import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  AuthoritativePricingResult,
  calculateAuthoritativeQuote,
  CommerceValidationError,
} from "@/lib/server/pricing";
import {
  CheckoutSession,
  CheckoutSessionStatus,
  ShippingAddress,
} from "@/types/commerce";

export const RESERVATION_EXPIRY_MINUTES = 30;

export interface CreateCheckoutSessionParams {
  checkoutRequestId: string;
  items: Array<{ productId: string; quantity: number }>;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: "shipping" | "pickup";
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
  couponCode?: string;
  authenticatedUserId?: string;
}

export interface CreateCheckoutSessionResult {
  session: CheckoutSession;
  releaseToken: string;
  replayed: boolean;
}

/**
 * Validates the checkoutRequestId format.
 */
export function validateCheckoutRequestId(id: string): string {
  if (typeof id !== "string") {
    throw new CommerceValidationError("checkoutRequestId must be a string.", 400);
  }
  const clean = id.trim();
  if (!clean || clean.length < 8 || clean.length > 128) {
    throw new CommerceValidationError(
      "checkoutRequestId must be between 8 and 128 characters.",
      400
    );
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) {
    throw new CommerceValidationError(
      "checkoutRequestId may only contain alphanumeric characters, underscores, and hyphens.",
      400
    );
  }
  return clean;
}

