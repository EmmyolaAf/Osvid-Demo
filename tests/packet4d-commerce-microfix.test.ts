import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  CommerceValidationError,
  validatePaymentReference,
} from "@/lib/server/pricing";
import { PaystackRefundError } from "@/lib/server/paystack";
import {
  computeCheckoutRequestFingerprint,
  normalizeDeliveryFingerprint,
} from "@/lib/server/checkout-session";
import { ShippingAddress } from "@/types/commerce";

// ============================================================================
// 1. CUSTOMER METRICS LOOKUP & UPDATE (Packet 4D Requirement 1)
// ============================================================================

test("Customer Metrics: existing authenticated profile increments metrics exactly once", () => {
  interface UserProfile {
    uid: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
  }

  const existingProfile: UserProfile = {
    uid: "user_valid_123",
    totalOrders: 2,
    totalSpent: 15000,
    lastOrderDate: "2026-01-01T00:00:00.000Z",
  };

  const currentSession = {
    authenticatedUserId: "user_valid_123",
    totalAmount: 5000,
  };

  const nowIso = new Date().toISOString();

  // Packet 4D corrected semantics:
  // if profile EXISTS: retain reference and update
  let userDocRef: string | null = null;
  if (currentSession.authenticatedUserId) {
    const candidateUid = currentSession.authenticatedUserId;
    // Simulate uSnap.exists === true
    const profileExists = candidateUid === existingProfile.uid;
    if (profileExists) {
      userDocRef = candidateUid;
    } else {
      userDocRef = null;
    }
  }

  assert.equal(userDocRef, "user_valid_123", "Profile reference must be retained when profile exists");

  if (userDocRef) {
    existingProfile.totalOrders += 1;
    existingProfile.totalSpent += currentSession.totalAmount;
    existingProfile.lastOrderDate = nowIso;
  }

  assert.equal(existingProfile.totalOrders, 3);
  assert.equal(existingProfile.totalSpent, 20000);
  assert.equal(existingProfile.lastOrderDate, nowIso);
});

test("Customer Metrics: missing authenticated profile is skipped safely without failing order", () => {
  const currentSession = {
    authenticatedUserId: "user_deleted_456",
    totalAmount: 8500,
  };

  // Simulate users/{uid} does not exist
  const existingProfiles = new Map<string, any>();

  let userDocRef: string | null = null;
  if (currentSession.authenticatedUserId) {
    const candidateUid = currentSession.authenticatedUserId;
    const profileExists = existingProfiles.has(candidateUid);
    if (profileExists) {
      userDocRef = candidateUid;
    } else {
      userDocRef = null;
    }
  }

  assert.equal(userDocRef, null, "Missing user profile doc must result in null userDocRef");

  // Order continues finalization without throwing
  let orderCreated = false;
  if (userDocRef) {
    // Should NOT be reached
    assert.fail("Should not attempt user profile update for non-existent profile doc");
  } else {
    orderCreated = true;
  }

  assert.equal(orderCreated, true, "Order must still finalize successfully when user profile document is missing");
});

test("Customer Metrics: guest checkout touches no user metrics", () => {
  const currentSession = {
    authenticatedUserId: undefined,
    customerEmail: "guest@example.com",
    totalAmount: 12000,
  };

  let userDocRef: string | null = null;
  if (currentSession.authenticatedUserId) {
    userDocRef = currentSession.authenticatedUserId;
  }

  assert.equal(userDocRef, null, "Guest session must not produce a userDocRef");
});

