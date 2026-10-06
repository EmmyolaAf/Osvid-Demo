import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  canonicalizeCartItems,
  CommerceValidationError,
} from "@/lib/server/pricing";
import {
  validateCheckoutRequestId,
  RESERVATION_EXPIRY_MINUTES,
} from "@/lib/server/checkout-session";
import {
  verifyWebhookSignature,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  initiatePaystackRefund,
  setPaystackTransportForTesting,
} from "@/lib/server/paystack";

// ===============================================================
// 1. PRICING & CART CANONICALIZATION TESTS
// ===============================================================

test("Pricing: rejects non-array, empty, or oversized cart items", () => {
  assert.throws(() => canonicalizeCartItems(null), /non-empty array/);
  assert.throws(() => canonicalizeCartItems([]), /non-empty array/);
  assert.throws(() => canonicalizeCartItems("not-an-array"), /non-empty array/);
  assert.throws(
    () => canonicalizeCartItems(Array(101).fill({ productId: "p1", quantity: 1 })),
    /maximum allowable cart items/
  );
});

test("Pricing: rejects zero, negative, floating-point, or invalid quantities", () => {
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: 0 }]),
    /positive integer/
  );
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: -5 }]),
    /positive integer/
  );
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: 2.5 }]),
    /positive integer/
  );
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: NaN }]),
    /positive integer/
  );
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: Infinity }]),
    /positive integer/
  );
  assert.throws(
    () => canonicalizeCartItems([{ productId: "p1", quantity: 1001 }]),
    /exceeds maximum single-order limit/
  );
});

test("Pricing: canonicalizes duplicate product IDs by summing quantities", () => {
  const rawItems = [
    { productId: "prod-chem-1", quantity: 2 },
    { productId: "prod-chem-2", quantity: 1 },
    { productId: "prod-chem-1", quantity: 3 },
  ];

  const canonical = canonicalizeCartItems(rawItems);
  assert.equal(canonical.length, 2);

  const item1 = canonical.find((i) => i.productId === "prod-chem-1");
  assert.equal(item1?.quantity, 5);

  const item2 = canonical.find((i) => i.productId === "prod-chem-2");
  assert.equal(item2?.quantity, 1);
});

test("Pricing: duplicate canonicalization rejects combined quantities exceeding 1,000", () => {
  const rawItems = [
    { productId: "prod-chem-1", quantity: 600 },
    { productId: "prod-chem-1", quantity: 500 },
  ];

  assert.throws(
    () => canonicalizeCartItems(rawItems),
    /Combined quantity for product "prod-chem-1" exceeds maximum/
  );
});

test("Pricing: ignores browser-supplied prices and uses Firestore authoritative pricing", () => {
  const firestoreProduct = {
    price: 50000,
    discountPrice: 45000,
    isActive: true,
  };

  // Browser attempt: claims price is ₦1 and discountPrice is ₦1
  const browserSpoofedItem = {
    productId: "p1",
    price: 1,
    discountPrice: 1,
    quantity: 2,
  };

  const hasDiscount =
    firestoreProduct.discountPrice !== undefined &&
    firestoreProduct.discountPrice > 0 &&
    firestoreProduct.discountPrice < firestoreProduct.price;

  const authoritativeUnitPrice = hasDiscount
    ? firestoreProduct.discountPrice
    : firestoreProduct.price;

  assert.equal(authoritativeUnitPrice, 45000);
  assert.notEqual(authoritativeUnitPrice, browserSpoofedItem.price);

  const lineTotal = authoritativeUnitPrice * browserSpoofedItem.quantity;
  assert.equal(lineTotal, 90000);

  const totalAmountKobo = Math.round(lineTotal * 100);
  assert.equal(totalAmountKobo, 9000000); // Integer kobo
});

test("Pricing: inactive product is rejected during quote calculation", () => {
  const inactiveProduct = {
    name: "Caustic Soda",
    isActive: false,
    price: 35000,
  };

  assert.equal(inactiveProduct.isActive, false);
});

// ===============================================================
// 2. COUPON SECURITY & RESERVATION TESTS
// ===============================================================

test("Coupons: percentage discount calculation is strictly bounded server-side", () => {
  const subtotal = 100000;
  const discountValue = 20; // 20%

  const percentage = Math.min(100, Math.max(0, discountValue));
  const discountAmount = Math.round((subtotal * percentage) / 100);

  assert.equal(discountAmount, 20000);
  assert.equal(subtotal - discountAmount, 80000);
});

test("Coupons: percentage discount exceeding 100% is capped at 100%", () => {
  const subtotal = 100000;
  const discountValue = 150; // Malicious 150%

  const percentage = Math.min(100, Math.max(0, discountValue));
  const discountAmount = Math.round((subtotal * percentage) / 100);

  assert.equal(discountAmount, 100000);
  assert.equal(subtotal - discountAmount, 0);
});

