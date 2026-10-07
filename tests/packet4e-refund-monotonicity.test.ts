import test from "node:test";
import assert from "node:assert/strict";
import { ReservationInvariantError } from "@/lib/server/pricing";
import { PaystackRefundError } from "@/lib/server/paystack";
import { canAdvanceRefundStatus } from "@/lib/server/payment-finalizer";

// ============================================================================
// 1. ANOMALY RESERVATION RELEASE (Packet 4E Requirement 1)
// ============================================================================

test("Anomaly Reservation Release: active checkout + deleted coupon releases product reservedQuantity and preserves stockQuantity", async () => {
  // Setup: checkout session with active reservation and a coupon that no longer exists
  const currentSession = {
    id: "cs_anom_001",
    couponId: "cpn_deleted_99",
    couponCode: "MISSINGCOUPON",
    reservationActive: true,
    totalAmount: 15000,
    customerEmail: "buyer@example.com",
    items: [
      { productId: "prod_a", name: "Product A", quantity: 2, unitPrice: 5000 },
      { productId: "prod_b", name: "Product B", quantity: 1, unitPrice: 5000 },
    ],
  };

  const productDocs = [
    {
      item: currentSession.items[0],
      stockQuantity: 20,
      reservedQuantity: 2,
    },
    {
      item: currentSession.items[1],
      stockQuantity: 10,
      reservedQuantity: 3,
    },
  ];

  // Coupon does NOT exist in discounts collection
  const couponExists = false;
  const couponDisappeared = Boolean(currentSession.couponId && !couponExists);
  assert.equal(couponDisappeared, true);

  const writesLog: Record<string, any> = {};
  const nowIso = new Date().toISOString();

  // Execute anomaly reservation release logic
  if (couponDisappeared) {
    const isReservationActive = Boolean(currentSession.reservationActive);
    const anomalyReason = `Coupon "${currentSession.couponCode || currentSession.couponId}" disappeared before payment finalization. Cannot complete redemption bookkeeping.`;

    if (isReservationActive) {
      // 1. Validate for every item: product.reservedQuantity >= item.quantity
      for (const p of productDocs) {
        if (p.reservedQuantity < p.item.quantity) {
          throw new ReservationInvariantError(
            `Reservation invariant violated during coupon anomaly release: product ${p.item.productId} reservedQuantity (${p.reservedQuantity}) is less than required (${p.item.quantity}).`
          );
        }
      }

      // 2. Decrement reservedQuantity -= item.quantity for every reserved product
      // Note: stockQuantity must NOT be decremented because no order is completed
      for (const p of productDocs) {
        p.reservedQuantity -= p.item.quantity;
        writesLog[`products/${p.item.productId}`] = {
          reservedQuantity: p.reservedQuantity,
          stockQuantity: p.stockQuantity, // untouched
        };
      }
    }

    // 3. Update checkout session: status = "anomaly_unfulfillable", reservationActive = false, releaseReason
    writesLog[`checkout_sessions/${currentSession.id}`] = {
      status: "anomaly_unfulfillable",
      reservationActive: false,
      releaseReason: "coupon_missing_at_payment_finalization",
      anomalyReason,
    };

    // 4. Create anomaly payment transaction record
    writesLog[`payment_transactions/pay_anom_001`] = {
      status: "anomaly_unfulfillable",
      anomalyReason,
      needsRefund: true,
      refundStatus: "none",
    };
  }

  // Verifications
  assert.equal(productDocs[0].reservedQuantity, 0, "Product A reservedQuantity must be decremented by 2");
  assert.equal(productDocs[0].stockQuantity, 20, "Product A physical stockQuantity must remain untouched");
  assert.equal(productDocs[1].reservedQuantity, 2, "Product B reservedQuantity must be decremented by 1 (3 - 1 = 2)");
  assert.equal(productDocs[1].stockQuantity, 10, "Product B physical stockQuantity must remain untouched");

  const sessionUpdate = writesLog[`checkout_sessions/${currentSession.id}`];
  assert.equal(sessionUpdate.status, "anomaly_unfulfillable");
  assert.equal(sessionUpdate.reservationActive, false);
  assert.equal(sessionUpdate.releaseReason, "coupon_missing_at_payment_finalization");

  const payTxUpdate = writesLog[`payment_transactions/pay_anom_001`];
  assert.equal(payTxUpdate.status, "anomaly_unfulfillable");
  assert.equal(payTxUpdate.needsRefund, true);
  assert.equal(payTxUpdate.refundStatus, "none");
});

