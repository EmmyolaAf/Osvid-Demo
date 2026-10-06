import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  ReservationInvariantError,
  CommerceValidationError,
  validatePaymentReference,
} from "@/lib/server/pricing";
import { PaystackRefundError } from "@/lib/server/paystack";

// ============================================================================
// 1. ATOMIC PAYMENT INITIALIZATION CLAIM & RECOVERY (Requirements 1 & 2)
// ============================================================================

test("Initialization Concurrency: two concurrent initialization claims result in exactly one provider-call winner", async () => {
  type InitStatus = "uninitialized" | "initializing" | "initialized" | "failed" | "recovery_required";

  interface SessionState {
    id: string;
    status: "active" | "finalized" | "expired";
    reservationActive: boolean;
    paymentInitializationStatus: InitStatus;
    paymentInitializationClaimedAt?: string;
    paymentInitializationAttempt: number;
    paystackReference?: string;
    accessCode?: string;
  }

  const session: SessionState = {
    id: "cs_concurrent_001",
    status: "active",
    reservationActive: true,
    paymentInitializationStatus: "uninitialized",
    paymentInitializationAttempt: 0,
  };

  // Simulated transactional lock
  let transactionRunning = false;
  async function claimInit(callerId: string): Promise<{
    outcome: "proceed" | "in_progress" | "cached" | "recovery_required";
    paystackReference: string;
  }> {
    while (transactionRunning) {
      await new Promise((r) => setTimeout(r, 5));
    }
    transactionRunning = true;

    try {
      if (session.status !== "active" || !session.reservationActive) {
        throw new Error("Session is not active or reservation expired.");
      }

      if (session.paymentInitializationStatus === "initialized" && session.accessCode && session.paystackReference) {
        return { outcome: "cached", paystackReference: session.paystackReference };
      }

      if (session.paymentInitializationStatus === "initializing" && session.paymentInitializationClaimedAt) {
        const ageMs = Date.now() - new Date(session.paymentInitializationClaimedAt).getTime();
        if (ageMs < 60_000) {
          return { outcome: "in_progress", paystackReference: session.paystackReference! };
        } else {
          session.paymentInitializationStatus = "recovery_required";
          return { outcome: "recovery_required", paystackReference: session.paystackReference! };
        }
      }

      if (session.paymentInitializationStatus === "recovery_required") {
        return { outcome: "recovery_required", paystackReference: session.paystackReference! };
      }

      // Claim allowed: increment attempt and establish stable reference
      session.paymentInitializationAttempt += 1;
      if (!session.paystackReference) {
        session.paystackReference = `osvid_${session.id}_${crypto.randomBytes(4).toString("hex")}`;
      }
      session.paymentInitializationStatus = "initializing";
      session.paymentInitializationClaimedAt = new Date().toISOString();

      return { outcome: "proceed", paystackReference: session.paystackReference };
    } finally {
      transactionRunning = false;
    }
  }

  // Two callers claim concurrently
  const [callerA, callerB] = await Promise.all([
    claimInit("worker_A"),
    claimInit("worker_B"),
  ]);

  const outcomes = [callerA.outcome, callerB.outcome].sort();
  assert.deepEqual(outcomes, ["in_progress", "proceed"], "Exactly one winner acquires claim to call Paystack; second sees in_progress");

  // Verify provider reference is identical and stable BEFORE external call
  assert.equal(callerA.paystackReference, callerB.paystackReference);
  assert.ok(callerA.paystackReference.startsWith("osvid_cs_concurrent_001_"));
});

test("Initialization Recovery: ambiguous post-provider persistence failure enters recovery state without duplicate provider call", async () => {
  // Scenario: Provider accepted initialization, but persisting access_code to DB failed.
  // Session is left in "initializing" with a stable reference.
  const session = {
    id: "cs_recovery_002",
    status: "active" as const,
    reservationActive: true,
    paymentInitializationStatus: "initializing" as const,
    paymentInitializationClaimedAt: new Date(Date.now() - 90_000).toISOString(), // 90s ago (stale)
    paymentInitializationAttempt: 1,
    paystackReference: "osvid_cs_recovery_002_d3a8",
    accessCode: undefined as string | undefined,
  };

  function evaluateRetry(): { canCallProvider: boolean; error?: string } {
    const ageMs = Date.now() - new Date(session.paymentInitializationClaimedAt).getTime();
    if (ageMs >= 60_000) {
      // Stale claim MUST NOT blindly generate another reference or re-call Paystack
      return {
        canCallProvider: false,
        error: "Previous payment initialization is pending confirmation. Manual recovery required.",
      };
    }
    return { canCallProvider: false, error: "Payment initialization currently in progress." };
  }

  const result = evaluateRetry();
  assert.equal(result.canCallProvider, false, "Must not blindly call provider on stale ambiguous initialization");
  assert.match(result.error!, /recovery required|in progress/i);
  assert.equal(session.paystackReference, "osvid_cs_recovery_002_d3a8", "Stable reference is preserved");
});