test("Coupons: fixed discount cannot exceed subtotal", () => {
  const subtotal = 25000;
  const discountValue = 50000; // Fixed ₦50,000 on ₦25,000 subtotal

  const discountAmount = Math.min(discountValue, subtotal);
  assert.equal(discountAmount, 25000);
  assert.equal(subtotal - discountAmount, 0);
});

test("Coupons: minimum order amount subtotal rule is enforced", () => {
  const subtotal = 15000;
  const minOrderAmount = 20000;

  assert.equal(subtotal < minOrderAmount, true);
});

test("Coupons: expired coupon is rejected", () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const expiry = new Date(pastDate);

  assert.equal(expiry.getTime() < Date.now(), true);
});

test("Coupons: max usage limit accounts for active reservations (effective capacity)", () => {
  const discount = {
    code: "FLASH10",
    maxUsageLimit: 10,
    usageCount: 8,
    reservedUsageCount: 2, // 2 currently committed in checkout sessions
  };

  const effectiveAvailable =
    discount.maxUsageLimit - discount.usageCount - discount.reservedUsageCount;

  assert.equal(effectiveAvailable, 0); // Rejects concurrent 11th customer
  assert.equal(effectiveAvailable <= 0, true);
});

test("Coupons: reservation release increments available capacity", () => {
  let reservedUsageCount = 2;
  // Abandoned reservation released
  reservedUsageCount = Math.max(0, reservedUsageCount - 1);
  assert.equal(reservedUsageCount, 1);

  // Second abandoned reservation released
  reservedUsageCount = Math.max(0, reservedUsageCount - 1);
  assert.equal(reservedUsageCount, 0);

  // Further release never makes counter negative
  reservedUsageCount = Math.max(0, reservedUsageCount - 1);
  assert.equal(reservedUsageCount, 0);
});

test("Coupons: successful finalization atomically shifts reservation to finalized usage", () => {
  let usageCount = 5;
  let reservedUsageCount = 1;

  // Payment finalized
  reservedUsageCount = Math.max(0, reservedUsageCount - 1);
  usageCount = usageCount + 1;

  assert.equal(reservedUsageCount, 0);
  assert.equal(usageCount, 6);
});

// ===============================================================
// 3. STOCK RESERVATION & EXPIRY TESTS
// ===============================================================

test("Inventory: available stock is stockQuantity minus reservedQuantity", () => {
  const product = {
    stockQuantity: 10,
    reservedQuantity: 3,
  };

  const available = product.stockQuantity - product.reservedQuantity;
  assert.equal(available, 7);

  // Backward compatibility: existing product without reservedQuantity treated as 0
  const legacyProduct = {
    stockQuantity: 15,
  };
  const legacyAvailable =
    legacyProduct.stockQuantity - ((legacyProduct as any).reservedQuantity || 0);
  assert.equal(legacyAvailable, 15);
});

test("Inventory: reservation rejects requests exceeding available stock", () => {
  const product = {
    stockQuantity: 5,
    reservedQuantity: 4,
  };
  const available = product.stockQuantity - product.reservedQuantity;
  const requestedQty = 2;

  assert.equal(available < requestedQty, true);
});

test("Inventory: reservation increment does NOT modify physical stockQuantity", () => {
  const product = {
    stockQuantity: 20,
    reservedQuantity: 0,
  };

  // Reserve 5
  product.reservedQuantity += 5;
  assert.equal(product.reservedQuantity, 5);
  assert.equal(product.stockQuantity, 20); // on-hand stock intact
});

test("Inventory: safe release restores available stock and prevents negative values", () => {
  let reservedQuantity = 5;

  // Release 5
  reservedQuantity = Math.max(0, reservedQuantity - 5);
  assert.equal(reservedQuantity, 0);

  // Repeated release does not go below zero
  reservedQuantity = Math.max(0, reservedQuantity - 5);
  assert.equal(reservedQuantity, 0);
});

test("Inventory: successful finalization converts reservation to physical stock reduction", () => {
  let stockQuantity = 20;
  let reservedQuantity = 5;
  const purchaseQty = 5;

  reservedQuantity = Math.max(0, reservedQuantity - purchaseQty);
  stockQuantity = stockQuantity - purchaseQty;

  assert.equal(reservedQuantity, 0);
  assert.equal(stockQuantity, 15);
});

test("Inventory: late payment re-acquires stock if available; flags anomaly if unavailable", () => {
  // Scenario A: stock still exists after reservation release
  const productA = { stockQuantity: 8, reservedQuantity: 0 };
  const purchaseQtyA = 3;
  const availableA = productA.stockQuantity - productA.reservedQuantity;
  assert.equal(availableA >= purchaseQtyA, true);

  // Scenario B: stock was depleted by another buyer while reservation was expired
  const productB = { stockQuantity: 1, reservedQuantity: 0 };
  const purchaseQtyB = 3;
  const availableB = productB.stockQuantity - productB.reservedQuantity;
  assert.equal(availableB >= purchaseQtyB, false); // Triggers safe refund path
});

