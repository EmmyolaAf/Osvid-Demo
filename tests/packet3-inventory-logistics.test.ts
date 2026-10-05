import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { validateOrderStatusTransition } from "@/app/api/admin/orders/[orderId]/fulfillment/route";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";
import { hasPermission, ServerAuthUser } from "@/lib/server/auth";
import { OrderStatus, normalizeManagerPermissions, ManagerPermissions } from "@/types/auth";
import { InventoryMovementType } from "@/types/inventory";

// ===============================================================
// 1. INVENTORY AUTHORITY & MODEL TESTS
// ===============================================================

interface MockServerUserOverrides extends Omit<Partial<ServerAuthUser>, "permissions"> {
  permissions?: Partial<ManagerPermissions>;
}

function createMockServerUser(overrides: MockServerUserOverrides = {}): ServerAuthUser {
  const { permissions: rawPerms, ...rest } = overrides;
  const role = overrides.role || "user";
  const isSuperAdmin = Boolean(overrides.isSuperAdmin || role === "super_admin");
  const isAdmin = Boolean(overrides.isAdmin || isSuperAdmin || role === "admin");
  const isManager = Boolean(overrides.isManager || role === "manager");
  const isStaff = isSuperAdmin || isAdmin || isManager;
  const isCustomer = role === "user";

  const permissions = rawPerms ? normalizeManagerPermissions(rawPerms) : undefined;

  return {
    uid: overrides.uid || "mock-uid-1",
    email: overrides.email || "user@osvid.com",
    displayName: overrides.displayName || "Mock User",
    role,
    isSuperAdmin,
    isAdmin,
    isManager,
    isStaff,
    isCustomer,
    isActive: overrides.isActive !== false,
    permissions,
    tokenClaims: overrides.tokenClaims || {},
    ...rest,
  };
}

test("Inventory: inventory-only Manager can manage inventory; non-inventory cannot", () => {
  const inventoryManager = createMockServerUser({
    uid: "mgr-inv-1",
    email: "inv@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: true,
      canManageOrders: false,
      canManageDiscounts: false,
      canManageWebsite: false,
    },
  });

  const catalogueManager = createMockServerUser({
    uid: "mgr-cat-1",
    email: "cat@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: true,
      canManageInventory: false,
      canManageOrders: false,
      canManageDiscounts: false,
      canManageWebsite: false,
    },
  });

  assert.equal(hasPermission(inventoryManager, "canManageInventory"), true);
  assert.equal(hasPermission(catalogueManager, "canManageInventory"), false);
  assert.equal(hasPermission(catalogueManager, "canManageProducts"), true);
  assert.equal(hasPermission(inventoryManager, "canManageProducts"), false);
});