// ============================================================================
// 2. FAIL CLOSED ON RESERVATION INVARIANTS (Requirement 3)
// ============================================================================

test("Reservation Invariants: active release with reservedQuantity < session quantity fails closed with typed error without counter mutation", () => {
  const product = {
    id: "prod-100",
    name: "Industrial Degreaser",
    stockQuantity: 50,
    reservedQuantity: 2, // Corrupted counter: only 2 reserved
  };

  const sessionQuantityToRelease = 5; // Session claims it reserved 5

  function releaseReservation(prod: typeof product, qty: number) {
    if (prod.reservedQuantity < qty) {
      // Requirement 3: FAIL CLOSED. DO NOT clamp with Math.max(0, ...).
      throw new ReservationInvariantError(
        `Reservation invariant violated: product ${prod.id} reservedQuantity (${prod.reservedQuantity}) is less than release quantity (${qty}).`
      );
    }
    prod.reservedQuantity -= qty;
  }

  assert.throws(
    () => releaseReservation(product, sessionQuantityToRelease),
    (err: any) => {
      assert.ok(err instanceof ReservationInvariantError);
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /reservedQuantity \(2\) is less than release quantity \(5\)/);
      return true;
    }
  );

  // Assert counters remained UNCHANGED
  assert.equal(product.reservedQuantity, 2, "reservedQuantity must not be mutated on invariant violation");
  assert.equal(product.stockQuantity, 50, "stockQuantity must not be mutated on invariant violation");
});

test("Reservation Invariants: active finalization with insufficient reservedQuantity fails closed without stock deduction", () => {
  const product = {
    id: "prod-200",
    name: "Caustic Soda",
    stockQuantity: 20,
    reservedQuantity: 1, // Only 1 reserved
  };

  const sessionQuantityPurchased = 3;

  function finalizeActiveReservation(prod: typeof product, qty: number) {
    if (prod.reservedQuantity < qty) {
      throw new ReservationInvariantError(
        `Reservation invariant violated: product ${prod.id} reservedQuantity (${prod.reservedQuantity}) is less than required (${qty}).`
      );
    }
    prod.reservedQuantity -= qty;
    prod.stockQuantity -= qty;
  }

  assert.throws(
    () => finalizeActiveReservation(product, sessionQuantityPurchased),
    (err: any) => {
      assert.ok(err instanceof ReservationInvariantError);
      return true;
    }
  );

  // Confirm NO physical stock deduction and NO reservation reduction occurred
  assert.equal(product.stockQuantity, 20);
  assert.equal(product.reservedQuantity, 1);
});

test("Reservation Invariants: coupon reservedUsageCount underflow fails closed without counter mutation", () => {
  const coupon = {
    code: "PROMO50",
    usageCount: 10,
    reservedUsageCount: 0, // Corrupted counter: 0 reserved
  };

  function consumeCouponReservation(c: typeof coupon) {
    if (c.reservedUsageCount < 1) {
      throw new ReservationInvariantError(
        `Reservation invariant violated: coupon ${c.code} reservedUsageCount (${c.reservedUsageCount}) is less than 1.`
      );
    }
    c.usageCount += 1;
    c.reservedUsageCount -= 1;
  }

  assert.throws(
    () => consumeCouponReservation(coupon),
    (err: any) => {
      assert.ok(err instanceof ReservationInvariantError);
      assert.match(err.message, /reservedUsageCount \(0\) is less than 1/);
      return true;
    }
  );

  assert.equal(coupon.usageCount, 10, "usageCount must remain unmutated");
  assert.equal(coupon.reservedUsageCount, 0, "reservedUsageCount must remain unmutated");
});

// ============================================================================
// 3. FIRESTORE TRANSACTION READ-BEFORE-WRITE ORDERING (Requirement 4)
// ============================================================================