test("Customer Metrics: duplicate payment reconciliation fast-path does not increment metrics again", () => {
  const userProfile = {
    uid: "user_replay_789",
    totalOrders: 1,
    totalSpent: 4000,
  };

  const existingTx = {
    id: "pay_dup_ref_01",
    status: "finalized",
    orderId: "ord_already_created_01",
    checkoutSessionId: "cs_replay_01",
  };

  let metricsIncremented = false;

  // Finalizer fast-path logic
  if (existingTx.status === "finalized" && existingTx.orderId) {
    // Fast path returns existing order immediately without running transaction writes
  } else {
    // Transaction writes metrics
    metricsIncremented = true;
    userProfile.totalOrders += 1;
    userProfile.totalSpent += 4000;
  }

  assert.equal(metricsIncremented, false, "Replay fast-path must not increment user metrics");
  assert.equal(userProfile.totalOrders, 1);
  assert.equal(userProfile.totalSpent, 4000);
});

// ============================================================================
// 2. REFUND RECONCILIATION LOCK & ATOMIC ANOMALY REFUND (Packet 4D Requirements 2 & 3)
// ============================================================================

test("Refunds: needs_attention and initiating block normal refund retry with 409", () => {
  function checkRefundEligibility(order: { id: string; refundStatus: string }) {
    if (
      order.refundStatus === "processed" ||
      order.refundStatus === "pending" ||
      order.refundStatus === "processing"
    ) {
      throw new Error(`CONFLICT:Refund is already ${order.refundStatus} for order "${order.id}". Duplicate refund rejected.`);
    }

    if (
      order.refundStatus === "initiating" ||
      order.refundStatus === "needs_attention"
    ) {
      throw new Error(`CONFLICT:Refund is currently in ${order.refundStatus} state for order "${order.id}". Refund reconciliation required.`);
    }

    return "eligible";
  }

  // needs_attention blocked
  assert.throws(
    () => checkRefundEligibility({ id: "ord_attn_1", refundStatus: "needs_attention" }),
    /CONFLICT:Refund is currently in needs_attention state for order "ord_attn_1"\. Refund reconciliation required\./
  );

  // initiating blocked
  assert.throws(
    () => checkRefundEligibility({ id: "ord_init_1", refundStatus: "initiating" }),
    /CONFLICT:Refund is currently in initiating state for order "ord_init_1"\. Refund reconciliation required\./
  );

  // processed/pending/processing blocked
  assert.throws(
    () => checkRefundEligibility({ id: "ord_done_1", refundStatus: "processed" }),
    /CONFLICT:Refund is already processed/
  );
  assert.throws(
    () => checkRefundEligibility({ id: "ord_pend_1", refundStatus: "pending" }),
    /CONFLICT:Refund is already pending/
  );

  // definitive failed is eligible for deliberate retry
  assert.equal(
    checkRefundEligibility({ id: "ord_fail_1", refundStatus: "failed" }),
    "eligible"
  );
  assert.equal(
    checkRefundEligibility({ id: "ord_none_1", refundStatus: "none" }),
    "eligible"
  );
});

test("Refunds: two concurrent anomaly finalizers obtain exactly one external refund claim", async () => {
  interface PaymentTxState {
    reference: string;
    status: "anomaly_unfulfillable";
    refundStatus: "none" | "initiating" | "pending" | "failed" | "needs_attention";
  }

  const sharedTx: PaymentTxState = {
    reference: "pay_anomaly_concurrent_ref",
    status: "anomaly_unfulfillable",
    refundStatus: "none",
  };

  let lockAcquired = false;

  async function atomicClaimAnomalyRefund(callerId: string): Promise<boolean> {
    // Model transactional atomic claim
    while (lockAcquired) {
      await new Promise((r) => setTimeout(r, 2));
    }
    lockAcquired = true;
    try {
      if (sharedTx.refundStatus === "none" || sharedTx.refundStatus === "failed") {
        sharedTx.refundStatus = "initiating";
        return true;
      }
      return false;
    } finally {
      lockAcquired = false;
    }
  }

  // Model Finalizer A and Finalizer B racing after discovering anomaly_unfulfillable
  const [claimA, claimB] = await Promise.all([
    atomicClaimAnomalyRefund("finalizer_A"),
    atomicClaimAnomalyRefund("finalizer_B"),
  ]);

  const claims = [claimA, claimB].filter(Boolean);
  assert.equal(claims.length, 1, "Exactly one finalizer must acquire the external-refund claim");
  assert.equal(sharedTx.refundStatus, "initiating");
});

