import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAuthenticatedUser,
  authErrorResponse,
  AuthError,
} from "@/lib/server/auth";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";
import { buildAuditLogRecord } from "@/lib/server/audit";
import { initiatePaystackRefund } from "@/lib/server/paystack";
import {
  canAdvanceRefundStatus,
  getDominantRefundStatus,
} from "@/lib/server/payment-finalizer";
import { Order } from "@/types/auth";
import { PaymentTransactionRecord } from "@/types/commerce";

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

    // 5. Atomic Claim in Firestore Transaction (Packet 4E Requirement 4: Consistent across Order + Payment Record)
    const nowIso = new Date().toISOString();
    const orderRef = adminDb.collection("orders").doc(cleanOrderId);

    const orderData = await adminDb.runTransaction(async (transaction) => {
      // 1. Read order document
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

      // Check current refund status on order for deduplication
      if (
        order.refundStatus === "processed" ||
        order.refundStatus === "pending" ||
        order.refundStatus === "processing"
      ) {
        throw new Error(
          `CONFLICT:Refund is already ${order.refundStatus} for order "${cleanOrderId}". Duplicate refund rejected.`
        );
      }

      if (
        order.refundStatus === "initiating" ||
        order.refundStatus === "needs_attention"
      ) {
        throw new Error(
          `CONFLICT:Refund is currently in ${order.refundStatus} state for order "${cleanOrderId}". Refund reconciliation required.`
        );
      }

      // 2. Read payment_transactions document if present BEFORE any writes
      const payTxRef = adminDb
        .collection("payment_transactions")
        .doc(order.paystackReference);
      const payTxSnap = await transaction.get(payTxRef);

      if (payTxSnap.exists) {
        const payTx = payTxSnap.data() as PaymentTransactionRecord;
        if (
          payTx.refundStatus === "processed" ||
          payTx.refundStatus === "pending" ||
          payTx.refundStatus === "processing"
        ) {
          throw new Error(
            `CONFLICT:Refund is already ${payTx.refundStatus} for transaction "${order.paystackReference}". Duplicate refund rejected.`
          );
        }

        if (
          payTx.refundStatus === "initiating" ||
          payTx.refundStatus === "needs_attention"
        ) {
          throw new Error(
            `CONFLICT:Refund is currently in ${payTx.refundStatus} state for transaction "${order.paystackReference}". Refund reconciliation required.`
          );
        }
      }

      // ALL READS MUST PRECEDE WRITES.
      // Set durable pre-call claim on order
      transaction.update(orderRef, {
        refundStatus: "initiating",
        refundReason: reason,
        refundRequestedAt: nowIso,
        refundRequestedBy: caller.email,
        updatedAt: nowIso,
      });

      // Apply claim consistently to payment transaction if it exists
      if (payTxSnap.exists) {
        transaction.update(payTxRef, {
          refundStatus: "initiating",
          refundInitiatingAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: nowIso,
        });
      }

      return order;
    });

    const amountKobo = Math.round(orderData.totalAmount * 100);

    // 6. Call Paystack Refund API server-side
    let outcomeType: "accepted" | "definitive_rejection" | "ambiguous_error" = "accepted";
    let failureReason = "";
    let providerRefundId: string | undefined = undefined;
    let refundReference: string | undefined = undefined;

    try {
      const paystackRefundRes = await initiatePaystackRefund({
        transactionReference: orderData.paystackReference!,
        amountKobo,
        merchantNote: reason,
      });

      if (paystackRefundRes.status === true) {
        outcomeType = "accepted";
        providerRefundId = paystackRefundRes?.data?.id
          ? String(paystackRefundRes.data.id)
          : undefined;
        refundReference =
          paystackRefundRes?.data?.refund_reference ||
          (paystackRefundRes?.data?.reference &&
          paystackRefundRes?.data?.reference !== orderData.paystackReference
            ? paystackRefundRes?.data?.reference
            : undefined);
      } else {
        outcomeType = "definitive_rejection";
        failureReason = paystackRefundRes.message || "Provider declined refund request.";
      }
    } catch (paystackErr: any) {
      console.error("Paystack refund API error:", paystackErr);
      failureReason =
        paystackErr?.message || "Failed to process refund with payment gateway.";
      const isDefinitive = Boolean(paystackErr?.isDefinitive);
      if (isDefinitive) {
        outcomeType = "definitive_rejection";
      } else {
        outcomeType = "ambiguous_error";
      }
    }

    // 7. Transactional post-provider persistence (Packet 4E Requirements 3, 6, 7)
    const postIso = new Date().toISOString();
    const payTxRef = orderData.paystackReference
      ? adminDb.collection("payment_transactions").doc(orderData.paystackReference)
      : null;

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
        outcomeType,
      },
    });

    let persistResult: { authoritativeStatus: string; statePreserved: boolean };
    try {
      persistResult = await adminDb.runTransaction(async (transaction) => {
        // 1. Transactionally read order document
        const curOrderSnap = await transaction.get(orderRef);
        if (!curOrderSnap.exists) {
          throw new Error(`NOT_FOUND:Order disappeared during refund: "${cleanOrderId}"`);
        }
        const curOrder = curOrderSnap.data() as Order;

        // 2. Transactionally read payment_transactions document if present
        let curPayTxSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        let curPayTx: PaymentTransactionRecord | null = null;
        if (payTxRef) {
          curPayTxSnap = await transaction.get(payTxRef);
          if (curPayTxSnap.exists) {
            curPayTx = curPayTxSnap.data() as PaymentTransactionRecord;
          }
        }

        // ALL READS ARE COMPLETE.
        // Packet 4F Requirement 7: Consider BOTH transactionally-read states
        const effectiveOrderStatus =
          curOrder.paymentStatus === "refunded" || curOrder.refundStatus === "processed"
            ? "processed"
            : (curOrder.refundStatus || "none");

        const effectiveTxStatus = curPayTx
          ? curPayTx.status === "refunded" || curPayTx.refundStatus === "processed"
            ? "processed"
            : (curPayTx.refundStatus || "none")
          : null;

        const dominantStatus = getDominantRefundStatus(
          effectiveOrderStatus,
          effectiveTxStatus
        );

        // If dominant refund state across both records is still "initiating", HTTP request owns transition
        if (dominantStatus === "initiating") {
          if (outcomeType === "accepted") {
            const updatedHistory = [
              ...(curOrder.statusHistory || []),
              {
                status: curOrder.orderStatus,
                updatedAt: postIso,
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
              refundRequestedAt: postIso,
              refundRequestedBy: caller.email,
              statusHistory: updatedHistory,
              updatedAt: postIso,
            };
            if (refundReference) orderUpdate.refundReference = refundReference;
            if (providerRefundId) orderUpdate.providerRefundId = providerRefundId;

            transaction.update(orderRef, orderUpdate);
            transaction.set(auditRef, auditEntry);

            if (curPayTxSnap?.exists && payTxRef) {
              const txUpdate: Record<string, any> = {
                refundStatus: "pending",
                updatedAt: FieldValue.serverTimestamp(),
                updatedAtIso: postIso,
              };
              if (refundReference) txUpdate.refundReference = refundReference;
              if (providerRefundId) txUpdate.providerRefundId = providerRefundId;
              transaction.update(payTxRef, txUpdate);
            }

            return {
              authoritativeStatus: "pending",
              statePreserved: false,
            };
          } else if (outcomeType === "definitive_rejection") {
            const updatedHistory = [
              ...(curOrder.statusHistory || []),
              {
                status: curOrder.orderStatus,
                updatedAt: postIso,
                note: `Refund initiation rejected by provider: ${failureReason}`,
                updatedBy: caller.email,
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: caller.role,
                eventType: "status" as const,
              },
            ];

            transaction.update(orderRef, {
              refundStatus: "failed",
              refundFailureReason: failureReason,
              statusHistory: updatedHistory,
              updatedAt: postIso,
            });

            if (curPayTxSnap?.exists && payTxRef) {
              transaction.update(payTxRef, {
                refundStatus: "failed",
                refundFailureReason: failureReason,
                needsRefund: true,
                updatedAt: FieldValue.serverTimestamp(),
                updatedAtIso: postIso,
              });
            }

            return {
              authoritativeStatus: "failed",
              statePreserved: false,
            };
          } else {
            // ambiguous_error
            const updatedHistory = [
              ...(curOrder.statusHistory || []),
              {
                status: curOrder.orderStatus,
                updatedAt: postIso,
                note: `Refund initiation transport error: ${failureReason}. Marked needs_attention for reconciliation.`,
                updatedBy: caller.email,
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: caller.role,
                eventType: "status" as const,
              },
            ];

            transaction.update(orderRef, {
              refundStatus: "needs_attention",
              refundFailureReason: `Ambiguous provider outcome / transport error: ${failureReason}. Refund reconciliation required.`,
              statusHistory: updatedHistory,
              updatedAt: postIso,
            });

            if (curPayTxSnap?.exists && payTxRef) {
              transaction.update(payTxRef, {
                refundStatus: "needs_attention",
                refundFailureReason: `Ambiguous provider outcome / transport error: ${failureReason}. Refund reconciliation required.`,
                updatedAt: FieldValue.serverTimestamp(),
                updatedAtIso: postIso,
              });
            }

            return {
              authoritativeStatus: "needs_attention",
              statePreserved: false,
            };
          }
        } else {
          // At least one record already contains a more advanced provider-established state!
          // DO NOT overwrite that state on the other record with pending, failed, or needs_attention.
          // Reconcile safely toward the more advanced dominant valid state.
          const orderMergeUpdate: Record<string, any> = {};
          if (
            effectiveOrderStatus !== dominantStatus &&
            canAdvanceRefundStatus(effectiveOrderStatus, dominantStatus)
          ) {
            orderMergeUpdate.refundStatus = dominantStatus;
            orderMergeUpdate.statusHistory = [
              ...(curOrder.statusHistory || []),
              {
                status: curOrder.orderStatus,
                updatedAt: postIso,
                note: `Refund state reconciled to "${dominantStatus}"`,
                updatedBy: "System (Admin Refund Reconciler)",
                eventType: "status",
              },
            ];
          }
          if (providerRefundId && !curOrder.providerRefundId) {
            orderMergeUpdate.providerRefundId = providerRefundId;
          }
          if (refundReference && !curOrder.refundReference) {
            orderMergeUpdate.refundReference = refundReference;
          }
          if (Object.keys(orderMergeUpdate).length > 0) {
            orderMergeUpdate.updatedAt = postIso;
            transaction.update(orderRef, orderMergeUpdate);
          }

          if (curPayTxSnap?.exists && curPayTx && payTxRef) {
            const txMergeUpdate: Record<string, any> = {};
            if (
              effectiveTxStatus !== dominantStatus &&
              canAdvanceRefundStatus(effectiveTxStatus, dominantStatus)
            ) {
              txMergeUpdate.refundStatus = dominantStatus;
            }
            if (providerRefundId && !curPayTx.providerRefundId) {
              txMergeUpdate.providerRefundId = providerRefundId;
            }
            if (refundReference && !curPayTx.refundReference) {
              txMergeUpdate.refundReference = refundReference;
            }
            if (Object.keys(txMergeUpdate).length > 0) {
              txMergeUpdate.updatedAt = FieldValue.serverTimestamp();
              txMergeUpdate.updatedAtIso = postIso;
              transaction.update(payTxRef, txMergeUpdate);
            }
          }

          return {
            authoritativeStatus: dominantStatus,
            statePreserved: true,
          };
        }
      });
    } catch (persistErr: any) {
      console.error(
        "CRITICAL: Error during post-provider refund persistence:",
        persistErr
      );
      return NextResponse.json(
        {
          error:
            "Refund accepted by payment gateway, but local update failed. Refund reconciliation required.",
          reconciliationRequired: true,
        },
        { status: 500 }
      );
    }

    if (
      persistResult.authoritativeStatus === "processed" ||
      persistResult.authoritativeStatus === "processing" ||
      persistResult.authoritativeStatus === "pending"
    ) {
      return NextResponse.json(
        {
          success: true,
          message: persistResult.statePreserved
            ? `Refund has already advanced to "${persistResult.authoritativeStatus}".`
            : "Refund initiated successfully with payment gateway.",
          refundReference: refundReference || null,
          providerRefundId: providerRefundId || null,
          refundStatus: persistResult.authoritativeStatus,
        },
        { status: 200 }
      );
    }

    if (persistResult.authoritativeStatus === "needs_attention") {
      return NextResponse.json(
        {
          error:
            "Transport error communicating with payment provider. State preserved for reconciliation.",
          reconciliationRequired: true,
          refundStatus: "needs_attention",
        },
        { status: 504 }
      );
    }

    if (persistResult.authoritativeStatus === "failed") {
      return NextResponse.json(
        {
          error: failureReason || "Refund initiation rejected by provider.",
          refundStatus: "failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        refundStatus: persistResult.authoritativeStatus,
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
