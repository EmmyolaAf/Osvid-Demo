import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import {
  Timestamp,
  FieldValue,
  type Transaction,
  type DocumentReference,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase-admin/firestore";
import {
  canonicalizeCartItems,
  CommerceValidationError,
  ReservationInvariantError,
  validateCustomerEmail,
  validateCustomerName,
  validateCustomerPhone,
  validateDeliveryDetails,
} from "@/lib/server/pricing";
import {
  AuthoritativeQuoteItem,
  CheckoutSession,
  CheckoutSessionStatus,
  ShippingAddress,
} from "@/types/commerce";
import { DiscountCode } from "@/types/auth";

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
 * Computes a deterministic session document ID from checkoutRequestId.
 */
export function getDeterministicSessionId(cleanRequestId: string): string {
  const hash = crypto.createHash("sha256").update(cleanRequestId).digest("hex").slice(0, 32);
  return `cs_${hash}`;
}

/**
 * Deterministically normalizes delivery fulfillment destination for the request fingerprint (Packet 4D Requirement 5).
 */
export function normalizeDeliveryFingerprint(
  deliveryMethod: "shipping" | "pickup",
  shippingAddress?: ShippingAddress | null,
  pickupLocationId?: string | null
): string {
  if (deliveryMethod === "pickup") {
    return `pickup:${(pickupLocationId || "").trim().toLowerCase()}`;
  }
  const addr: Partial<ShippingAddress> = shippingAddress || {};
  const street = (addr.streetAddress || addr.address || "").trim().toLowerCase();
  const city = (addr.city || "").trim().toLowerCase();
  const state = (addr.state || "").trim().toLowerCase();
  const postalCode = (addr.postalCode || "").trim().toLowerCase();
  const fullName = (addr.fullName || "").trim().toLowerCase();
  const phone = (addr.phone || "").trim().toLowerCase();
  const email = (addr.email || "").trim().toLowerCase();

  return [
    `method:shipping`,
    `street:${street}`,
    `city:${city}`,
    `state:${state}`,
    `postal:${postalCode}`,
    `name:${fullName}`,
    `phone:${phone}`,
    `email:${email}`,
  ].join(";");
}

/**
 * Computes a stable hash fingerprint of the normalized checkout intent.
 */
export function computeCheckoutRequestFingerprint(params: {
  canonicalItems: Array<{ productId: string; quantity: number }>;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: "shipping" | "pickup";
  shippingDetails?: string;
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
  couponCode?: string;
  authenticatedUserId?: string;
}): string {
  const sortedItemsStr = [...params.canonicalItems]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((i) => `${i.productId}:${i.quantity}`)
    .join(",");

  let deliveryStr = "";
  if (params.shippingAddress || params.pickupLocationId) {
    deliveryStr = normalizeDeliveryFingerprint(
      params.deliveryMethod,
      params.shippingAddress,
      params.pickupLocationId
    );
  } else if (params.shippingDetails !== undefined) {
    deliveryStr = params.shippingDetails.trim();
  } else {
    deliveryStr = normalizeDeliveryFingerprint(params.deliveryMethod, null, null);
  }

  const parts = [
    sortedItemsStr,
    (params.couponCode || "").trim().toUpperCase(),
    params.customerEmail.toLowerCase().trim(),
    params.customerName.trim(),
    params.customerPhone.trim(),
    params.deliveryMethod,
    deliveryStr,
    params.authenticatedUserId || "guest",
  ];

  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Creates an authoritative checkout session with atomic stock and coupon reservations.
 * Resolves transactionally to ONE session via deterministic session ID.
 * Re-reads and revalidates catalogue prices, stock, and coupon terms inside the reservation transaction.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const cleanRequestId = validateCheckoutRequestId(params.checkoutRequestId);
  const cleanCustomerEmail = validateCustomerEmail(params.customerInfo?.email);
  const cleanCustomerName = validateCustomerName(params.customerInfo?.name);
  const cleanCustomerPhone = validateCustomerPhone(params.customerInfo?.phone);

  const deliveryResult = validateDeliveryDetails(
    params.deliveryMethod,
    params.shippingAddress,
    params.pickupLocationId
  );

  const canonicalItems = canonicalizeCartItems(params.items);
  const normalizedCoupon = params.couponCode ? params.couponCode.trim().toUpperCase() : "";

  const shippingDetailsStr =
    deliveryResult.deliveryMethod === "pickup"
      ? deliveryResult.pickupLocationId || ""
      : `${deliveryResult.shippingAddress?.streetAddress || ""}|${deliveryResult.shippingAddress?.city || ""}|${deliveryResult.shippingAddress?.state || ""}`;

  const requestFingerprint = computeCheckoutRequestFingerprint({
    canonicalItems,
    customerEmail: cleanCustomerEmail,
    customerName: cleanCustomerName,
    customerPhone: cleanCustomerPhone,
    deliveryMethod: deliveryResult.deliveryMethod,
    shippingAddress: deliveryResult.shippingAddress,
    pickupLocationId: deliveryResult.pickupLocationId,
    shippingDetails: shippingDetailsStr,
    couponCode: normalizedCoupon,
    authenticatedUserId: params.authenticatedUserId,
  });

  const sessionId = getDeterministicSessionId(cleanRequestId);
  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtMs = now.getTime() + RESERVATION_EXPIRY_MINUTES * 60 * 1000;
  const reservationExpiresAt = Timestamp.fromMillis(expiresAtMs);
  const reservationExpiresAtIso = new Date(expiresAtMs).toISOString();

  let rawReleaseToken = crypto.randomBytes(32).toString("hex");
  let releaseTokenHash = crypto
    .createHash("sha256")
    .update(rawReleaseToken)
    .digest("hex");

  return adminDb.runTransaction(async (transaction: Transaction) => {
    // 1. Transactional Idempotency Check using deterministic session document
    const existingSnap = await transaction.get(sessionRef);

    if (existingSnap.exists) {
      const existing = existingSnap.data() as CheckoutSession;

      // Fingerprint match check
      if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
        throw new CommerceValidationError(
          "checkoutRequestId conflict: request was previously initialized with a different purchase intent.",
          409
        );
      }

      // If active, do NOT rotate release token prematurely (Packet 4D Requirement 4).
      // Token rotation happens only when delivering a usable session/token to the caller.
      if (existing.status === "active" && existing.reservationActive) {
        return {
          session: {
            ...existing,
            id: sessionId,
          },
          releaseToken: "",
          replayed: true,
        };
      }

      // If already finalized, return existing session
      if (existing.status === "finalized") {
        return {
          session: { ...existing, id: sessionId },
          releaseToken: "",
          replayed: true,
        };
      }

      // If released or expired, reject reuse
      throw new CommerceValidationError(
        "checkoutRequestId belongs to an expired or released checkout session. Please start a new purchase attempt.",
        409
      );
    }

    // 2. Transactionally Re-read and Revalidate Catalogue Items (Requirement 6)
    const pricedItems: AuthoritativeQuoteItem[] = [];
    const productDocs: Array<{
      ref: DocumentReference<DocumentData>;
      data: DocumentData;
      item: { productId: string; quantity: number };
    }> = [];

    for (const item of canonicalItems) {
      const pRef = adminDb.collection("products").doc(item.productId);
      const pSnap = await transaction.get(pRef);

      if (!pSnap.exists) {
        throw new CommerceValidationError(
          `Product with ID "${item.productId}" does not exist in store catalogue.`,
          404
        );
      }

      const pData = pSnap.data() || {};
      if (pData.isActive === false) {
        throw new CommerceValidationError(
          `Product "${pData.name || item.productId}" is currently inactive.`,
          400
        );
      }

      const basePrice = Number(pData.price);
      if (isNaN(basePrice) || basePrice < 0) {
        throw new CommerceValidationError(
          `Product "${pData.name || item.productId}" has an invalid price configuration.`,
          500
        );
      }

      const hasDiscount =
        pData.discountPrice !== undefined &&
        Number(pData.discountPrice) > 0 &&
        Number(pData.discountPrice) < basePrice;

      const unitPrice = hasDiscount ? Number(pData.discountPrice) : basePrice;
      const lineTotal = unitPrice * item.quantity;

      // Available stock invariant check
      const stock = Number(pData.stockQuantity || 0);
      const reserved = Number(pData.reservedQuantity || 0);
      const available = stock - reserved;

      if (available < item.quantity) {
        throw new CommerceValidationError(
          `Insufficient stock available for "${pData.name || item.productId}". Available: ${Math.max(0, available)}, requested: ${item.quantity}.`,
          409
        );
      }

      productDocs.push({ ref: pRef, data: pData, item });
      pricedItems.push({
        productId: item.productId,
        name: pData.name || "Product",
        sku: pData.sku || "",
        unit: pData.unit || "unit",
        imageUrl: pData.imageUrl || "",
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    // Authoritative subtotal
    const subtotal = pricedItems.reduce((acc, it) => acc + it.lineTotal, 0);
    const shippingFee = deliveryResult.deliveryMethod === "pickup" ? 0 : 0;

    // 3. Transactionally Re-read and Revalidate Coupon (Requirement 6)
    let discountAmount = 0;
    let couponDocRef: DocumentReference<DocumentData> | null = null;
    let couponDocData: DiscountCode | null = null;

    if (normalizedCoupon) {
      const qSnap = await adminDb
        .collection("discounts")
        .where("code", "==", normalizedCoupon)
        .limit(1)
        .get();

      if (qSnap.empty) {
        throw new CommerceValidationError(
          `Coupon code "${normalizedCoupon}" is invalid or does not exist.`,
          400
        );
      }

      couponDocRef = adminDb.collection("discounts").doc(qSnap.docs[0].id);
      const dSnap = await transaction.get(couponDocRef);

      if (!dSnap.exists) {
        throw new CommerceValidationError("Applied coupon no longer exists.", 400);
      }

      couponDocData = dSnap.data() as DiscountCode;

      // Revalidate coupon code strictly after transactional read (Packet 4D Requirement 6)
      const authoritativeCode = (couponDocData.code || "").trim().toUpperCase();
      if (authoritativeCode !== normalizedCoupon) {
        throw new CommerceValidationError(
          `Coupon code "${normalizedCoupon}" is invalid or does not match authoritative record.`,
          400
        );
      }

      if (!couponDocData.isActive) {
        throw new CommerceValidationError(
          `Coupon code "${normalizedCoupon}" is deactivated.`,
          400
        );
      }

      if (couponDocData.expiryDate) {
        const expiry = new Date(couponDocData.expiryDate);
        if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
          throw new CommerceValidationError(
            `Coupon code "${normalizedCoupon}" has expired.`,
            400
          );
        }
      }

      if (couponDocData.minOrderAmount && subtotal < couponDocData.minOrderAmount) {
        throw new CommerceValidationError(
          `Coupon "${normalizedCoupon}" requires a minimum order subtotal of ₦${couponDocData.minOrderAmount.toLocaleString()}.`,
          400
        );
      }

      const totalUsage =
        Number(couponDocData.usageCount || 0) + Number(couponDocData.reservedUsageCount || 0);

      if (couponDocData.maxUsageLimit && totalUsage >= couponDocData.maxUsageLimit) {
        throw new CommerceValidationError(
          `Coupon "${normalizedCoupon}" has reached its maximum redemption limit.`,
          409
        );
      }

      if (couponDocData.discountType === "percentage") {
        const percentage = Math.min(100, Math.max(0, couponDocData.discountValue));
        discountAmount = Math.round((subtotal * percentage) / 100);
      } else {
        discountAmount = Math.min(couponDocData.discountValue, subtotal);
      }
      discountAmount = Math.min(discountAmount, subtotal);
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);
    const totalAmountKobo = Math.round(totalAmount * 100);

    // 4. Apply Product Stock Reservations
    for (const p of productDocs) {
      const curReserved = Number(p.data.reservedQuantity || 0);
      transaction.update(p.ref, {
        reservedQuantity: curReserved + p.item.quantity,
        updatedAt: nowIso,
      });
    }

    // 5. Apply Coupon Usage Reservation
    if (couponDocRef && couponDocData) {
      const curReservedUsage = Number(couponDocData.reservedUsageCount || 0);
      transaction.update(couponDocRef, {
        reservedUsageCount: curReservedUsage + 1,
      });
    }

    // 6. Persist Checkout Session with explicit provider state machine (Requirement 5)
    const newSessionData: Omit<CheckoutSession, "id"> = {
      checkoutRequestId: cleanRequestId,
      requestFingerprint,
      status: "active",
      currency: "NGN",
      customerEmail: cleanCustomerEmail,
      customerName: cleanCustomerName,
      customerPhone: cleanCustomerPhone,
      authenticatedUserId: params.authenticatedUserId,
      deliveryMethod: deliveryResult.deliveryMethod,
      shippingAddress: deliveryResult.shippingAddress,
      pickupLocationId: deliveryResult.pickupLocationId,
      items: pricedItems,
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      totalAmountKobo,
      couponId: couponDocRef ? couponDocRef.id : undefined,
      couponCode: couponDocData ? couponDocData.code : undefined,
      paymentInitializationStatus: "uninitialized",
      paymentInitializationAttempt: 0,
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

    const createdSession: CheckoutSession = {
      id: sessionId,
      ...newSessionData,
      createdAt: reservationExpiresAt,
      updatedAt: reservationExpiresAt,
    };

    return {
      session: createdSession,
      releaseToken: rawReleaseToken,
      replayed: false,
    };
  });
}

export interface PaymentInitializationClaimResult {
  canProceed: boolean;
  outcome: "claim_acquired" | "already_initialized" | "in_progress" | "recovery_required";
  session: CheckoutSession;
  reference?: string;
  accessCode?: string;
  message?: string;
}

/**
 * Transactionally claims provider initialization for a checkout session.
 * Prevents concurrent provider initialization calls, locks a stable paystackReference,
 * and enters explicit recovery_required on ambiguous stale attempts (Requirement 1 & 2).
 */
export async function claimPaymentInitialization(
  sessionId: string
): Promise<PaymentInitializationClaimResult> {
  if (!sessionId || typeof sessionId !== "string") {
    throw new CommerceValidationError("sessionId is required.", 400);
  }

  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);

  return adminDb.runTransaction(async (transaction: Transaction) => {
    const snap = await transaction.get(sessionRef);
    if (!snap.exists) {
      throw new CommerceValidationError("Checkout session not found.", 404);
    }

    const session = { id: snap.id, ...snap.data() } as CheckoutSession;

    if (session.status !== "active") {
      throw new CommerceValidationError(
        `Cannot initialize payment for checkout session in "${session.status}" status.`,
        400
      );
    }

    if (!session.reservationActive) {
      throw new CommerceValidationError(
        "Checkout reservation is no longer active.",
        400
      );
    }

    // 1. If already initialized with accessCode and reference: return cached provider state
    if (
      session.paymentInitializationStatus === "initialized" &&
      session.paystackAccessCode &&
      session.paystackReference
    ) {
      return {
        canProceed: false,
        outcome: "already_initialized",
        session,
        reference: session.paystackReference,
        accessCode: session.paystackAccessCode,
      };
    }

    // 2. If session is flagged as recovery_required: do NOT issue duplicate provider call
    if (session.paymentInitializationStatus === "recovery_required") {
      return {
        canProceed: false,
        outcome: "recovery_required",
        session,
        message:
          "Payment initialization requires recovery due to an ambiguous earlier attempt. Please retry later or contact support.",
      };
    }

    // 3. If session is initializing: check claim age
    if (session.paymentInitializationStatus === "initializing") {
      const claimedAt = session.paymentInitializationClaimedAt;
      let claimedAtMs = 0;
      if (claimedAt) {
        claimedAtMs =
          typeof claimedAt.toMillis === "function"
            ? claimedAt.toMillis()
            : new Date(claimedAt).getTime();
      }

      const ageMs = Date.now() - claimedAtMs;

      // If claim is still fresh (< 60s), block concurrent duplicate caller
      if (claimedAtMs > 0 && ageMs < 60_000) {
        return {
          canProceed: false,
          outcome: "in_progress",
          session,
          message:
            "Payment initialization is currently in progress. Please wait for completion.",
        };
      }

      // If claim is stale (>= 60s), enter explicit recovery_required rather than calling Paystack again blindly
      transaction.update(sessionRef, {
        paymentInitializationStatus: "recovery_required",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        canProceed: false,
        outcome: "recovery_required",
        session: {
          ...session,
          paymentInitializationStatus: "recovery_required",
        },
        message:
          "Payment initialization attempt expired ambiguously. Recovery required; duplicate provider call blocked.",
      };
    }

    // 4. Initialization allowed (uninitialized, or failed with attempt < 5)
    const currentAttempts = Number(session.paymentInitializationAttempt || 0);
    if (currentAttempts >= 5) {
      throw new CommerceValidationError(
        "Maximum payment initialization attempts (5) exceeded for this session.",
        400
      );
    }

    const nextAttempt = currentAttempts + 1;
    // Persist a STABLE server-generated paystackReference before calling Paystack
    const stableRef =
      session.paystackReference ||
      `osvid_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;

    transaction.update(sessionRef, {
      paymentInitializationStatus: "initializing",
      paymentInitializationAttempt: nextAttempt,
      paymentInitializationClaimedAt: FieldValue.serverTimestamp(),
      paystackReference: stableRef,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      canProceed: true,
      outcome: "claim_acquired",
      session: {
        ...session,
        paymentInitializationStatus: "initializing",
        paymentInitializationAttempt: nextAttempt,
        paystackReference: stableRef,
      },
      reference: stableRef,
    };
  });
}

/**
 * Internal core release logic enforcing strict reservation invariants (Requirement 3 & 4).
 * Enforces all reads before all writes and fails closed with ReservationInvariantError on underflow.
 */
async function executeReservationRelease(
  sessionId: string,
  reason: string,
  requiredReleaseToken?: string
): Promise<{ success: boolean; alreadyReleased: boolean }> {
  if (!sessionId) {
    return { success: false, alreadyReleased: true };
  }

  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);

  return adminDb.runTransaction(async (transaction: Transaction) => {
    // 1. Read session doc
    const snap = await transaction.get(sessionRef);
    if (!snap.exists) {
      return { success: false, alreadyReleased: true };
    }

    const session = snap.data() as CheckoutSession;

    // Idempotency check: if not active or already released, no-op
    if (session.status !== "active" || !session.reservationActive) {
      return { success: true, alreadyReleased: true };
    }

    // If a release token is required (public path), compare cryptographically with timingSafeEqual (Requirement 3)
    if (requiredReleaseToken) {
      const computedHash = crypto
        .createHash("sha256")
        .update(requiredReleaseToken)
        .digest("hex");

      const compBuf = Buffer.from(computedHash, "utf8");
      const storedBuf = Buffer.from(session.releaseTokenHash || "", "utf8");

      if (compBuf.length !== storedBuf.length || !crypto.timingSafeEqual(compBuf, storedBuf)) {
        throw new CommerceValidationError("Invalid release authorization token.", 403);
      }
    }

    // 2. Collect all document references and READ ALL DOCUMENTS BEFORE WRITES (Requirement 4)
    const productRefs = (session.items || []).map((it) => ({
      item: it,
      ref: adminDb.collection("products").doc(it.productId),
    }));

    const productSnaps = await Promise.all(
      productRefs.map(async (p) => ({
        item: p.item,
        ref: p.ref,
        snap: await transaction.get(p.ref),
      }))
    );

    let discountSnap: DocumentSnapshot<DocumentData> | null = null;
    let discountRef: DocumentReference<DocumentData> | null = null;
    if (session.couponId) {
      discountRef = adminDb.collection("discounts").doc(session.couponId);
      discountSnap = await transaction.get(discountRef);
    }

    // 3. Strict reservation invariant validation (Requirement 3: Fail closed, no clamping!)
    for (const p of productSnaps) {
      if (p.snap.exists) {
        const pData = p.snap.data() || {};
        const currentReserved = Number(pData.reservedQuantity || 0);

        if (currentReserved < p.item.quantity) {
          throw new ReservationInvariantError(
            `Product ${p.item.productId} reservedQuantity (${currentReserved}) is less than session reservation (${p.item.quantity}). Release failed closed.`
          );
        }
      }
    }

    if (discountSnap && discountSnap.exists) {
      const dData = discountSnap.data() || {};
      const currentReservedUsage = Number(dData.reservedUsageCount || 0);

      if (currentReservedUsage < 1) {
        throw new ReservationInvariantError(
          `Coupon ${session.couponCode} reservedUsageCount (${currentReservedUsage}) is less than 1. Release failed closed.`
        );
      }
    }

    // 4. ALL READS & VALIDATIONS COMPLETE - PERFORM WRITES
    const nowIso = new Date().toISOString();

    for (const p of productSnaps) {
      if (p.snap.exists) {
        const pData = p.snap.data() || {};
        const currentReserved = Number(pData.reservedQuantity || 0);
        transaction.update(p.ref, {
          reservedQuantity: currentReserved - p.item.quantity,
          updatedAt: nowIso,
        });
      }
    }

    if (discountRef && discountSnap && discountSnap.exists) {
      const dData = discountSnap.data() || {};
      const currentReservedUsage = Number(dData.reservedUsageCount || 0);
      transaction.update(discountRef, {
        reservedUsageCount: currentReservedUsage - 1,
      });
    }

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
 * Public release path: strictly requires non-empty releaseToken and validates hash (Requirement 3).
 */
export async function releaseCheckoutReservationPublic(
  sessionId: string,
  releaseToken: string,
  reason = "client_cancelled"
): Promise<{ success: boolean; alreadyReleased: boolean }> {
  if (!sessionId || typeof sessionId !== "string") {
    throw new CommerceValidationError("checkoutSessionId is required.", 400);
  }
  if (!releaseToken || typeof releaseToken !== "string" || !releaseToken.trim()) {
    throw new CommerceValidationError(
      "releaseToken is required for public checkout reservation cancellation.",
      400
    );
  }
  return executeReservationRelease(sessionId.trim(), reason, releaseToken.trim());
}

/**
 * Internal server release path: used for initialization failure, system expiry, etc. (Requirement 3).
 */
export async function releaseCheckoutReservationInternal(
  sessionId: string,
  reason: string
): Promise<{ success: boolean; alreadyReleased: boolean }> {
  return executeReservationRelease(sessionId, reason);
}

/**
 * Backward compatibility alias for internal release.
 */
export const releaseCheckoutReservation = releaseCheckoutReservationInternal;

/**
 * Scans and releases expired active checkout sessions.
 * Suitable for lazy invocation or scheduled worker.
 */
export async function cleanupExpiredCheckoutReservations(maxBatch = 5): Promise<number> {
  if (process.env.MOCK_CHECKOUT_CLEANUP === "true") {
    return 0;
  }
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
        await releaseCheckoutReservationInternal(doc.id, "expired");
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

/**
 * Transactionally rotates the cancellation release token for an active checkout session.
 * Used exclusively when a usable session/token is confirmed to be delivered to a successful replay caller (Packet 4D Requirement 4).
 */
export async function rotateSessionReleaseToken(sessionId: string): Promise<string> {
  const sessionRef = adminDb.collection("checkout_sessions").doc(sessionId);
  const freshRawReleaseToken = crypto.randomBytes(32).toString("hex");
  const freshReleaseTokenHash = crypto
    .createHash("sha256")
    .update(freshRawReleaseToken)
    .digest("hex");

  await adminDb.runTransaction(async (transaction: Transaction) => {
    const snap = await transaction.get(sessionRef);
    if (!snap.exists) {
      throw new CommerceValidationError(
        `Checkout session "${sessionId}" not found for token rotation.`,
        404
      );
    }
    const session = snap.data() as CheckoutSession;
    if (session.status !== "active" || !session.reservationActive) {
      throw new CommerceValidationError(
        `Checkout session "${sessionId}" is not active with active reservation.`,
        400
      );
    }
    transaction.update(sessionRef, {
      releaseTokenHash: freshReleaseTokenHash,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return freshRawReleaseToken;
}
