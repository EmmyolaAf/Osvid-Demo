import { NextResponse } from "next/server";
import { finalizeSuccessfulPayment } from "@/lib/server/payment-finalizer";
import { PaymentVerificationResponse } from "@/types/order-types";
import { logger, getOrGenerateRequestId } from "@/lib/server/logger";

export const dynamic = "force-dynamic";

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
  const requestId = getOrGenerateRequestId(req);
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Invalid content type. Expected application/json", 415);
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      logger.warn("Failed to parse request JSON in /api/payment/verify", {
        requestId,
        operation: "payment_verify",
        outcome: "failure",
      });
      return errorResponse("Malformed JSON payload", 400);
    }

    const { reference, checkoutSessionId } = body || {};

    if (!reference) {
      return errorResponse("Missing required payment reference");
    }

    logger.info("Verifying payment transaction", {
      requestId,
      operation: "payment_verify",
      paystackReference: reference,
      checkoutSessionId,
    });

    // Call the shared, authoritative payment finalizer
    const result = await finalizeSuccessfulPayment(reference, {
      expectedCheckoutSessionId: checkoutSessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          payment: false,
          emailSent: false,
          error: result.message || "Payment verification failed or stock was unavailable.",
        },
        { status: result.anomaly ? 409 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        payment: true,
        emailSent: result.emailSent,
        data: {
          reference,
          amount: result.amount ?? 0,
          currency: result.currency || "NGN",
          orderId: result.orderId,
        },
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Critical error in /api/payment/verify:", err);
    return errorResponse(
      err?.message || "Internal server error during payment verification.",
      500
    );
  }
}
