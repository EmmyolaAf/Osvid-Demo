import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAuthenticatedUser,
  authErrorResponse,
  AuthError,
} from "@/lib/server/auth";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";
import { buildAuditLogRecord } from "@/lib/server/audit";
import { initiatePaystackRefund } from "@/lib/server/paystack";
import { Order } from "@/types/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
): Promise<NextResponse> {
  try {
    const resolvedParams = await Promise.resolve(params);
    const rawOrderId = resolvedParams.orderId;

    if (!rawOrderId || typeof rawOrderId !== "string") {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }

    const cleanOrderId = rawOrderId.trim();

    // 1. Authenticate caller
    const caller = await requireAuthenticatedUser(req);

    // 2. Authorize strictly Admin or Super Admin (Managers do NOT have refund authority)
    if (!caller.isSuperAdmin && !caller.isAdmin) {
      throw new AuthError(
        "Forbidden: Refund authority requires Admin or Super Admin privileges.",
        403
      );
    }

    // 3. Subscription guard for normal Admin (Super Admin recovery bypasses)
    await assertOperationalSubscription(caller);

    // 4. Validate input reason
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!reason || reason.length < 3 || reason.length > 500) {
      return NextResponse.json(
        { error: "Refund reason is required and must be between 3 and 500 characters." },
        { status: 400 }
      );
    }

    // 5. Atomic Claim in Firestore Transaction (Requirement 15)
    const nowIso = new Date().toISOString();
    const orderRef = adminDb.collection("orders").doc(cleanOrderId);

    const orderData = await adminDb.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`NOT_FOUND:Order not found: "${cleanOrderId}"`);
      }

      const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

      if (order.paymentStatus !== "paid") {
        throw new Error(
          `BAD_REQUEST:Cannot refund order in "${order.paymentStatus}" payment status. Order must be paid.`
        );
      }

      if (!order.paystackReference) {
        throw new Error(
          "BAD_REQUEST:Order is missing paystackReference required for refund processing."
        );
      }

      // Check current refund status for deduplication
      if (
        order.refundStatus === "processed" ||
        order.refundStatus === "pending" ||
        order.refundStatus === "processing"
      ) {
        throw new Error(
          `CONFLICT:Refund is already ${order.refundStatus} for order "${cleanOrderId}". Duplicate refund rejected.`
        );
      }

      if (order.refundStatus === "initiating") {
        const lastRequested = order.refundRequestedAt
          ? new Date(order.refundRequestedAt).getTime()
          : 0;
        // If initiated less than 2 minutes ago, block duplicate
        if (Date.now() - lastRequested < 2 * 60 * 1000) {
          throw new Error(
            `CONFLICT:Refund is currently being initiated for order "${cleanOrderId}". Please wait.`
          );
        }
      }

      // Set durable pre-call claim
      transaction.update(orderRef, {
        refundStatus: "initiating",
        refundReason: reason,
        refundRequestedAt: nowIso,
        refundRequestedBy: caller.email,
        updatedAt: nowIso,
      });

      return order;
    });

    const amountKobo = Math.round(orderData.totalAmount * 100);

    // 6. Call Paystack Refund API server-side
    let paystackRefundRes: any = null;
    try {
      paystackRefundRes = await initiatePaystackRefund({
        transactionReference: orderData.paystackReference!,
        amountKobo,
        merchantNote: reason,
      });
    } catch (paystackErr: any) {
      console.error("Paystack refund API error:", paystackErr);
      const failIso = new Date().toISOString();
      const failureReason =
        paystackErr.message || "Failed to process refund with payment gateway.";

      // Record failure state durably on order
      await orderRef.update({
        refundStatus: "failed",
        refundFailureReason: failureReason,
        updatedAt: failIso,
        statusHistory: [
          ...(orderData.statusHistory || []),
          {
            status: orderData.orderStatus,
            updatedAt: failIso,
            note: `Refund initiation failed: ${failureReason}`,
            updatedBy: caller.email,
            actorUid: caller.uid,
            actorEmail: caller.email,
            actorRole: caller.role,
            eventType: "status",
          },
        ],
      });

      return NextResponse.json({ error: failureReason }, { status: 502 });
    }

    // 7. Extract real provider refund values (Requirement 16: No synthetic fallback)
    const providerRefundId = paystackRefundRes?.data?.id
      ? String(paystackRefundRes.data.id)
      : undefined;
    const refundReference =
      paystackRefundRes?.data?.refund_reference ||
      paystackRefundRes?.data?.reference ||
      undefined;

    // 8. Update order document and append audit event
    // NOTE: Inventory is NOT restocked here. Inventory restock strictly awaits refund.processed webhook.
    const { docRef: auditRef, entry: auditEntry } = buildAuditLogRecord({
      actor: {
        uid: caller.uid,
        email: caller.email,
        role: caller.role,
      },
      action: "order_refund_requested",
      targetType: "order",
      targetId: cleanOrderId,
      summary: `Initiated Paystack refund for order ${cleanOrderId} (${reason})`,
      metadata: {
        orderId: cleanOrderId,
        amount: orderData.totalAmount,
        amountKobo,
        paystackReference: orderData.paystackReference,
        refundReference: refundReference || null,
        providerRefundId: providerRefundId || null,
        reason,
      },
    });

    const updatedHistory = [
      ...(orderData.statusHistory || []),
      {
        status: orderData.orderStatus,
        updatedAt: nowIso,
        note: `Refund requested by ${caller.email}: "${reason}"${
          refundReference ? ` (Ref: ${refundReference})` : ""
        }${providerRefundId ? ` (ID: ${providerRefundId})` : ""}`,
        updatedBy: caller.email,
        actorUid: caller.uid,
        actorEmail: caller.email,
        actorRole: caller.role,
        eventType: "status" as const,
      },
    ];

    const orderUpdate: Record<string, any> = {
      refundStatus: "pending",
      refundReason: reason,
      refundRequestedAt: nowIso,
      refundRequestedBy: caller.email,
      statusHistory: updatedHistory,
      updatedAt: nowIso,
    };
    if (refundReference) orderUpdate.refundReference = refundReference;
    if (providerRefundId) orderUpdate.providerRefundId = providerRefundId;

    const batch = adminDb.batch();
    batch.update(orderRef, orderUpdate);
    batch.set(auditRef, auditEntry);

    // Also update payment_transactions document if it exists
    if (orderData.paystackReference) {
      const payTxRef = adminDb.collection("payment_transactions").doc(orderData.paystackReference);
      const payTxSnap = await payTxRef.get();
      if (payTxSnap.exists) {
        const txUpdate: Record<string, any> = {
          refundStatus: "pending",
          updatedAtIso: nowIso,
        };
        if (refundReference) txUpdate.refundReference = refundReference;
        if (providerRefundId) txUpdate.providerRefundId = providerRefundId;
        batch.update(payTxRef, txUpdate);
      }
    }

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        message: "Refund initiated successfully with payment gateway.",
        refundReference: refundReference || null,
        providerRefundId: providerRefundId || null,
        refundStatus: "pending",
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    const msg = err?.message || "";
    if (msg.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: msg.replace("NOT_FOUND:", "") }, { status: 404 });
    }
    if (msg.startsWith("BAD_REQUEST:")) {
      return NextResponse.json({ error: msg.replace("BAD_REQUEST:", "") }, { status: 400 });
    }
    if (msg.startsWith("CONFLICT:")) {
      return NextResponse.json({ error: msg.replace("CONFLICT:", "") }, { status: 409 });
    }
    console.error("Unexpected error in /api/admin/orders/[orderId]/refund:", err);
    return NextResponse.json(
      { error: "Internal server error processing order refund." },
      { status: 500 }
    );
  }
}
