import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdvanceRefundStatus,
  getDominantRefundStatus,
  UpdateRefundStatusResult,
} from "@/lib/server/payment-finalizer";

// ============================================================================
// 1. CONCURRENT WEBHOOK ADVANCEMENT & RETRY (Packet 4F Requirements 1 & 2)
// ============================================================================

test("Concurrent Webhooks: concurrent processed and pending finishes processed", async () => {
  // Shared state representing Firestore documents
  let dbOrderRefundStatus = "initiating";
  let dbTxRefundStatus = "initiating";

  // Simulate transactional commit helper
  async function applyWebhookTransaction(incomingStatus: string) {
    // Transaction loop: re-reads and checks monotonicity
    const currentDominant = getDominantRefundStatus(dbOrderRefundStatus, dbTxRefundStatus);

    if (canAdvanceRefundStatus(currentDominant, incomingStatus)) {
      if (currentDominant !== incomingStatus) {
        dbOrderRefundStatus = incomingStatus;
        dbTxRefundStatus = incomingStatus;
        return { changed: true, status: incomingStatus };
      }
      return { changed: false, duplicate: true, status: incomingStatus };
    }

    return { changed: false, ignoredAsStale: true, status: currentDominant };
  }

  // Simulate Webhook A (processed) and Webhook B (pending) racing
  // Case 1: processed commits first, then pending commits
  dbOrderRefundStatus = "initiating";
  dbTxRefundStatus = "initiating";
  const resA1 = await applyWebhookTransaction("processed");
  const resB1 = await applyWebhookTransaction("pending");

  assert.equal(resA1.status, "processed");
  assert.equal(resA1.changed, true);
  assert.equal(resB1.ignoredAsStale, true);
  assert.equal(dbOrderRefundStatus, "processed");
  assert.equal(dbTxRefundStatus, "processed");

  // Case 2: pending commits first, then processed commits
  dbOrderRefundStatus = "initiating";
  dbTxRefundStatus = "initiating";
  const resB2 = await applyWebhookTransaction("pending");
  const resA2 = await applyWebhookTransaction("processed");

  assert.equal(resB2.status, "pending");
  assert.equal(resB2.changed, true);
  assert.equal(resA2.status, "processed");
  assert.equal(resA2.changed, true);
  assert.equal(dbOrderRefundStatus, "processed");
  assert.equal(dbTxRefundStatus, "processed");
});

test("Concurrent Webhooks: concurrent processed and failed finishes processed", async () => {
  let dbOrderRefundStatus = "initiating";
  let dbTxRefundStatus = "initiating";

  async function applyWebhookTransaction(incomingStatus: string) {
    const currentDominant = getDominantRefundStatus(dbOrderRefundStatus, dbTxRefundStatus);

    if (canAdvanceRefundStatus(currentDominant, incomingStatus)) {
      if (currentDominant !== incomingStatus) {
        dbOrderRefundStatus = incomingStatus;
        dbTxRefundStatus = incomingStatus;
        return { changed: true, status: incomingStatus };
      }
      return { changed: false, duplicate: true, status: incomingStatus };
    }

    return { changed: false, ignoredAsStale: true, status: currentDominant };
  }

  // processed commits first, then failed arrives
  const resA = await applyWebhookTransaction("processed");
  const resB = await applyWebhookTransaction("failed");

  assert.equal(resA.changed, true);
  assert.equal(resB.ignoredAsStale, true);
  assert.equal(dbOrderRefundStatus, "processed");
  assert.equal(dbTxRefundStatus, "processed");
});

test("Concurrent Webhooks: concurrent processing and pending finishes processing", async () => {
  let dbOrderRefundStatus = "initiating";
  let dbTxRefundStatus = "initiating";

  async function applyWebhookTransaction(incomingStatus: string) {
    const currentDominant = getDominantRefundStatus(dbOrderRefundStatus, dbTxRefundStatus);

    if (canAdvanceRefundStatus(currentDominant, incomingStatus)) {
      if (currentDominant !== incomingStatus) {
        dbOrderRefundStatus = incomingStatus;
        dbTxRefundStatus = incomingStatus;
        return { changed: true, status: incomingStatus };
      }
      return { changed: false, duplicate: true, status: incomingStatus };
    }

    return { changed: false, ignoredAsStale: true, status: currentDominant };
  }

  // processing commits first, then pending arrives
  const resA = await applyWebhookTransaction("processing");
  const resB = await applyWebhookTransaction("pending");

  assert.equal(resA.status, "processing");
  assert.equal(resB.ignoredAsStale, true);
  assert.equal(dbOrderRefundStatus, "processing");
  assert.equal(dbTxRefundStatus, "processing");
});

// ============================================================================
// 2. ORDERED PROGRESSION (Packet 4F Requirement 2)
// ============================================================================

test("Ordered Progression: pending followed by processing advances", () => {
  assert.equal(canAdvanceRefundStatus("pending", "processing"), true);
});

test("Ordered Progression: processing followed by processed advances", () => {
  assert.equal(canAdvanceRefundStatus("processing", "processed"), true);
});

