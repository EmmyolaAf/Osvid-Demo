import test from "node:test";
import assert from "node:assert/strict";
import {
  extractBearerToken,
  isSuperAdminEmail,
  PRIMARY_SUPER_ADMIN_EMAIL,
  AuthError,
  hasPermission,
  ServerAuthUser,
} from "@/lib/server/auth";

test("extractBearerToken correctly parses Authorization header", () => {
  // Valid Bearer
  const req1 = { headers: new Headers({ Authorization: "Bearer test-token-123" }) };
  assert.equal(extractBearerToken(req1 as any), "test-token-123");

  // Case insensitive header
  const req2 = { headers: new Headers({ authorization: "Bearer lowercase-token" }) };
  assert.equal(extractBearerToken(req2 as any), "lowercase-token");

  // Missing header
  const req3 = { headers: new Headers() };
  assert.equal(extractBearerToken(req3 as any), null);

  // Non-Bearer scheme
  const req4 = { headers: new Headers({ Authorization: "Basic dXNlcjpwYXNz" }) };
  assert.equal(extractBearerToken(req4 as any), null);

  // Malformed header (no token after Bearer)
  const req5 = { headers: new Headers({ Authorization: "Bearer" }) };
  assert.equal(extractBearerToken(req5 as any), null);
});

test("isSuperAdminEmail strictly verifies the platform owner email", () => {
  assert.equal(isSuperAdminEmail(PRIMARY_SUPER_ADMIN_EMAIL), true);
  assert.equal(isSuperAdminEmail("ABOLARINWAEMMANUELFREE@GMAIL.COM"), true);
  assert.equal(isSuperAdminEmail("  abolarinwaemmanuelfree@gmail.com  "), true);
  assert.equal(isSuperAdminEmail("attacker@evil.com"), false);
  assert.equal(isSuperAdminEmail("admin@osvid.com"), false);
  assert.equal(isSuperAdminEmail(null), false);
  assert.equal(isSuperAdminEmail(undefined), false);
});

test("hasPermission correctly evaluates manager vs admin privileges", () => {
  const superAdmin: ServerAuthUser = {
    uid: "super-1",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    role: "super_admin",
    isSuperAdmin: true,
    isAdmin: true,
    isManager: false,
    isStaff: true,
    isCustomer: false,
    isActive: true,
    tokenClaims: {},
  };

  const admin: ServerAuthUser = {
    uid: "admin-1",
    email: "admin@osvid.com",
    role: "admin",
    isSuperAdmin: false,
    isAdmin: true,
    isManager: false,
    isStaff: true,
    isCustomer: false,
    isActive: true,
    tokenClaims: {},
  };

  const managerWithProductsOnly: ServerAuthUser = {
    uid: "manager-1",
    email: "manager@osvid.com",
    role: "manager",
    isSuperAdmin: false,
    isAdmin: false,
    isManager: true,
    isStaff: true,
    isCustomer: false,
    isActive: true,
    permissions: {
      canManageProducts: true,
      canManageOrders: false,
      canViewFinancials: false,
      canManageWebsite: false,
      canManageCustomers: false,
      canManageDiscounts: false,
    },
    tokenClaims: {},
  };

  const regularCustomer: ServerAuthUser = {
    uid: "user-1",
    email: "customer@example.com",
    role: "user",
    isSuperAdmin: false,
    isAdmin: false,
    isManager: false,
    isStaff: false,
    isCustomer: true,
    isActive: true,
    tokenClaims: {},
  };

  // Super Admin has all permissions
  assert.equal(hasPermission(superAdmin, "canManageProducts"), true);
  assert.equal(hasPermission(superAdmin, "canViewFinancials"), true);
  assert.equal(hasPermission(superAdmin, "canManageWebsite"), true);

  // Admin has all business operations permissions
  assert.equal(hasPermission(admin, "canManageProducts"), true);
  assert.equal(hasPermission(admin, "canViewFinancials"), true);
  assert.equal(hasPermission(admin, "canManageDiscounts"), true);

  // Manager with granular permissions
  assert.equal(hasPermission(managerWithProductsOnly, "canManageProducts"), true);
  assert.equal(hasPermission(managerWithProductsOnly, "canManageOrders"), false);
  assert.equal(hasPermission(managerWithProductsOnly, "canViewFinancials"), false);

  // Customer has zero manager permissions
  assert.equal(hasPermission(regularCustomer, "canManageProducts"), false);
  assert.equal(hasPermission(regularCustomer, "canManageOrders"), false);
});

test("AuthError correctly exposes status code for API responses", () => {
  const err401 = new AuthError("Missing token", 401);
  assert.equal(err401.message, "Missing token");
  assert.equal(err401.status, 401);

  const err403 = new AuthError("Forbidden role", 403);
  assert.equal(err403.message, "Forbidden role");
  assert.equal(err403.status, 403);
});

// ===============================================================
// LIVE PROFILE & SERVER AUTH CONSISTENCY TESTS
// ===============================================================

import { adminDb } from "@/lib/firebase/admin";
import { resolveServerUser } from "@/lib/server/auth";
import {
  updateManagerProfile,
  updateUserRole,
  toggleUserStatus,
  deleteUserRecord,
} from "@/lib/firebase/firestore";

const mockUserStore: Record<string, any> = {};
let simulateDbError = false;