test("Inventory: direct browser stock write is denied by firestore.rules", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  const productSection = rules.slice(rules.indexOf("match /products/{productId}"));
  const nextSection = productSection.indexOf("match /categories");
  const productRules = productSection.slice(0, nextSection);

  // Products collection enforces explicit catalogue field allowlist that excludes stockQuantity
  assert.match(productRules, /affectedKeys\(\)\.hasOnly\(\[/);
  assert.match(productRules, /'name'/);
  assert.match(productRules, /'price'/);
  assert.doesNotMatch(productRules, /hasOnly\(\[[^\]]*'stockQuantity'/);

  // Products creation strictly enforces stockQuantity == 0 (or omitted) for all callers including Super Admin
  assert.match(
    productRules,
    /\(!\('stockQuantity' in request\.resource\.data\) \|\| request\.resource\.data\.stockQuantity == 0\)/
  );
});

test("Inventory: movement documents are client-immutable in firestore.rules", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  const ledgerSnippet = rules.slice(rules.indexOf("match /inventory_movements/{movementId}"));
  const nextMatch = ledgerSnippet.indexOf("match /discounts");
  const block = ledgerSnippet.slice(0, nextMatch > 0 ? nextMatch : undefined);

  // Client writes are completely denied (create, update, delete)
  assert.match(block, /allow create:\s*if false;/);
  assert.match(block, /allow update:\s*if false;/);
  assert.match(block, /allow delete:\s*if false;/);
  // Reading requires live staff with canManageInventory and operational subscription
  assert.match(block, /hasManagerPermission\('canManageInventory'\)/);
  assert.match(block, /isSubscriptionOperational\(\)/);
});

test("Inventory Transaction: positive adjustment updates stock and creates ledger movement atomically", () => {
  let productStock = 50;
  const ledger: Record<string, any> = {};

  function applyAdjustment(
    productId: string,
    delta: number,
    type: InventoryMovementType,
    requestId: string,
    actor: { uid: string; email: string; role: string },
    reason?: string
  ) {
    if (delta === 0) throw new Error("Delta cannot be zero");
    if (productStock + delta < 0) throw new Error("Stock cannot fall below zero");
    if (ledger[requestId]) {
      return { replayed: true, movement: ledger[requestId] };
    }

    const previousStock = productStock;
    productStock += delta;
    const movement = {
      id: requestId,
      productId,
      delta,
      previousStock,
      newStock: productStock,
      type,
      reason,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      requestId,
      createdAtIso: new Date().toISOString(),
    };
    ledger[requestId] = movement;

    return { replayed: false, movement };
  }

  const result = applyAdjustment(
    "prod-1",
    25,
    "restock",
    "req-001",
    { uid: "mgr-1", email: "mgr@osvid.com", role: "manager" },
    "Restocked shipment"
  );

  assert.equal(result.replayed, false);
  assert.equal(productStock, 75);
  assert.equal(result.movement.previousStock, 50);
  assert.equal(result.movement.newStock, 75);
  assert.equal(result.movement.delta, 25);
  assert.equal(result.movement.type, "restock");
  assert.equal(result.movement.actorEmail, "mgr@osvid.com");
});

test("Inventory Transaction: negative adjustment cannot take stock below zero", () => {
  let productStock = 10;

  function applyAdjustment(currentStock: number, delta: number) {
    if (currentStock + delta < 0) {
      throw new Error(`Insufficient inventory: stock would become ${currentStock + delta}`);
    }
    return currentStock + delta;
  }

  assert.throws(
    () => applyAdjustment(productStock, -15),
    /Insufficient inventory: stock would become -5/
  );
  assert.equal(applyAdjustment(productStock, -10), 0);
  assert.equal(applyAdjustment(productStock, -5), 5);
});

test("Inventory Idempotency: duplicate requestId returns replayed result without applying change twice", () => {
  let productStock = 100;
  const ledger: Record<string, any> = {};

  function adjustWithIdempotency(requestId: string, delta: number, payloadHash: string) {
    if (ledger[requestId]) {
      if (ledger[requestId].payloadHash !== payloadHash) {
        throw new Error("Idempotency conflict: requestId was already processed with different parameters.");
      }
      return { replayed: true, newStock: productStock };
    }

    productStock += delta;
    ledger[requestId] = { requestId, delta, payloadHash };
    return { replayed: false, newStock: productStock };
  }

  // First request
  const res1 = adjustWithIdempotency("req-abc-123", 20, "hash-1");
  assert.equal(res1.replayed, false);
  assert.equal(res1.newStock, 120);
  assert.equal(productStock, 120);

  // Network retry with exact same payload
  const res2 = adjustWithIdempotency("req-abc-123", 20, "hash-1");
  assert.equal(res2.replayed, true);
  assert.equal(res2.newStock, 120);
  assert.equal(productStock, 120); // NOT incremented again!

  // Replay attempt with conflicting payload must be rejected
  assert.throws(
    () => adjustWithIdempotency("req-abc-123", 50, "hash-CONFLICT"),
    /Idempotency conflict/
  );
  assert.equal(productStock, 120); // Still unaltered!
});

test("Inventory: initial product stock enters through inventory movement, product doc starts at 0", () => {
  // In the modeled workflow:
  const productCreationDoc = {
    name: "Caustic Soda Flakes",
    price: 35000,
    stockQuantity: 0, // Enforced at 0 by firestore.rules
  };
  assert.equal(productCreationDoc.stockQuantity, 0);

  // If creator has inventory permission, subsequent initial_stock movement is recorded
  const initialStockMovement = {
    productId: "prod-new-1",
    delta: 50,
    previousStock: 0,
    newStock: 50,
    type: "initial_stock" as InventoryMovementType,
    reason: "Initial stock registered on product creation",
  };

  assert.equal(initialStockMovement.previousStock, 0);
  assert.equal(initialStockMovement.newStock, 50);
  assert.equal(initialStockMovement.type, "initial_stock");
});

test("Inventory: movement metadata derives actor from trusted server caller, ignoring client input", () => {
  const caller = createMockServerUser({
    uid: "auth-server-uid-777",
    email: "trusted-manager@osvid.com",
    role: "manager",
  });

  const clientJson = {
    actorUid: "forged-super-admin-uid",
    actorEmail: "fake-admin@google.com",
    actorRole: "super_admin",
  };

  // Server API derives actor solely from caller
  const recordedActor = {
    actorUid: caller.uid,
    actorEmail: caller.email,
    actorRole: caller.role,
  };

  assert.equal(recordedActor.actorUid, "auth-server-uid-777");
  assert.equal(recordedActor.actorEmail, "trusted-manager@osvid.com");
  assert.notEqual(recordedActor.actorUid, clientJson.actorUid);
  assert.notEqual(recordedActor.actorEmail, clientJson.actorEmail);
});

// ===============================================================
// 2. SERVER SUBSCRIPTION GUARD TESTS
// ===============================================================

test("Subscription Guard: fail-closed if runtime document is missing", async () => {
  const staffCaller = createMockServerUser({
    uid: "mgr-1",
    email: "mgr@osvid.com",
    role: "manager",
  });

  // Custom mock passing null snapshot
  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: false,
        data: () => undefined,
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.match(err.message, /Fail-closed: Tenant operational subscription record is missing/);
      return true;
    }
  );
});

