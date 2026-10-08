import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  assertNoExposedSecrets,
  requirePaystackSecret,
  requireResendApiKey,
  requireMaintenanceCronSecret,
  getServerConfig,
} from "@/lib/server/env";
import { GET as healthCheckGet } from "@/app/api/health/route";
import { POST as maintenanceCleanupPost } from "@/app/api/internal/maintenance/checkout-reservations/route";
import {
  validateMediaFile,
  generateManagedStoragePath,
  isOwnedStorageUrl,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from "@/lib/firebase/storage";
import { getOrGenerateRequestId, sanitizeLogData } from "@/lib/server/logger";

describe("OSVID Packet 5 — Production Runtime, Media, CI & Observability", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MOCK_CHECKOUT_CLEANUP = "true";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. ENVIRONMENT & SECRET CONTRACT
  // ==========================================================================
  describe("Server Environment Contract & Secret Protection", () => {
    it("assertNoExposedSecrets throws error if any secret is exposed via NEXT_PUBLIC_", () => {
      process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY = "sk_test_leaked_key";
      assert.throws(
        () => assertNoExposedSecrets(),
        /SECURITY CRITICAL: Server secret detected with public prefix/
      );
    });

    it("assertNoExposedSecrets passes when no secrets use public prefix", () => {
      delete process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_RESEND_API_KEY;
      assert.doesNotThrow(() => assertNoExposedSecrets());
    });

    it("requirePaystackSecret returns trimmed key when configured", () => {
      process.env.PAYSTACK_SECRET_KEY = "  sk_test_12345  ";
      assert.equal(requirePaystackSecret(), "sk_test_12345");
    });

    it("requirePaystackSecret throws descriptive configuration error when missing", () => {
      delete process.env.PAYSTACK_SECRET_KEY;
      assert.throws(
        () => requirePaystackSecret(),
        /Configuration Error: PAYSTACK_SECRET_KEY is missing/
      );
    });

    it("requireResendApiKey returns trimmed key or throws when missing", () => {
      process.env.RESEND_API_KEY = "re_test_98765";
      assert.equal(requireResendApiKey(), "re_test_98765");

      delete process.env.RESEND_API_KEY;
      assert.throws(
        () => requireResendApiKey(),
        /Configuration Error: RESEND_API_KEY is missing/
      );
    });

    it("requireMaintenanceCronSecret returns secret or throws when missing", () => {
      process.env.MAINTENANCE_CRON_SECRET = "cron_secret_abc123";
      assert.equal(requireMaintenanceCronSecret(), "cron_secret_abc123");

      delete process.env.MAINTENANCE_CRON_SECRET;
      assert.throws(
        () => requireMaintenanceCronSecret(),
        /Configuration Error: MAINTENANCE_CRON_SECRET is missing/
      );
    });

    it("getServerConfig resolves non-sensitive server parameters safely", () => {
      process.env.PORT = "9090";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.FIREBASE_PROJECT_ID = "osvid-custom";

      const config = getServerConfig();
      assert.equal(config.port, 9090);
      assert.equal(config.nodeEnv, "production");
      assert.equal(config.firebaseProjectId, "osvid-custom");
    });
  });

  // ==========================================================================
  // 2. HEALTH CHECK ENDPOINT
  // ==========================================================================
  describe("Lightweight Health Check Endpoint", () => {
    it("GET /api/health returns 200 with safe service information", async () => {
      const res = await healthCheckGet();
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.equal(body.service, "osvid-web");
      assert.ok(body.timestamp);
      assert.ok(body.version);

      // Verify no secrets or credentials are leakable in health response
      const serialized = JSON.stringify(body).toLowerCase();
      assert.equal(serialized.includes("secret"), false);
      assert.equal(serialized.includes("password"), false);
      assert.equal(serialized.includes("serviceaccount"), false);
      assert.equal(serialized.includes("key"), false);
    });
  });

  // ==========================================================================
  // 3. INTERNAL MAINTENANCE RESERVATION CLEANUP ENDPOINT
  // ==========================================================================
  describe("Maintenance Cleanup Endpoint (POST /api/internal/maintenance/checkout-reservations)", () => {
    const validSecret = "super_secure_cron_secret_4892019";

    beforeEach(() => {
      process.env.MAINTENANCE_CRON_SECRET = validSecret;
    });

    it("rejects requests missing credentials with HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations", {
        method: "POST",
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 401);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error, "Unauthorized");
    });

    it("rejects requests with invalid credentials with HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong_invalid_secret",
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 401);
    });

    it("rejects when MAINTENANCE_CRON_SECRET is unconfigured in server environment with HTTP 503", async () => {
      delete process.env.MAINTENANCE_CRON_SECRET;
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations", {
        method: "POST",
        headers: {
          authorization: `Bearer ${validSecret}`,
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 503);
    });

    it("accepts valid Bearer token and executes cleanup", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations?batch=25", {
        method: "POST",
        headers: {
          authorization: `Bearer ${validSecret}`,
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(typeof body.cleanedCount, "number");
      assert.equal(body.batchLimit, 25);
      assert.ok(body.timestamp);
    });

    it("accepts valid x-maintenance-key header and bounds batchLimit between 1 and 100", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations?batch=500", {
        method: "POST",
        headers: {
          "x-maintenance-key": validSecret,
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.batchLimit, 100); // Clamped to max 100
    });
  });

  // ==========================================================================
  // 4. STORAGE MEDIA SECURITY & ORPHAN SAFETY
  // ==========================================================================
  describe("Product Media Upload & Storage Helper Validation", () => {
    it("accepts supported image MIME types (JPEG, PNG, WebP)", () => {
      for (const mime of ALLOWED_IMAGE_MIME_TYPES) {
        const file = {
          name: `sample.${mime.split("/")[1]}`,
          type: mime,
          size: 1024 * 500, // 500 KB
        } as File;
        const result = validateMediaFile(file);
        assert.equal(result.valid, true);
      }
    });

    it("rejects arbitrary MIME types even if prefix is image/", () => {
      const gifFile = {
        name: "animation.gif",
        type: "image/gif",
        size: 1024 * 100,
      } as File;
      const result = validateMediaFile(gifFile);
      assert.equal(result.valid, false);
      assert.match(result.error!, /Unsupported image format/);
    });

    it("rejects non-image MIME types (PDF, HTML, executables)", () => {
      const pdfFile = {
        name: "manual.pdf",
        type: "application/pdf",
        size: 1024 * 50,
      } as File;
      assert.equal(validateMediaFile(pdfFile).valid, false);
    });

    it("rejects files exceeding 5 MB size bound", () => {
      const largeFile = {
        name: "huge.jpg",
        type: "image/jpeg",
        size: MAX_IMAGE_FILE_SIZE_BYTES + 1024,
      } as File;
      const result = validateMediaFile(largeFile);
      assert.equal(result.valid, false);
      assert.match(result.error!, /exceeds maximum allowed limit of 5 MB/);
    });

    it("generateManagedStoragePath sanitizes directory traversal and preserves safe extension", () => {
      const dirtyName = "../../../etc/passwd.jpg";
      const storagePath = generateManagedStoragePath("products", dirtyName);

      assert.equal(storagePath.startsWith("products/"), true);
      assert.equal(storagePath.includes(".."), false);
      assert.equal(storagePath.endsWith(".jpg"), true);
    });

    it("isOwnedStorageUrl correctly identifies managed Firebase Storage paths", () => {
      const ownedProductUrl =
        "https://firebasestorage.googleapis.com/v0/b/osvid-9d4d6.appspot.com/o/products%2F123-abc.jpg?alt=media";
      const ownedCategoryUrl =
        "https://firebasestorage.googleapis.com/v0/b/osvid-9d4d6.appspot.com/o/categories%2F456-def.webp?alt=media";
      const externalUnsplashUrl = "https://images.unsplash.com/photo-1581092160607-ee22621dd758";
      const externalWixUrl = "https://static.wixstatic.com/media/sample.jpg";

      assert.equal(isOwnedStorageUrl(ownedProductUrl), true);
      assert.equal(isOwnedStorageUrl(ownedCategoryUrl), true);
      assert.equal(isOwnedStorageUrl(externalUnsplashUrl), false);
      assert.equal(isOwnedStorageUrl(externalWixUrl), false);
      assert.equal(isOwnedStorageUrl(null), false);
    });
  });

  // ==========================================================================
  // 5. STRUCTURED LOGGING & REQUEST CORRELATION
  // ==========================================================================
  describe("Structured Logging & Request Correlation", () => {
    it("getOrGenerateRequestId accepts valid incoming x-request-id", () => {
      const req = new Request("http://localhost:3000", {
        headers: { "x-request-id": "req-custom-correlation-1234" },
      });
      assert.equal(getOrGenerateRequestId(req), "req-custom-correlation-1234");
    });

    it("getOrGenerateRequestId generates random UUID when header is absent or invalid", () => {
      const req = new Request("http://localhost:3000");
      const generated = getOrGenerateRequestId(req);
      assert.ok(generated);
      assert.match(
        generated,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("sanitizeLogData strictly redacts secrets, keys, and tokens", () => {
      const dirtyLog = {
        operation: "checkout",
        authorization: "Bearer secret_token_123",
        paystackSecretKey: "sk_live_very_secret",
        customer: {
          email: "user@example.com",
          password: "plain_password_123",
        },
        orderId: "ord_555",
      };

      const sanitized = sanitizeLogData(dirtyLog) as Record<string, any>;
      assert.equal(sanitized.authorization, "[REDACTED]");
      assert.equal(sanitized.paystackSecretKey, "[REDACTED]");
      assert.equal(sanitized.customer.password, "[REDACTED]");
      assert.equal(sanitized.orderId, "ord_555");
    });
  });

  // ==========================================================================
  // 6. BUILD CONFIGURATION & STATIC EXPORT DECOUPLING
  // ==========================================================================
  describe("Build Script & Deployment Configuration Invariants", () => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
    );

    it("canonical npm run build builds dynamic Next.js application without legacy static sync", () => {
      assert.equal(pkgJson.scripts.build, "next build");
      assert.equal(pkgJson.scripts.build.includes("sync-out.js"), false);
    });

    it("legacy static sync is moved to an explicitly named legacy script", () => {
      assert.ok(pkgJson.scripts["build:legacy-static"]);
      assert.equal(
        pkgJson.scripts["build:legacy-static"].includes("sync-out.js"),
        true
      );
    });

    it("test:emulator script is configured for Firebase Rules testing", () => {
      assert.ok(pkgJson.scripts["test:emulator"]);
      assert.equal(
        pkgJson.scripts["test:emulator"].includes("firebase emulators:exec"),
        true
      );
    });

    it("firebase.json configures public asset directory and API anti-cache headers", () => {
      const firebaseJson = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "firebase.json"), "utf8")
      );
      assert.equal(firebaseJson.hosting.public, "public"); // Not 'out'
      assert.notEqual(firebaseJson.hosting.public, "out");

      // Verify anti-cache headers for /api/**
      const apiHeader = firebaseJson.hosting.headers?.find(
        (h: any) => h.source === "/api/**"
      );
      assert.ok(apiHeader);
      assert.equal(
        apiHeader.headers.some(
          (h: any) =>
            h.key.toLowerCase() === "cache-control" &&
            h.value.includes("no-store")
        ),
        true
      );
    });

    it("Dockerfile and .dockerignore exist for Cloud Run containerization", () => {
      const dockerfileContent = fs.readFileSync(
        path.resolve(process.cwd(), "Dockerfile"),
        "utf8"
      );
      assert.ok(dockerfileContent.includes("node:20-alpine"));
      assert.ok(dockerfileContent.includes(".next/standalone"));
      assert.ok(dockerfileContent.includes("USER nextjs"));
      assert.ok(dockerfileContent.includes("PORT=8080"));

      const dockerignoreContent = fs.readFileSync(
        path.resolve(process.cwd(), ".dockerignore"),
        "utf8"
      );
      assert.ok(dockerignoreContent.includes("firebase-service-account.json"));
      assert.ok(dockerignoreContent.includes(".env*"));
    });

    it("CI workflow file exists and sets up Node 20 and Java for emulators", () => {
      const ciPath = fs.existsSync(path.resolve(process.cwd(), ".github/workflows/ci.yml"))
        ? path.resolve(process.cwd(), ".github/workflows/ci.yml")
        : path.resolve(process.cwd(), ".github/ci-workflow.yml");
      const ciContent = fs.readFileSync(ciPath, "utf8");
      assert.ok(ciContent.includes("actions/setup-java@v4"));
      assert.ok(ciContent.includes("distribution: temurin"));
      assert.ok(ciContent.includes("java-version: 21"));
      assert.ok(ciContent.includes("npm run test:emulator"));
    });
  });
});