const origCollection = adminDb.collection.bind(adminDb);
(adminDb as any).collection = (colName: string) => {
  if (colName === "users") {
    return {
      doc: (docId: string) => ({
        get: async () => {
          if (simulateDbError) {
            throw new Error("Firestore connection timeout simulated");
          }
          const docData = mockUserStore[docId];
          return {
            exists: docData !== undefined && docData !== null,
            data: () => docData,
          };
        },
      }),
    };
  }
  return origCollection(colName);
};

test("resolveServerUser: non-primary super_admin claim does NOT grant Super Admin authority", async () => {
  mockUserStore["attacker-uid"] = {
    email: "attacker@evil.com",
    role: "user",
    isActive: true,
  };
  const token: any = {
    uid: "attacker-uid",
    email: "attacker@evil.com",
    role: "super_admin",
  };
  const user = await resolveServerUser(token);
  assert.equal(user.isSuperAdmin, false);
  assert.equal(user.role, "user");
  assert.equal(user.isAdmin, false);
  assert.equal(user.isStaff, false);
});

test("resolveServerUser: primary provider account receives Super Admin authority", async () => {
  const token: any = {
    uid: "primary-super-uid",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    role: "super_admin",
  };
  const user = await resolveServerUser(token);
  assert.equal(user.isSuperAdmin, true);
  assert.equal(user.isAdmin, true);
  assert.equal(user.isStaff, true);
  assert.equal(user.role, "super_admin");
});

test("resolveServerUser: deactivated Manager is blocked from privileged operations", async () => {
  mockUserStore["deactivated-mgr-uid"] = {
    email: "manager@osvid.com",
    role: "manager",
    isActive: false,
    permissions: { canManageProducts: true },
  };
  const token: any = {
    uid: "deactivated-mgr-uid",
    email: "manager@osvid.com",
    role: "manager",
  };
  await assert.rejects(
    async () => resolveServerUser(token),
    (err: any) => err instanceof AuthError && err.status === 403 && /deactivated/.test(err.message)
  );
});

test("resolveServerUser: revoked Manager permission cannot be recovered through stale token claims", async () => {
  mockUserStore["mgr-revoked-uid"] = {
    email: "manager@osvid.com",
    role: "manager",
    isActive: true,
    permissions: {
      canManageProducts: false, // REVOKED in live database
      canManageOrders: true,
    },
  };
  // Token has stale permissions where canManageProducts was true
  const staleToken: any = {
    uid: "mgr-revoked-uid",
    email: "manager@osvid.com",
    role: "manager",
    permissions: {
      canManageProducts: true, // STALE token claim
      canManageOrders: true,
    },
  };
  const resolved = await resolveServerUser(staleToken);
  assert.equal(resolved.permissions?.canManageProducts, false);
  assert.equal(hasPermission(resolved, "canManageProducts"), false);
  assert.equal(hasPermission(resolved, "canManageOrders"), true);
});

test("resolveServerUser: staff role changes adopt live Firestore profile state over stale token", async () => {
  // Stale token says "manager", but DB says "admin"
  mockUserStore["promoted-uid"] = {
    email: "staff@osvid.com",
    role: "admin",
    isActive: true,
  };
  const token1: any = {
    uid: "promoted-uid",
    email: "staff@osvid.com",
    role: "manager",
  };
  const resolvedAdmin = await resolveServerUser(token1);
  assert.equal(resolvedAdmin.role, "admin");
  assert.equal(resolvedAdmin.isAdmin, true);

  // Stale token says "admin", but DB says "user" (demoted)
  mockUserStore["demoted-uid"] = {
    email: "formeradmin@osvid.com",
    role: "user",
    isActive: true,
  };
  const token2: any = {
    uid: "demoted-uid",
    email: "formeradmin@osvid.com",
    role: "admin",
  };
  const resolvedUser = await resolveServerUser(token2);
  assert.equal(resolvedUser.role, "user");
  assert.equal(resolvedUser.isAdmin, false);
  assert.equal(resolvedUser.isStaff, false);
});

test("resolveServerUser: fails closed with 503 when live staff profile cannot be resolved due to DB error", async () => {
  simulateDbError = true;
  try {
    const privilegedToken: any = {
      uid: "staff-outage-uid",
      email: "staff@osvid.com",
      role: "admin",
    };
    await assert.rejects(
      async () => resolveServerUser(privilegedToken),
      (err: any) => err instanceof AuthError && err.status === 503
    );

    // Primary Super Admin emergency bootstrap bypass remains functional
    const superToken: any = {
      uid: "super-bootstrap-uid",
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      role: "super_admin",
    };
    const superUser = await resolveServerUser(superToken);
    assert.equal(superUser.isSuperAdmin, true);
  } finally {
    simulateDbError = false;
  }
});

test("Privileged staff helpers do NOT fall back to direct Firestore when unauthenticated or failing", async () => {
  // All helpers must reject when unauthenticated, never falling back to direct updateDoc/deleteDoc
  await assert.rejects(
    async () => updateManagerProfile("uid-1", { customTitle: "New Title" }),
    /Authentication required/
  );
  await assert.rejects(
    async () => updateUserRole("uid-1", "admin"),
    /Authentication required/
  );
  await assert.rejects(
    async () => toggleUserStatus("uid-1", false),
    /Authentication required/
  );
  await assert.rejects(
    async () => deleteUserRecord("uid-1"),
    /Authentication required/
  );
});