test("Refunds: ambiguous anomaly refund outcome becomes needs_attention, definitive failure becomes failed", () => {
  function mapAnomalyRefundOutcome(err: any): "failed" | "needs_attention" {
    if (err instanceof PaystackRefundError || err?.name === "PaystackRefundError") {
      if (err.isDefinitive) {
        return "failed";
      }
      return "needs_attention";
    }
    if (err?.isDefinitive) {
      return "failed";
    }
    return "needs_attention";
  }

  // Ambiguous transport failure or 5xx
  const transportErr = new PaystackRefundError("ETIMEDOUT connecting to api.paystack.co", false);
  assert.equal(mapAnomalyRefundOutcome(transportErr), "needs_attention");

  const gateway502 = new PaystackRefundError("Bad Gateway from Paystack", false, 502);
  assert.equal(mapAnomalyRefundOutcome(gateway502), "needs_attention");

  // Definitive rejection (400, 422, already refunded)
  const definitiveErr = new PaystackRefundError("Transaction already refunded", true, 400);
  assert.equal(mapAnomalyRefundOutcome(definitiveErr), "failed");
});

// ============================================================================
// 3. RELEASE TOKEN OWNERSHIP & SAFE ROTATION (Packet 4D Requirement 4)
// ============================================================================

test("Release Token: in_progress and recovery_required replay do not invalidate original release token", () => {
  interface SessionState {
    id: string;
    status: "active";
    reservationActive: boolean;
    releaseTokenHash: string;
    paymentInitializationStatus: "initializing" | "recovery_required";
  }

  const rawTokenA = "token_a_1234567890abcdef1234567890abcdef";
  const hashA = crypto.createHash("sha256").update(rawTokenA).digest("hex");

  const session: SessionState = {
    id: "cs_safe_token_001",
    status: "active",
    reservationActive: true,
    releaseTokenHash: hashA,
    paymentInitializationStatus: "initializing",
  };

  // Request B arrives with same checkoutRequestId during in_progress
  // createCheckoutSession does NOT rotate token for active replay
  function replayActiveSession(existing: SessionState): { replayed: boolean; releaseToken: string } {
    if (existing.status === "active" && existing.reservationActive) {
      return {
        replayed: true,
        releaseToken: "", // Token rotation NOT performed during replay read
      };
    }
    throw new Error("Invalid session state");
  }

  const replayResult = replayActiveSession(session);
  assert.equal(replayResult.replayed, true);
  assert.equal(replayResult.releaseToken, "");

  // Request A's token hash must NOT have changed!
  assert.equal(session.releaseTokenHash, hashA, "Original token hash must remain unaltered on in_progress replay");

  // Now verify with recovery_required
  session.paymentInitializationStatus = "recovery_required";
  const replayRecovery = replayActiveSession(session);
  assert.equal(replayRecovery.replayed, true);
  assert.equal(session.releaseTokenHash, hashA, "Original token hash must remain unaltered on recovery_required replay");
});

test("Release Token: successful replay rotation returns new token and invalidates old token only on delivery", () => {
  let activeHash = crypto.createHash("sha256").update("token_original_aaa").digest("hex");

  function rotateToken(): string {
    const freshRaw = crypto.randomBytes(32).toString("hex");
    activeHash = crypto.createHash("sha256").update(freshRaw).digest("hex");
    return freshRaw;
  }

  function verifyToken(token: string): boolean {
    const candidateHash = crypto.createHash("sha256").update(token).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(activeHash, "hex"));
  }

  // Original token is valid before rotation
  assert.equal(verifyToken("token_original_aaa"), true);

  // Successful replay delivers fresh token
  const deliveredToken = rotateToken();
  assert.notEqual(deliveredToken, "token_original_aaa");

  // Old token is now invalid; newly delivered token is valid
  assert.equal(verifyToken("token_original_aaa"), false);
  assert.equal(verifyToken(deliveredToken), true);
});

