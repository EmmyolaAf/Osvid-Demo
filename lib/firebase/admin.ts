import "server-only";
import { initializeApp, cert, applicationDefault, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

/**
 * Server-side Firebase Admin SDK initialization.
 *
 * Production Runtime (Cloud Run):
 *   Uses Google Application Default Credentials (ADC) provided by the Cloud Run
 *   runtime service account. No long-lived service account JSON key is required
 *   or stored in the container.
 *
 * Local Development Fallback:
 *   Optional local file `firebase-service-account.json` (gitignored) or
 *   `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable.
 */

let serviceAccount: any = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    }
  }
} catch (e: any) {
  // Never log credential contents or raw environment strings
  console.warn("Could not load local service account file; proceeding with Google Application Default Credentials (ADC).", e?.message || "");
}

/**
 * Resolves Firebase Project ID fail-closed in production/staging runtimes.
 *
 * In production or staging server runtime (NODE_ENV === "production"),
 * FIREBASE_PROJECT_ID is strictly required. Failing to provide it throws an error
 * immediately to prevent accidental connection to the production project or wrong environment.
 *
 * In local development or testing (NODE_ENV !== "production"), a documented fallback to
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID or "osvid-9d4d6" is permitted.
 */
export function resolveFirebaseAdminProjectId(env: NodeJS.ProcessEnv = process.env): string {
  const explicitId = env.FIREBASE_PROJECT_ID;
  if (explicitId && explicitId.trim().length > 0) {
    return explicitId.trim();
  }

  // During Next.js build / bundling phase (docker build / npm run build), allow build-time placeholder so image construction does not require credentials
  if (
    env.NEXT_PHASE === "phase-production-build" ||
    env.npm_lifecycle_event === "build" ||
    (typeof process !== "undefined" && Array.isArray(process.argv) && process.argv.some((arg) => arg.includes("build")))
  ) {
    return "build-time-placeholder";
  }

  // Fail-closed in production / staging runtime: never silently fall back to production ID
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Missing required FIREBASE_PROJECT_ID in production runtime. " +
      "Cloud Run staging and production services must explicitly configure FIREBASE_PROJECT_ID."
    );
  }

  // Documented local development fallback
  const localFallback = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "osvid-9d4d6";
  return localFallback;
}

const projectId = resolveFirebaseAdminProjectId();

function initAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  }

  // Cloud Run / Google Cloud production: ADC via runtime service account
  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } catch {
    // Fallback for offline testing / mocked environments
    return initializeApp({ projectId });
  }
}

const adminApp = initAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