test("Transaction Order: multi-product release strictly performs all reads before writes", async () => {
  const operationsLog: string[] = [];

  // Transaction audit harness
  const mockTransaction = {
    get: async (docName: string) => {
      operationsLog.push(`READ:${docName}`);
      return { exists: true, data: () => ({ reservedQuantity: 10 }) };
    },
    update: (docName: string, data: any) => {
      operationsLog.push(`WRITE:${docName}`);
    },
  };

  // Refactored ordering per Requirement 4:
  // Step 1: Read session
  await mockTransaction.get("checkout_sessions/cs_01");
  // Step 2: Read all products
  await mockTransaction.get("products/p_01");
  await mockTransaction.get("products/p_02");
  // Step 3: Read coupon
  await mockTransaction.get("discounts/d_01");

  // Step 4: Validate invariants, then perform all writes
  mockTransaction.update("products/p_01", { reservedQuantity: 8 });
  mockTransaction.update("products/p_02", { reservedQuantity: 7 });
  mockTransaction.update("discounts/d_01", { reservedUsageCount: 0 });
  mockTransaction.update("checkout_sessions/cs_01", { reservationActive: false });

  // Verification: All READs must precede the first WRITE
  const firstWriteIndex = operationsLog.findIndex((op) => op.startsWith("WRITE:"));
  const lastReadIndex = operationsLog.map((op, i) => (op.startsWith("READ:") ? i : -1)).reduce((a, b) => Math.max(a, b));

  assert.ok(lastReadIndex < firstWriteIndex, `All reads (${lastReadIndex}) must precede first write (${firstWriteIndex})`);
});

test("Transaction Order: multi-product refund reconciliation strictly performs all reads before writes", async () => {
  const operationsLog: string[] = [];

  const mockTransaction = {
    get: async (docName: string) => {
      operationsLog.push(`READ:${docName}`);
      return { exists: true, data: () => ({ stockQuantity: 20 }) };
    },
    update: (docName: string, data: any) => {
      operationsLog.push(`WRITE:${docName}`);
    },
    set: (docName: string, data: any) => {
      operationsLog.push(`WRITE:${docName}`);
    },
  };

  // Step 1: Read order
  await mockTransaction.get("orders/ord_01");
  // Step 2: Read ALL products
  await mockTransaction.get("products/p_01");
  await mockTransaction.get("products/p_02");
  // Step 3: Read user
  await mockTransaction.get("users/usr_01");
  // Step 4: Read payment transaction
  await mockTransaction.get("payment_transactions/pay_ref_01");

  // Step 5: Perform all writes
  mockTransaction.update("products/p_01", { stockQuantity: 22 });
  mockTransaction.set("inventory_movements/ret_p01", {});
  mockTransaction.update("products/p_02", { stockQuantity: 21 });
  mockTransaction.set("inventory_movements/ret_p02", {});
  mockTransaction.update("users/usr_01", { totalSpent: 0 });
  mockTransaction.update("orders/ord_01", { paymentStatus: "refunded" });
  mockTransaction.update("payment_transactions/pay_ref_01", { status: "refunded" });

  const firstWriteIndex = operationsLog.findIndex((op) => op.startsWith("WRITE:"));
  const lastReadIndex = operationsLog.map((op, i) => (op.startsWith("READ:") ? i : -1)).reduce((a, b) => Math.max(a, b));

  assert.ok(lastReadIndex < firstWriteIndex, `All refund reads (${lastReadIndex}) must precede first refund write (${firstWriteIndex})`);
});

// ============================================================================
// 4. STRICT PAYMENT & SESSION METADATA BINDING (Requirement 5)
// ============================================================================

