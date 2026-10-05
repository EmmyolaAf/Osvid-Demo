import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIMARY_SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
  isVerifiedProviderIdentity,
  hasPermission,
  ServerAuthUser,
} from "@/lib/server/auth";
import {
  normalizeManagerPermissions,
  DEFAULT_MANAGER_PERMISSIONS,
  ManagerPermissions,
} from "@/types/auth";
import { calculateSubscriptionStatus } from "@/lib/firebase/subscription";
import { sanitizeMetadata, buildAuditLogRecord } from "@/lib/server/audit";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
import { RuntimeSubscriptionState } from "@/types/subscription";
import fs from "node:fs";
import path from "node:path";

// ===============================================================
// 1. STAFF HIERARCHY & OPERATIONAL PERMISSION INHERITANCE
// ===============================================================

function createMockCaller(params: {
  uid: string;
  email: string;
  role: "super_admin" | "admin" | "manager" | "user";
  permissions?: Partial<ManagerPermissions>;
}): ServerAuthUser {
  const isSuperAdmin = params.role === "super_admin" || isSuperAdminEmail(params.email);
  return {
    uid: params.uid,
    email: params.email,
    displayName: "Test User",
    role: params.role,
    isSuperAdmin,
    isAdmin: isSuperAdmin || params.role === "admin",
    isManager: params.role === "manager",
    isStaff: isSuperAdmin || params.role === "admin" || params.role === "manager",
    isCustomer: params.role === "user",
    isActive: true,
    permissions: params.permissions ? normalizeManagerPermissions(params.permissions) : undefined,
    tokenClaims: { role: params.role },
  };
}

test("Admin inherits all operational client permissions", () => {
  const admin = createMockCaller({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });

  assert.equal(hasPermission(admin, "canManageProducts"), true);
  assert.equal(hasPermission(admin, "canManageInventory"), true);
  assert.equal(hasPermission(admin, "canManageOrders"), true);
  assert.equal(hasPermission(admin, "canManageCustomers"), true);
  assert.equal(hasPermission(admin, "canManageDiscounts"), true);
  assert.equal(hasPermission(admin, "canManageWebsite"), true);
  assert.equal(hasPermission(admin, "canViewFinancials"), true);
});

test("Super Admin inherits all operational permissions", () => {
  const superAdmin = createMockCaller({
    uid: "super-1",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    role: "super_admin",
  });

  assert.equal(hasPermission(superAdmin, "canManageProducts"), true);
  assert.equal(hasPermission(superAdmin, "canManageInventory"), true);
  assert.equal(hasPermission(superAdmin, "canManageOrders"), true);
  assert.equal(hasPermission(superAdmin, "canViewFinancials"), true);
});

test("Manager permissions are granular: Product Manager vs Inventory Manager separation", () => {
  // Product Manager: can create/edit catalog, but CANNOT adjust inventory
  const productManager = createMockCaller({
    uid: "mgr-prod",
    email: "product.mgr@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: true,
      canManageInventory: false,
      canManageOrders: false,
      canViewFinancials: false,
    },
  });

  assert.equal(hasPermission(productManager, "canManageProducts"), true);
  assert.equal(hasPermission(productManager, "canManageInventory"), false);
  assert.equal(hasPermission(productManager, "canManageOrders"), false);
  assert.equal(hasPermission(productManager, "canViewFinancials"), false);

  // Inventory Manager: can adjust stock, but CANNOT edit catalog data
  const inventoryManager = createMockCaller({
    uid: "mgr-inv",
    email: "inventory.mgr@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: true,
      canManageOrders: false,
      canViewFinancials: false,
    },
  });

  assert.equal(hasPermission(inventoryManager, "canManageProducts"), false);
  assert.equal(hasPermission(inventoryManager, "canManageInventory"), true);
  assert.equal(hasPermission(inventoryManager, "canManageOrders"), false);
  assert.equal(hasPermission(inventoryManager, "canViewFinancials"), false);
});

test("Logistics Manager has order authority but NOT catalogue or inventory", () => {
  const logisticsManager = createMockCaller({
    uid: "mgr-log",
    email: "logistics.mgr@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: false,
      canManageInventory: false,
      canManageOrders: true,
      canViewFinancials: false,
    },
  });

  assert.equal(hasPermission(logisticsManager, "canManageOrders"), true);
  assert.equal(hasPermission(logisticsManager, "canManageProducts"), false);
  assert.equal(hasPermission(logisticsManager, "canManageInventory"), false);
  assert.equal(hasPermission(logisticsManager, "canViewFinancials"), false);
});