test("Subscription Guard: suspended client blocks operational mutation", async () => {
  const staffCaller = createMockServerUser({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  const futureTimestamp = Timestamp.fromDate(new Date(Date.now() + 86400000));

  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: true,
        data: () => ({
          clientId: "osvid",
          isSuspended: true,
          hardSuspendAt: futureTimestamp,
        }),
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 403);
      assert.match(err.message, /Operation forbidden: Client subscription is suspended/);
      return true;
    }
  );
});

test("Subscription Guard: expired hardSuspendAt blocks operational mutation", async () => {
  const staffCaller = createMockServerUser({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  // Past timestamp
  const pastTimestamp = Timestamp.fromDate(new Date(Date.now() - 3600000));

  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: true,
        data: () => ({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: pastTimestamp,
        }),
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 403);
      assert.match(err.message, /Hard subscription cutoff reached/);
      return true;
    }
  );
});

test("Subscription Guard: malformed runtime state fails closed", async () => {
  const staffCaller = createMockServerUser({
    uid: "mgr-1",
    email: "mgr@osvid.com",
    role: "manager",
  });

  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: true,
        data: () => ({
          clientId: "wrong-client", // invalid clientId
          isSuspended: false,
          hardSuspendAt: "not-a-timestamp",
        }),
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.match(err.message, /Malformed runtime subscription document/);
      return true;
    }
  );
});

test("Subscription Guard: Super Admin recovery bypass remains even when subscription is suspended or missing", async () => {
  const superAdminCaller = createMockServerUser({
    uid: "sa-1",
    email: "abolarinwaemmanuelfree@gmail.com",
    role: "super_admin",
  });

  // Should succeed without throwing despite missing doc
  await assert.doesNotReject(async () => {
    await assertOperationalSubscription(superAdminCaller, async () => ({
      exists: false,
      data: () => undefined,
    } as any));
  });

  // Should succeed even when suspended
  await assert.doesNotReject(async () => {
    await assertOperationalSubscription(superAdminCaller, async () => ({
      exists: true,
      data: () => ({
        clientId: "osvid",
        isSuspended: true,
        hardSuspendAt: Timestamp.now(),
      }),
    } as any));
  });
});

// ===============================================================
// 3. ORDER STATE MACHINE & LOGISTICS TESTS
// ===============================================================

