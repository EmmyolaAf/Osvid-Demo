// app/api/verify-payment/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-static";
import {
  PaymentVerificationRequest,
  PaymentVerificationResponse,
} from "@/types/order-types";
import { generateOrderConfirmationEmail } from "@/lib/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function for consistent error responses
const errorResponse = (message: string, status: number = 400) => {
  return NextResponse.json(
    {
      success: false,
      payment: false,
      emailSent: false,
      error: message,
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};

export async function POST(
  req: Request
): Promise<NextResponse<PaymentVerificationResponse>> {
  try {
    // Validate request content type
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Invalid content type", 415);
    }

    let body: PaymentVerificationRequest;
    try {
      body = await req.json();
    } catch (e) {
      console.error(e);
      return errorResponse("Invalid JSON payload", 400);
    }

    const { reference, email: userEmail, orderData } = body;

    // Validate required fields
    if (!reference || !userEmail) {
      return errorResponse("Missing reference or email");
    }

    // Verify payment with Paystack
    let paystackResponse;
    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          reference
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Paystack API error: ${verifyRes.status}`
        );
      }

      paystackResponse = await verifyRes.json();
    } catch (error) {
      console.error("Paystack verification error:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Payment verification failed"
      );
    }

    // Check if payment was successful
    if (!paystackResponse.data || paystackResponse.data.status !== "success") {
      return errorResponse(
        paystackResponse.message || "Payment not successful"
      );
    }

    // Send confirmation email
    let emailSuccess = false;
    try {
      const emailHtml = generateOrderConfirmationEmail({
        reference,
        email: userEmail,
        orderData,
        paymentData: paystackResponse.data,
      });

      const emailResponse = await resend.emails.send({
        from: `Osvid Chemicals Ltd. <${process.env.FROM_EMAIL}>`,
        to: userEmail,
        bcc: process.env.BCC_EMAIL
          ? [process.env.BCC_EMAIL]
          : "osvidbusinesses@gmail.com",
        subject: `Order Confirmation - ${orderData?.orderId || reference}`,
        html: emailHtml,
      });

      emailSuccess = Boolean(emailResponse?.data);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Continue with response even if email fails
    }

    // Successful response
    return NextResponse.json(
      {
        success: true,
        payment: true,
        emailSent: emailSuccess,
        data: {
          reference: paystackResponse.data.reference,
          amount: paystackResponse.data.amount / 100,
          currency: paystackResponse.data.currency,
          customer: paystackResponse.data.customer,
          orderId: orderData?.orderId,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Unexpected error in verify-payment:", err);
    return errorResponse("Internal server error", 500);
  }
}
