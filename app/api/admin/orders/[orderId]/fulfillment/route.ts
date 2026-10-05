import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAuthenticatedUser,
  hasPermission,
  authErrorResponse,
  AuthError,
} from "@/lib/server/auth";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";
import { buildAuditLogRecord } from "@/lib/server/audit";
import { Order, OrderStatus, OrderHistoryEvent } from "@/types/auth";

const ALLOWED_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/**
 * Evaluates whether a requested order status transition is valid according to
 * the explicit logistics state machine (Packet 3).
 */
export function validateOrderStatusTransition(
  currentStatus: OrderStatus,
  requestedStatus: OrderStatus,
  deliveryMethod: "pickup" | "delivery"
): { valid: boolean; reason?: string } {
  if (currentStatus === requestedStatus) {
    return { valid: true };
  }

  if (currentStatus === "delivered") {
    return { valid: false, reason: "Order is already delivered. Terminal state cannot be altered." };
  }

  if (currentStatus === "cancelled") {
    return { valid: false, reason: "Order is cancelled. Terminal state cannot be altered." };
  }

  if (deliveryMethod === "pickup") {
    // Pickup workflow: pending -> processing -> delivered; cancellation from pending or processing
    if (currentStatus === "pending") {
      if (requestedStatus === "processing" || requestedStatus === "cancelled") {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Pickup order in 'pending' status can only transition to 'processing' or 'cancelled'. Got '${requestedStatus}'.`,
      };
    }

    if (currentStatus === "processing") {
      if (requestedStatus === "delivered" || requestedStatus === "cancelled") {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Pickup order in 'processing' status can only transition to 'delivered' or 'cancelled'. Got '${requestedStatus}'.`,
      };
    }

    if (requestedStatus === "shipped") {
      return {
        valid: false,
        reason: "Pickup orders do not use 'shipped' status. Complete fulfillment by setting status to 'delivered'.",
      };
    }
  } else {
    // Delivery workflow: pending -> processing -> shipped -> delivered; cancellation from pending or processing
    if (currentStatus === "pending") {
      if (requestedStatus === "processing" || requestedStatus === "cancelled") {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Delivery order in 'pending' status can only transition to 'processing' or 'cancelled'. Got '${requestedStatus}'.`,
      };
    }

    if (currentStatus === "processing") {
      if (requestedStatus === "shipped" || requestedStatus === "cancelled") {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Delivery order in 'processing' status can only transition to 'shipped' or 'cancelled'. Got '${requestedStatus}'.`,
      };
    }

    if (currentStatus === "shipped") {
      if (requestedStatus === "delivered") {
        return { valid: true };
      }
      if (requestedStatus === "cancelled") {
        return {
          valid: false,
          reason: "Order has already been shipped. In-transit orders cannot be cancelled directly through logistics workflow.",
        };
      }
      return {
        valid: false,
        reason: `Shipped order can only transition to 'delivered'. Got '${requestedStatus}'.`,
      };
    }
  }

  return {
    valid: false,
    reason: `Invalid status transition from '${currentStatus}' to '${requestedStatus}'.`,
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }

    const cleanOrderId = orderId.trim();

    // 1. Authorize caller: Super Admin, Admin, or Manager with canManageOrders
    const caller = await requireAuthenticatedUser(req);
    if (
      !caller.isSuperAdmin &&
      !caller.isAdmin &&
      !hasPermission(caller, "canManageOrders")
    ) {
      throw new AuthError(
        "Forbidden: Insufficient privileges to update order fulfillment. Requires order management authority.",
        403
      );
    }

    // 2. Operational subscription guard
    await assertOperationalSubscription(caller);

    // 3. Parse input body
    const body = await req.json().catch(() => ({}));
    const { status, trackingNumber, note } = body;

    if (status !== undefined) {
      if (!ALLOWED_ORDER_STATUSES.includes(status as OrderStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status '${status}'. Must be one of [${ALLOWED_ORDER_STATUSES.join(", ")}]`,
          },
          { status: 400 }
        );
      }
    }

    if (trackingNumber !== undefined && typeof trackingNumber === "string" && trackingNumber.length > 200) {
      return NextResponse.json(
        { error: "trackingNumber exceeds maximum length of 200 characters." },
        { status: 400 }
      );
    }

    if (note !== undefined && typeof note === "string" && note.length > 1000) {
      return NextResponse.json(
        { error: "note exceeds maximum length of 1000 characters." },
        { status: 400 }
      );
    }

    // 4. Load and update order transactionally with audit logging
    const orderRef = adminDb.collection("orders").doc(cleanOrderId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new AuthError(`Order not found: "${cleanOrderId}"`, 404);
      }

      const currentOrder = orderSnap.data() as Order;
      const currentStatus = currentOrder.orderStatus || "pending";
      const deliveryMethod = currentOrder.deliveryMethod || "delivery";
      const requestedStatus = status ? (status as OrderStatus) : currentStatus;

      // Validate status transition against state machine
      const transitionValidation = validateOrderStatusTransition(
        currentStatus,
        requestedStatus,
        deliveryMethod
      );

      if (!transitionValidation.valid) {
        throw new AuthError(
          transitionValidation.reason || `Invalid transition from ${currentStatus} to ${requestedStatus}`,
          400
        );
      }

      // If transitioning to shipped in delivery method, tracking reference is required
      const cleanTracking =
        trackingNumber !== undefined
          ? String(trackingNumber).trim()
          : (currentOrder.trackingNumber || "");

      if (deliveryMethod === "delivery" && requestedStatus === "shipped") {
        if (!cleanTracking || cleanTracking.length === 0) {
          throw new AuthError(
            "A non-empty tracking/dispatch number is required when transitioning a delivery order to 'shipped'.",
            400
          );
        }
      }

      const statusChanged = requestedStatus !== currentStatus;
      const trackingChanged =
        trackingNumber !== undefined && cleanTracking !== (currentOrder.trackingNumber || "");
      const cleanNote = note && typeof note === "string" ? note.trim() : "";

      // If nothing changed, avoid creating duplicate history entries
      if (!statusChanged && !trackingChanged && !cleanNote) {
        return {
          order: { ...currentOrder, id: cleanOrderId },
          changed: false,
          status: currentStatus,
        };
      }

      const nowIso = new Date().toISOString();
      const eventType: "status" | "tracking" | "note" | "fulfillment" =
        statusChanged ? "status" : trackingChanged ? "tracking" : "note";

      const historyEvent: OrderHistoryEvent = {
        status: requestedStatus,
        updatedAt: nowIso,
        updatedBy: caller.displayName || caller.email,
        actorUid: caller.uid,
        actorEmail: caller.email,
        actorRole: caller.role,
        eventType,
        note:
          cleanNote ||
          (statusChanged
            ? `Order status changed from ${currentStatus.toUpperCase()} to ${requestedStatus.toUpperCase()}`
            : trackingChanged
            ? `Tracking number updated to ${cleanTracking}`
            : "Fulfillment note added"),
        ...(cleanTracking ? { trackingNumber: cleanTracking } : {}),
      };

      const updatedHistory = [...(currentOrder.statusHistory || []), historyEvent];

      // Update payload strictly omits any financial fields or customer ownership
      const updatePayload: Record<string, any> = {
        updatedAt: nowIso,
        statusHistory: updatedHistory,
      };

      if (statusChanged) {
        updatePayload.orderStatus = requestedStatus;
      }

      if (trackingNumber !== undefined) {
        updatePayload.trackingNumber = cleanTracking;
      }

      if (cleanNote) {
        updatePayload.notes = cleanNote;
      }

      transaction.update(orderRef, updatePayload);

      // Audit log event
      const auditAction = statusChanged ? `order.${requestedStatus}` : "order.fulfillment_update";
      const { docRef: auditRef, entry: auditEntry } = buildAuditLogRecord({
        actor: {
          uid: caller.uid,
          email: caller.email,
          role: caller.role,
        },
        action: auditAction,
        targetType: "order",
        targetId: cleanOrderId,
        summary: statusChanged
          ? `Updated Order #${currentOrder.orderNumber || cleanOrderId} status (${currentStatus} → ${requestedStatus})`
          : `Updated Order #${currentOrder.orderNumber || cleanOrderId} fulfillment details`,
        metadata: {
          orderId: cleanOrderId,
          orderNumber: currentOrder.orderNumber,
          previousStatus: currentStatus,
          newStatus: requestedStatus,
          statusChanged,
          trackingNumber: cleanTracking,
          note: cleanNote || undefined,
          eventType,
          deliveryMethod,
        },
      });

      transaction.set(auditRef, auditEntry);

      return {
        order: {
          ...currentOrder,
          id: cleanOrderId,
          ...updatePayload,
        },
        changed: true,
        status: requestedStatus,
      };
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      status: result.status,
      changed: result.changed,
      message: result.changed
        ? `Order #${result.order.orderNumber || cleanOrderId} fulfillment updated successfully.`
        : "No fulfillment details were modified.",
    });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}
