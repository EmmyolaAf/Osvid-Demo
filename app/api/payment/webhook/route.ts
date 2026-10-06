import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/paystack";
import {
  finalizeSuccessfulPayment,
  finalizeProcessedRefund,
  updateRefundStatus,
} from "@/lib/server/payment-finalizer";

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

    // 4. Handle events with retry-safe error propagation (Requirement 17 & 19)
    switch (eventType) {
      case "charge.success": {
        const reference = data?.reference;
        if (!reference) {
          return NextResponse.json(
            { error: "Missing reference in charge.success event" },
            { status: 400 }
          );
        }
        try {
          await finalizeSuccessfulPayment(reference);
        } catch (finErr: any) {
          console.error(
            `Error finalizing payment for reference "${reference}" via webhook:`,
            finErr
          );
          // Return non-2xx so Paystack will retry delivery
          return NextResponse.json(
            { error: finErr?.message || "Payment finalization failed" },
            { status: 500 }
          );
        }
        break;
      }

      case "refund.processed": {
        try {
          await finalizeProcessedRefund(data);
        } catch (refErr: any) {
          console.error("Error finalizing processed refund via webhook:", refErr);
          return NextResponse.json(
            { error: refErr?.message || "Refund finalization failed" },
            { status: 500 }
          );
        }
        break;
      }

      case "refund.pending": {
        try {
          await updateRefundStatus("pending", data);
        } catch (err: any) {
          console.error("Error updating refund.pending via webhook:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to update refund status" },
            { status: 500 }
          );
        }
        break;
      }

      case "refund.processing": {
        try {
          await updateRefundStatus("processing", data);
        } catch (err: any) {
          console.error("Error updating refund.processing via webhook:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to update refund status" },
            { status: 500 }
          );
        }
        break;
      }

      case "refund.needs-attention": {
        try {
          await updateRefundStatus("needs_attention", data);
        } catch (err: any) {
          console.error("Error updating refund.needs-attention via webhook:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to update refund status" },
            { status: 500 }
          );
        }
        break;
      }

      case "refund.failed": {
        try {
          await updateRefundStatus("failed", data);
        } catch (err: any) {
          console.error("Error updating refund.failed via webhook:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to update refund status" },
            { status: 500 }
          );
        }
        break;
      }

      default:
        // Safely acknowledge unhandled Paystack events
        break;
    }

    // Acknowledge successfully processed or replayed webhook
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in Paystack webhook handler:", err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}

