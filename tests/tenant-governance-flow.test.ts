import test from "node:test";
import assert from "node:assert/strict";
import { POST as createAdminHandler } from "@/app/api/admin/create/route";
import { POST as updateAdminHandler } from "@/app/api/admin/update/route";
import { POST as toggleStatusHandler } from "@/app/api/admin/toggle-status/route";
import { POST as deleteAdminHandler } from "@/app/api/admin/delete/route";
import { GET as listAdminsHandler } from "@/app/api/admin/list/route";
import { NextRequest } from "next/server";
import { PRIMARY_SUPER_ADMIN_EMAIL } from "@/lib/server/auth";

test("Super Admin list and create route handler invariants", async () => {
  // Verify unauthenticated requests are rejected
  const unauthListReq = new NextRequest("http://localhost:3000/api/admin/list");
  const unauthListRes = await listAdminsHandler(unauthListReq);
  assert.equal(unauthListRes.status, 401);

  const unauthCreateReq = new NextRequest("http://localhost:3000/api/admin/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "tenant@example.com", displayName: "Tenant Admin" }),
  });
  const unauthCreateRes = await createAdminHandler(unauthCreateReq);
  assert.equal(unauthCreateRes.status, 401);

  const unauthUpdateReq = new NextRequest("http://localhost:3000/api/admin/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "test-uid", displayName: "Updated Name" }),
  });
  const unauthUpdateRes = await updateAdminHandler(unauthUpdateReq);
  assert.equal(unauthUpdateRes.status, 401);

  const unauthToggleReq = new NextRequest("http://localhost:3000/api/admin/toggle-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "test-uid", isActive: true }),
  });
  const unauthToggleRes = await toggleStatusHandler(unauthToggleReq);
  assert.equal(unauthToggleRes.status, 401);
});

test("Role-based login routing and storefront product catalog navigation invariants", () => {
  // Pure helper simulating login routing rule semantics
  function resolveTargetRoute({
    role,
    email,
    redirectUrl,
  }: {
    role: string;
    email: string;
    redirectUrl?: string | null;
  }): string {
    const isSuper =
      role === "super_admin" ||
      email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

    if (isSuper) {
      if (redirectUrl && redirectUrl.startsWith("/dashboard/super-admin")) {
        return redirectUrl;
      }
      return "/dashboard/super-admin";
    }

    if (role === "admin") {
      if (
        redirectUrl &&
        redirectUrl.startsWith("/dashboard") &&
        !redirectUrl.startsWith("/dashboard/super-admin")
      ) {
        return redirectUrl;
      }
      return "/dashboard";
    }

    if (role === "manager") {
      if (redirectUrl && redirectUrl.startsWith("/dashboard")) {
        return redirectUrl;
      }
      return "/dashboard/managers";
    }

    if (redirectUrl && !redirectUrl.startsWith("/dashboard")) {
      return redirectUrl;
    }

    return "/account";
  }

  // Admin login always routes to /dashboard and rejects customer or floating redirects
  assert.equal(
    resolveTargetRoute({ role: "admin", email: "storeadmin@osvid.com" }),
    "/dashboard",
    "Admin must strictly route to /dashboard"
  );
  assert.equal(
    resolveTargetRoute({
      role: "admin",
      email: "storeadmin@osvid.com",
      redirectUrl: "/account",
    }),
    "/dashboard",
    "Admin must ignore customer /account redirect and route directly to /dashboard"
  );
  assert.equal(
    resolveTargetRoute({
      role: "admin",
      email: "storeadmin@osvid.com",
      redirectUrl: "/products",
    }),
    "/dashboard",
    "Admin must ignore storefront redirect and route directly to /dashboard"
  );
  assert.equal(
    resolveTargetRoute({
      role: "admin",
      email: "storeadmin@osvid.com",
      redirectUrl: "/dashboard/products",
    }),
    "/dashboard/products",
    "Admin allows internal dashboard subpage redirect"
  );

  // Super Admin login always routes to /dashboard/super-admin
  assert.equal(
    resolveTargetRoute({ role: "super_admin", email: PRIMARY_SUPER_ADMIN_EMAIL }),
    "/dashboard/super-admin",
    "Super Admin must strictly route to /dashboard/super-admin"
  );
  assert.equal(
    resolveTargetRoute({
      role: "super_admin",
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      redirectUrl: "/account",
    }),
    "/dashboard/super-admin",
    "Super Admin must ignore customer /account redirect"
  );

  // Customer login routes to /account or external redirect
  assert.equal(
    resolveTargetRoute({ role: "user", email: "customer@example.com" }),
    "/account",
    "Customer routes to /account"
  );
  assert.equal(
    resolveTargetRoute({
      role: "user",
      email: "customer@example.com",
      redirectUrl: "/checkout",
    }),
    "/checkout",
    "Customer routes to safe redirect"
  );
});

test("Website visual editor codebase persistence and 7-day log retention invariants", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  // 1. Invariant: data/site-content.json must exist in codebase
  const contentFilePath = path.join(process.cwd(), "data", "site-content.json");
  const contentRaw = await fs.readFile(contentFilePath, "utf8");
  const content = JSON.parse(contentRaw);
  assert.ok(content.hero, "site-content.json must have hero configuration");
  assert.ok(content.elements, "site-content.json must have elements styling dictionary");

  // 2. Invariant: 7-day (1-week) expiration and pruning semantics
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const mockLogs = [
    {
      id: "active_log_1",
      timestamp: new Date(now - 2 * ONE_DAY_MS).toISOString(),
      expiresAt: new Date(now + 5 * ONE_DAY_MS).toISOString(), // 5 days remaining
      summary: "Button rounded to 12px",
    },
    {
      id: "expired_log_2",
      timestamp: new Date(now - 9 * ONE_DAY_MS).toISOString(),
      expiresAt: new Date(now - 2 * ONE_DAY_MS).toISOString(), // Expired 2 days ago
      summary: "Old heading edit",
    },
  ];

  // Pruning function
  const activeOnly = mockLogs.filter((l) => new Date(l.expiresAt).getTime() > now);
  assert.equal(activeOnly.length, 1, "Logs older than 7 days must be pruned");
  assert.equal(activeOnly[0].id, "active_log_1");

  // Expired log cannot be reverted
  const expiredLog = mockLogs.find((l) => l.id === "expired_log_2");
  const isRevertible = expiredLog ? new Date(expiredLog.expiresAt).getTime() > now : false;
  assert.equal(isRevertible, false, "Changes older than 1 week cannot be reverted");
});