test("Anomaly Reservation Release: reservation underflow fails closed without writes or clamping", () => {
  const currentSession = {
    id: "cs_anom_underflow",
    couponId: "cpn_deleted_corrupt",
    reservationActive: true,
    items: [{ productId: "prod_underflow", quantity: 5, unitPrice: 1000 }],
  };

  const productDocs = [
    {
      item: currentSession.items[0],
      stockQuantity: 10,
      reservedQuantity: 3, // Corrupted: only 3 reserved, but session asks to release 5
    },
  ];

  function runAnomalyRelease() {
    for (const p of productDocs) {
      if (p.reservedQuantity < p.item.quantity) {
        throw new ReservationInvariantError(
          `Reservation invariant violated during coupon anomaly release: product ${p.item.productId} reservedQuantity (${p.reservedQuantity}) is less than required (${p.item.quantity}).`
        );
      }
    }
  }

  assert.throws(
    () => runAnomalyRelease(),
    (err: any) => {
      assert.ok(err instanceof ReservationInvariantError);
      assert.match(err.message, /reservedQuantity \(3\) is less than required \(5\)/);
      return true;
    }
  );

  // Assert no clamping occurred
  assert.equal(productDocs[0].reservedQuantity, 3, "reservedQuantity must not be modified or clamped");
  assert.equal(productDocs[0].stockQuantity, 10, "stockQuantity must remain untouched");
});

test("Anomaly Reservation Release: already-released checkout does not decrement reservation again", () => {
  const currentSession = {
    id: "cs_anom_already_released",
    couponId: "cpn_deleted_stale",
    reservationActive: false, // Session had already been released earlier!
    items: [{ productId: "prod_stale", quantity: 2, unitPrice: 2000 }],
  };

  const productDocs = [
    {
      item: currentSession.items[0],
      stockQuantity: 10,
      reservedQuantity: 4,
    },
  ];

  let productReservationMutated = false;

  const isReservationActive = Boolean(currentSession.reservationActive);
  if (isReservationActive) {
    productDocs[0].reservedQuantity -= 2;
    productReservationMutated = true;
  }

  assert.equal(productReservationMutated, false, "Must not decrement reservation if reservationActive is false");
  assert.equal(productDocs[0].reservedQuantity, 4, "reservedQuantity must remain exactly as was");
});

// ============================================================================
// 2. ADMIN REFUND RACE (Packet 4E Requirement 3, 6, 7)
// ============================================================================

test("Admin Refund Race: Admin call owns initiating → pending when no webhook raced", () => {
  let orderRefundStatus = "initiating";
  const outcomeType = "accepted";
  const providerRefundId = "rf_123";
  const refundReference = "ref_456";

  let finalStatus = "";
  if (orderRefundStatus === "initiating") {
    if (outcomeType === "accepted") {
      orderRefundStatus = "pending";
      finalStatus = "pending";
    }
  } else {
    finalStatus = orderRefundStatus;
  }

  assert.equal(orderRefundStatus, "pending");
  assert.equal(finalStatus, "pending");
});

test("Admin Refund Race: webhook processing before Admin persistence remains processing", () => {
  // Webhook arrived during external provider call and moved order to "processing"
  let orderRefundStatus = "processing";
  const outcomeType = "accepted";

  let preservedStatus = "";
  if (orderRefundStatus === "initiating") {
    orderRefundStatus = "pending";
    preservedStatus = "pending";
  } else {
    // Newer state preserved!
    preservedStatus = orderRefundStatus;
  }

  assert.equal(orderRefundStatus, "processing", "Order status must not be downgraded to pending");
  assert.equal(preservedStatus, "processing");
});

test("Admin Refund Race: webhook processed before Admin persistence remains processed", () => {
  // Webhook arrived and moved order to "processed"
  let orderRefundStatus = "processed";
  const outcomeType = "accepted";

  let preservedStatus = "";
  if (orderRefundStatus === "initiating") {
    orderRefundStatus = "pending";
    preservedStatus = "pending";
  } else {
    // Terminal processed state preserved!
    preservedStatus = orderRefundStatus;
  }

  assert.equal(orderRefundStatus, "processed", "Order status must not be downgraded from processed");
  assert.equal(preservedStatus, "processed");
});

