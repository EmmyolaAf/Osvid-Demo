import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, getFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "../firebase";

// Initialize Firebase App (client-side singleton)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use memory-only cache so that queries always pull fresh live data from Cloud Firestore
// and never get stuck serving stale IndexedDB cache across reloads.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