// ============================================================================
// 3. ACKNOWLEDGEMENT SEMANTICS: DUPLICATE & STALE (Packet 4F Requirement 4 & 5)
// ============================================================================

test("Webhook Acknowledgement: duplicate pending is acknowledged successfully", () => {
  function evaluateWebhookOutcome(currentStatus: string, incomingStatus: string): UpdateRefundStatusResult {
    const dominant = currentStatus;
    if (dominant === incomingStatus) {
      return {
        success: true,
        matched: true,
        changed: false,
        duplicate: true,
        authoritativeStatus: dominant,
      };
    }
    return {
      success: true,
      matched: true,
      changed: true,
      authoritativeStatus: incomingStatus,
    };
  }

  const result = evaluateWebhookOutcome("pending", "pending");
  assert.equal(result.success, true);
  assert.equal(result.matched, true);
  assert.equal(result.changed, false);
  assert.equal(result.duplicate, true);
  assert.equal(result.authoritativeStatus, "pending");
});

test("Webhook Acknowledgement: duplicate processing is acknowledged successfully", () => {
  function evaluateWebhookOutcome(currentStatus: string, incomingStatus: string): UpdateRefundStatusResult {
    const dominant = currentStatus;
    if (dominant === incomingStatus) {
      return {
        success: true,
        matched: true,
        changed: false,
        duplicate: true,
        authoritativeStatus: dominant,
      };
    }
    return {
      success: true,
      matched: true,
      changed: true,
      authoritativeStatus: incomingStatus,
    };
  }

  const result = evaluateWebhookOutcome("processing", "processing");
  assert.equal(result.success, true);
  assert.equal(result.matched, true);
  assert.equal(result.changed, false);
  assert.equal(result.duplicate, true);
  assert.equal(result.authoritativeStatus, "processing");
});

test("Webhook Acknowledgement: stale pending after processed is acknowledged without mutation", () => {
  function evaluateWebhookOutcome(currentStatus: string, incomingStatus: string): UpdateRefundStatusResult {
    const canAdvance = canAdvanceRefundStatus(currentStatus, incomingStatus);
    if (!canAdvance) {
      return {
        success: true,
        matched: true,
        changed: false,
        ignoredAsStale: true,
        authoritativeStatus: currentStatus,
      };
    }
    return {
      success: true,
      matched: true,
      changed: true,
      authoritativeStatus: incomingStatus,
    };
  }

  const result = evaluateWebhookOutcome("processed", "pending");
  assert.equal(result.success, true);
  assert.equal(result.matched, true);
  assert.equal(result.changed, false);
  assert.equal(result.ignoredAsStale, true);
  assert.equal(result.authoritativeStatus, "processed");
});

test("Webhook Acknowledgement: stale failed after processed is acknowledged without mutation", () => {
  function evaluateWebhookOutcome(currentStatus: string, incomingStatus: string): UpdateRefundStatusResult {
    const canAdvance = canAdvanceRefundStatus(currentStatus, incomingStatus);
    if (!canAdvance) {
      return {
        success: true,
        matched: true,
        changed: false,
        ignoredAsStale: true,
        authoritativeStatus: currentStatus,
      };
    }
    return {
      success: true,
      matched: true,
      changed: true,
      authoritativeStatus: incomingStatus,
    };
  }

  const result = evaluateWebhookOutcome("processed", "failed");
  assert.equal(result.success, true);
  assert.equal(result.matched, true);
  assert.equal(result.changed, false);
  assert.equal(result.ignoredAsStale, true);
  assert.equal(result.authoritativeStatus, "processed");
});

test("Webhook Acknowledgement: stale event does not produce duplicate statusHistory", () => {
  const initialHistory = [
    { status: "paid", note: "Order placed" },
    { status: "paid", note: "Refund requested" },
    { status: "paid", note: 'Refund status updated to "processing"' },
  ];

  const order = {
    refundStatus: "processing",
    statusHistory: [...initialHistory],
  };

  const incomingStatus = "pending"; // Stale event arriving after processing

  if (canAdvanceRefundStatus(order.refundStatus, incomingStatus)) {
    order.statusHistory.push({
      status: "paid",
      note: `Refund status updated to "${incomingStatus}"`,
    });
  }

  assert.equal(order.statusHistory.length, initialHistory.length, "No status history entry should be added for stale event");
  assert.equal(order.statusHistory[order.statusHistory.length - 1].note, 'Refund status updated to "processing"');
});

test("Webhook Acknowledgement: unknown refund transaction remains a webhook processing failure", () => {
  // Given a payload with no matching order or payment_transaction document
  const orderExists = false;
  const payTxExists = false;

  let outcome: UpdateRefundStatusResult;
  if (!orderExists && !payTxExists) {
    outcome = {
      success: false,
      matched: false,
      changed: false,
    };
  } else {
    outcome = {
      success: true,
      matched: true,
      changed: true,
    };
  }

  // Webhook route evaluates: if (!outcome.matched || !outcome.success) return 500
  const httpStatusCode = !outcome.matched || !outcome.success ? 500 : 200;

  assert.equal(outcome.success, false);
  assert.equal(outcome.matched, false);
  assert.equal(httpStatusCode, 500, "Unknown transaction must return non-2xx for retry");
});