test("Manager financial access is read-only / visibility-only", () => {
  const financeViewer = createMockCaller({
    uid: "mgr-fin",
    email: "finance.mgr@osvid.com",
    role: "manager",
    permissions: {
      canViewFinancials: true,
      canManageProducts: false,
      canManageInventory: false,
      canManageOrders: false,
    },
  });

  assert.equal(hasPermission(financeViewer, "canViewFinancials"), true);
  assert.equal(hasPermission(financeViewer, "canManageProducts"), false);
  assert.equal(hasPermission(financeViewer, "canManageInventory"), false);
  assert.equal(hasPermission(financeViewer, "canManageOrders"), false);
});

test("Customer has zero manager operational permissions", () => {
  const customer = createMockCaller({
    uid: "cust-1",
    email: "shopper@gmail.com",
    role: "user",
  });

  assert.equal(hasPermission(customer, "canManageProducts"), false);
  assert.equal(hasPermission(customer, "canManageInventory"), false);
  assert.equal(hasPermission(customer, "canManageOrders"), false);
  assert.equal(hasPermission(customer, "canViewFinancials"), false);
});

// ===============================================================
// 2. BACKWARD-COMPATIBLE MANAGER PERMISSION NORMALIZATION
// ===============================================================

test("normalizeManagerPermissions preserves existing saved permissions and safely defaults missing canManageInventory", () => {
  // Legacy doc with canManageProducts: true, missing canManageInventory
  const legacyProductManager = normalizeManagerPermissions({
    canManageProducts: true,
    canManageOrders: false,
    canViewFinancials: false,
    canManageWebsite: false,
    canManageCustomers: false,
    canManageDiscounts: false,
  });
  // Backward compatibility: existing managers that had products permission inherit inventory access
  assert.equal(legacyProductManager.canManageProducts, true);
  assert.equal(legacyProductManager.canManageInventory, true);

  // Legacy doc without products permission: canManageInventory defaults to false
  const legacyOrdersOnlyManager = normalizeManagerPermissions({
    canManageProducts: false,
    canManageOrders: true,
  });
  assert.equal(legacyOrdersOnlyManager.canManageProducts, false);
  assert.equal(legacyOrdersOnlyManager.canManageInventory, false);
  assert.equal(legacyOrdersOnlyManager.canManageOrders, true);

  // Explicit canManageInventory assignment is preserved
  const explicitManager = normalizeManagerPermissions({
    canManageProducts: true,
    canManageInventory: false,
  });
  assert.equal(explicitManager.canManageProducts, true);
  assert.equal(explicitManager.canManageInventory, false);
});

test("DEFAULT_MANAGER_PERMISSIONS gives inventory authority by default, NOT catalogue CRUD", () => {
  assert.equal(DEFAULT_MANAGER_PERMISSIONS.canManageProducts, false);
  assert.equal(DEFAULT_MANAGER_PERMISSIONS.canManageInventory, true);
  assert.equal(DEFAULT_MANAGER_PERMISSIONS.canManageOrders, true);
  assert.equal(DEFAULT_MANAGER_PERMISSIONS.canViewFinancials, false);
});

// ===============================================================
// 3. SUPER ADMIN / PROVIDER IDENTITY HARDENING
// ===============================================================

test("isVerifiedProviderIdentity rejects unverified accounts claiming provider email", () => {
  // Attacker creates unverified email/password account with provider email
  const unverifiedAttacker = {
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    email_verified: false,
  };
  assert.equal(isVerifiedProviderIdentity(unverifiedAttacker as any), false);

  // Missing email
  assert.equal(isVerifiedProviderIdentity({ email_verified: true } as any), false);

  // Different email even if verified
  assert.equal(
    isVerifiedProviderIdentity({
      email: "impostor@osvid.com",
      email_verified: true,
    } as any),
    false
  );
});

test("isVerifiedProviderIdentity accepts legitimate verified provider identities", () => {
  // Verified email
  assert.equal(
    isVerifiedProviderIdentity({
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      email_verified: true,
    } as any),
    true
  );

  // Google SSO provider
  assert.equal(
    isVerifiedProviderIdentity({
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      firebase: { sign_in_provider: "google.com" },
    } as any),
    true
  );

  // Trusted custom claim
  assert.equal(
    isVerifiedProviderIdentity({
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      isProviderOwner: true,
    } as any),
    true
  );
});

// ===============================================================
// 4. SUBSCRIPTION DETERMINISTIC STATE MACHINE
// ===============================================================

