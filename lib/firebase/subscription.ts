import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./client";
import { BusinessSubscription } from "@/types/auth";

const SUBSCRIPTION_DOC_ID = "main_business";
const COLLECTION_NAME = "system_settings";
const WRITE_TIMEOUT_MS = 12000;
const READ_TIMEOUT_MS = 6000;

export interface SubscriptionStatusInfo {
  status: "active" | "warning" | "suspended";
  isSuspended: boolean;
  suspendedReason?: string;
  daysRemaining: number;
  hostingExpiryDate: string;
  gracePeriodDays: number;
  isPastDue: boolean;
  isGracePeriod: boolean;
  showWarning: boolean;
  warningNotice?: string;
  renewalAmountNgn: number;
  hostingPlan: "standard" | "professional" | "enterprise";
  businessName: string;
}

export type SubscriptionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

export const DEFAULT_BUSINESS_SUBSCRIPTION: BusinessSubscription = {
  id: SUBSCRIPTION_DOC_ID,
  businessName: "OSVID Chemicals Limited",
  adminEmail: "admin@osvidchemicals.com",
  isSuspended: false,
  suspendedReason: "Hosting subscription payment past due.",
  hostingPlan: "enterprise",
  // Default: 1 year from now
  hostingExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
  gracePeriodDays: 7,
  renewalAmountNgn: 250000,
  showWarning: false,
  warningNotice: "Hosting renewal due soon. Please settle your account to prevent service interruption.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Execute a promise with a safe timeout rejection
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Calculate subscription status, days remaining, and grace period logic
 */
export function calculateSubscriptionStatus(sub: BusinessSubscription): SubscriptionStatusInfo {
  const now = new Date();
  const expiry = new Date(sub.hostingExpiryDate || Date.now());
  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const gracePeriodDays = sub.gracePeriodDays ?? 7;

  const isPastDue = daysRemaining < 0;
  const isGracePeriod = isPastDue && Math.abs(daysRemaining) <= gracePeriodDays;
  const isHardExpired = isPastDue && Math.abs(daysRemaining) > gracePeriodDays;

  let computedStatus: "active" | "warning" | "suspended" = "active";

  if (sub.isSuspended || isHardExpired) {
    computedStatus = "suspended";
  } else if (sub.showWarning || daysRemaining <= 14 || isGracePeriod) {
    computedStatus = "warning";
  } else {
    computedStatus = "active";
  }

  return {
    status: computedStatus,
    isSuspended: sub.isSuspended || isHardExpired,
    suspendedReason:
      sub.suspendedReason ||
      (isHardExpired
        ? `Annual license expired on ${expiry.toLocaleDateString()}. Grace period of ${gracePeriodDays} days has elapsed.`
        : "Application access suspended by administrator."),
    daysRemaining,
    hostingExpiryDate: sub.hostingExpiryDate,
    gracePeriodDays,
    isPastDue,
    isGracePeriod,
    showWarning: sub.showWarning || daysRemaining <= 14 || isGracePeriod,
    warningNotice:
      sub.warningNotice ||
      (isGracePeriod
        ? `Account in ${gracePeriodDays}-day grace period! Please renew immediately to avoid shutdown.`
        : daysRemaining <= 14
        ? `Hosting renewal due in ${daysRemaining} day(s).`
        : ""),
    renewalAmountNgn: sub.renewalAmountNgn || 250000,
    hostingPlan: sub.hostingPlan || "enterprise",
    businessName: sub.businessName || "OSVID Chemicals Limited",
  };
}

/**
 * Get direct database subscription object with safe fallback
 */
export async function getBusinessSubscription(): Promise<BusinessSubscription> {
  try {
    const docRef = doc(db, COLLECTION_NAME, SUBSCRIPTION_DOC_ID);
    const snap = await withTimeout(
      getDoc(docRef),
      READ_TIMEOUT_MS,
      "Subscription query read timed out"
    );

    if (snap.exists()) {
      const data = snap.data() as BusinessSubscription;
      return {
        ...DEFAULT_BUSINESS_SUBSCRIPTION,
        ...data,
        id: snap.id,
      };
    }

    // Auto-seed in background if missing
    setDoc(docRef, DEFAULT_BUSINESS_SUBSCRIPTION, { merge: true }).catch(() => {});
    return DEFAULT_BUSINESS_SUBSCRIPTION;
  } catch (err) {
    console.warn("getBusinessSubscription returned fallback due to:", err);
    return DEFAULT_BUSINESS_SUBSCRIPTION;
  }
}

/**
 * Fetch current subscription status with graceful offline / timeout tolerance
 */
export async function getSubscriptionStatus(): Promise<SubscriptionResult<SubscriptionStatusInfo>> {
  try {
    const docRef = doc(db, COLLECTION_NAME, SUBSCRIPTION_DOC_ID);
    const snap = await withTimeout(
      getDoc(docRef),
      READ_TIMEOUT_MS,
      "Firestore subscription read timed out"
    );

    let subData: BusinessSubscription;

    if (snap.exists()) {
      subData = {
        ...DEFAULT_BUSINESS_SUBSCRIPTION,
        ...(snap.data() as BusinessSubscription),
        id: snap.id,
      };
    } else {
      subData = DEFAULT_BUSINESS_SUBSCRIPTION;
      setDoc(docRef, DEFAULT_BUSINESS_SUBSCRIPTION, { merge: true }).catch(() => {});
    }

    const statusInfo = calculateSubscriptionStatus(subData);
    return { success: true, data: statusInfo };
  } catch (error: any) {
    console.warn("getSubscriptionStatus using active fallback cache:", error?.message || error);
    // Graceful active state fallback prevents UI crashes during connection handshakes
    const fallbackStatus = calculateSubscriptionStatus(DEFAULT_BUSINESS_SUBSCRIPTION);
    return { success: true, data: fallbackStatus };
  }
}

/**
 * Update subscription parameters (Super Admin only) with confirmation
 */
export async function updateSubscriptionSettings(
  data: Partial<BusinessSubscription>
): Promise<SubscriptionResult<BusinessSubscription>> {
  try {
    const docRef = doc(db, COLLECTION_NAME, SUBSCRIPTION_DOC_ID);

    let currentData: BusinessSubscription = DEFAULT_BUSINESS_SUBSCRIPTION;
    try {
      const currentSnap = await withTimeout(
        getDoc(docRef),
        READ_TIMEOUT_MS,
        "Read before update timed out"
      );
      if (currentSnap.exists()) {
        currentData = currentSnap.data() as BusinessSubscription;
      }
    } catch (readErr) {
      // ignore, proceed with update
    }

    const payload: BusinessSubscription = {
      ...currentData,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Strict write to Firestore
    await withTimeout(
      setDoc(docRef, payload, { merge: true }),
      WRITE_TIMEOUT_MS,
      "Database write timed out after 12s."
    );

    return { success: true, data: payload };
  } catch (error: any) {
    console.error("updateSubscriptionSettings failure:", error);
    return {
      success: false,
      error: error?.message || "Failed to persist subscription settings to Firestore.",
    };
  }
}

/**
 * Update the business subscription (wrapper returning BusinessSubscription)
 */
export async function updateBusinessSubscription(
  data: Partial<BusinessSubscription>
): Promise<BusinessSubscription> {
  const result = await updateSubscriptionSettings(data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Toggle the global app suspension kill-switch with immediate confirmation
 */
export async function toggleAppSuspension(
  isSuspended: boolean,
  reason?: string
): Promise<SubscriptionResult<BusinessSubscription>> {
  try {
    const updatePayload: Partial<BusinessSubscription> = {
      isSuspended,
      ...(isSuspended && reason ? { suspendedReason: reason.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    return await updateSubscriptionSettings(updatePayload);
  } catch (error: any) {
    console.error("toggleAppSuspension error:", error);
    return {
      success: false,
      error: error?.message || "Failed to update global app suspension state.",
    };
  }
}