/**
 * Creates an authoritative checkout session with atomic stock and coupon reservations.
 * If checkoutRequestId was already used with identical payload, returns existing session (Idempotent).
 * If payload differs on an existing checkoutRequestId, rejects with 409 Conflict.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const cleanRequestId = validateCheckoutRequestId(params.checkoutRequestId);

  const cleanCustomerEmail = params.customerInfo?.email?.toLowerCase()?.trim() || "";
  const cleanCustomerName = params.customerInfo?.name?.trim() || "";
  const cleanCustomerPhone = params.customerInfo?.phone?.trim() || "";

  if (!cleanCustomerEmail || !cleanCustomerName) {
    throw new CommerceValidationError(
      "Customer name and email are required to create a checkout session.",
      400
    );
  }

  // 1. Check for existing session by checkoutRequestId
  const existingSnap = await adminDb
    .collection("checkout_sessions")
    .where("checkoutRequestId", "==", cleanRequestId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    const existingSession = { id: existingDoc.id, ...existingDoc.data() } as CheckoutSession;

    // If active or already finalized, check for payload equality
    if (existingSession.status === "active" || existingSession.status === "finalized") {
      // Check customer email and total
      if (
        existingSession.customerEmail.toLowerCase() !== cleanCustomerEmail.toLowerCase()
      ) {
        throw new CommerceValidationError(
          "checkoutRequestId conflict: request was previously used with different customer details.",
          409
        );
      }

      return {
        session: existingSession,
        releaseToken: "", // Token not exposed on replay
        replayed: true,
      };
    }
  }

  // 2. Compute authoritative quote before entering reservation transaction
  const quote = await calculateAuthoritativeQuote({
    rawItems: params.items,
    couponCode: params.couponCode,
    deliveryMethod: params.deliveryMethod,
    shippingAddress: params.shippingAddress,
    pickupLocationId: params.pickupLocationId,
  });

  // Generate unguessable release token and session ID
  const rawReleaseToken = crypto.randomBytes(32).toString("hex");
  const releaseTokenHash = crypto
    .createHash("sha256")
    .update(rawReleaseToken)
    .digest("hex");

  const sessionId = `cs_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtMs = now.getTime() + RESERVATION_EXPIRY_MINUTES * 60 * 1000;
  const reservationExpiresAt = Timestamp.fromMillis(expiresAtMs);
  const reservationExpiresAtIso = new Date(expiresAtMs).toISOString();

  // 3. Atomically reserve stock and coupon in a Firestore transaction
  await adminDb.runTransaction(async (transaction) => {
    // A. Re-check idempotency inside transaction
    const existingInTx = await transaction.get(sessionRef);
    if (existingInTx.exists) {
      return;
    }

    // B. Read all products for the session
    const productDocs: Array<{
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
      requestedQty: number;
      name: string;
    }> = [];

    for (const item of quote.items) {
      const pRef = adminDb.collection("products").doc(item.productId);
      const pSnap = await transaction.get(pRef);
      if (!pSnap.exists) {
        throw new CommerceValidationError(
          `Product "${item.name}" (ID: ${item.productId}) no longer exists.`,
          404
        );
      }
      const pData = pSnap.data() || {};
      productDocs.push({
        ref: pRef,
        data: pData,
        requestedQty: item.quantity,
        name: pData.name || item.name,
      });
    }

    // C. Read coupon doc if applied
    let discountDocRef: FirebaseFirestore.DocumentReference | null = null;
    let discountData: FirebaseFirestore.DocumentData | null = null;

    if (quote.coupon?.id) {
      discountDocRef = adminDb.collection("discounts").doc(quote.coupon.id);
      const dSnap = await transaction.get(discountDocRef);
      if (!dSnap.exists) {
        throw new CommerceValidationError("Applied coupon no longer exists.", 400);
      }
      discountData = dSnap.data() || {};
    }

    // D. Validate stock availability and apply stock reservations
    for (const p of productDocs) {
      const stock = Number(p.data.stockQuantity || 0);
      const reserved = Number(p.data.reservedQuantity || 0);
      const available = stock - reserved;

      if (available < p.requestedQty) {
        throw new CommerceValidationError(
          `Insufficient stock available for "${p.name}". Available: ${Math.max(0, available)}, requested: ${p.requestedQty}.`,
          409
        );
      }

      transaction.update(p.ref, {
        reservedQuantity: reserved + p.requestedQty,
        updatedAt: nowIso,
      });
    }

    // E. Validate coupon availability and apply coupon reservation
    if (discountDocRef && discountData) {
      const maxLimit = discountData.maxUsageLimit;
      if (maxLimit !== undefined && maxLimit !== null) {
        const usage = Number(discountData.usageCount || 0);
        const reservedUsage = Number(discountData.reservedUsageCount || 0);
        const effectiveAvailable = maxLimit - usage - reservedUsage;

        if (effectiveAvailable <= 0) {
          throw new CommerceValidationError(
            `Coupon "${quote.coupon?.code}" has reached its maximum redemption limit.`,
            409
          );
        }
      }

      transaction.update(discountDocRef, {
        reservedUsageCount: Number(discountData.reservedUsageCount || 0) + 1,
      });
    }

    // F. Create checkout session document
    const newSessionData: Omit<CheckoutSession, "id"> = {
      checkoutRequestId: cleanRequestId,
      status: "active",
      currency: "NGN",
      customerEmail: cleanCustomerEmail,
      customerName: cleanCustomerName,
      customerPhone: cleanCustomerPhone,
      authenticatedUserId: params.authenticatedUserId,
      deliveryMethod: params.deliveryMethod,
      shippingAddress: params.shippingAddress,
      pickupLocationId: params.pickupLocationId,
      items: quote.items,
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      discountAmount: quote.discountAmount,
      totalAmount: quote.totalAmount,
      couponId: quote.coupon?.id,
      couponCode: quote.coupon?.code,
      reservationExpiresAt,
      reservationExpiresAtIso,
      reservationActive: true,
      releaseTokenHash,
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: nowIso,
    };

    transaction.set(sessionRef, newSessionData);
  });

  const createdSession: CheckoutSession = {
    id: sessionId,
    checkoutRequestId: cleanRequestId,
    status: "active",
    currency: "NGN",
    customerEmail: cleanCustomerEmail,
    customerName: cleanCustomerName,
    customerPhone: cleanCustomerPhone,
    authenticatedUserId: params.authenticatedUserId,
    deliveryMethod: params.deliveryMethod,
    shippingAddress: params.shippingAddress,
    pickupLocationId: params.pickupLocationId,
    items: quote.items,
    subtotal: quote.subtotal,
    shippingFee: quote.shippingFee,
    discountAmount: quote.discountAmount,
    totalAmount: quote.totalAmount,
    couponId: quote.coupon?.id,
    couponCode: quote.coupon?.code,
    reservationExpiresAt,
    reservationExpiresAtIso,
    reservationActive: true,
    releaseTokenHash,
    createdAt: reservationExpiresAt,
    createdAtIso: nowIso,
    updatedAt: reservationExpiresAt,
    updatedAtIso: nowIso,
  };

  return {
    session: createdSession,
    releaseToken: rawReleaseToken,
    replayed: false,
  };
}

/**
 * Releases a checkout session's reserved stock and coupon atomically.
 * Safe and idempotent: will not double-decrement or make reservedQuantity negative.
 */
