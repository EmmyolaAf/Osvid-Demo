// app/api/payment/verify/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  PaymentVerificationRequest,
  PaymentVerificationResponse,
} from "@/types/order-types";
import { Order, OrderStatus } from "@/types/auth";
import { generateOrderConfirmationEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Invalid content type. Expected application/json", 415);
    }

    let body: PaymentVerificationRequest;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Failed to parse request JSON:", e);
      return errorResponse("Malformed JSON payload", 400);
    }

    const { reference, email: userEmail, orderData } = body;

    if (!reference || !userEmail) {
      return errorResponse("Missing required payment reference or customer email");
    }

    // 1. Verify transaction with Paystack REST API
    let paystackData: any = null;
    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(
          errJson.message || `Paystack verification returned status ${verifyRes.status}`
        );
      }

      const verifyJson = await verifyRes.json();
      if (!verifyJson.status || verifyJson.data?.status !== "success") {
        throw new Error(verifyJson.data?.gateway_response || "Payment was not completed successfully.");
      }

      paystackData = verifyJson.data;
    } catch (paystackErr: any) {
      console.error("Paystack verification error:", paystackErr);
      return errorResponse(paystackErr.message || "Payment verification failed with payment gateway.");
    }

    const nowIso = new Date().toISOString();
    const verifiedAmountNaira = (paystackData.amount || 0) / 100;
    const resolvedOrderId =
      orderData?.orderId || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 2. Persist Order Record directly into Firestore `orders` collection
    const orderDocRef = adminDb.collection("orders").doc(resolvedOrderId);

    // Map items cleanly
    const orderItems = (orderData?.items || []).map((it: any, idx: number) => ({
      id: `item_${idx}_${Date.now()}`,
      productId: it.productId || it.id || it._id || "",
      productName: it.name || it.productName || "Chemical Product",
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      imageUrl: it.imageUrl || it.image || "/images/placeholder.webp",
      unit: it.unit || it.variant || "unit",
    }));

    const formattedShippingAddress = {
      fullName: orderData?.customerInfo?.name || orderData?.shippingAddress?.streetAddress || "Valued Customer",
      phone: orderData?.customerInfo?.phone || "",
      email: userEmail.toLowerCase(),
      address: orderData?.shippingAddress?.streetAddress || "Customer Address",
      city: orderData?.shippingAddress?.city || "Lagos",
      state: orderData?.shippingAddress?.state || "Lagos",
      postalCode: orderData?.shippingAddress?.postalCode || "",
    };

    const newOrderRecord: Order = {
      id: resolvedOrderId,
      orderNumber: resolvedOrderId,
      userId: (orderData as any)?.userId || undefined,
      customerName: orderData?.customerInfo?.name || userEmail.split("@")[0],
      customerEmail: userEmail.toLowerCase(),
      customerPhone: orderData?.customerInfo?.phone || "",
      deliveryMethod: orderData?.deliveryMethod === "pickup" ? "pickup" : "delivery",
      shippingAddress: formattedShippingAddress,
      items: orderItems,
      subtotal: Number(orderData?.subtotal) || verifiedAmountNaira,
      shippingFee: Number(orderData?.shippingFee) || 0,
      totalAmount: verifiedAmountNaira,
      paymentStatus: "paid",
      orderStatus: "pending" as OrderStatus,
      paystackReference: reference,
      statusHistory: [
        {
          status: "pending" as OrderStatus,
          updatedAt: nowIso,
          note: `Payment verified via Paystack (Ref: ${reference})`,
          updatedBy: "System (Paystack Webhook)",
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Save order to Firestore
    await orderDocRef.set(newOrderRecord);

    // 3. Automatically decrement product stockQuantity in Firestore
    try {
      const batch = adminDb.batch();
      for (const item of orderItems) {
        if (item.productId) {
          const productRef = adminDb.collection("products").doc(item.productId);
          const productDoc = await productRef.get();
          if (productDoc.exists) {
            batch.update(productRef, {
              stockQuantity: FieldValue.increment(-item.quantity),
              updatedAt: nowIso,
            });
          }
        }
      }
      await batch.commit();
    } catch (stockErr) {
      console.warn("Could not decrement product stock for order:", resolvedOrderId, stockErr);
    }

    // 4. Update Customer Profile Metrics if registered
    try {
      const usersQuery = await adminDb
        .collection("users")
        .where("email", "==", userEmail.toLowerCase())
        .limit(1)
        .get();

      if (!usersQuery.empty) {
        const userDoc = usersQuery.docs[0];
        await userDoc.ref.update({
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(verifiedAmountNaira),
          lastOrderDate: nowIso,
        });
      }
    } catch (userErr) {
      console.warn("Could not update user stats for order:", userErr);
    }

    // 5. Send Transactional Receipt Email via Resend
    let emailSuccess = false;
    if (resend && process.env.FROM_EMAIL) {
      try {
        const emailHtml = generateOrderConfirmationEmail({
          reference,
          email: userEmail,
          orderData: {
            orderId: resolvedOrderId,
            items: orderItems.map((item) => ({
              name: item.productName,
              quantity: item.quantity,
              price: item.price,
              variant: item.unit,
              imageUrl: item.imageUrl,
            })),
            total: verifiedAmountNaira,
            subtotal: newOrderRecord.subtotal,
            shippingFee: newOrderRecord.shippingFee,
            currency: "NGN",
            deliveryMethod: orderData?.deliveryMethod === "pickup" ? "pickup" : "shipping",
            shippingAddress: orderData?.shippingAddress,
            customerInfo: orderData?.customerInfo,
          },
          paymentData: paystackData,
        });

        const emailResponse = await resend.emails.send({
          from: `OSVID CHEMICALS LTD. <${process.env.FROM_EMAIL}>`,
          to: userEmail,
          bcc: process.env.BCC_EMAIL ? [process.env.BCC_EMAIL] : "osvidbusinesses@gmail.com",
          subject: `Order Confirmation - #${resolvedOrderId}`,
          html: emailHtml,
        });

        emailSuccess = Boolean(emailResponse?.data);
      } catch (emailErr) {
        console.error("Email dispatch failed:", emailErr);
      }
    }

    // Return strict success response
    return NextResponse.json(
      {
        success: true,
        payment: true,
        emailSent: emailSuccess,
        data: {
          reference,
          amount: verifiedAmountNaira,
          currency: "NGN",
          customer: paystackData.customer,
          orderId: resolvedOrderId,
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
    return errorResponse(err?.message || "Internal server error during payment verification.", 500);
  }
}