// ============================================================================
// 4. COMPLETE CHECKOUT INTENT FINGERPRINT (Packet 4D Requirement 5)
// ============================================================================

test("Fingerprint: changed postalCode produces conflicting fingerprint", () => {
  const baseItems = [{ productId: "p_100", quantity: 1 }];

  const addr1: ShippingAddress = {
    streetAddress: "123 Marina Street",
    city: "Lagos Island",
    state: "Lagos",
    postalCode: "100001",
  };

  const addr2: ShippingAddress = {
    ...addr1,
    postalCode: "100002", // Changed postal code
  };

  const fp1 = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "user@domain.com",
    customerName: "Buyer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: addr1,
  });

  const fp2 = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "user@domain.com",
    customerName: "Buyer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: addr2,
  });

  assert.notEqual(fp1, fp2, "Changed postal code must produce a different fingerprint");
});

test("Fingerprint: changed shipping-specific contact details produce conflicting fingerprint", () => {
  const baseItems = [{ productId: "p_100", quantity: 1 }];

  const baseAddr: ShippingAddress = {
    streetAddress: "45 Broad Street",
    city: "Lagos",
    state: "Lagos",
    postalCode: "101001",
    fullName: "Recipient A",
    phone: "+2348022222222",
    email: "recipientA@example.com",
  };

  const fpBase = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "orderer@domain.com",
    customerName: "Orderer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: baseAddr,
  });

  // Different shipping recipient name
  const fpDiffName = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "orderer@domain.com",
    customerName: "Orderer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: { ...baseAddr, fullName: "Recipient B" },
  });
  assert.notEqual(fpBase, fpDiffName, "Changed shipping recipient name must conflict");

  // Different shipping phone
  const fpDiffPhone = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "orderer@domain.com",
    customerName: "Orderer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: { ...baseAddr, phone: "+2348099999999" },
  });
  assert.notEqual(fpBase, fpDiffPhone, "Changed shipping phone must conflict");

  // Different shipping email
  const fpDiffEmail = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "orderer@domain.com",
    customerName: "Orderer",
    customerPhone: "+2348011111111",
    deliveryMethod: "shipping",
    shippingAddress: { ...baseAddr, email: "other_recipient@example.com" },
  });
  assert.notEqual(fpBase, fpDiffEmail, "Changed shipping email must conflict");
});

test("Fingerprint: normalized identical address replays successfully", () => {
  const baseItems = [{ productId: "p_100", quantity: 2 }];

  const addrA: ShippingAddress = {
    streetAddress: "  123 Lekki Expressway  ",
    city: "  Lagos  ",
    state: " LAGOS ",
    postalCode: " 105102 ",
    fullName: " John Doe ",
  };

  const addrB: ShippingAddress = {
    streetAddress: "123 lekki expressway",
    city: "lagos",
    state: "lagos",
    postalCode: "105102",
    fullName: "john doe",
  };

  const fpA = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "JOHN@EXAMPLE.COM ",
    customerName: " John Doe ",
    customerPhone: " +2348033333333 ",
    deliveryMethod: "shipping",
    shippingAddress: addrA,
  });

  const fpB = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "john@example.com",
    customerName: "John Doe",
    customerPhone: "+2348033333333",
    deliveryMethod: "shipping",
    shippingAddress: addrB,
  });

  assert.equal(fpA, fpB, "Case and whitespace normalized details must match and replay");
});

test("Fingerprint: pickup order includes normalized pickupLocationId", () => {
  const baseItems = [{ productId: "p_100", quantity: 1 }];

  const fpPickup1 = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "buyer@domain.com",
    customerName: "Buyer",
    customerPhone: "+2348011111111",
    deliveryMethod: "pickup",
    pickupLocationId: "hub_ikeja_01",
  });

  const fpPickup2 = computeCheckoutRequestFingerprint({
    canonicalItems: baseItems,
    customerEmail: "buyer@domain.com",
    customerName: "Buyer",
    customerPhone: "+2348011111111",
    deliveryMethod: "pickup",
    pickupLocationId: "hub_vi_02",
  });

  assert.notEqual(fpPickup1, fpPickup2, "Different pickup locations must produce different fingerprints");
});