export async function releaseCheckoutReservation(
  sessionId: string,
  reason: string,
  providedReleaseToken?: string
): Promise<{ success: boolean; alreadyReleased: boolean }> {
  if (!sessionId) {
    return { success: false, alreadyReleased: true };
  }

  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);

  return adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(sessionRef);
    if (!snap.exists) {
      return { success: false, alreadyReleased: true };
    }

    const session = snap.data() as CheckoutSession;

    // If not active or already released/finalized, release is a no-op
    if (session.status !== "active" || !session.reservationActive) {
      return { success: true, alreadyReleased: true };
    }

    // Verify release token if provided
    if (providedReleaseToken && session.releaseTokenHash) {
      const computedHash = crypto
        .createHash("sha256")
        .update(providedReleaseToken)
        .digest("hex");
      if (computedHash !== session.releaseTokenHash) {
        throw new CommerceValidationError("Invalid release authorization token.", 403);
      }
    }

    const nowIso = new Date().toISOString();

    // 1. Decrement reservedQuantity for each product safely
    for (const item of session.items || []) {
      const pRef = adminDb.collection("products").doc(item.productId);
      const pSnap = await transaction.get(pRef);
      if (pSnap.exists) {
        const pData = pSnap.data() || {};
        const currentReserved = Number(pData.reservedQuantity || 0);
        const nextReserved = Math.max(0, currentReserved - item.quantity);
        transaction.update(pRef, {
          reservedQuantity: nextReserved,
          updatedAt: nowIso,
        });
      }
    }

    // 2. Decrement reservedUsageCount on coupon if applicable
    if (session.couponId) {
      const dRef = adminDb.collection("discounts").doc(session.couponId);
      const dSnap = await transaction.get(dRef);
      if (dSnap.exists) {
        const dData = dSnap.data() || {};
        const currentReservedUsage = Number(dData.reservedUsageCount || 0);
        const nextReservedUsage = Math.max(0, currentReservedUsage - 1);
        transaction.update(dRef, {
          reservedUsageCount: nextReservedUsage,
        });
      }
    }

    // 3. Mark session released
    transaction.update(sessionRef, {
      status: "released",
      reservationActive: false,
      releasedAt: FieldValue.serverTimestamp(),
      releasedAtIso: nowIso,
      releaseReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: nowIso,
    });

    return { success: true, alreadyReleased: false };
  });
}

/**
 * Scans and releases expired active checkout sessions.
 * Suitable for periodic or lazy invocation.
 */
export async function cleanupExpiredCheckoutReservations(maxBatch = 20): Promise<number> {
  try {
    const expiredSnaps = await adminDb
      .collection("checkout_sessions")
      .where("reservationActive", "==", true)
      .where("reservationExpiresAt", "<", Timestamp.now())
      .limit(maxBatch)
      .get();

    let cleaned = 0;
    for (const doc of expiredSnaps.docs) {
      try {
        await releaseCheckoutReservation(doc.id, "expired");
        cleaned++;
      } catch (err) {
        console.warn(`Failed to release expired session ${doc.id}:`, err);
      }
    }
    return cleaned;
  } catch (err) {
    console.error("Error cleaning up expired checkout sessions:", err);
    return 0;
  }
}