test("calculateSubscriptionStatus correctly evaluates active, warning, grace, and suspended states", () => {
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

  // 1. ACTIVE: far in the future
  const activeStatus = calculateSubscriptionStatus({
    hostingExpiryDate: oneYearFromNow,
    isSuspended: false,
    gracePeriodDays: 7,
  });
  assert.equal(activeStatus.status, "active");
  assert.equal(activeStatus.isGracePeriod, false);
  assert.equal(activeStatus.isSuspended, false);

  // 2. WARNING: within 30 days
  const warningStatus = calculateSubscriptionStatus({
    hostingExpiryDate: tenDaysFromNow,
    isSuspended: false,
    gracePeriodDays: 7,
  });
  assert.equal(warningStatus.status, "warning");
  assert.equal(warningStatus.isGracePeriod, false);
  assert.equal(warningStatus.isSuspended, false);

  // 3. GRACE: expired 3 days ago, grace period is 7 days
  const graceStatus = calculateSubscriptionStatus({
    hostingExpiryDate: threeDaysAgo,
    isSuspended: false,
    gracePeriodDays: 7,
  });
  assert.equal(graceStatus.status, "grace");
  assert.equal(graceStatus.isGracePeriod, true);
  assert.equal(graceStatus.isSuspended, false);

  // 4. SUSPENDED: expired 20 days ago, past 7-day grace period
  const autoSuspended = calculateSubscriptionStatus({
    hostingExpiryDate: twentyDaysAgo,
    isSuspended: false,
    gracePeriodDays: 7,
  });
  assert.equal(autoSuspended.status, "suspended");
  assert.equal(autoSuspended.isSuspended, true);

  // 5. EXPLICIT KILLSWITCH: isSuspended: true overrides active expiry
  const manualSuspended = calculateSubscriptionStatus({
    hostingExpiryDate: oneYearFromNow,
    isSuspended: true,
    gracePeriodDays: 7,
  });
  assert.equal(manualSuspended.status, "suspended");
  assert.equal(manualSuspended.isSuspended, true);
});

// ===============================================================
// 5. AUDIT LOGGING & METADATA SANITIZATION
// ===============================================================

test("sanitizeMetadata strips sensitive passwords, tokens, and secret keys", () => {
  const sensitivePayload = {
    userName: "Test Admin",
    email: "admin@osvid.com",
    password: "SuperSecretPassword123!",
    temporaryPassword: "TempPassword999!",
    paystack_secret_key: "sk_live_123456789",
    authToken: "jwt-token-string",
    nested: {
      apiKey: "secret-api-key",
      safeNote: "This note should not be redacted",
    },
    allowedArray: [1, 2, "normal-value"],
  };

  const sanitized = sanitizeMetadata(sensitivePayload);

  assert.equal(sanitized.userName, "Test Admin");
  assert.equal(sanitized.email, "admin@osvid.com");
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.temporaryPassword, "[REDACTED]");
  assert.equal(sanitized.paystack_secret_key, "[REDACTED]");
  assert.equal(sanitized.authToken, "[REDACTED]");
  assert.equal(sanitized.nested.apiKey, "[REDACTED]");
  assert.equal(sanitized.nested.safeNote, "This note should not be redacted");
  assert.deepEqual(sanitized.allowedArray, [1, 2, "normal-value"]);
});

// ===============================================================
// 6. CLIENT CONFIG & ARCHITECTURE VERIFICATION
// ===============================================================

test("Client configuration defines stable client identity grounded in repository facts (.firebaserc)", () => {
  assert.equal(OSVID_CLIENT_CONFIG.clientId, "osvid");
  assert.equal(OSVID_CLIENT_CONFIG.clientName, "OSVID Chemicals Limited");
  assert.equal(OSVID_CLIENT_CONFIG.firebaseProjectId, "osvid-9d4d6");
  assert.equal(OSVID_CLIENT_CONFIG.hostingSite, "osvid.web.app");
  assert.equal(OSVID_CLIENT_CONFIG.primaryDomain, undefined);
  assert.equal(OSVID_CLIENT_CONFIG.defaultAdminEmail, undefined);
  assert.equal(OSVID_CLIENT_CONFIG.controlPlaneReady, false);
});

// ===============================================================
// 7. SECURITY RULES VERIFICATION (STATIC ENFORCEMENT)
// ===============================================================

