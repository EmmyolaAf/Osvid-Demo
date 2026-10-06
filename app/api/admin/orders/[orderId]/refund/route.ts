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

    // 5. Load authoritative order
    const orderRef = adminDb.collection("orders").doc(cleanOrderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { error: `Order not found: "${cleanOrderId}"` },
        { status: 404 }
      );
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    if (order.paymentStatus !== "paid") {
      return NextResponse.json(
        {
          error: `Cannot refund order in "${order.paymentStatus}" payment status. Order must be paid.`,
        },
        { status: 400 }
      );
    }

    if (
      order.refundStatus === "processed" ||
      order.refundStatus === "pending" ||
      order.refundStatus === "processing"
    ) {
      return NextResponse.json(
        {
          error: `Refund is already ${order.refundStatus} for order "${cleanOrderId}". Duplicate refund rejected.`,
        },
        { status: 409 }
      );
    }

    if (!order.paystackReference) {
      return NextResponse.json(
        { error: "Order is missing paystackReference required for refund processing." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const amountKobo = Math.round(order.totalAmount * 100);

    // 6. Call Paystack Refund API server-side
    let paystackRefundRes: any = null;
    try {
      paystackRefundRes = await initiatePaystackRefund({
        transactionReference: order.paystackReference,
        amountKobo,
        merchantNote: reason,
      });
    } catch (paystackErr: any) {
      console.error("Paystack refund API error:", paystackErr);
      return NextResponse.json(
        { error: paystackErr.message || "Failed to process refund with payment gateway." },
        { status: 502 }
      );
    }

    const refundReference =
      paystackRefundRes.data?.reference ||
      paystackRefundRes.data?.refund_reference ||
      `REF-${Date.now()}`;

    // 7. Update order document transactionally and append audit event
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
        amount: order.totalAmount,
        amountKobo,
        paystackReference: order.paystackReference,
        refundReference,
        reason,
      },
    });

    const updatedHistory = [
      ...(order.statusHistory || []),
      {
        status: order.orderStatus,
        updatedAt: nowIso,
        note: `Refund requested by ${caller.email}: "${reason}" (Ref: ${refundReference})`,
        updatedBy: caller.email,
        actorUid: caller.uid,
        actorEmail: caller.email,
        actorRole: caller.role,
        eventType: "status" as const,
      },
    ];

    const batch = adminDb.batch();
    batch.update(orderRef, {
      refundStatus: "pending",
      refundReason: reason,
      refundReference,
      refundRequestedAt: nowIso,
      refundRequestedBy: caller.email,
      statusHistory: updatedHistory,
      updatedAt: nowIso,
    });
    batch.set(auditRef, auditEntry);

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        message: "Refund initiated successfully with payment gateway.",
        refundReference,
        refundStatus: "pending",
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    console.error("Unexpected error in /api/admin/orders/[orderId]/refund:", err);
    return NextResponse.json(
      { error: "Internal server error processing order refund." },
      { status: 500 }
    );
  }
}
