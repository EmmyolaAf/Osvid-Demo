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
import { resolveFirebaseAdminProjectId } from "@/lib/firebase/admin";
import { GET as healthCheckGet } from "@/app/api/health/route";
import { POST as maintenanceCleanupPost } from "@/app/api/internal/maintenance/checkout-reservations/route";
import {
  validateMediaFile,
  generateManagedStoragePath,
  isOwnedStorageUrl,
  getConfiguredStorageBucket,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from "@/lib/firebase/storage";
import { getOrGenerateRequestId, sanitizeLogData } from "@/lib/server/logger";
import { resolveClientFirebaseConfig, firebaseConfig } from "@/lib/firebase";
import { adminDb } from "@/lib/firebase/admin";
import {
  getServerProducts,
  getServerProductCategories,
  getServerBlogPosts,
} from "@/lib/server/storefront";

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

    it("resolveFirebaseAdminProjectId fails closed when FIREBASE_PROJECT_ID is missing in production", () => {
      assert.throws(
        () => resolveFirebaseAdminProjectId({ NODE_ENV: "production" }),
        /Missing required FIREBASE_PROJECT_ID in production runtime/
      );
    });

    it("resolveFirebaseAdminProjectId honours explicit staging and production project IDs", () => {
      assert.equal(
        resolveFirebaseAdminProjectId({
          NODE_ENV: "production",
          FIREBASE_PROJECT_ID: "osvid-staging",
        }),
        "osvid-staging"
      );
      assert.equal(
        resolveFirebaseAdminProjectId({
          NODE_ENV: "production",
          FIREBASE_PROJECT_ID: "osvid-9d4d6",
        }),
        "osvid-9d4d6"
      );
    });

    it("resolveFirebaseAdminProjectId permits documented fallback only in non-production environments", () => {
      assert.equal(
        resolveFirebaseAdminProjectId({ NODE_ENV: "development" }),
        "osvid-9d4d6"
      );
      assert.equal(
        resolveFirebaseAdminProjectId({
          NODE_ENV: "development",
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: "osvid-dev-custom",
        }),
        "osvid-dev-custom"
      );
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

    it("accepts requests with valid bearer token and executes cleanup", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations", {
        method: "POST",
        headers: {
          authorization: `Bearer ${validSecret}`,
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.releasedCount, 0);
    });

    it("accepts requests with x-cron-secret header", async () => {
      const req = new Request("http://localhost:3000/api/internal/maintenance/checkout-reservations", {
        method: "POST",
        headers: {
          "x-cron-secret": validSecret,
        },
      });
      const res = await maintenanceCleanupPost(req);
      assert.equal(res.status, 200);
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

    it("isOwnedStorageUrl strictly verifies configured bucket, hostname, and valid paths", () => {
      const configuredBucket = getConfiguredStorageBucket();

      const ownedProductUrl =
        `https://firebasestorage.googleapis.com/v0/b/${configuredBucket}/o/products%2F123-abc.jpg?alt=media`;
      const ownedCategoryUrl =
        `https://firebasestorage.googleapis.com/v0/b/${configuredBucket}/o/categories%2F456-def.webp?alt=media`;
      const otherBucketUrl =
        "https://firebasestorage.googleapis.com/v0/b/malicious-foreign-project.appspot.com/o/products%2F123-abc.jpg?alt=media";
      const externalUnsplashUrl = "https://images.unsplash.com/photo-1581092160607-ee22621dd758";
      const externalWixUrl = "https://static.wixstatic.com/media/sample.jpg";
      const traversalUrl =
        `https://firebasestorage.googleapis.com/v0/b/${configuredBucket}/o/products%2F..%2Fsecret.json`;
      const invalidPrefixUrl =
        `https://firebasestorage.googleapis.com/v0/b/${configuredBucket}/o/system_secrets%2Fkeys.json`;

      // 1. Configured bucket products / categories -> owned
      assert.equal(isOwnedStorageUrl(ownedProductUrl), true);
      assert.equal(isOwnedStorageUrl(ownedCategoryUrl), true);

      // 2. Foreign bucket with products/... -> NOT owned
      assert.equal(isOwnedStorageUrl(otherBucketUrl), false);

      // 3. External URLs -> NOT owned
      assert.equal(isOwnedStorageUrl(externalUnsplashUrl), false);
      assert.equal(isOwnedStorageUrl(externalWixUrl), false);
      assert.equal(isOwnedStorageUrl(null), false);
      assert.equal(isOwnedStorageUrl(""), false);

      // 4. Traversal or invalid prefix -> NOT owned
      assert.equal(isOwnedStorageUrl(traversalUrl), false);
      assert.equal(isOwnedStorageUrl(invalidPrefixUrl), false);
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
  // 6. BUILD CONFIGURATION & PRE-RELEASE GATES
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

    it("test:emulator script explicitly uses demo-osvid-rules-test project", () => {
      assert.ok(pkgJson.scripts["test:emulator"]);
      assert.ok(
        pkgJson.scripts["test:emulator"].includes("firebase emulators:exec"),
        "must execute firebase emulators"
      );
      assert.ok(
        pkgJson.scripts["test:emulator"].includes("--project demo-osvid-rules-test"),
        "must explicitly specify demo-osvid-rules-test project"
      );
    });

    it("firebase-tools is installed and locked in devDependencies", () => {
      assert.ok(pkgJson.devDependencies["firebase-tools"]);
    });

    it("canonical firebase.json omits deployable hosting section to prevent accidental static deploy", () => {
      const firebaseJson = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "firebase.json"), "utf8")
      );
      // Canonical firebase.json must NOT have a deployable hosting block
      assert.equal(firebaseJson.hosting, undefined);

      // Template must contain full hosting configuration with Cloud Run rewrite and anti-cache headers
      const templateJson = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), "firebase.hosting-cloudrun.template.json"),
          "utf8"
        )
      );
      assert.equal(templateJson.hosting.public, "public");
      assert.ok(templateJson.hosting.rewrites);
      assert.equal(templateJson.hosting.rewrites[0].run.serviceId, "osvid-web");

      const apiHeader = templateJson.hosting.headers?.find(
        (h: any) => h.source === "/api/**"
      );
      assert.ok(apiHeader);
      assert.ok(
        apiHeader.headers.some(
          (h: any) =>
            h.key.toLowerCase() === "cache-control" &&
            h.value.includes("no-store")
        )
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

    it("CI workflow exists strictly at .github/workflows/ci.yml and old template is absent", () => {
      const oldWorkflowPath = path.resolve(process.cwd(), ".github/ci-workflow.yml");
      assert.equal(
        fs.existsSync(oldWorkflowPath),
        false,
        ".github/ci-workflow.yml must NOT exist"
      );

      const canonicalWorkflowPath = path.resolve(
        process.cwd(),
        ".github/workflows/ci.yml"
      );
      assert.equal(
        fs.existsSync(canonicalWorkflowPath),
        true,
        ".github/workflows/ci.yml MUST exist"
      );

      const ciContent = fs.readFileSync(canonicalWorkflowPath, "utf8");
      assert.ok(ciContent.includes("actions/setup-java@v4"));
      assert.ok(ciContent.includes("distribution: temurin"));
      assert.ok(ciContent.includes("java-version: 21"));
      assert.ok(ciContent.includes("npm run test:emulator"));
    });
  });

  // ==========================================================================
  // 7. STOREFRONT SERVER / CLIENT ARCHITECTURAL BOUNDARY
  // ==========================================================================
  describe("Storefront Server / Client Architectural Boundary", () => {
    it("Server Components and API routes do not import browser lib/firebase/storefront", () => {
      const serverComponentFiles = [
        "app/(live)/shop/page.tsx",
        "app/(live)/shop/[slug]/page.tsx",
        "app/(live)/products/page.tsx",
        "app/(live)/products/[categorySlug]/page.tsx",
        "app/(live)/blog/page.tsx",
        "app/(live)/blog/[slug]/page.tsx",
        "app/(live)/services/page.tsx",
        "app/(live)/services/[slug]/page.tsx",
        "app/(live)/about/page.tsx",
        "app/(live)/page.tsx",
        "components/reusables/sections/BlogSection.server.tsx",
        "components/reusables/sections/featured-products.tsx",
        "app/api/route.ts",
      ];

      for (const relPath of serverComponentFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.equal(
          content.includes('from "@/lib/firebase/storefront"'),
          false,
          `${relPath} must NOT import browser lib/firebase/storefront`
        );
        assert.ok(
          content.includes('from "@/lib/server/storefront"'),
          `${relPath} MUST import server adapter @/lib/server/storefront`
        );
      }
    });

    it("only legitimate browser client components import browser lib/firebase/storefront", () => {
      const allowedClientFiles = [
        "components/reusables/forms/ContactForm.tsx",
        "components/reusables/BackInStockNotificationButton.tsx",
      ];

      for (const relPath of allowedClientFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.ok(
          content.includes('from "@/lib/firebase/storefront"'),
          `${relPath} legitimately uses browser client storefront`
        );
      }
    });
  });

  // ==========================================================================
  // 8. CLIENT FIREBASE CONFIG RESOLUTION & FAIL-CLOSED SEMANTICS
  // ==========================================================================
  describe("Client Firebase Configuration Resolver & Storage Alignment", () => {
    it("fails closed in production build if required client Firebase fields are missing", () => {
      assert.throws(
        () => resolveClientFirebaseConfig({}, "production"),
        /Missing required client Firebase configuration/
      );
    });

    it("does not silently fall back to osvid-9d4d6 in production", () => {
      assert.throws(
        () =>
          resolveClientFirebaseConfig(
            {
              apiKey: "some-key",
              authDomain: "test.firebaseapp.com",
            },
            "production"
          ),
        /Missing required client Firebase configuration/
      );
    });

    it("explicitly supplied production configuration resolves correctly", () => {
      const explicitProd = {
        apiKey: "AIzaSy_explicit_prod_key",
        authDomain: "osvid-prod.firebaseapp.com",
        projectId: "osvid-prod",
        storageBucket: "osvid-prod.firebasestorage.app",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:abcdef123",
        measurementId: "G-PROD123",
      };

      const resolved = resolveClientFirebaseConfig(explicitProd, "production");
      assert.equal(resolved.projectId, "osvid-prod");
      assert.equal(resolved.storageBucket, "osvid-prod.firebasestorage.app");
      assert.equal(resolved.apiKey, "AIzaSy_explicit_prod_key");
      assert.equal(resolved.measurementId, "G-PROD123");
    });

    it("explicitly supplied staging configuration resolves correctly without production fallback", () => {
      const stagingConfig = {
        apiKey: "AIzaSy_explicit_staging_key",
        authDomain: "osvid-staging.firebaseapp.com",
        projectId: "osvid-staging",
        storageBucket: "osvid-staging.firebasestorage.app",
        messagingSenderId: "9876543210",
        appId: "1:9876543210:web:fedcba321",
      };

      const resolved = resolveClientFirebaseConfig(stagingConfig, "production");
      assert.equal(resolved.projectId, "osvid-staging");
      assert.equal(resolved.storageBucket, "osvid-staging.firebasestorage.app");
      assert.notEqual(resolved.projectId, "osvid-9d4d6");
    });

    it("provides safe documented demo fallback in development and test environments", () => {
      const resolved = resolveClientFirebaseConfig({}, "test");
      assert.ok(resolved.projectId);
      assert.ok(resolved.storageBucket);
      assert.ok(resolved.apiKey);
    });

    it("client projectId and storage bucket share the same configuration source", () => {
      const customConfig = {
        apiKey: "key-123",
        authDomain: "custom-tenant.firebaseapp.com",
        projectId: "custom-tenant",
        storageBucket: "custom-tenant.firebasestorage.app",
        messagingSenderId: "5555555555",
        appId: "1:555:web:custom",
      };
      const resolved = resolveClientFirebaseConfig(customConfig, "production");
      assert.ok(resolved.storageBucket.includes(resolved.projectId));
    });

    it("getConfiguredStorageBucket resolves bucket aligned with client config", () => {
      const bucket = getConfiguredStorageBucket();
      assert.ok(bucket && typeof bucket === "string");
      if (firebaseConfig?.storageBucket) {
        assert.equal(bucket, firebaseConfig.storageBucket);
      }
    });
  });

  // ==========================================================================
  // 9. DOCKER BUILD-TIME VS RUNTIME BOUNDARY CONTRACT
  // ==========================================================================
  describe("Dockerfile Non-Secret Build ARGs & Environment Isolation", () => {
    const dockerfileContent = fs.readFileSync(
      path.resolve(process.cwd(), "Dockerfile"),
      "utf8"
    );

    it("exposes only NON-SECRET NEXT_PUBLIC variables as builder ARGs", () => {
      const requiredArgs = [
        "ARG NEXT_PUBLIC_FIREBASE_API_KEY",
        "ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "ARG NEXT_PUBLIC_FIREBASE_APP_ID",
        "ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
        "ARG NEXT_PUBLIC_BASE_URL",
      ];

      for (const arg of requiredArgs) {
        assert.ok(
          dockerfileContent.includes(arg),
          `Dockerfile must declare builder build argument: ${arg}`
        );
      }
    });

    it("strictly DOES NOT expose runtime secrets as Docker build arguments", () => {
      const forbiddenSecretArgs = [
        "ARG PAYSTACK_SECRET_KEY",
        "ARG RESEND_API_KEY",
        "ARG MAINTENANCE_CRON_SECRET",
        "ARG FIREBASE_SERVICE_ACCOUNT",
      ];

      for (const secretArg of forbiddenSecretArgs) {
        assert.equal(
          dockerfileContent.includes(secretArg),
          false,
          `SECURITY VIOLATION: Dockerfile must NEVER include secret build argument: ${secretArg}`
        );
      }
    });
  });

  // ==========================================================================
  // 10. CI WORKFLOW SAFE DEMO CONFIGURATION CONTRACT
  // ==========================================================================
  describe("CI Workflow Safe Demo Public Configuration Contract", () => {
    it("canonical workflow file exists at .github/workflows/ci.yml", () => {
      const ciPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
      assert.ok(fs.existsSync(ciPath), ".github/workflows/ci.yml must exist");
    });

    it("ci.yml supplies safe demo NEXT_PUBLIC Firebase configuration", () => {
      const ciContent = fs.readFileSync(
        path.resolve(process.cwd(), ".github/workflows/ci.yml"),
        "utf8"
      );
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_PROJECT_ID: demo-osvid-rules-test"));
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_API_KEY: demo-api-key-for-ci-compilation-only"));
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: demo-osvid-rules-test.firebaseapp.com"));
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: demo-osvid-rules-test.firebasestorage.app"));
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:"));
      assert.ok(ciContent.includes("NEXT_PUBLIC_FIREBASE_APP_ID:"));
      assert.ok(ciContent.includes("FIREBASE_PROJECT_ID: demo-osvid-rules-test"));
    });
  });

  // ==========================================================================
  // 11. REQUEST-TIME STOREFRONT RENDERING & SERVER MODULE BOUNDARIES
  // ==========================================================================
  describe("Request-Time Rendering & Static Generation Removal", () => {
    const firestoreBackedRoutes = [
      "app/(live)/page.tsx",
      "app/(live)/shop/page.tsx",
      "app/(live)/shop/[slug]/page.tsx",
      "app/(live)/products/page.tsx",
      "app/(live)/products/[categorySlug]/page.tsx",
      "app/(live)/blog/page.tsx",
      "app/(live)/blog/[slug]/page.tsx",
      "app/(live)/services/page.tsx",
      "app/(live)/services/[slug]/page.tsx",
      "app/(live)/about/page.tsx",
    ];

    it("all Firestore-backed public routes are configured as force-dynamic", () => {
      for (const routePath of firestoreBackedRoutes) {
        const fullPath = path.resolve(process.cwd(), routePath);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.ok(
          content.includes('export const dynamic = "force-dynamic"'),
          `${routePath} must declare export const dynamic = "force-dynamic"`
        );
      }
    });

    it("no force-dynamic storefront route retains misleading revalidate declarations", () => {
      for (const routePath of firestoreBackedRoutes) {
        const fullPath = path.resolve(process.cwd(), routePath);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.equal(
          content.includes("export const revalidate"),
          false,
          `${routePath} must NOT retain page-level revalidate declaration`
        );
      }
    });

    it("dynamic parameter routes do not execute generateStaticParams Firestore reads at build time", () => {
      const slugRoutes = [
        "app/(live)/blog/[slug]/page.tsx",
        "app/(live)/services/[slug]/page.tsx",
      ];
      for (const routePath of slugRoutes) {
        const fullPath = path.resolve(process.cwd(), routePath);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.equal(
          content.includes("generateStaticParams"),
          false,
          `${routePath} must NOT declare generateStaticParams`
        );
      }
    });

    it("server modules contain standard server-only boundary", () => {
      const serverModules = [
        "lib/server/storefront.ts",
        "lib/firebase/admin.ts",
      ];
      for (const modPath of serverModules) {
        const fullPath = path.resolve(process.cwd(), modPath);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.ok(
          content.includes('import "server-only"'),
          `${modPath} must import "server-only"`
        );
      }
    });
  });

  // ==========================================================================
  // 12. PUBLIC DATA VISIBILITY & ERROR SANITIZATION
  // ==========================================================================
  describe("Public Storefront Adapter Visibility & Error Sanitization", () => {
    it("getServerProductCategories filters out categories explicitly marked isActive === false", async () => {
      const origCollection = adminDb.collection.bind(adminDb);
      try {
        (adminDb as any).collection = (colName: string) => {
          if (colName === "product_categories") {
            return {
              orderBy: () => ({
                get: async () => ({
                  docs: [
                    {
                      id: "cat-active",
                      data: () => ({
                        name: "Active Category",
                        slug: "active-cat",
                        priority: 1,
                        isActive: true,
                      }),
                    },
                    {
                      id: "cat-legacy",
                      data: () => ({
                        name: "Legacy Category",
                        slug: "legacy-cat",
                        priority: 2,
                      }),
                    },
                    {
                      id: "cat-disabled",
                      data: () => ({
                        name: "Disabled Category",
                        slug: "disabled-cat",
                        priority: 3,
                        isActive: false,
                      }),
                    },
                  ],
                }),
              }),
            };
          }
          return origCollection(colName);
        };

        const res = await getServerProductCategories();
        assert.equal(res.success, true);
        const categories = res.data!;
        assert.equal(categories.length, 2);
        assert.ok(categories.some((c) => c._id === "cat-active"));
        assert.ok(categories.some((c) => c._id === "cat-legacy"));
        assert.equal(categories.some((c) => c._id === "cat-disabled"), false);
      } finally {
        (adminDb as any).collection = origCollection;
      }
    });

    it("sanitizes Admin SDK errors and never leaks raw infrastructure errors to public pages", async () => {
      const origCollection = adminDb.collection.bind(adminDb);
      try {
        (adminDb as any).collection = () => {
          throw new Error("Could not load default credentials (ADC) from GCE metadata: 14 UNAVAILABLE");
        };

        const prodRes = await getServerProducts();
        assert.equal(prodRes.success, false);
        assert.equal(prodRes.error, "Unable to load products right now.");
        assert.equal(prodRes.error!.includes("ADC"), false);
        assert.equal(prodRes.error!.includes("14 UNAVAILABLE"), false);

        const blogRes = await getServerBlogPosts();
        assert.equal(blogRes.success, false);
        assert.equal(blogRes.error, "Unable to load blog posts right now.");
        assert.equal(blogRes.error!.includes("credentials"), false);
      } finally {
        (adminDb as any).collection = origCollection;
      }
    });
  });
});