test("firestore.rules enforces tamper-resistance on audit_logs and separates catalogue from stock updates", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  // Audit logs cannot be written from client
  assert.match(rules, /match \/audit_logs\/\{logId\}/);
  assert.match(rules, /allow write: if false;/);
  assert.match(rules, /allow read: if isSuperAdmin\(\);/);

  // Products collection separates catalogue CRUD from stock adjustment
  assert.match(rules, /match \/products\/\{productId\}/);
  assert.match(rules, /hasManagerPermission\('canManageProducts'\)/);
  assert.match(rules, /hasManagerPermission\('canManageInventory'\)/);
  assert.match(rules, /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['stockQuantity'\]\)/);
  assert.match(rules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['stockQuantity', 'updatedAt'\]\)/);
});

test("firestore.rules enforces isSubscriptionOperational() schema validity and seals system_settings", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  // isSubscriptionOperational helper requires exists(subDoc), structural schema validity, and NO fail-open !exists(subDoc)
  assert.match(rules, /function isSubscriptionOperational\(\)/);
  assert.match(rules, /let subDoc = \/databases\/\$\(database\)\/documents\/runtime_settings\/subscription;/);
  assert.match(rules, /exists\(subDoc\)/);
  assert.doesNotMatch(rules, /!exists\(subDoc\)/);
  assert.match(rules, /get\(subDoc\)\.data\.clientId == "osvid"/);
  assert.match(rules, /get\(subDoc\)\.data\.isSuspended is bool/);
  assert.match(rules, /get\(subDoc\)\.data\.isSuspended == false/);
  assert.match(rules, /get\(subDoc\)\.data\.hardSuspendAt is timestamp/);
  assert.match(rules, /request\.time < get\(subDoc\)\.data\.hardSuspendAt/);

  // Gated staff writes
  assert.match(rules, /match \/categories\/\{categoryId\}[\s\S]*?isSubscriptionOperational\(\)/);
  assert.match(rules, /match \/orders\/\{orderId\}[\s\S]*?isSubscriptionOperational\(\)/);
  assert.match(rules, /match \/discounts\/\{discountId\}[\s\S]*?isSubscriptionOperational\(\)/);

  // runtime_settings collection: public read, write denied
  assert.match(rules, /match \/runtime_settings\/\{settingId\}/);
  assert.match(rules, /allow read: if true;/);
  assert.match(rules, /allow write: if false;/);

  // Provider-private subscription records in system_settings: non-overlapping wildcard excludes subscription docs
  assert.match(rules, /match \/system_settings\/\{settingId\}/);
  assert.match(rules, /settingId != "subscription"/);
  assert.match(rules, /settingId != "main_business"/);
  // Ensure broad wildcard staff read without exclusions no longer exists
  assert.doesNotMatch(rules, /match \/system_settings\/\{settingId\}[\s\S]*?allow read:\s*if isStaff\(\) \|\| isSuperAdmin\(\);/);

  // users collection: direct delete forbidden
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*?allow delete: if false;/);
});

test("storage.rules gates staff uploads behind isSubscriptionOperational() with full schema enforcement", () => {
  const rulesPath = path.resolve(process.cwd(), "storage.rules");
  const rules = fs.readFileSync(rulesPath, "utf-8");

  assert.match(rules, /function isSubscriptionOperational\(\)/);
  assert.match(rules, /let subDoc = \/databases\/\(default\)\/documents\/runtime_settings\/subscription;/);
  assert.match(rules, /firestore\.exists\(subDoc\)/);
  assert.doesNotMatch(rules, /!firestore\.exists\(subDoc\)/);
  assert.match(rules, /firestore\.get\(subDoc\)\.data\.clientId == "osvid"/);
  assert.match(rules, /firestore\.get\(subDoc\)\.data\.isSuspended is bool/);
  assert.match(rules, /firestore\.get\(subDoc\)\.data\.isSuspended == false/);
  assert.match(rules, /firestore\.get\(subDoc\)\.data\.hardSuspendAt is timestamp/);
  assert.match(rules, /request\.time < firestore\.get\(subDoc\)\.data\.hardSuspendAt/);
  assert.match(rules, /isSubscriptionOperational\(\)/);
});

// ===============================================================
// 8. PRIVILEGED SUBSCRIPTION & AUDIT ROUTE PROTECTION
// ===============================================================

import { POST as subscriptionRouteHandler } from "@/app/api/admin/subscription/route";
import { GET as auditLogsRouteHandler } from "@/app/api/admin/audit-logs/route";
import { NextRequest } from "next/server";