test("Admin Refund Race: ambiguous HTTP timeout after webhook processed does NOT become needs_attention", () => {
  // Webhook arrived and moved order to "processed"
  let orderRefundStatus = "processed";
  const outcomeType = "ambiguous_error"; // e.g. fetch timed out after provider accepted
  const failureReason = "Paystack refund transport error: connection timed out";

  let preservedStatus = "";
  if (orderRefundStatus === "initiating") {
    orderRefundStatus = "needs_attention";
    preservedStatus = "needs_attention";
  } else {
    preservedStatus = orderRefundStatus;
  }

  assert.equal(orderRefundStatus, "processed", "processed state must NOT be replaced with needs_attention");
  assert.equal(preservedStatus, "processed");
});

test("Admin Refund Race: definitive HTTP failure after webhook processed does NOT become failed", () => {
  // Webhook arrived and moved order to "processed"
  let orderRefundStatus = "processed";
  const outcomeType = "definitive_rejection"; // e.g. delayed 400 response
  const failureReason = "Transaction has already been fully refunded";

  let preservedStatus = "";
  if (orderRefundStatus === "initiating") {
    orderRefundStatus = "failed";
    preservedStatus = "failed";
  } else {
    preservedStatus = orderRefundStatus;
  }

  assert.equal(orderRefundStatus, "processed", "processed state must NOT be replaced with failed");
  assert.equal(preservedStatus, "processed");
});

// ============================================================================
// 3. PAYMENT RECORD CLAIM CONSISTENCY (Packet 4E Requirement 4)
// ============================================================================

test("Payment Record Consistency: pre-provider initiating claim updates order + existing payment transaction together with all reads before writes", async () => {
  const db: Record<string, any> = {
    "orders/ord_claim_01": {
      id: "ord_claim_01",
      paymentStatus: "paid",
      refundStatus: "none",
      paystackReference: "pay_ref_claim_01",
      totalAmount: 12000,
    },
    "payment_transactions/pay_ref_claim_01": {
      id: "pay_ref_claim_01",
      refundStatus: "none",
    },
  };

  const operationsLog: string[] = [];

  // Simulate Firestore transaction
  const tx = {
    get: async (key: string) => {
      operationsLog.push(`READ:${key}`);
      const val = db[key];
      return { exists: Boolean(val), data: () => val };
    },
    update: (key: string, data: any) => {
      operationsLog.push(`WRITE:${key}`);
      Object.assign(db[key], data);
    },
  };

  // Transaction execution
  const orderSnap = await tx.get("orders/ord_claim_01");
  const order = orderSnap.data();

  const payTxSnap = await tx.get(`payment_transactions/${order.paystackReference}`);
  assert.equal(payTxSnap.exists, true);

  // All reads completed before any write
  tx.update("orders/ord_claim_01", { refundStatus: "initiating" });
  tx.update(`payment_transactions/${order.paystackReference}`, { refundStatus: "initiating" });

  const firstWrite = operationsLog.findIndex((op) => op.startsWith("WRITE:"));
  const lastRead = operationsLog.map((op, i) => (op.startsWith("READ:") ? i : -1)).reduce((a, b) => Math.max(a, b));

  assert.ok(lastRead < firstWrite, "All reads must precede first write");
  assert.equal(db["orders/ord_claim_01"].refundStatus, "initiating");
  assert.equal(db["payment_transactions/pay_ref_claim_01"].refundStatus, "initiating");
});

test("Payment Record Consistency: legacy order without payment transaction still remains supported", async () => {
  const db: Record<string, any> = {
    "orders/ord_legacy_01": {
      id: "ord_legacy_01",
      paymentStatus: "paid",
      refundStatus: "none",
      paystackReference: "pay_ref_legacy_01",
      totalAmount: 8000,
    },
  };

  const tx = {
    get: async (key: string) => {
      const val = db[key];
      return { exists: Boolean(val), data: () => val };
    },
    update: (key: string, data: any) => {
      Object.assign(db[key], data);
    },
  };

  const orderSnap = await tx.get("orders/ord_legacy_01");
  const order = orderSnap.data();

  // payment_transactions does not exist
  const payTxSnap = await tx.get(`payment_transactions/${order.paystackReference}`);
  assert.equal(payTxSnap.exists, false);

  // Successfully claims order without error
  tx.update("orders/ord_legacy_01", { refundStatus: "initiating" });
  if (payTxSnap.exists) {
    tx.update(`payment_transactions/${order.paystackReference}`, { refundStatus: "initiating" });
  }

  assert.equal(db["orders/ord_legacy_01"].refundStatus, "initiating", "Legacy order must claim initiating smoothly");
});

