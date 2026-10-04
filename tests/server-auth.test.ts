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