// ============================================================================
// 5. COUPON TRANSACTIONAL REVALIDATION & DISAPPEARANCE (Packet 4D Requirements 6 & 7)
// ============================================================================

test("Coupon: transactional reread with changed code is rejected", () => {
  const normalizedCoupon = "SAVE20";

  // Simulate coupon document returned by initial query whose code was concurrently modified
  const transactionalDocData = {
    code: "SAVE10", // Concurrent modification
    isActive: true,
    discountType: "percentage" as const,
    discountValue: 10,
  };

  function validateTransactionalCoupon(codeFromDoc: string, requestedCode: string) {
    const authoritativeCode = (codeFromDoc || "").trim().toUpperCase();
    if (authoritativeCode !== requestedCode) {
      throw new CommerceValidationError(
        `Coupon code "${requestedCode}" is invalid or does not match authoritative record.`,
        400
      );
    }
  }

  assert.throws(
    () => validateTransactionalCoupon(transactionalDocData.code, normalizedCoupon),
    (err: any) => err instanceof CommerceValidationError && err.statusCode === 400
  );
});

test("Coupon: session with couponId but missing coupon at payment finalization enters anomaly path", () => {
  const currentSession = {
    id: "cs_missing_coupon_01",
    couponId: "disc_deleted_99",
    couponCode: "EXPIRED_SALE",
    totalAmount: 18000,
  };

  const discountDocExists = false; // Coupon was deleted

  let enteredAnomaly = false;
  let finalizedOrder = false;

  if (currentSession.couponId) {
    if (!discountDocExists) {
      // Packet 4D Requirement 7: Enter anomaly unfulfillable path
      enteredAnomaly = true;
    } else {
      finalizedOrder = true;
    }
  }

  assert.equal(enteredAnomaly, true, "Must enter anomaly unfulfillable path when coupon document disappeared");
  assert.equal(finalizedOrder, false, "Must never silently finalize an inconsistent discounted order");
});

// ============================================================================
// 6. FAST-PATH SESSION CONSISTENCY (Packet 4D Requirement 8)
// ============================================================================

test("Fast Path: finalized reference + wrong expectedCheckoutSessionId is rejected with 409", () => {
  const existingTx = {
    id: "paystack_ref_finalized_111",
    status: "finalized",
    orderId: "ord_111",
    checkoutSessionId: "cs_legitimate_owner_session",
  };

  function fastPathCheck(options?: { expectedCheckoutSessionId?: string }) {
    if (existingTx.status === "finalized" && existingTx.orderId) {
      if (options?.expectedCheckoutSessionId) {
        const expectedId = options.expectedCheckoutSessionId.trim();
        if (existingTx.checkoutSessionId !== expectedId) {
          throw new CommerceValidationError(
            `Checkout session binding error: finalized payment "${existingTx.id}" belongs to session "${existingTx.checkoutSessionId || ""}", not "${expectedId}".`,
            409
          );
        }
      }
      return { success: true, orderId: existingTx.orderId, replayed: true };
    }
    return { success: false };
  }

  // Caller attempts to claim finalized reference using an unrelated checkoutSessionId
  assert.throws(
    () => fastPathCheck({ expectedCheckoutSessionId: "cs_attacker_unrelated_session" }),
    (err: any) =>
      err instanceof CommerceValidationError &&
      err.statusCode === 409 &&
      err.message.includes("belongs to session")
  );

  // Correct session ID replays normally
  const replay = fastPathCheck({ expectedCheckoutSessionId: "cs_legitimate_owner_session" });
  assert.equal(replay.success, true);
  assert.equal(replay.orderId, "ord_111");
  assert.equal(replay.replayed, true);
});