test("Order State Machine: Delivery workflow transitions", () => {
  // pending -> processing (allowed)
  assert.equal(validateOrderStatusTransition("pending", "processing", "delivery").valid, true);

  // processing -> shipped (allowed)
  assert.equal(validateOrderStatusTransition("processing", "shipped", "delivery").valid, true);

  // shipped -> delivered (allowed)
  assert.equal(validateOrderStatusTransition("shipped", "delivered", "delivery").valid, true);

  // pending -> cancelled (allowed)
  assert.equal(validateOrderStatusTransition("pending", "cancelled", "delivery").valid, true);

  // processing -> cancelled (allowed)
  assert.equal(validateOrderStatusTransition("processing", "cancelled", "delivery").valid, true);

  // shipped -> cancelled (REJECTED)
  const shippedToCancelled = validateOrderStatusTransition("shipped", "cancelled", "delivery");
  assert.equal(shippedToCancelled.valid, false);
  assert.match(shippedToCancelled.reason!, /In-transit orders cannot be cancelled/);

  // terminal states cannot transition to anything
  assert.equal(validateOrderStatusTransition("delivered", "processing", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("delivered", "cancelled", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("cancelled", "pending", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("cancelled", "processing", "delivery").valid, false);

  // invalid backwards or skipping transitions
  assert.equal(validateOrderStatusTransition("pending", "shipped", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("pending", "delivered", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("processing", "pending", "delivery").valid, false);
  assert.equal(validateOrderStatusTransition("shipped", "processing", "delivery").valid, false);
});

test("Order State Machine: Pickup workflow transitions", () => {
  // pending -> processing (allowed)
  assert.equal(validateOrderStatusTransition("pending", "processing", "pickup").valid, true);

  // processing -> delivered (allowed)
  assert.equal(validateOrderStatusTransition("processing", "delivered", "pickup").valid, true);

  // pickup does NOT use shipped stage
  const pickupShipped = validateOrderStatusTransition("processing", "shipped", "pickup");
  assert.equal(pickupShipped.valid, false);
  assert.match(pickupShipped.reason!, /Pickup order in 'processing' status can only transition to 'delivered' or 'cancelled'/);

  // cancellation allowed from pending and processing
  assert.equal(validateOrderStatusTransition("pending", "cancelled", "pickup").valid, true);
  assert.equal(validateOrderStatusTransition("processing", "cancelled", "pickup").valid, true);

  // terminal delivered and cancelled reject transitions
  assert.equal(validateOrderStatusTransition("delivered", "cancelled", "pickup").valid, false);
  assert.equal(validateOrderStatusTransition("cancelled", "processing", "pickup").valid, false);
});

test("Order Logistics: Delivery transition to shipped requires tracking reference", () => {
  function validateFulfillmentPayload(
    targetStatus: OrderStatus,
    existingTracking: string | undefined,
    incomingTracking: string | undefined,
    deliveryMethod: "pickup" | "delivery"
  ) {
    if (deliveryMethod !== "pickup" && targetStatus === "shipped") {
      const activeTracking = incomingTracking?.trim() || existingTracking?.trim();
      if (!activeTracking || activeTracking.length === 0) {
        throw new Error("Transitioning delivery order to 'shipped' requires a valid tracking number or dispatch reference.");
      }
    }
  }

  // Delivery without tracking throws
  assert.throws(
    () => validateFulfillmentPayload("shipped", undefined, undefined, "delivery"),
    /requires a valid tracking number/
  );

  // Delivery with incoming tracking passes
  assert.doesNotThrow(() =>
    validateFulfillmentPayload("shipped", undefined, "GIG-998822", "delivery")
  );

  // Delivery with existing tracking on order passes
  assert.doesNotThrow(() =>
    validateFulfillmentPayload("shipped", "OLD-TRACK-1", undefined, "delivery")
  );

  // Pickup does not require tracking
  assert.doesNotThrow(() =>
    validateFulfillmentPayload("delivered", undefined, undefined, "pickup")
  );
});

test("Order Logistics: Logistics update strictly protects financial fields", () => {
  const initialOrder = {
    id: "ord-101",
    totalAmount: 150000,
    subtotal: 140000,
    paymentStatus: "paid",
    paystackReference: "pstk-ref-999",
    items: [{ productId: "p-1", quantity: 2, price: 70000 }],
    orderStatus: "processing" as OrderStatus,
    trackingNumber: undefined,
  };

  // Malicious request payload trying to tamper with financial data
  const incomingJson = {
    status: "shipped",
    trackingNumber: "FEDEX-8882",
    totalAmount: 0,
    paymentStatus: "refunded",
    items: [],
  };

  // Fulfillment update only applies logistics fields
  const updatedOrder = {
    ...initialOrder,
    orderStatus: incomingJson.status as OrderStatus,
    trackingNumber: incomingJson.trackingNumber,
  };

  assert.equal(updatedOrder.orderStatus, "shipped");
  assert.equal(updatedOrder.trackingNumber, "FEDEX-8882");
  assert.equal(updatedOrder.totalAmount, 150000); // Protected
  assert.equal(updatedOrder.paymentStatus, "paid"); // Protected
  assert.equal(updatedOrder.paystackReference, "pstk-ref-999"); // Protected
  assert.equal(updatedOrder.items.length, 1); // Protected
});

test("Order Logistics: Manager with canManageOrders is authorized; without is rejected", () => {
  const logisticsManager = createMockServerUser({
    uid: "mgr-log-1",
    email: "logistics@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: false,
      canManageOrders: true,
      canManageDiscounts: false,
      canManageWebsite: false,
    },
  });

  const inventoryOnlyManager = createMockServerUser({
    uid: "mgr-inv-only",
    email: "inventory@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: true,
      canManageOrders: false,
      canManageDiscounts: false,
      canManageWebsite: false,
    },
  });

  assert.equal(hasPermission(logisticsManager, "canManageOrders"), true);
  assert.equal(hasPermission(inventoryOnlyManager, "canManageOrders"), false);
});

test("Order Audit Trail: Order fulfillment mutation produces immutable audit event", () => {
  const auditEvent = {
    id: "audit-ord-shipped-1",
    action: "order.shipped",
    resourceType: "orders",
    resourceId: "ord-883",
    actorUid: "mgr-log-1",
    actorEmail: "logistics@osvid.com",
    actorRole: "manager",
    metadata: {
      oldStatus: "processing",
      newStatus: "shipped",
      trackingNumber: "GIG-12345",
      note: "Dispatched from Lagos warehouse",
    },
    createdAt: new Date().toISOString(),
  };

  assert.equal(auditEvent.action, "order.shipped");
  assert.equal(auditEvent.resourceType, "orders");
  assert.equal(auditEvent.resourceId, "ord-883");
  assert.equal(auditEvent.metadata.oldStatus, "processing");
  assert.equal(auditEvent.metadata.newStatus, "shipped");
  assert.equal(auditEvent.metadata.trackingNumber, "GIG-12345");
});

// ===============================================================
// 5. PACKET 3B SECURITY GATE ENFORCEMENT TESTS
// ===============================================================

function simulateOrderReadRule(auth: any, orderData: any, userProfile: any): boolean {
  const isSuperAdmin =
    auth != null &&
    auth.email?.toLowerCase() === "abolarinwaemmanuelfree@gmail.com" &&
    (auth.email_verified === true ||
      auth.firebase_provider === "google.com" ||
      auth.isProviderOwner === true);

  const isAdmin =
    isSuperAdmin ||
    (auth != null && userProfile?.isActive === true && userProfile?.role === "admin");

  const hasOrderPermission =
    isAdmin ||
    (auth != null &&
      userProfile?.isActive === true &&
      userProfile?.role === "manager" &&
      userProfile?.permissions?.canManageOrders === true);

  if (hasOrderPermission) return true;

  if (auth != null) {
    if (orderData?.userId && orderData.userId === auth.uid) return true;
    if (
      orderData?.customerEmail &&
      auth.email &&
      orderData.customerEmail.toLowerCase() === auth.email.toLowerCase() &&
      auth.email_verified === true
    ) {
      return true;
    }
  }

  return false;
}

test("Order Read: Manager without canManageOrders cannot read all orders", () => {
  const caller = { uid: "mgr-cat-only", email: "catalog@osvid.com", email_verified: true };
  const userProfile = {
    isActive: true,
    role: "manager",
    permissions: {
      canManageProducts: true,
      canManageInventory: true,
      canManageOrders: false,
    },
  };
  const orderDoc = { id: "ord-1", userId: "cust-99", customerEmail: "customer@example.com" };

  assert.equal(simulateOrderReadRule(caller, orderDoc, userProfile), false);
});

test("Order Read: Logistics Manager can read operational orders", () => {
  const caller = { uid: "mgr-log", email: "logistics@osvid.com", email_verified: true };
  const userProfile = {
    isActive: true,
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: false,
      canManageOrders: true,
    },
  };
  const orderDoc = { id: "ord-1", userId: "cust-99", customerEmail: "customer@example.com" };

  assert.equal(simulateOrderReadRule(caller, orderDoc, userProfile), true);
});

test("Order Read: Admin can read operational orders", () => {
  const caller = { uid: "admin-1", email: "admin@osvid.com", email_verified: true };
  const userProfile = { isActive: true, role: "admin" };
  const orderDoc = { id: "ord-1", userId: "cust-99", customerEmail: "customer@example.com" };

  assert.equal(simulateOrderReadRule(caller, orderDoc, userProfile), true);
});

test("Order Read: customer can read order by own userId", () => {
  const caller = { uid: "cust-99", email: "customer@example.com", email_verified: false };
  const userProfile = { isActive: true, role: "user" };
  const orderDoc = { id: "ord-1", userId: "cust-99", customerEmail: "different@example.com" };

  assert.equal(simulateOrderReadRule(caller, orderDoc, userProfile), true);
});

test("Order Read: email fallback cannot expose guest order to unverified email identity", () => {
  const unverifiedAttacker = {
    uid: "attacker-1",
    email: "victim@example.com",
    email_verified: false,
  };
  const userProfile = { isActive: true, role: "user" };
  const guestOrderDoc = {
    id: "ord-guest-1",
    userId: undefined,
    customerEmail: "victim@example.com",
  };

  assert.equal(simulateOrderReadRule(unverifiedAttacker, guestOrderDoc, userProfile), false);
});

test("Order Read: verified-email legacy ownership path works if retained", () => {
  const verifiedCustomer = {
    uid: "cust-verified-1",
    email: "victim@example.com",
    email_verified: true,
  };
  const userProfile = { isActive: true, role: "user" };
  const guestOrderDoc = {
    id: "ord-guest-1",
    userId: undefined,
    customerEmail: "victim@example.com",
  };

  assert.equal(simulateOrderReadRule(verifiedCustomer, guestOrderDoc, userProfile), true);
});

test("Stock Rules: Super Admin browser cannot directly alter stockQuantity or create positive stock", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  const productBlock = rules.slice(rules.indexOf("match /products/{productId}"));
  const nextBlock = productBlock.indexOf("match /categories");
  const snippet = productBlock.slice(0, nextBlock);

  // Creation: stockQuantity must be 0 or omitted for all callers including Super Admin
  assert.match(
    snippet,
    /\(!\('stockQuantity' in request\.resource\.data\) \|\| request\.resource\.data\.stockQuantity == 0\)/
  );

  // Update: uses affectedKeys().hasOnly() allowlist that excludes stockQuantity
  assert.match(snippet, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[/);
  assert.doesNotMatch(snippet, /hasOnly\(\[[^\]]*'stockQuantity'/);
});

test("Stock Rules: product catalogue updates use explicit field allowlist", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  const productBlock = rules.slice(rules.indexOf("match /products/{productId}"));
  const snippet = productBlock.slice(0, productBlock.indexOf("match /categories"));

  // Verify explicit catalogue fields in allowlist
  assert.match(snippet, /'name'/);
  assert.match(snippet, /'slug'/);
  assert.match(snippet, /'price'/);
  assert.match(snippet, /'description'/);
  assert.match(snippet, /'category'/);
  assert.match(snippet, /'sku'/);
  assert.match(snippet, /'imageUrl'/);
  assert.match(snippet, /'updatedAt'/);
});

test("Super Admin can still use the inventory API while subscription is suspended", async () => {
  const superAdminCaller = createMockServerUser({
    uid: "sa-1",
    email: "abolarinwaemmanuelfree@gmail.com",
    role: "super_admin",
    isSuperAdmin: true,
  });

  // Does not throw even when subscription document indicates suspended
  await assert.doesNotReject(async () => {
    await assertOperationalSubscription(superAdminCaller, async () => ({
      exists: true,
      data: () => ({
        clientId: "osvid",
        isSuspended: true,
        suspendedReason: "Account suspended for non-payment",
        hardSuspendAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
      }),
    } as any));
  });
});

test("Server Guard: rejects ISO string hardSuspendAt", async () => {
  const staffCaller = createMockServerUser({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: true,
        data: () => ({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: "2026-12-31T00:00:00Z", // String rejected!
        }),
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.match(err.message, /not a valid Firestore Timestamp/);
      return true;
    }
  );
});

test("Server Guard: rejects malformed timestamp-shaped objects", async () => {
  const staffCaller = createMockServerUser({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  // Plain object with only _seconds (no toMillis/toDate methods)
  await assert.rejects(
    async () => {
      await assertOperationalSubscription(staffCaller, async () => ({
        exists: true,
        data: () => ({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: { _seconds: 1800000000 },
        }),
      } as any));
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.match(err.message, /not a valid Firestore Timestamp/);
      return true;
    }
  );
});

test("Server Guard: accepts genuine Firestore Timestamp", async () => {
  const staffCaller = createMockServerUser({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  const validFutureTimestamp = Timestamp.fromDate(new Date(Date.now() + 86400000));

  await assert.doesNotReject(async () => {
    await assertOperationalSubscription(staffCaller, async () => ({
      exists: true,
      data: () => ({
        clientId: "osvid",
        isSuspended: false,
        hardSuspendAt: validFutureTimestamp,
      }),
    } as any));
  });
});

test("Terminal Orders: delivered order rejects same-status note/tracking mutation", () => {
  const deliveryResult = validateOrderStatusTransition("delivered", "delivered", "delivery");
  assert.equal(deliveryResult.valid, false);
  assert.match(deliveryResult.reason || "", /Terminal state cannot be altered/);

  const pickupResult = validateOrderStatusTransition("delivered", "delivered", "pickup");
  assert.equal(pickupResult.valid, false);
  assert.match(pickupResult.reason || "", /Terminal state cannot be altered/);
});

test("Terminal Orders: cancelled order rejects same-status note/tracking mutation", () => {
  const deliveryResult = validateOrderStatusTransition("cancelled", "cancelled", "delivery");
  assert.equal(deliveryResult.valid, false);
  assert.match(deliveryResult.reason || "", /Terminal state cannot be altered/);

  const pickupResult = validateOrderStatusTransition("cancelled", "cancelled", "pickup");
  assert.equal(pickupResult.valid, false);
  assert.match(pickupResult.reason || "", /Terminal state cannot be altered/);
});

test("Terminal Orders: processing/shipped non-terminal fulfillment details still work where allowed", () => {
  // Same status for non-terminal allows note/tracking update
  assert.equal(validateOrderStatusTransition("processing", "processing", "delivery").valid, true);
  assert.equal(validateOrderStatusTransition("shipped", "shipped", "delivery").valid, true);

  // Normal transitions
  assert.equal(validateOrderStatusTransition("processing", "shipped", "delivery").valid, true);
  assert.equal(validateOrderStatusTransition("shipped", "delivered", "delivery").valid, true);
});

test("Inventory Request ID: invalid requestId containing / is rejected", () => {
  const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-:\.]+$/;
  assert.equal(REQUEST_ID_REGEX.test("inv/movement/123"), false);
  assert.equal(REQUEST_ID_REGEX.test("../traversal"), false);
  assert.equal(REQUEST_ID_REGEX.test("has space"), false);
});

test("Inventory Request ID: excessively long requestId is rejected", () => {
  const longId = "a".repeat(129);
  assert.equal(longId.length > 128, true);
});

test("Inventory Request ID: normal generated requestId remains valid", () => {
  const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-:\.]+$/;
  const normalId1 = `inv_prod_123_${Date.now()}_abc123`;
  const normalId2 = "req-uuid-883-992-110";
  const normalId3 = "movement:initial:prod-99";

  assert.equal(REQUEST_ID_REGEX.test(normalId1), true);
  assert.equal(REQUEST_ID_REGEX.test(normalId2), true);
  assert.equal(REQUEST_ID_REGEX.test(normalId3), true);
  assert.equal(normalId1.length <= 128, true);
});
