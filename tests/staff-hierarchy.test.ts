import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIMARY_SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
  assertCanCreateStaffRole,
  assertStaffEndpointTarget,
  assertCanManageTargetStaff,
  assertCanUpdateStaffFields,
  assertCanDeleteStaff,
  ServerAuthUser,
  AuthError,
  generateSecureTemporaryPassword,
} from "@/lib/server/auth";

// Helpers to create mock caller representations
function createMockUser(params: {
  uid: string;
  email: string;
  role: "super_admin" | "admin" | "manager" | "user";
}): ServerAuthUser {
  const isSuperAdmin = params.role === "super_admin" || isSuperAdminEmail(params.email);
  return {
    uid: params.uid,
    email: params.email,
    displayName: "Mock User",
    role: params.role,
    isSuperAdmin,
    isAdmin: isSuperAdmin || params.role === "admin",
    isManager: params.role === "manager",
    isStaff: isSuperAdmin || params.role === "admin" || params.role === "manager",
    isCustomer: params.role === "user",
    isActive: true,
    tokenClaims: { role: params.role },
  };
}

const superAdminCaller = createMockUser({
  uid: "super-1",
  email: PRIMARY_SUPER_ADMIN_EMAIL,
  role: "super_admin",
});

const adminCaller = createMockUser({
  uid: "admin-1",
  email: "admin@osvid.com",
  role: "admin",
});

const managerCaller = createMockUser({
  uid: "manager-1",
  email: "manager@osvid.com",
  role: "manager",
});

const customerCaller = createMockUser({
  uid: "user-1",
  email: "customer@example.com",
  role: "user",
});

// ===============================================================
// 1. STAFF CREATION TESTS
// ===============================================================

test("Super Admin can create an Admin and a Manager via assertCanCreateStaffRole", () => {
  const adminRole = assertCanCreateStaffRole(superAdminCaller, "admin", "newadmin@osvid.com");
  assert.equal(adminRole, "admin");

  const managerRole = assertCanCreateStaffRole(superAdminCaller, "manager", "newmgr@osvid.com");
  assert.equal(managerRole, "manager");
});