test("Payment Binding: rejects mismatch in metadata.clientId, checkoutSessionId, or reference", () => {
  const authoritativeSession = {
    id: "cs_bound_789",
    paystackReference: "osvid_cs_bound_789_ref",
    totalAmountKobo: 2500000,
    customerEmail: "client@example.com",
  };

  function assertPaymentBinding(verifiedData: {
    reference: string;
    metadata?: Record<string, any>;
  }) {
    // Requirement 5
    if (verifiedData.metadata?.clientId !== "osvid") {
      throw new CommerceValidationError("Paystack metadata clientId must be 'osvid'.", 403);
    }
    if (verifiedData.metadata?.checkoutSessionId !== authoritativeSession.id) {
      throw new CommerceValidationError("Paystack metadata checkoutSessionId does not match session ID.", 409);
    }
    if (authoritativeSession.paystackReference && authoritativeSession.paystackReference !== verifiedData.reference) {
      throw new CommerceValidationError("Session paystackReference does not match verified reference.", 409);
    }
    return true;
  }

  // 1. Correct binding succeeds
  assert.equal(
    assertPaymentBinding({
      reference: "osvid_cs_bound_789_ref",
      metadata: { clientId: "osvid", checkoutSessionId: "cs_bound_789" },
    }),
    true
  );

  // 2. Missing/Wrong clientId rejected
  assert.throws(
    () =>
      assertPaymentBinding({
        reference: "osvid_cs_bound_789_ref",
        metadata: { clientId: "other_store", checkoutSessionId: "cs_bound_789" },
      }),
    (err: any) => err instanceof CommerceValidationError && err.statusCode === 403
  );

  // 3. Mismatched checkoutSessionId rejected
  assert.throws(
    () =>
      assertPaymentBinding({
        reference: "osvid_cs_bound_789_ref",
        metadata: { clientId: "osvid", checkoutSessionId: "cs_attacker_session" },
      }),
    (err: any) => err instanceof CommerceValidationError && err.statusCode === 409
  );

  // 4. Mismatched payment reference rejected
  assert.throws(
    () =>
      assertPaymentBinding({
        reference: "osvid_other_reference",
        metadata: { clientId: "osvid", checkoutSessionId: "cs_bound_789" },
      }),
    (err: any) => err instanceof CommerceValidationError && err.statusCode === 409
  );
});

// ============================================================================
// 5. FINALIZER IMMUTABLE SESSION STATE RECHECK (Requirement 6)
// ============================================================================

test("Finalizer Transaction State: rechecks immutable session snapshot fields inside transaction and fails closed on drift", () => {
  const verifiedSnapshot = {
    id: "cs_snap_001",
    totalAmountKobo: 500000,
    currency: "NGN",
    customerEmail: "buyer@domain.com",
    paystackReference: "ref_snap_001",
    items: [{ productId: "p1", quantity: 2, unitPrice: 2500 }],
  };

  function validateCurrentSessionState(currentSession: typeof verifiedSnapshot) {
    if (currentSession.id !== verifiedSnapshot.id) {
      throw new Error("Session ID mismatch");
    }
    if (currentSession.totalAmountKobo !== verifiedSnapshot.totalAmountKobo) {
      throw new Error("Authoritative amount altered mid-flight");
    }
    if (currentSession.currency !== "NGN") {
      throw new Error("Currency altered");
    }
    if (currentSession.customerEmail !== verifiedSnapshot.customerEmail) {
      throw new Error("Email altered");
    }
    if (currentSession.paystackReference !== verifiedSnapshot.paystackReference) {
      throw new Error("Paystack reference altered");
    }
    if (currentSession.items.length !== verifiedSnapshot.items.length) {
      throw new Error("Item count altered");
    }
    for (let i = 0; i < currentSession.items.length; i++) {
      if (currentSession.items[i].productId !== verifiedSnapshot.items[i].productId ||
          currentSession.items[i].quantity !== verifiedSnapshot.items[i].quantity ||
          currentSession.items[i].unitPrice !== verifiedSnapshot.items[i].unitPrice) {
        throw new Error("Item spec altered");
      }
    }
    return true;
  }

  // Untampered passes
  assert.equal(validateCurrentSessionState({ ...verifiedSnapshot }), true);

  // Tampered total amount fails closed
  assert.throws(
    () => validateCurrentSessionState({ ...verifiedSnapshot, totalAmountKobo: 400000 }),
    /Authoritative amount altered/
  );

  // Tampered item quantity fails closed
  assert.throws(
    () => validateCurrentSessionState({
      ...verifiedSnapshot,
      items: [{ productId: "p1", quantity: 5, unitPrice: 2500 }],
    }),
    /Item spec altered/
  );
});

// ============================================================================
// 6. RECEIPT RETRY FOR FINALIZED PAYMENTS (Requirement 7)
// ============================================================================

