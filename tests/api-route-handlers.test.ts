import test from "node:test";
import assert from "node:assert/strict";
import { POST as createAdminHandler } from "@/app/api/admin/create/route";
import { POST as updateAdminHandler } from "@/app/api/admin/update/route";
import { POST as deleteAdminHandler } from "@/app/api/admin/delete/route";
import { POST as toggleStatusHandler } from "@/app/api/admin/toggle-status/route";
import { GET as listAdminsHandler } from "@/app/api/admin/list/route";
import { NextRequest } from "next/server";

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