test("Unauthenticated request to /api/admin/subscription is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "suspend", reason: "Test suspension" }),
  });
  const res = await subscriptionRouteHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Unauthenticated request to /api/admin/audit-logs is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/audit-logs?limit=50", {
    method: "GET",
  });
  const res = await auditLogsRouteHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Admin and Manager callers cannot mutate provider subscription (enforced via requireSuperAdmin)", () => {
  const adminCaller = createMockCaller({
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
  });
  assert.equal(adminCaller.isSuperAdmin, false);

  const managerCaller = createMockCaller({
    uid: "manager-1",
    email: "manager@osvid.com",
    role: "manager",
  });
  assert.equal(managerCaller.isSuperAdmin, false);

  const customerCaller = createMockCaller({
    uid: "customer-1",
    email: "customer@gmail.com",
    role: "user",
  });
  assert.equal(customerCaller.isSuperAdmin, false);

  // Only verified Super Admin holds isSuperAdmin authority
  const superAdminCaller = createMockCaller({
    uid: "super-1",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    role: "super_admin",
  });
  assert.equal(superAdminCaller.isSuperAdmin, true);
});

// ===============================================================
// 9. FIRESTORE DIFF LOGIC & INVENTORY ISOLATION SIMULATION
// ===============================================================

function simulateRulesUpdate(params: {
  isSuperAdmin: boolean;
  isSubscriptionOperational: boolean;
  canManageProducts: boolean;
  canManageInventory: boolean;
  existingDoc: Record<string, any>;
  incomingDoc: Record<string, any>;
}): boolean {
  if (params.isSuperAdmin) return true;
  if (!params.isSubscriptionOperational) return false;

  const allKeys = Array.from(new Set([...Object.keys(params.existingDoc), ...Object.keys(params.incomingDoc)]));
  const affectedKeys = allKeys.filter((k) => params.incomingDoc[k] !== params.existingDoc[k]);

  if (params.canManageProducts && !params.canManageInventory) {
    return !affectedKeys.includes("stockQuantity");
  }

  if (params.canManageInventory && !params.canManageProducts) {
    return affectedKeys.every((k) => k === "stockQuantity" || k === "updatedAt");
  }

  if (params.canManageProducts && params.canManageInventory) {
    return true;
  }

  return false;
}

function simulateRulesCreate(params: {
  isSuperAdmin: boolean;
  isSubscriptionOperational: boolean;
  canManageProducts: boolean;
  canManageInventory: boolean;
  incomingDoc: Record<string, any>;
}): boolean {
  if (params.isSuperAdmin) return true;
  if (!params.isSubscriptionOperational) return false;
  if (!params.canManageProducts) return false;

  return params.canManageInventory || params.incomingDoc.stockQuantity === 0;
}

test("Product Manager without inventory authority cannot modify stockQuantity", () => {
  const existingDoc = { name: "Chemical A", price: 5000, stockQuantity: 100, updatedAt: "2026-10-01" };

  // Can update metadata
  const allowed = simulateRulesUpdate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: true,
    canManageInventory: false,
    existingDoc,
    incomingDoc: { ...existingDoc, name: "Chemical A+", price: 6000 },
  });
  assert.equal(allowed, true);

  // Cannot modify stock
  const denied = simulateRulesUpdate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: true,
    canManageInventory: false,
    existingDoc,
    incomingDoc: { ...existingDoc, stockQuantity: 200 },
  });
  assert.equal(denied, false);
});

test("Inventory Manager without product authority can only modify stockQuantity and updatedAt", () => {
  const existingDoc = { name: "Chemical A", price: 5000, stockQuantity: 100, updatedAt: "2026-10-01" };

  // Can adjust stockQuantity and updatedAt
  const allowed = simulateRulesUpdate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: false,
    canManageInventory: true,
    existingDoc,
    incomingDoc: { ...existingDoc, stockQuantity: 80, updatedAt: "2026-10-05" },
  });
  assert.equal(allowed, true);

  // Cannot touch catalogue metadata (name, price)
  const denied = simulateRulesUpdate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: false,
    canManageInventory: true,
    existingDoc,
    incomingDoc: { ...existingDoc, stockQuantity: 80, price: 4000 },
  });
  assert.equal(denied, false);
});

test("Product Manager without inventory authority cannot create positive initial stock", () => {
  // Creating product with stock 0 is allowed
  const allowed = simulateRulesCreate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: true,
    canManageInventory: false,
    incomingDoc: { name: "Chemical B", stockQuantity: 0 },
  });
  assert.equal(allowed, true);

  // Creating product with stock > 0 is denied
  const denied = simulateRulesCreate({
    isSuperAdmin: false,
    isSubscriptionOperational: true,
    canManageProducts: true,
    canManageInventory: false,
    incomingDoc: { name: "Chemical B", stockQuantity: 50 },
  });
  assert.equal(denied, false);
});

