import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/paystack";
import {
  finalizeSuccessfulPayment,
  finalizeProcessedRefund,
  updateRefundStatus,
} from "@/lib/server/payment-finalizer";
import { logger, getOrGenerateRequestId } from "@/lib/server/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getOrGenerateRequestId(req);
  try {
    // 1. Read raw text body required for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // 2. Cryptographic signature check using constant-time HMAC SHA512
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("Invalid Paystack webhook signature rejected", {
        requestId,
        operation: "webhook",
        outcome: "failure",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse JSON event payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.warn("Malformed webhook JSON payload", {
        requestId,
        operation: "webhook",
        outcome: "failure",
      });
      return NextResponse.json({ error: "Malformed event JSON" }, { status: 400 });
    }

    const eventType = event?.event;
    const data = event?.data;

    logger.info(`Received Paystack webhook event: ${eventType}`, {
      requestId,
      operation: "webhook",
      paystackReference: data?.reference,
    });

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
          logger.info("Successfully finalized payment via webhook", {
            requestId,
            operation: "payment_finalization",
            paystackReference: reference,
            outcome: "success",
          });
        } catch (finErr: any) {
          logger.error(
            `Error finalizing payment for reference "${reference}" via webhook`,
            {
              requestId,
              operation: "payment_finalization",
              paystackReference: reference,
              outcome: "failure",
            },
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
          const outcome = await finalizeProcessedRefund(data);
          if (!outcome.success) {
            console.error(
              "Refund processed reconciliation failed or transaction not found:",
              data
            );
            return NextResponse.json(
              { error: "Refund reconciliation failed or transaction not found" },
              { status: 500 }
            );
          }
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
          const outcome = await updateRefundStatus("pending", data);
          if (!outcome.matched || !outcome.success) {
            console.error(
              "Refund status update (pending) failed or transaction not found:",
              data
            );
            return NextResponse.json(
              { error: "Refund status update failed or matching transaction not found" },
              { status: 500 }
            );
          }
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
          const outcome = await updateRefundStatus("processing", data);
          if (!outcome.matched || !outcome.success) {
            console.error(
              "Refund status update (processing) failed or transaction not found:",
              data
            );
            return NextResponse.json(
              { error: "Refund status update failed or matching transaction not found" },
              { status: 500 }
            );
          }
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
          const outcome = await updateRefundStatus("needs_attention", data);
          if (!outcome.matched || !outcome.success) {
            console.error(
              "Refund status update (needs-attention) failed or transaction not found:",
              data
            );
            return NextResponse.json(
              { error: "Refund status update failed or matching transaction not found" },
              { status: 500 }
            );
          }
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
          const outcome = await updateRefundStatus("failed", data);
          if (!outcome.matched || !outcome.success) {
            console.error(
              "Refund status update (failed) failed or transaction not found:",
              data
            );
            return NextResponse.json(
              { error: "Refund status update failed or matching transaction not found" },
              { status: 500 }
            );
          }
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