test("Admin can create a Manager, but CANNOT create an Admin or Super Admin", () => {
  // Allowed: Manager
  const mgrRole = assertCanCreateStaffRole(adminCaller, "manager", "ops@osvid.com");
  assert.equal(mgrRole, "manager");

  // Forbidden: Admin
  assert.throws(
    () => assertCanCreateStaffRole(adminCaller, "admin", "otheradmin@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  // Forbidden: Super Admin
  assert.throws(
    () => assertCanCreateStaffRole(adminCaller, "super_admin", "fake@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Super Admin cannot create account with super_admin role or using primary owner email", () => {
  assert.throws(
    () => assertCanCreateStaffRole(superAdminCaller, "super_admin", "another@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.throws(
    () => assertCanCreateStaffRole(superAdminCaller, "admin", PRIMARY_SUPER_ADMIN_EMAIL),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Staff creation rejects requests attempting to create 'user' (customer) accounts", () => {
  assert.throws(
    () => assertCanCreateStaffRole(superAdminCaller, "user", "cust@example.com"),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  assert.throws(
    () => assertCanCreateStaffRole(adminCaller, "user", "cust@example.com"),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

// ===============================================================
// 2. STAFF TARGET RESTRICTIONS
// ===============================================================

test("assertStaffEndpointTarget strictly rejects customer accounts and allows staff", () => {
  // Staff roles succeed
  assert.doesNotThrow(() => assertStaffEndpointTarget("admin"));
  assert.doesNotThrow(() => assertStaffEndpointTarget("manager"));
  assert.doesNotThrow(() => assertStaffEndpointTarget("super_admin"));

  // Customer role throws 400
  assert.throws(
    () => assertStaffEndpointTarget("user"),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  // Undefined or arbitrary role throws 400
  assert.throws(
    () => assertStaffEndpointTarget(undefined),
    (err: any) => err instanceof AuthError && err.status === 400
  );
  assert.throws(
    () => assertStaffEndpointTarget("guest"),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

// ===============================================================
// 3. STAFF MANAGEMENT & HIERARCHY TESTS
// ===============================================================

test("Admin CANNOT manage other Admins or Super Admins", () => {
  const otherAdmin = { uid: "admin-2", email: "otheradmin@osvid.com", role: "admin" };
  const superAdminTarget = { uid: "super-1", email: PRIMARY_SUPER_ADMIN_EMAIL, role: "super_admin" };

  assert.throws(
    () => assertCanManageTargetStaff(adminCaller, otherAdmin),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.throws(
    () => assertCanManageTargetStaff(adminCaller, superAdminTarget),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Admin CAN manage a Manager", () => {
  const managerTarget = { uid: "manager-2", email: "warehouse@osvid.com", role: "manager" };
  assert.doesNotThrow(() => assertCanManageTargetStaff(adminCaller, managerTarget));
});

test("Staff administration endpoints reject targeting customer accounts", () => {
  const customerTarget = { uid: "cust-1", email: "shopper@gmail.com", role: "user" };

  assert.throws(
    () => assertCanManageTargetStaff(adminCaller, customerTarget),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  assert.throws(
    () => assertCanManageTargetStaff(superAdminCaller, customerTarget),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

// ===============================================================
// 4. STAFF FIELD UPDATES
// ===============================================================

test("Admin CANNOT promote a Manager to Admin or Super Admin", () => {
  const managerTarget = { uid: "manager-2", email: "ops@osvid.com", role: "manager" };

  assert.throws(
    () => assertCanUpdateStaffFields(adminCaller, managerTarget, { role: "admin" }),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.throws(
    () => assertCanUpdateStaffFields(adminCaller, managerTarget, { role: "super_admin" }),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Super Admin cannot be demoted or deactivated", () => {
  const superTarget = { uid: "super-1", email: PRIMARY_SUPER_ADMIN_EMAIL, role: "super_admin" };

  // Cannot deactivate
  assert.throws(
    () => assertCanUpdateStaffFields(superAdminCaller, superTarget, { isActive: false }),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  // Cannot demote
  assert.throws(
    () => assertCanUpdateStaffFields(superAdminCaller, superTarget, { role: "admin" }),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

// ===============================================================
// 5. STAFF DELETION
// ===============================================================

test("Staff self-deletion is strictly forbidden", () => {
  assert.throws(
    () => assertCanDeleteStaff(adminCaller, { uid: "admin-1", email: "admin@osvid.com", role: "admin" }),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  assert.throws(
    () => assertCanDeleteStaff(superAdminCaller, { uid: "super-1", email: PRIMARY_SUPER_ADMIN_EMAIL, role: "super_admin" }),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

test("Primary Super Admin account CANNOT be deleted by anyone", () => {
  const superTarget = { uid: "super-1", email: PRIMARY_SUPER_ADMIN_EMAIL, role: "super_admin" };

  assert.throws(
    () => assertCanDeleteStaff(adminCaller, superTarget),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  // Even if caller had another super admin token, primary cannot be deleted
  assert.throws(
    () => assertCanDeleteStaff(superAdminCaller, superTarget),
    (err: any) => err instanceof AuthError && (err.status === 400 || err.status === 403)
  );
});

test("Admin CANNOT delete other Admins, but CAN delete Managers", () => {
  const otherAdmin = { uid: "admin-2", email: "otheradmin@osvid.com", role: "admin" };
  const managerTarget = { uid: "manager-3", email: "cleaner@osvid.com", role: "manager" };

  assert.throws(
    () => assertCanDeleteStaff(adminCaller, otherAdmin),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.doesNotThrow(() => assertCanDeleteStaff(adminCaller, managerTarget));
});

test("Staff deletion rejects customer accounts", () => {
  const customerTarget = { uid: "cust-9", email: "buyer@gmail.com", role: "user" };

  assert.throws(
    () => assertCanDeleteStaff(superAdminCaller, customerTarget),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

// ===============================================================
// 6. TEMPORARY PASSWORD GENERATOR
// ===============================================================

test("generateSecureTemporaryPassword produces strong, non-predictable temporary passwords", () => {
  const pwd1 = generateSecureTemporaryPassword();
  const pwd2 = generateSecureTemporaryPassword();

  assert.notEqual(pwd1, pwd2);
  assert.ok(pwd1.length >= 12);
  assert.notEqual(pwd1, "OsvidManager2026!");
  assert.notEqual(pwd1, "OsvidAdmin2026!");
  // Contains special characters and mixed case
  assert.match(pwd1, /[A-Z]/);
  assert.match(pwd1, /[a-z]/);
  assert.match(pwd1, /[0-9]/);
  assert.match(pwd1, /[!@#$%&*#]/);
});
