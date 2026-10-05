import { adminDb } from "@/lib/firebase/admin";
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
 * 4. hardSuspendAt must exist, be a valid timestamp/date, and be strictly in the future.
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

    // Determine timestamp milliseconds
    let hardSuspendMs: number;
    if (typeof data.hardSuspendAt.toMillis === "function") {
      hardSuspendMs = data.hardSuspendAt.toMillis();
    } else if (typeof data.hardSuspendAt.toDate === "function") {
      hardSuspendMs = data.hardSuspendAt.toDate().getTime();
    } else if (typeof data.hardSuspendAt === "string") {
      hardSuspendMs = new Date(data.hardSuspendAt).getTime();
    } else if (data.hardSuspendAt._seconds) {
      hardSuspendMs = data.hardSuspendAt._seconds * 1000;
    } else {
      throw new AuthError("Malformed hardSuspendAt timestamp in runtime subscription.", 503);
    }

    if (isNaN(hardSuspendMs) || Date.now() >= hardSuspendMs) {
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
