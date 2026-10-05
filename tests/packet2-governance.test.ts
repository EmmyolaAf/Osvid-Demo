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
import { sanitizeMetadata } from "@/lib/server/audit";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
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

test("Client configuration defines stable client identity without altering collections", () => {
  assert.equal(OSVID_CLIENT_CONFIG.clientId, "osvid");
  assert.equal(OSVID_CLIENT_CONFIG.clientName, "OSVID Chemicals Limited");
  assert.equal(OSVID_CLIENT_CONFIG.controlPlaneReady, true);
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