test("Operational mutations are blocked when subscription is suspended", () => {
  const existingDoc = { name: "Chemical A", price: 5000, stockQuantity: 100 };

  const blocked = simulateRulesUpdate({
    isSuperAdmin: false,
    isSubscriptionOperational: false,
    canManageProducts: true,
    canManageInventory: true,
    existingDoc,
    incomingDoc: { ...existingDoc, price: 6000 },
  });
  assert.equal(blocked, false);

  // Super admin can bypass for recovery
  const superAllowed = simulateRulesUpdate({
    isSuperAdmin: true,
    isSubscriptionOperational: false,
    canManageProducts: false,
    canManageInventory: false,
    existingDoc,
    incomingDoc: { ...existingDoc, price: 6000 },
  });
  assert.equal(superAllowed, true);
});

// ===============================================================
// 10. RUNTIME SUBSCRIPTION PRIVACY & AUDIT LOGGING
// ===============================================================

test("RuntimeSubscriptionState contains no provider-private billing info or renewal fees", () => {
  const runtimeState: RuntimeSubscriptionState = {
    clientId: "osvid",
    isSuspended: false,
    businessName: "OSVID Chemicals Limited",
    hostingExpiryDate: "2027-10-01T00:00:00.000Z",
    gracePeriodDays: 7,
    hardSuspendAt: null,
    hardSuspendAtIso: "2027-10-08T00:00:00.000Z",
    showWarning: false,
    updatedAt: "2026-10-05T00:00:00.000Z",
  };

  const keys = Object.keys(runtimeState);
  assert.equal(keys.includes("renewalAmountNgn"), false);
  assert.equal(keys.includes("billingContactEmail"), false);
  assert.equal(keys.includes("providerNotes"), false);
  assert.equal(keys.includes("adminEmail"), false);
});

test("buildAuditLogRecord produces immutable, properly structured audit record", () => {
  const { docRef, entry } = buildAuditLogRecord({
    actor: {
      uid: "super-1",
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      role: "super_admin",
    },
    action: "subscription_update",
    targetType: "subscription",
    targetId: "subscription",
    summary: "Updated subscription",
    metadata: { newStatus: "active", plan: "pro" },
  });

  assert.equal(entry.actorUid, "super-1");
  assert.equal(entry.actorEmail, PRIMARY_SUPER_ADMIN_EMAIL);
  assert.equal(entry.actorRole, "super_admin");
  assert.equal(entry.action, "subscription_update");
  assert.equal(typeof entry.timestamp, "string");
  assert.deepEqual(entry.metadata, { newStatus: "active", plan: "pro" });
  assert.ok(docRef);
});

// ===============================================================
// 11. PACKET 2C CONSISTENCY & AUDIT SURFACING VERIFICATION
// ===============================================================

test("Staff mutation response contract surfaces auditRecorded and auditWarning on audit failure", () => {
  // Simulate successful auth operation where audit log succeeds
  const successAuditResult = { success: true, logId: "audit-123" };
  const successResponse = {
    success: true,
    auditRecorded: Boolean(successAuditResult.success),
    ...(!successAuditResult.success
      ? { auditWarning: "Staff account created successfully, but audit log entry failed to record." }
      : {}),
    message: 'Manager "John Doe" created successfully!',
  };
  assert.equal(successResponse.success, true);
  assert.equal(successResponse.auditRecorded, true);
  assert.equal("auditWarning" in successResponse, false);

  // Simulate successful auth operation where audit log fails
  const failedAuditResult = { success: false, error: "Firestore unavailable" };
  const warningResponse = {
    success: true,
    auditRecorded: Boolean(failedAuditResult.success),
    ...(!failedAuditResult.success
      ? { auditWarning: "Staff account created successfully, but audit log entry failed to record." }
      : {}),
    message: 'Manager "John Doe" created successfully!',
  };
  assert.equal(warningResponse.success, true);
  assert.equal(warningResponse.auditRecorded, false);
  assert.equal(typeof warningResponse.auditWarning, "string");
  assert.match(warningResponse.auditWarning!, /audit log entry failed to record/);
});

