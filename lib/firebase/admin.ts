import { initializeApp, cert, applicationDefault, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "osvid-9d4d6";

if (!projectId) {
  throw new Error(
    "Missing Firebase Project ID. Please set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID."
  );
}

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
export const adminDb = getFirestore(adminApp);
