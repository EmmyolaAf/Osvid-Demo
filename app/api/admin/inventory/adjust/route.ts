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
import {
  InventoryMovement,
  InventoryMovementType,
  InventoryAdjustmentResponse,
} from "@/types/inventory";
import { Timestamp } from "firebase-admin/firestore";

const ALLOWED_MOVEMENT_TYPES: InventoryMovementType[] = [
  "initial_stock",
  "restock",
  "manual_adjustment",
  "correction",
  "damaged",
  "sale",
  "return",
  "cancellation",
  "other",
];

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller using authoritative live profile & session
    const caller = await requireAuthenticatedUser(req);

    // 2. Check inventory authority: Super Admin, Admin, or Manager with canManageInventory
    if (
      !caller.isSuperAdmin &&
      !caller.isAdmin &&
      !hasPermission(caller, "canManageInventory")
    ) {
      throw new AuthError(
        "Forbidden: Insufficient privileges to adjust inventory. Requires inventory management authority.",
        403
      );
    }

    // 3. Operational subscription guard (Super Admin bypasses for recovery)
    await assertOperationalSubscription(caller);

    // 4. Validate input payload
    const body = await req.json().catch(() => ({}));
    const { productId, delta, type, reason, requestId, orderId, reference } = body;

    if (!productId || typeof productId !== "string" || productId.trim().length === 0) {
      return NextResponse.json(
        { error: "productId is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0) {
      return NextResponse.json(
        { error: "delta must be a non-zero integer." },
        { status: 400 }
      );
    }

    if (!type || !ALLOWED_MOVEMENT_TYPES.includes(type as InventoryMovementType)) {
      return NextResponse.json(
        {
          error: `type must be one of [${ALLOWED_MOVEMENT_TYPES.join(", ")}]`,
        },
        { status: 400 }
      );
    }

    if (reason !== undefined && reason !== null) {
      if (typeof reason !== "string" || reason.length > 500) {
        return NextResponse.json(
          { error: "reason must be a string up to 500 characters." },
          { status: 400 }
        );
      }
    }

    if (!requestId || typeof requestId !== "string" || requestId.trim().length === 0) {
      return NextResponse.json(
        { error: "requestId is required as an idempotency key." },
        { status: 400 }
      );
    }

    const cleanRequestId = requestId.trim();

    if (cleanRequestId.length > 128) {
      return NextResponse.json(
        { error: "requestId exceeds maximum length of 128 characters." },
        { status: 400 }
      );
    }

    // Must be a safe, bounded Firestore document ID (alphanumeric, -, _, :, .)
    // Reject path separators such as '/' or whitespace
    const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-:\.]+$/;
    if (!REQUEST_ID_REGEX.test(cleanRequestId)) {
      return NextResponse.json(
        {
          error:
            "requestId contains invalid characters. Only letters, numbers, hyphens, underscores, colons, and periods are permitted.",
        },
        { status: 400 }
      );
    }
    const cleanProductId = productId.trim();
    const movementType = type as InventoryMovementType;
    const cleanReason =
      (reason && typeof reason === "string" ? reason.trim() : "") ||
      (delta > 0 ? "Inventory increase" : "Inventory adjustment");

    // 5. Firestore transaction for atomic product update + immutable movement ledger record
    const productRef = adminDb.collection("products").doc(cleanProductId);
    const movementRef = adminDb.collection("inventory_movements").doc(cleanRequestId);

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      // Idempotency check: see if this requestId was already processed
      const existingMovementSnap = await transaction.get(movementRef);
      if (existingMovementSnap.exists) {
        const existingData = existingMovementSnap.data() as InventoryMovement;
        // Verify payload compatibility
        if (
          existingData.productId !== cleanProductId ||
          existingData.delta !== delta ||
          existingData.type !== movementType
        ) {
          throw new AuthError(
            "Idempotency conflict: requestId was already processed with a conflicting product or quantity delta.",
            409
          );
        }

        // Return original result without re-applying change
        return {
          previousStock: existingData.previousStock,
          newStock: existingData.newStock,
          movementId: existingData.id,
          replayed: true,
        };
      }

      // Read current product document
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) {
        throw new AuthError(`Product not found: "${cleanProductId}"`, 404);
      }

      const productData = productSnap.data() || {};
      const currentStock =
        typeof productData.stockQuantity === "number" ? productData.stockQuantity : 0;
      const newStock = currentStock + delta;

      if (newStock < 0) {
        throw new AuthError(
          `Insufficient inventory: Cannot adjust stock by ${delta}. Current stock is ${currentStock} (would result in ${newStock}).`,
          400
        );
      }

      const nowIso = new Date().toISOString();

      // Update product snapshot
      transaction.update(productRef, {
        stockQuantity: newStock,
        updatedAt: nowIso,
      });

      // Write immutable ledger movement
      const movementData: InventoryMovement = {
        id: cleanRequestId,
        productId: cleanProductId,
        productName: productData.name || "Unknown Product",
        sku: productData.sku || "",
        delta,
        previousStock: currentStock,
        newStock,
        type: movementType,
        reason: cleanReason,
        actorUid: caller.uid,
        actorEmail: caller.email,
        actorRole: caller.role,
        ...(orderId ? { orderId: String(orderId).trim() } : {}),
        ...(reference ? { reference: String(reference).trim() } : {}),
        requestId: cleanRequestId,
        createdAt: Timestamp.now(),
        createdAtIso: nowIso,
      };

      transaction.set(movementRef, movementData);

      // Audit log event
      const { docRef: auditRef, entry: auditEntry } = buildAuditLogRecord({
        actor: {
          uid: caller.uid,
          email: caller.email,
          role: caller.role,
        },
        action: "inventory.adjust",
        targetType: "product",
        targetId: cleanProductId,
        summary: `Adjusted inventory for "${movementData.productName}" by ${
          delta > 0 ? `+${delta}` : delta
        } (${currentStock} → ${newStock}, Type: ${movementType})`,
        metadata: {
          productId: cleanProductId,
          productName: movementData.productName,
          sku: movementData.sku,
          delta,
          previousStock: currentStock,
          newStock,
          type: movementType,
          reason: cleanReason,
          requestId: cleanRequestId,
          orderId: movementData.orderId,
        },
      });

      transaction.set(auditRef, auditEntry);

      return {
        previousStock: currentStock,
        newStock,
        movementId: cleanRequestId,
        replayed: false,
      };
    });

    const response: InventoryAdjustmentResponse = {
      success: true,
      ...transactionResult,
      message: transactionResult.replayed
        ? `Request already processed: stock remains at ${transactionResult.newStock}.`
        : `Inventory updated successfully: ${transactionResult.previousStock} → ${transactionResult.newStock}.`,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return authErrorResponse(err);
  }
}
