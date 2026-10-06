import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/paystack";
import {
  finalizeSuccessfulPayment,
  finalizeProcessedRefund,
} from "@/lib/server/payment-finalizer";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Read raw text body required for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // 2. Cryptographic signature check using constant-time HMAC SHA512
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("Invalid Paystack webhook signature rejected.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse JSON event payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed event JSON" }, { status: 400 });
    }

    const eventType = event?.event;
    const data = event?.data;

    // 4. Handle events
    switch (eventType) {
      case "charge.success": {
        const reference = data?.reference;
        if (reference) {
          try {
            await finalizeSuccessfulPayment(reference);
          } catch (finErr) {
            console.error(
              `Error finalizing payment for reference "${reference}" via webhook:`,
              finErr
            );
          }
        }
        break;
      }

      case "refund.processed": {
        try {
          await finalizeProcessedRefund(data);
        } catch (refErr) {
          console.error("Error finalizing processed refund via webhook:", refErr);
        }
        break;
      }

      case "refund.failed": {
        const transactionRef =
          data?.transaction_reference || data?.transaction?.reference;
        if (transactionRef) {
          const ordersSnap = await adminDb
            .collection("orders")
            .where("paystackReference", "==", transactionRef)
            .limit(1)
            .get();

          if (!ordersSnap.empty) {
            await ordersSnap.docs[0].ref.update({
              refundStatus: "failed",
              refundFailureReason: data?.status || "Paystack refund failed.",
              updatedAt: new Date().toISOString(),
            });
          }
        }
        break;
      }

      default:
        // Safely acknowledge unhandled Paystack events
        break;
    }

    // Always respond 200 to acknowledge webhook receipt
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in Paystack webhook handler:", err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
