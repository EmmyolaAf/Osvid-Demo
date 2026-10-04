import test from "node:test";
import assert from "node:assert/strict";
import { PRIMARY_SUPER_ADMIN_EMAIL, isSuperAdminEmail } from "@/lib/server/auth";

/**
 * Simulates the server-side RBAC decision engine used in the staff administration routes.
 */
function evaluateStaffCreation(
  caller: { role: string; email: string; isSuperAdmin: boolean },
  requestedRole: string,
  requestedEmail: string
): { allowed: boolean; assignedRole?: string; error?: string } {
  const cleanEmail = requestedEmail.trim().toLowerCase();

  // Rule 1: No one can create a super_admin or use the primary super admin email
  if (requestedRole === "super_admin" || isSuperAdminEmail(cleanEmail)) {
    return { allowed: false, error: "Super Admin accounts cannot be created via API" };
  }

  // Rule 2: Non-staff or managers cannot create staff
  if (caller.role !== "admin" && caller.role !== "super_admin") {
    return { allowed: false, error: "Unauthorized: Insufficient administrative privileges" };
  }

  // Rule 3: Admin callers may ONLY create Managers
  if (!caller.isSuperAdmin) {
    if (requestedRole && requestedRole !== "manager") {
      return { allowed: false, error: "Administrators are only permitted to create Manager accounts" };
    }
    return { allowed: true, assignedRole: "manager" };
  }

  // Rule 4: Super Admin may create Admin or Manager
  return { allowed: true, assignedRole: requestedRole === "manager" ? "manager" : "admin" };
}

function evaluateStaffUpdate(
  caller: { uid: string; role: string; isSuperAdmin: boolean },
  target: { uid: string; role: string; email: string },
  updates: { role?: string; isActive?: boolean }
): { allowed: boolean; error?: string } {
  const isTargetSuper = isSuperAdminEmail(target.email) || target.role === "super_admin";

  // Rule 1: Target is Super Admin
  if (isTargetSuper) {
    if (!caller.isSuperAdmin) {
      return { allowed: false, error: "Administrators cannot modify Super Admin accounts" };
    }
    if (updates.isActive === false) {
      return { allowed: false, error: "Cannot deactivate the primary Super Admin account" };
    }
    if (updates.role && updates.role !== "super_admin") {
      return { allowed: false, error: "Cannot demote the primary Super Admin account" };
    }
  }

  // Rule 2: Cannot grant 'super_admin' role to anyone
  if (updates.role === "super_admin" && !isTargetSuper) {
    return { allowed: false, error: "Cannot grant Super Admin role via update" };
  }

  // Rule 3: Admin restrictions
  if (!caller.isSuperAdmin) {
    // Admin cannot modify another Admin
    if (target.role === "admin" && target.uid !== caller.uid) {
      return { allowed: false, error: "Administrators cannot modify other Administrator accounts" };
    }

    // Admin cannot promote a Manager to Admin
    if (target.role === "manager" && updates.role && updates.role !== "manager") {
      return { allowed: false, error: "Administrators cannot promote Managers to Administrator" };
    }
  }

  // Rule 4: Manager or User caller cannot update staff
  if (caller.role !== "admin" && caller.role !== "super_admin") {
    return { allowed: false, error: "Unauthorized" };
  }

  return { allowed: true };
}

function evaluateStaffDeletion(
  caller: { uid: string; role: string; isSuperAdmin: boolean },
  target: { uid: string; role: string; email: string }
): { allowed: boolean; error?: string } {
  // Prevent self-deletion
  if (target.uid === caller.uid) {
    return { allowed: false, error: "Self-deletion is not permitted" };
  }

  // Super Admin cannot be deleted
  if (isSuperAdminEmail(target.email) || target.role === "super_admin") {
    return { allowed: false, error: "Super Admin account cannot be deleted" };
  }

  // Caller authorization
  if (caller.role !== "admin" && caller.role !== "super_admin") {
    return { allowed: false, error: "Unauthorized" };
  }

  // Admin cannot delete Admin
  if (!caller.isSuperAdmin && target.role === "admin") {
    return { allowed: false, error: "Administrators cannot delete Administrator accounts" };
  }

  return { allowed: true };
}

// ===============================================================
// TESTS
// ===============================================================