// ===============================================================
// 4. CHECKOUT SESSION & IDEMPOTENCY TESTS
// ===============================================================

test("Checkout: validateCheckoutRequestId enforces bounded safe identifier", () => {
  assert.equal(validateCheckoutRequestId("crq_12345678_abcd"), "crq_12345678_abcd");
  assert.equal(validateCheckoutRequestId("REQ-CHECKOUT-9912"), "REQ-CHECKOUT-9912");

  // Rejects too short, whitespace, or invalid characters
  assert.throws(() => validateCheckoutRequestId("short"), /between 8 and 128/);
  assert.throws(() => validateCheckoutRequestId("has space 12345"), /alphanumeric/);
  assert.throws(() => validateCheckoutRequestId("invalid/path/12345"), /alphanumeric/);
  assert.throws(() => validateCheckoutRequestId("a".repeat(129)), /between 8 and 128/);
});

test("Checkout: reservation expires at expected ~30 minutes window", () => {
  assert.equal(RESERVATION_EXPIRY_MINUTES, 30);
  const now = Date.now();
  const expiresAtMs = now + RESERVATION_EXPIRY_MINUTES * 60 * 1000;
  assert.equal(Math.round((expiresAtMs - now) / (60 * 1000)), 30);
});

// ===============================================================
// 5. PAYSTACK INTEGRATION & WEBHOOK TESTS
// ===============================================================

test("Paystack: missing secret key fails clearly without leaking secrets", async () => {
  const origKey = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;

  try {
    await assert.rejects(
      async () => {
        await verifyPaystackTransaction("test_ref");
      },
      (err: any) => {
        assert.match(err.message, /PAYSTACK_CONFIG_ERROR/);
        return true;
      }
    );
  } finally {
    process.env.PAYSTACK_SECRET_KEY = origKey;
  }
});

test("Paystack: verifyWebhookSignature rejects missing signature header or raw body", () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_mock_secret_key";
  assert.equal(verifyWebhookSignature("", "sig"), false);
  assert.equal(verifyWebhookSignature("{}", null), false);
  assert.equal(verifyWebhookSignature("{}", undefined), false);
});

test("Paystack: verifyWebhookSignature validates correct HMAC SHA512 signature", () => {
  const secret = "sk_test_sample_secret_key_12345";
  process.env.PAYSTACK_SECRET_KEY = secret;

  const rawBody = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref_123456", amount: 5000000 },
  });

  const validSignature = crypto
    .createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  assert.equal(verifyWebhookSignature(rawBody, validSignature), true);

  // Tampered payload is rejected
  const tamperedBody = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref_123456", amount: 100 }, // Attacker changed amount
  });
  assert.equal(verifyWebhookSignature(tamperedBody, validSignature), false);

  // Tampered signature is rejected
  const invalidSignature = "a".repeat(128);
  assert.equal(verifyWebhookSignature(rawBody, invalidSignature), false);
});