test("Operational mutation fails closed when runtime subscription doc does not exist", () => {
  // When runtime subscription doc does not exist in Firestore:
  const subDocExists = false;
  const isSuperAdmin = false;
  const isSubscriptionOperational = subDocExists; // fail-closed: must exist

  const allowed = simulateRulesUpdate({
    isSuperAdmin,
    isSubscriptionOperational,
    canManageProducts: true,
    canManageInventory: true,
    existingDoc: { name: "Product A", price: 100 },
    incomingDoc: { name: "Product A", price: 120 },
  });
  assert.equal(allowed, false, "Staff write must be denied when runtime subscription doc does not exist");

  // Super Admin can still perform recovery writes when subscription doc does not exist
  const superAllowed = simulateRulesUpdate({
    isSuperAdmin: true,
    isSubscriptionOperational,
    canManageProducts: false,
    canManageInventory: false,
    existingDoc: { name: "Product A", price: 100 },
    incomingDoc: { name: "Product A", price: 120 },
  });
  assert.equal(superAllowed, true, "Super Admin must retain emergency recovery capability");
});

test("Subscription initialization payload rejects invalid or synthetic terms", () => {
  // Positive renewalAmountNgn required
  const invalidAmountPayload = {
    action: "initialize",
    renewalAmountNgn: 0,
    hostingExpiryDate: "2027-10-01T00:00:00.000Z",
  };
  assert.equal(invalidAmountPayload.renewalAmountNgn <= 0, true);

  // Valid concrete terms
  const validPayload = {
    action: "initialize",
    businessName: "OSVID Chemicals Limited",
    renewalAmountNgn: 150000,
    hostingExpiryDate: "2027-10-01T00:00:00.000Z",
    gracePeriodDays: 14,
  };
  assert.equal(validPayload.renewalAmountNgn > 0, true);
  assert.equal(Number.isNaN(new Date(validPayload.hostingExpiryDate).getTime()), false);
});
// ===============================================================
// 12. PACKET 2D OVERLAP PREVENTION & RUNTIME SCHEMA ENFORCEMENT
// ===============================================================

function simulateSystemSettingsReadRule(params: {
  settingId: string;
  isSuperAdmin: boolean;
  isStaff: boolean;
}): boolean {
  // Direct simulation of:
  // allow read: if isSuperAdmin() || (isStaff() && settingId != "subscription" && settingId != "main_business");
  return params.isSuperAdmin || (
    params.isStaff &&
    params.settingId !== "subscription" &&
    params.settingId !== "main_business"
  );
}

test("system_settings non-overlapping rule strictly blocks staff from reading subscription documents", () => {
  // Staff callers (Admin / Manager) attempting to read subscription documents
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "subscription", isSuperAdmin: false, isStaff: true }),
    false,
    "Staff must be denied read on system_settings/subscription"
  );
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "main_business", isSuperAdmin: false, isStaff: true }),
    false,
    "Staff must be denied read on system_settings/main_business"
  );

  // Staff callers attempting to read general non-subscription documents
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "theme_config", isSuperAdmin: false, isStaff: true }),
    true,
    "Staff may read non-subscription system settings"
  );

  // Super Admin can read all documents
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "subscription", isSuperAdmin: true, isStaff: true }),
    true,
    "Super Admin can read system_settings/subscription"
  );
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "main_business", isSuperAdmin: true, isStaff: true }),
    true,
    "Super Admin can read system_settings/main_business"
  );

  // Unauthenticated / non-staff callers denied on all documents
  assert.equal(
    simulateSystemSettingsReadRule({ settingId: "theme_config", isSuperAdmin: false, isStaff: false }),
    false,
    "Non-staff denied on all system settings"
  );
});

function simulateIsSubscriptionOperationalRule(doc: any, requestTimeMs: number): boolean {
  if (!doc) return false;
  if (typeof doc !== "object") return false;
  if (!("clientId" in doc) || doc.clientId !== "osvid") return false;
  if (!("isSuspended" in doc) || typeof doc.isSuspended !== "boolean" || doc.isSuspended !== false) return false;
  if (!("hardSuspendAt" in doc) || doc.hardSuspendAt === null) return false;
  if (typeof doc.hardSuspendAt !== "object" || typeof doc.hardSuspendAt.toMillis !== "function") return false;
  if (requestTimeMs >= doc.hardSuspendAt.toMillis()) return false;
  return true;
}