test("Super Admin can create an Admin and a Manager", () => {
  const superAdminCaller = {
    role: "super_admin",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    isSuperAdmin: true,
  };

  const createAdmin = evaluateStaffCreation(superAdminCaller, "admin", "newadmin@osvid.com");
  assert.equal(createAdmin.allowed, true);
  assert.equal(createAdmin.assignedRole, "admin");

  const createMgr = evaluateStaffCreation(superAdminCaller, "manager", "newmgr@osvid.com");
  assert.equal(createMgr.allowed, true);
  assert.equal(createMgr.assignedRole, "manager");
});

test("Admin can create a Manager, but CANNOT create an Admin or Super Admin", () => {
  const adminCaller = {
    role: "admin",
    email: "tenantadmin@osvid.com",
    isSuperAdmin: false,
  };

  // Allowed to create manager
  const createMgr = evaluateStaffCreation(adminCaller, "manager", "ops@osvid.com");
  assert.equal(createMgr.allowed, true);
  assert.equal(createMgr.assignedRole, "manager");

  // Denied creating an admin
  const createAdmin = evaluateStaffCreation(adminCaller, "admin", "otheradmin@osvid.com");
  assert.equal(createAdmin.allowed, false);
  assert.match(createAdmin.error || "", /only permitted to create Manager accounts/);

  // Denied creating a super admin
  const createSuper = evaluateStaffCreation(adminCaller, "super_admin", "superfake@osvid.com");
  assert.equal(createSuper.allowed, false);
  assert.match(createSuper.error || "", /Super Admin accounts cannot be created/);
});

test("Manager or Customer cannot create any staff accounts", () => {
  const managerCaller = { role: "manager", email: "mgr@osvid.com", isSuperAdmin: false };
  const userCaller = { role: "user", email: "user@osvid.com", isSuperAdmin: false };

  assert.equal(evaluateStaffCreation(managerCaller, "manager", "test@osvid.com").allowed, false);
  assert.equal(evaluateStaffCreation(userCaller, "manager", "test@osvid.com").allowed, false);
});

test("Admin CANNOT promote a Manager to Admin or Super Admin", () => {
  const adminCaller = { uid: "adm-1", role: "admin", isSuperAdmin: false };
  const managerTarget = { uid: "mgr-1", role: "manager", email: "mgr@osvid.com" };

  const promoteToAdmin = evaluateStaffUpdate(adminCaller, managerTarget, { role: "admin" });
  assert.equal(promoteToAdmin.allowed, false);
  assert.match(promoteToAdmin.error || "", /cannot promote Managers/);

  const promoteToSuper = evaluateStaffUpdate(adminCaller, managerTarget, { role: "super_admin" });
  assert.equal(promoteToSuper.allowed, false);
});

test("Admin CANNOT modify or delete another Admin account", () => {
  const adminCaller = { uid: "adm-1", role: "admin", isSuperAdmin: false };
  const otherAdmin = { uid: "adm-2", role: "admin", email: "other@osvid.com" };

  const updateOther = evaluateStaffUpdate(adminCaller, otherAdmin, { isActive: false });
  assert.equal(updateOther.allowed, false);
  assert.match(updateOther.error || "", /cannot modify other Administrator accounts/);

  const deleteOther = evaluateStaffDeletion(adminCaller, otherAdmin);
  assert.equal(deleteOther.allowed, false);
  assert.match(deleteOther.error || "", /cannot delete Administrator accounts/);
});

test("Primary Super Admin account is protected against demotion, deactivation and deletion", () => {
  const superAdminCaller = { uid: "super-1", role: "super_admin", isSuperAdmin: true };
  const superAdminTarget = { uid: "super-1", role: "super_admin", email: PRIMARY_SUPER_ADMIN_EMAIL };

  // Cannot deactivate Super Admin
  const deact = evaluateStaffUpdate(superAdminCaller, superAdminTarget, { isActive: false });
  assert.equal(deact.allowed, false);
  assert.match(deact.error || "", /Cannot deactivate/);

  // Cannot demote Super Admin
  const demote = evaluateStaffUpdate(superAdminCaller, superAdminTarget, { role: "admin" });
  assert.equal(demote.allowed, false);
  assert.match(demote.error || "", /Cannot demote/);

  // Cannot delete Super Admin
  const del = evaluateStaffDeletion(superAdminCaller, superAdminTarget);
  assert.equal(del.allowed, false);
});