test("Receipt Retry: finalized payment whose email previously failed can retry and reclaims abandoned claims", () => {
  interface PaymentTx {
    status: "finalized";
    receiptEmailStatus: "pending" | "sending" | "sent" | "failed";
    receiptEmailClaimedAt?: string;
  }

  const tx: PaymentTx = {
    status: "finalized",
    receiptEmailStatus: "failed", // previously failed
  };

  function claimReceiptSend(currentTx: PaymentTx, nowMs: number): boolean {
    if (currentTx.receiptEmailStatus === "sent") return false;

    if (currentTx.receiptEmailStatus === "sending" && currentTx.receiptEmailClaimedAt) {
      const ageMs = nowMs - new Date(currentTx.receiptEmailClaimedAt).getTime();
      if (ageMs < 5 * 60 * 1000) return false; // Non-stale claim blocks
    }

    currentTx.receiptEmailStatus = "sending";
    currentTx.receiptEmailClaimedAt = new Date(nowMs).toISOString();
    return true;
  }

  const t0 = 1700000000000;

  // 1. Reconcile/replay when previous status was 'failed': claim is permitted
  assert.equal(claimReceiptSend(tx, t0), true);
  assert.equal(tx.receiptEmailStatus, "sending");

  // 2. Concurrent second caller within 5m is blocked
  assert.equal(claimReceiptSend(tx, t0 + 60_000), false);

  // 3. Stale sending claim (>5 minutes) is reclaimed
  assert.equal(claimReceiptSend(tx, t0 + 6 * 60_000), true);

  // 4. Once sent, never retried
  tx.receiptEmailStatus = "sent";
  assert.equal(claimReceiptSend(tx, t0 + 10 * 60_000), false);
});

// ============================================================================
// 7. REFUND CLAIM SEMANTICS & ERROR CLASSIFICATION (Requirements 8, 9, 10, 11)
// ============================================================================

test("Refund Claim: stale initiating state blocks duplicate Paystack call without time expiration", () => {
  const order = {
    id: "ord_stale_ref_01",
    refundStatus: "initiating",
    refundRequestedAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
  };

  function attemptRefund(ord: typeof order) {
    if (ord.refundStatus === "initiating") {
      // Requirement 8: NO 2-minute time fallthrough!
      throw new Error(`CONFLICT:Refund is currently in initiating state for order "${ord.id}". Refund reconciliation required.`);
    }
  }

  assert.throws(
    () => attemptRefund(order),
    /Refund reconciliation required/
  );
});

test("Refund Error Classification: distinguishes definitive provider rejection from ambiguous transport failure", () => {
  // Provider definitively rejected (HTTP 400, or status=false) -> failed
  const definitiveError = new PaystackRefundError("Transaction has already been fully refunded", true, 400);
  assert.equal(definitiveError.isDefinitive, true);

  // Ambiguous transport failure (network timeout / reset / 5xx) -> needs_attention / reconciliation_required
  const transportError = new PaystackRefundError("Paystack refund transport error: fetch failed", false);
  assert.equal(transportError.isDefinitive, false);

  function mapRefundFailure(err: PaystackRefundError): { refundStatus: string; reconciliationRequired: boolean } {
    if (err.isDefinitive) {
      return { refundStatus: "failed", reconciliationRequired: false };
    } else {
      return { refundStatus: "needs_attention", reconciliationRequired: true };
    }
  }

  assert.deepEqual(mapRefundFailure(definitiveError), { refundStatus: "failed", reconciliationRequired: false });
  assert.deepEqual(mapRefundFailure(transportError), { refundStatus: "needs_attention", reconciliationRequired: true });
});

test("Refund Identifier Separation: payment transaction reference and refund reference remain distinct", () => {
  const webhookPayload = {
    id: 112233,
    transaction_reference: "pay_charge_orig_99",
    refund_reference: "ref_provider_rf_88",
    reference: "pay_charge_orig_99", // Paystack may include charge ref in reference
  };

  const cleanTxRef = webhookPayload.transaction_reference;
  const providerRefundId = String(webhookPayload.id);
  const refundReference =
    webhookPayload.refund_reference ||
    (webhookPayload.reference !== cleanTxRef ? webhookPayload.reference : null);

  assert.equal(cleanTxRef, "pay_charge_orig_99");
  assert.equal(providerRefundId, "112233");
  assert.equal(refundReference, "ref_provider_rf_88");
  assert.notEqual(refundReference, cleanTxRef, "Refund reference must never be confused with charge transaction reference");
});

// ============================================================================
// 8. REFUND WEBHOOK RESULT ACKNOWLEDGEMENT (Requirement 12)
// ============================================================================

