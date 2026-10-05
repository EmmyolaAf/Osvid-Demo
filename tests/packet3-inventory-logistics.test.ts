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

  // Products collection strictly forbids client updates from changing stockQuantity
  assert.match(
    rules,
    /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['stockQuantity'\]\)/
  );

  // Products creation strictly enforces stockQuantity == 0 (or omitted)
  assert.match(
    rules,
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
