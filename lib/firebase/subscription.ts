import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./client";
import { BusinessSubscription } from "@/types/auth";

const SUBSCRIPTION_DOC_ID = "main_business";

export const DEFAULT_BUSINESS_SUBSCRIPTION: BusinessSubscription = {
  id: SUBSCRIPTION_DOC_ID,
  businessName: "OSVID Chemicals Limited",
  adminEmail: "admin@osvidchemicals.com",
  isSuspended: false,
  hostingPlan: "enterprise",
  hostingExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(), // 90 days from now
  renewalAmountNgn: 250000,
  showWarning: false,
  warningNotice: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Get the business subscription & hosting status
 */
export async function getBusinessSubscription(): Promise<BusinessSubscription> {
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("osvid_business_subscription");
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      // fallback
    }
  }

  try {
    const docRef = doc(db, "system_settings", SUBSCRIPTION_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as BusinessSubscription;
      if (typeof window !== "undefined") {
        localStorage.setItem("osvid_business_subscription", JSON.stringify(data));
      }
      return data;
    }
  } catch (err) {
    console.warn("Using default subscription due to Firestore fetch error:", err);
  }

  return DEFAULT_BUSINESS_SUBSCRIPTION;
}

/**
 * Update the business subscription / hosting status (Super Admin only)
 */
export async function updateBusinessSubscription(data: Partial<BusinessSubscription>): Promise<BusinessSubscription> {
  const current = await getBusinessSubscription();
  const updated: BusinessSubscription = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem("osvid_business_subscription", JSON.stringify(updated));
  }

  try {
    const docRef = doc(db, "system_settings", SUBSCRIPTION_DOC_ID);
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.warn("Could not save subscription to Firestore, updated locally:", err);
  }

  return updated;
}