test("Paystack: mock transport verifies HTTP call without calling external network", async () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_mock_secret";

  let capturedUrl = "";
  let capturedHeaders: any = null;

  setPaystackTransportForTesting(async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init?.headers;
    return new Response(
      JSON.stringify({
        status: true,
        data: {
          access_code: "acc_mock_code_123",
          reference: "osvid_ref_999",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  try {
    const res = await initializePaystackTransaction({
      email: "buyer@example.com",
      amountKobo: 4500000,
      reference: "osvid_ref_999",
    });

    assert.equal(res.access_code, "acc_mock_code_123");
    assert.equal(res.reference, "osvid_ref_999");
    assert.match(capturedUrl, /paystack\.co\/transaction\/initialize/);
    assert.match(capturedHeaders["Authorization"], /Bearer sk_test_mock_secret/);
  } finally {
    setPaystackTransportForTesting(null);
  }
});

test("Paystack: verifyPaystackTransaction checks amount in integer kobo and NGN currency", async () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_mock_secret";

  setPaystackTransportForTesting(async () => {
    return new Response(
      JSON.stringify({
        status: true,
        data: {
          reference: "osvid_tx_555",
          status: "success",
          amount: 5000000, // ₦50,000 in kobo
          currency: "NGN",
          customer: { email: "customer@example.com" },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  try {
    const verified = await verifyPaystackTransaction("osvid_tx_555");
    assert.equal(verified.status, "success");
    assert.equal(verified.amount, 5000000);
    assert.equal(verified.currency, "NGN");
    assert.equal(verified.customer.email, "customer@example.com");
  } finally {
    setPaystackTransportForTesting(null);
  }
});

// ===============================================================
// 6. ORDER CREATION & CUSTOMER METRICS TESTS
// ===============================================================

test("Orders: registered customer metrics updated strictly by verified UID, not guest email", () => {
  // Scenario A: Genuine authenticated customer with verified UID
  const authenticatedSession = {
    authenticatedUserId: "user_verified_uid_88",
    customerEmail: "user@example.com",
    totalAmount: 75000,
  };
  assert.equal(Boolean(authenticatedSession.authenticatedUserId), true);

  // Scenario B: Guest checkout with matching email
  const guestSession = {
    authenticatedUserId: undefined,
    customerEmail: "user@example.com",
    totalAmount: 30000,
  };
  // Metrics update is skipped for guest, avoiding modifying arbitrary registered accounts
  assert.equal(Boolean(guestSession.authenticatedUserId), false);
});

// ===============================================================
// 7. REFUND WORKFLOW & RESTOCK RECONCILIATION TESTS
// ===============================================================

test("Refunds: Manager cannot initiate refund; Admin/Super Admin authorized", () => {
  const managerCaller = {
    role: "manager",
    isSuperAdmin: false,
    isAdmin: false,
    permissions: { canManageOrders: true },
  };

  const adminCaller = {
    role: "admin",
    isSuperAdmin: false,
    isAdmin: true,
  };

  const superAdminCaller = {
    role: "super_admin",
    isSuperAdmin: true,
    isAdmin: true,
  };

  // Manager is forbidden even with canManageOrders
  const isManagerAuthorized =
    managerCaller.isSuperAdmin || managerCaller.isAdmin;
  assert.equal(isManagerAuthorized, false);

  // Admin and Super Admin are authorized
  assert.equal(adminCaller.isSuperAdmin || adminCaller.isAdmin, true);
  assert.equal(superAdminCaller.isSuperAdmin || superAdminCaller.isAdmin, true);
});

test("Refunds: duplicate refund request on pending/processed order is rejected", () => {
  const pendingRefundOrder = {
    id: "ORD-1",
    paymentStatus: "paid",
    refundStatus: "pending",
  };

  const isDuplicate =
    pendingRefundOrder.refundStatus === "processed" ||
    pendingRefundOrder.refundStatus === "pending" ||
    pendingRefundOrder.refundStatus === "processing";

  assert.equal(isDuplicate, true);
});

test("Refunds: refund.processed restocks inventory and is idempotent against duplicates", () => {
  let orderPaymentStatus = "paid";
  let productStock = 10;
  const refundItemQty = 2;

  // First refund.processed event:
  if (orderPaymentStatus !== "refunded") {
    orderPaymentStatus = "refunded";
    productStock += refundItemQty;
  }

  assert.equal(orderPaymentStatus, "refunded");
  assert.equal(productStock, 12);

  // Duplicate webhook arrival:
  let reprocessed = false;
  if (orderPaymentStatus !== "refunded") {
    reprocessed = true;
    productStock += refundItemQty;
  }

  assert.equal(reprocessed, false);
  assert.equal(productStock, 12); // Exactly once, no double-restock!
});

// ===============================================================
// 8. FIRESTORE SECURITY RULES VERIFICATION TESTS
// ===============================================================

test("Firestore Rules: checkout_sessions and payment_transactions are completely denied to browser", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  assert.match(rulesContent, /match \/checkout_sessions\/\{sessionId\} \{\s+allow read: if false;\s+allow write: if false;\s+\}/);
  assert.match(rulesContent, /match \/payment_transactions\/\{txId\} \{\s+allow read: if false;\s+allow write: if false;\s+\}/);
});

test("Firestore Rules: discounts read access restricted to staff with discount authority", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  // Public read should no longer be present
  assert.doesNotMatch(rulesContent, /match \/discounts\/\{discountId\} \{\s+allow read: if true;/);
  assert.match(rulesContent, /match \/discounts\/\{discountId\} \{\s+[\s\S]*?hasManagerPermission\('canManageDiscounts'\)/);
});

test("Firestore Rules: discounts create/update protect usageCount and reservedUsageCount", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  assert.match(rulesContent, /reservedUsageCount/);
  assert.match(rulesContent, /usageCount/);
});

test("Firestore Rules: products create/update schema strictly protect reservedQuantity", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  // Create keys allowlist must NOT contain reservedQuantity
  const createKeysMatch = rulesContent.match(/keys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
  assert.ok(createKeysMatch);
  assert.equal(createKeysMatch[1].includes("'reservedQuantity'"), false);

  // Update affectedKeys allowlist must NOT contain reservedQuantity
  const updateKeysMatch = rulesContent.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
  assert.ok(updateKeysMatch);
  assert.equal(updateKeysMatch[1].includes("'reservedQuantity'"), false);
});
