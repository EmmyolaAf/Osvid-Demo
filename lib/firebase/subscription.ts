import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./client";
import { BusinessSubscription } from "@/types/auth";
import {
  SubscriptionStatus,
  SubscriptionStatusInfo,
  RuntimeSubscriptionState,
} from "@/types/subscription";

const RUNTIME_COLLECTION_NAME = "runtime_settings";
const PRIMARY_SUBSCRIPTION_DOC_ID = "subscription";
const LEGACY_SUBSCRIPTION_DOC_ID = "main_business";
const COLLECTION_NAME = "system_settings";
const READ_TIMEOUT_MS = 6000;

export { type SubscriptionStatusInfo };

export type SubscriptionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

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
 * Calculate subscription status, days remaining, and grace period logic deterministically.
 * States:
 * - suspended: manually suspended OR hard expired beyond grace period
 * - grace: past expiry date but within grace period
 * - warning: within 14 days of expiry OR showWarning enabled
 * - active: normal operation
 */
export function calculateSubscriptionStatus(
  sub: Partial<BusinessSubscription | RuntimeSubscriptionState>
): SubscriptionStatusInfo {
  if (!sub.hostingExpiryDate) {
    return {
      status: "suspended",
      isSuspended: true,
      suspendedReason: sub.suspendedReason || "License expiration date is not configured.",
      daysRemaining: 0,
      hostingExpiryDate: "",
      gracePeriodDays: sub.gracePeriodDays ?? 7,
      isPastDue: true,
      isGracePeriod: false,
      showWarning: true,
      warningNotice: sub.warningNotice,
      businessName: sub.businessName,
    };
  }

  const now = new Date();
  const expiry = new Date(sub.hostingExpiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const gracePeriodDays = typeof sub.gracePeriodDays === "number" && sub.gracePeriodDays >= 0 ? sub.gracePeriodDays : 7;

  const isPastDue = daysRemaining < 0;
  const isGracePeriod = isPastDue && Math.abs(daysRemaining) <= gracePeriodDays;
  const isHardExpired = isPastDue && Math.abs(daysRemaining) > gracePeriodDays;

  const effectiveSuspended = Boolean(sub.isSuspended || isHardExpired);

  let computedStatus: SubscriptionStatus = "active";
  if (effectiveSuspended) {
    computedStatus = "suspended";
  } else if (isGracePeriod) {
    computedStatus = "grace";
  } else if (sub.showWarning || daysRemaining <= 14) {
    computedStatus = "warning";
  } else {
    computedStatus = "active";
  }

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
    showWarning: Boolean(sub.showWarning || daysRemaining <= 14 || isGracePeriod),
    warningNotice:
      sub.warningNotice ||
      (isGracePeriod
        ? `ANNUAL HOSTING PAST DUE: Operating in grace period (${gracePeriodDays - Math.abs(daysRemaining)} days remaining). Settle renewal promptly to avoid service suspension.`
        : undefined),
    businessName: sub.businessName,
    hardSuspendAtIso: (sub as any).hardSuspendAtIso,
    renewalAmountNgn: (sub as any).renewalAmountNgn,
    hostingPlan: (sub as any).hostingPlan,
  };
}

/**
 * Reads the authoritative provider subscription record (Super Admin only).
 * Does NOT fabricate fail-open active terms if database read fails.
 */
export async function getBusinessSubscription(): Promise<BusinessSubscription | null> {
  try {
    // 1. Try primary authoritative document
    const primaryRef = doc(db, COLLECTION_NAME, PRIMARY_SUBSCRIPTION_DOC_ID);
    const primarySnap = await withTimeout(
      getDoc(primaryRef),
      READ_TIMEOUT_MS,
      "Subscription query read timed out"
    );

    if (primarySnap.exists()) {
      return {
        ...(primarySnap.data() as BusinessSubscription),
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
      return {
        ...(legacySnap.data() as BusinessSubscription),
        id: legacySnap.id,
      };
    }

    return null;
  } catch (err) {
    console.error("Error reading business subscription from Firestore:", err);
    return null;
  }
}

/**
 * Fetch current operational subscription status from the minimal safe runtime record
 * (`runtime_settings/subscription`).
 * Publicly accessible and does not expose provider billing secrets.
 * Fails safely with structured error if Firestore is unavailable.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionResult<SubscriptionStatusInfo>> {
  try {
    // 1. Primary: read minimal runtime status document
    const runtimeRef = doc(db, RUNTIME_COLLECTION_NAME, PRIMARY_SUBSCRIPTION_DOC_ID);
    const runtimeSnap = await withTimeout(
      getDoc(runtimeRef),
      READ_TIMEOUT_MS,
      "Runtime subscription query timed out"
    );

    if (runtimeSnap.exists()) {
      const runtimeData = runtimeSnap.data() as RuntimeSubscriptionState;
      const statusInfo = calculateSubscriptionStatus(runtimeData);
      return { success: true, data: statusInfo };
    }

    // 2. Fallback during initial setup/migration: check authoritative doc
    const fallbackSub = await getBusinessSubscription();
    if (fallbackSub) {
      const statusInfo = calculateSubscriptionStatus(fallbackSub);
      return { success: true, data: statusInfo };
    }

    // Unconfigured state: return error without fabricating active license
    return {
      success: false,
      error: "Subscription record not found in database. Platform initialization required.",
    };
  } catch (error: any) {
    console.error("getSubscriptionStatus database query failure:", error?.message || error);
    return {
      success: false,
      error: error?.message || "Failed to reach database to verify subscription status.",
    };
  }
}

/**
 * Update subscription parameters via secure server API route (Super Admin only).
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
      payload = {
        reason: data.suspendedReason,
        hostingExpiryDate: data.hostingExpiryDate,
      };
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
  reason?: string,
  renewalExpiryDate?: string
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
        payload: {
          reason: reason?.trim(),
          hostingExpiryDate: renewalExpiryDate,
        },
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

/**
 * Bootstrap and synchronize the safe client runtime subscription document from
 * existing authoritative database records (Super Admin only).
 */
export async function bootstrapRuntimeSubscription(): Promise<SubscriptionResult<any>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return {
        success: false,
        error: "Authentication required to bootstrap runtime subscription.",
      };
    }

    const res = await fetch("/api/admin/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "bootstrap-runtime" }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Failed to bootstrap runtime subscription document.",
      };
    }

    return { success: true, data: result.runtime };
  } catch (error: any) {
    console.error("bootstrapRuntimeSubscription error:", error);
    return {
      success: false,
      error: error?.message || "Failed to bootstrap runtime subscription.",
    };
  }
}

/**
 * Initialize authoritative subscription terms from scratch (Super Admin only).
 */
export async function initializeSubscription(
  terms: {
    hostingExpiryDate: string;
    renewalAmountNgn: number;
    gracePeriodDays?: number;
    hostingPlan?: string;
    businessName?: string;
    adminEmail?: string;
    warningNotice?: string;
  }
): Promise<SubscriptionResult<any>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return {
        success: false,
        error: "Authentication required to initialize subscription.",
      };
    }

    const res = await fetch("/api/admin/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "initialize", payload: terms }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Failed to initialize subscription.",
      };
    }

    return { success: true, data: result.subscription };
  } catch (error: any) {
    console.error("initializeSubscription error:", error);
    return {
      success: false,
      error: error?.message || "Failed to initialize subscription.",
    };
  }
}
