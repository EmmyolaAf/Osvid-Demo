import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./client";
import { BusinessSubscription } from "@/types/auth";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
import { SubscriptionStatus } from "@/types/subscription";

const PRIMARY_SUBSCRIPTION_DOC_ID = "subscription";
const LEGACY_SUBSCRIPTION_DOC_ID = "main_business";
const COLLECTION_NAME = "system_settings";
const READ_TIMEOUT_MS = 6000;

export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
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
  clientId?: string;
}

export type SubscriptionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

export const DEFAULT_BUSINESS_SUBSCRIPTION: BusinessSubscription = {
  id: PRIMARY_SUBSCRIPTION_DOC_ID,
  clientId: OSVID_CLIENT_CONFIG.clientId,
  businessName: OSVID_CLIENT_CONFIG.clientName,
  adminEmail: OSVID_CLIENT_CONFIG.defaultAdminEmail,
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
 * Deterministic states:
 * - suspended: manually suspended OR hard expired beyond grace period
 * - grace: past expiry but within grace period
 * - warning: within 14 days of expiry OR showWarning enabled
 * - active: normal operation
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

  let computedStatus: SubscriptionStatus = "active";

  if (sub.isSuspended || isHardExpired) {
    computedStatus = "suspended";
  } else if (isGracePeriod) {
    computedStatus = "grace";
  } else if (sub.showWarning || daysRemaining <= 14) {
    computedStatus = "warning";
  } else {
    computedStatus = "active";
  }

  const effectiveSuspended = sub.isSuspended || isHardExpired;

  return {
    status: computedStatus,
    isSuspended: effectiveSuspended,
    suspendedReason:
      sub.suspendedReason ||
      (isHardExpired
        ? `Annual license expired on ${expiry.toLocaleDateString()}. Grace period of ${gracePeriodDays} days has elapsed.`
        : "Application access suspended by platform provider."),
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
    businessName: sub.businessName || OSVID_CLIENT_CONFIG.clientName,
    clientId: sub.clientId || OSVID_CLIENT_CONFIG.clientId,
  };
}

/**
 * Get direct database subscription object with safe dual-read fallback
 */
export async function getBusinessSubscription(): Promise<BusinessSubscription> {
  try {
    // 1. Try primary authoritative document
    const primaryRef = doc(db, COLLECTION_NAME, PRIMARY_SUBSCRIPTION_DOC_ID);
    const primarySnap = await withTimeout(
      getDoc(primaryRef),
      READ_TIMEOUT_MS,
      "Subscription query read timed out"
    );

    if (primarySnap.exists()) {
      const data = primarySnap.data() as BusinessSubscription;
      return {
        ...DEFAULT_BUSINESS_SUBSCRIPTION,
        ...data,
        id: primarySnap.id,
      };
    }

    // 2. Try legacy fallback document
    const legacyRef = doc(db, COLLECTION_NAME, LEGACY_SUBSCRIPTION_DOC_ID);
    const legacySnap = await withTimeout(
      getDoc(legacyRef),
      READ_TIMEOUT_MS,
      "Legacy subscription query read timed out"
    );

    if (legacySnap.exists()) {
      const data = legacySnap.data() as BusinessSubscription;
      return {
        ...DEFAULT_BUSINESS_SUBSCRIPTION,
        ...data,
        id: legacySnap.id,
      };
    }

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
    const subData = await getBusinessSubscription();
    const statusInfo = calculateSubscriptionStatus(subData);
    return { success: true, data: statusInfo };
  } catch (error: any) {
    console.warn("getSubscriptionStatus using active fallback cache:", error?.message || error);
    const fallbackStatus = calculateSubscriptionStatus(DEFAULT_BUSINESS_SUBSCRIPTION);
    return { success: true, data: fallbackStatus };
  }
}

/**
 * Update subscription parameters via secure server API route (Super Admin only).
 * Replaces direct browser Firestore writes with authenticated server endpoint.
 */
export async function updateSubscriptionSettings(
  data: Partial<BusinessSubscription>
): Promise<SubscriptionResult<BusinessSubscription>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return {
        success: false,
        error: "Authentication required to update subscription settings.",
      };
    }

    let action = "update-terms";
    let payload: any = {};

    if (data.isSuspended !== undefined) {
      action = data.isSuspended ? "suspend" : "reactivate";
      payload = { reason: data.suspendedReason };
    } else if (data.showWarning !== undefined || data.warningNotice !== undefined) {
      action = "set-warning";
      payload = {
        showWarning: data.showWarning,
        warningNotice: data.warningNotice,
      };
    } else {
      action = "update-terms";
      payload = {
        hostingExpiryDate: data.hostingExpiryDate,
        renewalAmountNgn: data.renewalAmountNgn,
        gracePeriodDays: data.gracePeriodDays,
        hostingPlan: data.hostingPlan,
        businessName: data.businessName,
      };
    }

    const res = await fetch("/api/admin/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Failed to persist subscription settings via server.",
      };
    }

    return { success: true, data: result.subscription };
  } catch (error: any) {
    console.error("updateSubscriptionSettings failure:", error);
    return {
      success: false,
      error: error?.message || "Failed to update subscription settings.",
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
 * Toggle the global app suspension kill-switch with immediate confirmation via server API
 */
export async function toggleAppSuspension(
  isSuspended: boolean,
  reason?: string
): Promise<SubscriptionResult<BusinessSubscription>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return {
        success: false,
        error: "Authentication required to toggle application suspension.",
      };
    }

    const res = await fetch("/api/admin/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: isSuspended ? "suspend" : "reactivate",
        payload: { reason: reason?.trim() },
      }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Failed to update global app suspension state.",
      };
    }

    return { success: true, data: result.subscription };
  } catch (error: any) {
    console.error("toggleAppSuspension error:", error);
    return {
      success: false,
      error: error?.message || "Failed to update global app suspension state.",
    };
  }
}