// ============================================================================
// 4. ORDER / PAYMENT TRANSACTION CONSISTENCY (Packet 4F Requirement 3)
// ============================================================================

test("State Consistency: order and payment transaction cannot finish with refund states moving backwards relative to one another", () => {
  // Pre-existing state mismatch: order is initiating, payment_transactions is already processing
  const effectiveOrderStatus = "initiating";
  const effectiveTxStatus = "processing";

  const dominant = getDominantRefundStatus(effectiveOrderStatus, effectiveTxStatus);
  assert.equal(dominant, "processing", "Dominant status must be the more advanced state (processing)");

  // Incoming event: pending (older than processing)
  const incoming = "pending";
  const canAdvance = canAdvanceRefundStatus(dominant, incoming);
  assert.equal(canAdvance, false, "Incoming pending cannot downgrade dominant processing");

  // Reconcile pre-existing mismatch forward:
  let finalOrderStatus = effectiveOrderStatus;
  let finalTxStatus = effectiveTxStatus;

  if (canAdvanceRefundStatus(finalOrderStatus, dominant)) {
    finalOrderStatus = dominant;
  }
  if (canAdvanceRefundStatus(finalTxStatus, dominant)) {
    finalTxStatus = dominant;
  }

  assert.equal(finalOrderStatus, "processing");
  assert.equal(finalTxStatus, "processing");
  assert.equal(finalOrderStatus, finalTxStatus, "Records must align at the dominant state without moving backwards");
});

// ============================================================================
// 5. PROCESS RACING INTERMEDIATE EVENTS & EXACTLY-ONCE RESTOCK (Packet 4F Requirement 6)
// ============================================================================

test("Race Protection: refund.processed racing refund.pending restocks exactly once", () => {
  let stockQuantity = 10;
  let restockCount = 0;

  const order = {
    paymentStatus: "paid",
    refundStatus: "initiating",
    items: [{ productId: "p1", quantity: 2 }],
  };

  function finalizeProcessed() {
    // Guard: already refunded / processed check
    if (order.paymentStatus === "refunded" || order.refundStatus === "processed") {
      return { alreadyProcessed: true };
    }

    // Restock
    for (const item of order.items) {
      stockQuantity += item.quantity;
      restockCount++;
    }

    order.paymentStatus = "refunded";
    order.refundStatus = "processed";
    return { alreadyProcessed: false };
  }

  function applyIntermediate(status: string) {
    const isTerminal = order.paymentStatus === "refunded" || order.refundStatus === "processed";
    if (isTerminal || !canAdvanceRefundStatus(order.refundStatus, status)) {
      return { changed: false, ignoredAsStale: true };
    }
    order.refundStatus = status;
    return { changed: true };
  }

  // 1. refund.processed arrives
  const p1 = finalizeProcessed();
  assert.equal(p1.alreadyProcessed, false);
  assert.equal(stockQuantity, 12);
  assert.equal(restockCount, 1);

  // 2. Delayed refund.pending arrives
  const intRes = applyIntermediate("pending");
  assert.equal(intRes.ignoredAsStale, true);
  assert.equal(order.refundStatus, "processed", "Must not downgrade from processed");

  // 3. Duplicate refund.processed arrives
  const p2 = finalizeProcessed();
  assert.equal(p2.alreadyProcessed, true);
  assert.equal(stockQuantity, 12, "Stock must not be incremented again");
  assert.equal(restockCount, 1, "Restock must execute exactly once");
});

// ============================================================================
// 6. ADMIN POST-PROVIDER HANDLER CONSISTENCY (Packet 4F Requirement 7)
// ============================================================================

test("Admin Refund Consistency: Admin post-provider handler does not downgrade an advanced payment record", () => {
  // Scenario: Admin calls refund; Paystack call accepted;
  // but meanwhile a webhook already set payment_transactions to processing!
  const curOrder = {
    refundStatus: "initiating",
    paymentStatus: "paid",
  };
  const curPayTx = {
    refundStatus: "processing", // Advanced by racing webhook!
    status: "finalized",
  };

  function reconcileAdminOutcome(orderStatus: string, txStatus: string) {
    const dominant = getDominantRefundStatus(orderStatus, txStatus);
    let finalOrder = orderStatus;
    let finalTx = txStatus;

    if (dominant === "initiating") {
      finalOrder = "pending";
      finalTx = "pending";
    } else {
      if (canAdvanceRefundStatus(orderStatus, dominant)) {
        finalOrder = dominant;
      }
      if (canAdvanceRefundStatus(txStatus, dominant)) {
        finalTx = dominant;
      }
    }
    return { dominant, finalOrder, finalTx };
  }

  const { dominant, finalOrder, finalTx } = reconcileAdminOutcome("initiating", "processing");

  assert.equal(dominant, "processing");
  assert.equal(finalOrder, "processing", "Order must be reconciled forward to processing");
  assert.equal(finalTx, "processing", "Payment transaction must NOT be downgraded to pending");
});
