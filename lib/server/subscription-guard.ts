import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { ServerAuthUser, AuthError } from "@/lib/server/auth";
import { OSVID_CLIENT_CONFIG } from "@/config/client";

/**
 * Reusable server-side operational subscription guard (Packet 3).
 *
 * Firebase Admin SDK bypasses security rules, so operational mutation APIs
 * must enforce subscription operational state server-side.
 *
 * Enforces the exact same fail-closed semantics as firestore.rules and storage.rules:
 * 1. Document runtime_settings/subscription must exist.
 * 2. clientId must match "osvid".
 * 3. isSuspended must be boolean false.
 * 4. hardSuspendAt must exist, be a genuine Firestore Timestamp, and be strictly in the future.
 *
 * Super Admin provider recovery bypasses subscription gating.
 */
export async function assertOperationalSubscription(
  caller: ServerAuthUser,
  fetchSubscriptionSnap?: () => Promise<{ exists: boolean; data: () => any }>
): Promise<void> {
  // Super Admin provider governance/recovery bypasses subscription suspension
  if (caller.isSuperAdmin) {
    return;
  }

  try {
    const snap = fetchSubscriptionSnap
      ? await fetchSubscriptionSnap()
      : await adminDb
          .collection("runtime_settings")
          .doc("subscription")
          .get();

    if (!snap.exists) {
      throw new AuthError(
        "Fail-closed: Tenant operational subscription record is missing. Operational mutations disabled.",
        503
      );
    }

    const data = snap.data();
    if (!data) {
      throw new AuthError("Malformed runtime subscription document.", 503);
    }

    if (data.clientId !== OSVID_CLIENT_CONFIG.clientId) {
      throw new AuthError("Malformed runtime subscription document: client identity mismatch.", 503);
    }

    if (typeof data.isSuspended !== "boolean" || data.isSuspended === true) {
      throw new AuthError(
        data.suspendedReason || "Operation forbidden: Client subscription is suspended.",
        403
      );
    }

    if (!data.hardSuspendAt) {
      throw new AuthError("Subscription runtime hardSuspendAt timestamp is missing.", 503);
    }

    // Fail-closed unless hardSuspendAt is a genuine Firestore/Admin Timestamp
    const isTimestamp =
      data.hardSuspendAt instanceof Timestamp ||
      (typeof data.hardSuspendAt === "object" &&
        data.hardSuspendAt !== null &&
        typeof data.hardSuspendAt.toMillis === "function" &&
        typeof data.hardSuspendAt.toDate === "function" &&
        typeof data.hardSuspendAt.seconds === "number" &&
        typeof data.hardSuspendAt.nanoseconds === "number");

    if (!isTimestamp) {
      throw new AuthError(
        "Subscription runtime hardSuspendAt is not a valid Firestore Timestamp.",
        503
      );
    }

    const hardSuspendMs = data.hardSuspendAt.toMillis();
    if (typeof hardSuspendMs !== "number" || isNaN(hardSuspendMs)) {
      throw new AuthError("Malformed hardSuspendAt timestamp in runtime subscription.", 503);
    }

    if (Date.now() >= hardSuspendMs) {
      throw new AuthError(
        "Operation forbidden: Hard subscription cutoff reached. Operational mutations are suspended.",
        403
      );
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      throw err;
    }
    console.error("Error evaluating server operational subscription:", err);
    throw new AuthError(
      `Unable to verify store subscription operational status: ${err?.message || String(err)}`,
      503
    );
  }
}

/**
 * Public storefront operational check (e.g. checkout / order placement).
 * Non-Super-Admin storefront operations fail closed if the store subscription is suspended.
 */
export async function assertStoreOperationalSubscription(
  fetchSubscriptionSnap?: () => Promise<{ exists: boolean; data: () => any }>
): Promise<void> {
  const storefrontCaller: ServerAuthUser = {
    uid: "storefront",
    email: "storefront@osvid.internal",
    role: "user",
    isSuperAdmin: false,
    isAdmin: false,
    isManager: false,
    isStaff: false,
    isCustomer: true,
    isActive: true,
    tokenClaims: {},
  };
  return assertOperationalSubscription(storefrontCaller, fetchSubscriptionSnap);
}
