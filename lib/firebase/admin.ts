import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let serviceAccount: any = null;

try {
  const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  }
} catch (e) {
  console.warn("Could not load firebase-service-account.json:", e);
}

const adminApp = !getApps().length
  ? serviceAccount
    ? initializeApp({ credential: cert(serviceAccount) })
    : initializeApp({ projectId: "osvid-9d4d6" })
  : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