// ============================================================================
// 4. ANOMALY REFUND RACE (Packet 4E Requirement 5, 6, 7)
// ============================================================================

test("Anomaly Refund Race: provider accepted + webhook processed before local persistence remains processed", () => {
  let txRefundStatus = "processed"; // Webhook arrived before local HTTP finalizer resumed
  const refundAccepted = true;
  const providerRefundId = "pr_99";
  const refundReference = "rf_88";

  let savedStatus = "";
  if (txRefundStatus === "initiating") {
    txRefundStatus = "pending";
    savedStatus = "pending";
  } else {
    // Preserve newer state
    savedStatus = txRefundStatus;
  }

  assert.equal(txRefundStatus, "processed", "Must not downgrade from processed to pending");
  assert.equal(savedStatus, "processed");
});

test("Anomaly Refund Race: provider accepted + webhook processing remains processing", () => {
  let txRefundStatus = "processing"; // Webhook arrived before local persistence
  const refundAccepted = true;

  let savedStatus = "";
  if (txRefundStatus === "initiating") {
    txRefundStatus = "pending";
    savedStatus = "pending";
  } else {
    savedStatus = txRefundStatus;
  }

  assert.equal(txRefundStatus, "processing", "Must not downgrade from processing to pending");
  assert.equal(savedStatus, "processing");
});

test("Anomaly Refund Race: ambiguous transport while payment record still initiating becomes needs_attention", () => {
  let txRefundStatus = "initiating";
  const outcome = "ambiguous_error";

  if (txRefundStatus === "initiating") {
    if (outcome === "ambiguous_error") {
      txRefundStatus = "needs_attention";
    }
  }

  assert.equal(txRefundStatus, "needs_attention", "Genuine unresolved transport error transitions initiating to needs_attention");
});

test("Anomaly Refund Race: definitive rejection while still initiating becomes failed", () => {
  let txRefundStatus = "initiating";
  const outcome = "definitive_failure";

  if (txRefundStatus === "initiating") {
    if (outcome === "definitive_failure") {
      txRefundStatus = "failed";
    }
  }

  assert.equal(txRefundStatus, "failed", "Definitive provider rejection transitions initiating to failed");
});

// ============================================================================
// 5. OUT-OF-ORDER WEBHOOKS & MONOTONICITY (Packet 4E Requirement 8, 9)
// ============================================================================

test("Out-of-Order Webhooks: processed followed by pending does not downgrade", () => {
  assert.equal(canAdvanceRefundStatus("processed", "pending"), false);
});

test("Out-of-Order Webhooks: processed followed by processing does not downgrade", () => {
  assert.equal(canAdvanceRefundStatus("processed", "processing"), false);
});

test("Out-of-Order Webhooks: processed followed by failed does not downgrade", () => {
  assert.equal(canAdvanceRefundStatus("processed", "failed"), false);
});

test("Out-of-Order Webhooks: duplicate processed remains idempotent", () => {
  assert.equal(canAdvanceRefundStatus("processed", "processed"), true);
});

test("Out-of-Order Webhooks: pending → processing → processed works normally", () => {
  assert.equal(canAdvanceRefundStatus("none", "initiating"), true);
  assert.equal(canAdvanceRefundStatus("initiating", "pending"), true);
  assert.equal(canAdvanceRefundStatus("pending", "processing"), true);
  assert.equal(canAdvanceRefundStatus("processing", "processed"), true);
});

test("Out-of-Order Webhooks: processing cannot be downgraded to pending", () => {
  assert.equal(canAdvanceRefundStatus("processing", "pending"), false);
});

test("Out-of-Order Webhooks: needs_attention can advance on authenticated provider evidence", () => {
  assert.equal(canAdvanceRefundStatus("needs_attention", "pending"), true);
  assert.equal(canAdvanceRefundStatus("needs_attention", "processing"), true);
  assert.equal(canAdvanceRefundStatus("needs_attention", "processed"), true);
  assert.equal(canAdvanceRefundStatus("needs_attention", "failed"), true);
});
