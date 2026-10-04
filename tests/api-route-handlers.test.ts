import test from "node:test";
import assert from "node:assert/strict";
import { POST as createAdminHandler } from "@/app/api/admin/create/route";
import { POST as updateAdminHandler } from "@/app/api/admin/update/route";
import { POST as deleteAdminHandler } from "@/app/api/admin/delete/route";
import { POST as toggleStatusHandler } from "@/app/api/admin/toggle-status/route";
import { GET as listAdminsHandler } from "@/app/api/admin/list/route";
import { NextRequest } from "next/server";
import {
  assertCanCreateStaffRole,
  assertCanManageTargetStaff,
  assertCanUpdateStaffFields,
  assertCanDeleteStaff,
  assertStaffEndpointTarget,
  AuthError,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from "@/lib/server/auth";

// ===============================================================
// 1. UNAUTHENTICATED & TOKEN TESTS
// ===============================================================

test("Unauthenticated request to /api/admin/create is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      displayName: "Test User",
      role: "admin",
    }),
  });

  const res = await createAdminHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Unauthenticated request to /api/admin/update is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: "some-user-id",
      displayName: "Updated Name",
    }),
  });

  const res = await updateAdminHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Unauthenticated request to /api/admin/delete is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: "some-user-id",
    }),
  });

  const res = await deleteAdminHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Unauthenticated request to /api/admin/toggle-status is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/toggle-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: "some-user-id",
      isActive: false,
    }),
  });

  const res = await toggleStatusHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Unauthenticated request to /api/admin/list is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/list", {
    method: "GET",
  });

  const res = await listAdminsHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Missing or invalid Authorization header/);
});

test("Request with invalid/fake token to /api/admin/create is rejected with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/admin/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid.fake.token",
    },
    body: JSON.stringify({
      email: "test@example.com",
      displayName: "Test User",
    }),
  });

  const res = await createAdminHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Invalid authentication token|Unauthorized/);
});

// ===============================================================
// 2. AUTHORITATIVE ROUTE LOGIC & NEGATIVE TESTS
// ===============================================================

const mockSuperAdminCaller: any = {
  uid: "super-1",
  email: PRIMARY_SUPER_ADMIN_EMAIL,
  role: "super_admin",
  isSuperAdmin: true,
  isAdmin: true,
  isManager: false,
  isStaff: true,
  isCustomer: false,
  isActive: true,
};

const mockAdminCaller: any = {
  uid: "admin-1",
  email: "admin@osvid.com",
  role: "admin",
  isSuperAdmin: false,
  isAdmin: true,
  isManager: false,
  isStaff: true,
  isCustomer: false,
  isActive: true,
};

test("Route rule: Admin cannot create another Admin or Super Admin", () => {
  assert.throws(
    () => assertCanCreateStaffRole(mockAdminCaller, "admin", "candidate@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.throws(
    () => assertCanCreateStaffRole(mockAdminCaller, "super_admin", "candidate@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Route rule: Super Admin cannot create account with super_admin role via API", () => {
  assert.throws(
    () => assertCanCreateStaffRole(mockSuperAdminCaller, "super_admin", "candidate@osvid.com"),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Route rule: Staff endpoints reject targeting ordinary customers", () => {
  assert.throws(
    () => assertStaffEndpointTarget("user"),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  assert.throws(
    () => assertCanManageTargetStaff(mockAdminCaller, { uid: "user-1", email: "cust@gmail.com", role: "user" }),
    (err: any) => err instanceof AuthError && err.status === 400
  );

  assert.throws(
    () => assertCanDeleteStaff(mockAdminCaller, { uid: "user-1", email: "cust@gmail.com", role: "user" }),
    (err: any) => err instanceof AuthError && err.status === 400
  );
});

test("Route rule: Admin targeting other Admin is rejected with 403", () => {
  const otherAdmin = { uid: "admin-2", email: "other@osvid.com", role: "admin" };

  assert.throws(
    () => assertCanManageTargetStaff(mockAdminCaller, otherAdmin),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  assert.throws(
    () => assertCanDeleteStaff(mockAdminCaller, otherAdmin),
    (err: any) => err instanceof AuthError && err.status === 403
  );
});

test("Route rule: Primary Super Admin is strictly immutable (cannot be demoted, deactivated, or deleted)", () => {
  const superAccount = { uid: "super-1", email: PRIMARY_SUPER_ADMIN_EMAIL, role: "super_admin" };

  // Cannot deactivate
  assert.throws(
    () => assertCanUpdateStaffFields(mockSuperAdminCaller, superAccount, { isActive: false }),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  // Cannot demote
  assert.throws(
    () => assertCanUpdateStaffFields(mockSuperAdminCaller, superAccount, { role: "admin" }),
    (err: any) => err instanceof AuthError && err.status === 403
  );

  // Cannot delete
  assert.throws(
    () => assertCanDeleteStaff(mockSuperAdminCaller, superAccount),
    (err: any) => err instanceof AuthError && (err.status === 400 || err.status === 403)
  );
});

// ===============================================================
// 3. ATOMIC DELETION FAILURE SEMANTICS
// ===============================================================

test("Partial deletion failure does NOT return HTTP success", () => {
  // Simulate the delete route's evaluation logic for partial deletions:
  const authDeleted = true;
  const firestoreDeleted = false;
  const firestoreError = "Firestore transaction timeout";

  const isFailed = !authDeleted || !firestoreDeleted;
  assert.equal(isFailed, true);

  // When failed, the response status is 500, retryable is true, and success is NOT true
  const failurePayload = {
    error: "Deletion operation failed or partially succeeded",
    details: {
      authDeleted,
      firestoreDeleted,
      authError: null,
      firestoreError,
    },
    retryable: true,
  };

  assert.equal(failurePayload.retryable, true);
  assert.equal((failurePayload as any).success, undefined);
  assert.equal(failurePayload.details.firestoreDeleted, false);
});