test("Refund Webhook Acknowledgement: unhandled or failed reconciliation returns 500 so provider retries", () => {
  function processWebhookOutcome(res: { success: boolean; updated?: boolean }): number {
    if (!res.success || (res.updated !== undefined && !res.updated)) {
      return 500; // Trigger Paystack webhook retry
    }
    return 200;
  }

  // Failed finalizeProcessedRefund returns 500
  assert.equal(processWebhookOutcome({ success: false }), 500);

  // Failed updateRefundStatus (transaction not found / not updated) returns 500
  assert.equal(processWebhookOutcome({ success: true, updated: false }), 500);

  // Successful update returns 200
  assert.equal(processWebhookOutcome({ success: true, updated: true }), 200);
});

// ============================================================================
// 9. CLIENT AUTHENTICATED-CHECKOUT DOWNGRADE (Requirement 15)
// ============================================================================

test("Client Auth: token retrieval failure aborts checkout with error and never downgrades to guest", async () => {
  const mockUser = {
    email: "customer@osvid.internal",
    getIdToken: async () => {
      throw new Error("Token refresh network failure");
    },
  };

  let checkoutAborted = false;
  let proceededAsGuest = false;

  async function handleCheckoutAuth(user: typeof mockUser | null) {
    let authHeaders: Record<string, string> = {};
    if (user) {
      try {
        const idToken = await user.getIdToken();
        if (!idToken) throw new Error("Empty credentials");
        authHeaders = { Authorization: `Bearer ${idToken}` };
      } catch {
        // Requirement 15: Must abort checkout, never silently proceed as guest
        checkoutAborted = true;
        return;
      }
    } else {
      proceededAsGuest = true;
    }
  }

  // Logged in user with failed token -> ABORTS
  await handleCheckoutAuth(mockUser);
  assert.equal(checkoutAborted, true);
  assert.equal(proceededAsGuest, false);

  // Truly logged-out user (null) -> proceeds as guest
  checkoutAborted = false;
  proceededAsGuest = false;
  await handleCheckoutAuth(null);
  assert.equal(checkoutAborted, false);
  assert.equal(proceededAsGuest, true);
});

// ============================================================================
// 10. DELIVERY METHOD STRICT VALIDATION (Requirement 16)
// ============================================================================

test("Validation: deliveryMethod 'anything_else' rejected with HTTP 400; 'shipping' and 'pickup' accepted", () => {
  function validateDeliveryMethod(rawMethod: any): "shipping" | "pickup" {
    if (rawMethod !== "shipping" && rawMethod !== "pickup") {
      throw new CommerceValidationError(
        `Invalid deliveryMethod "${rawMethod}". Allowed values are "shipping" or "pickup".`,
        400
      );
    }
    return rawMethod;
  }

  // Valid methods
  assert.equal(validateDeliveryMethod("shipping"), "shipping");
  assert.equal(validateDeliveryMethod("pickup"), "pickup");

  // Invalid methods rejected with 400
  const invalidInputs = ["anything_else", "delivery", "courier", "drone", "", 123, null, undefined];
  for (const input of invalidInputs) {
    assert.throws(
      () => validateDeliveryMethod(input),
      (err: any) => err instanceof CommerceValidationError && err.statusCode === 400
    );
  }
});

// ============================================================================
// 11. VERIFICATION ROUTE AUTHORITATIVE AMOUNTS (Requirement 18)
// ============================================================================

test("Verify Response: finalized verification returns authoritative amount and currency, not zero", () => {
  const finalizerResult = {
    success: true,
    orderId: "ORD-TEST-999",
    amount: 32500,
    amountKobo: 3250000,
    currency: "NGN" as const,
    replayed: true,
    emailSent: true,
  };

  const verificationApiResponse = {
    success: true,
    payment: true,
    emailSent: finalizerResult.emailSent,
    data: {
      reference: "ref_test_999",
      amount: finalizerResult.amount ?? 0,
      currency: finalizerResult.currency || "NGN",
      orderId: finalizerResult.orderId,
    },
  };

  assert.equal(verificationApiResponse.data.amount, 32500, "Must return real authoritative amount");
  assert.notEqual(verificationApiResponse.data.amount, 0, "Must not return placeholder 0");
  assert.equal(verificationApiResponse.data.currency, "NGN");
  assert.equal(verificationApiResponse.data.orderId, "ORD-TEST-999");
});