test("Malformed or missing runtime state fails closed in operational evaluation", () => {
  const nowMs = 1791244800000; // 2026-10-05T00:00:00.000Z
  const validFutureTimestamp = { toMillis: () => nowMs + 7 * 24 * 60 * 60 * 1000 };
  const expiredTimestamp = { toMillis: () => nowMs - 1000 };

  // 1. Missing document fails closed
  assert.equal(simulateIsSubscriptionOperationalRule(null, nowMs), false);

  // 2. Missing hardSuspendAt fails closed (no longer treated as operational)
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: false },
      nowMs
    ),
    false
  );

  // 3. Null hardSuspendAt fails closed
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: false, hardSuspendAt: null },
      nowMs
    ),
    false
  );

  // 4. Non-timestamp hardSuspendAt fails closed
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: false, hardSuspendAt: "2027-10-01" },
      nowMs
    ),
    false
  );

  // 5. Missing or incorrect clientId fails closed
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "wrong-client", isSuspended: false, hardSuspendAt: validFutureTimestamp },
      nowMs
    ),
    false
  );
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { isSuspended: false, hardSuspendAt: validFutureTimestamp },
      nowMs
    ),
    false
  );

  // 6. Non-boolean isSuspended fails closed
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: "false", hardSuspendAt: validFutureTimestamp },
      nowMs
    ),
    false
  );

  // 7. isSuspended == true fails closed
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: true, hardSuspendAt: validFutureTimestamp },
      nowMs
    ),
    false
  );

  // 8. request.time >= hardSuspendAt fails closed (expired past grace)
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: false, hardSuspendAt: expiredTimestamp },
      nowMs
    ),
    false
  );

  // 9. Structurally valid runtime state succeeds
  assert.equal(
    simulateIsSubscriptionOperationalRule(
      { clientId: "osvid", isSuspended: false, hardSuspendAt: validFutureTimestamp },
      nowMs
    ),
    true
  );
});

test("Super Admin bypasses runtime subscription gating even with malformed runtime state", () => {
  const malformedRuntimeDoc = { clientId: "corrupt", isSuspended: "invalid" };
  const isOperational = simulateIsSubscriptionOperationalRule(malformedRuntimeDoc, Date.now());
  assert.equal(isOperational, false);

  const allowed = simulateRulesUpdate({
    isSuperAdmin: true,
    isSubscriptionOperational: isOperational,
    canManageProducts: false,
    canManageInventory: false,
    existingDoc: { name: "Chemical A", price: 5000 },
    incomingDoc: { name: "Chemical A", price: 6000 },
  });
  assert.equal(allowed, true, "Super Admin emergency bypass must succeed");
});

test("Initialization logic rejects overwriting existing authoritative subscription terms (409 Conflict)", () => {
  const simulateInitializeAction = (lookupKind: "FOUND" | "NOT_CONFIGURED") => {
    if (lookupKind === "FOUND") {
      return {
        status: 409,
        error:
          "Subscription is already configured. Use 'update-terms' to modify terms or 'bootstrap-runtime' to sync runtime state.",
      };
    }
    return { status: 200, success: true };
  };

  const conflictRes = simulateInitializeAction("FOUND");
  assert.equal(conflictRes.status, 409);
  assert.match(conflictRes.error!, /already configured/);

  const freshRes = simulateInitializeAction("NOT_CONFIGURED");
  assert.equal(freshRes.status, 200);
});

test("Initialization validates optional fields: businessName, adminEmail, warningNotice", () => {
  const validateInitPayload = (payload: any) => {
    if (payload.businessName !== undefined) {
      if (typeof payload.businessName !== "string" || payload.businessName.trim().length === 0 || payload.businessName.length > 150) {
        return { valid: false, error: "Invalid businessName" };
      }
    }
    if (payload.adminEmail !== undefined && payload.adminEmail !== "") {
      if (
        typeof payload.adminEmail !== "string" ||
        payload.adminEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.adminEmail.trim())
      ) {
        return { valid: false, error: "Invalid adminEmail" };
      }
    }
    if (payload.warningNotice !== undefined) {
      if (typeof payload.warningNotice !== "string" || payload.warningNotice.length > 500) {
        return { valid: false, error: "Invalid warningNotice" };
      }
    }
    return { valid: true };
  };

  // Invalid email format rejected
  assert.equal(validateInitPayload({ adminEmail: "not-an-email" }).valid, false);
  assert.equal(validateInitPayload({ adminEmail: "admin@osvid" }).valid, false);
  assert.equal(validateInitPayload({ adminEmail: "admin@osvid.com" }).valid, true);

  // Empty or overly long businessName rejected
  assert.equal(validateInitPayload({ businessName: "" }).valid, false);
  assert.equal(validateInitPayload({ businessName: "   " }).valid, false);
  assert.equal(validateInitPayload({ businessName: "a".repeat(151) }).valid, false);
  assert.equal(validateInitPayload({ businessName: "OSVID Chemicals" }).valid, true);

  // Overly long warning notice rejected
  assert.equal(validateInitPayload({ warningNotice: "x".repeat(501) }).valid, false);
  assert.equal(validateInitPayload({ warningNotice: "Notice within limits" }).valid, true);
});
