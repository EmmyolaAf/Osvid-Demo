import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin, authErrorResponse } from "@/lib/server/auth";
import { buildAuditLogRecord } from "@/lib/server/audit";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
import {
  ClientSubscription,
  RuntimeSubscriptionState,
  SubscriptionStatus,
  HostingPlan,
} from "@/types/subscription";
import { Timestamp } from "firebase-admin/firestore";

const PRIMARY_SUBSCRIPTION_DOC = "subscription";
const LEGACY_SUBSCRIPTION_DOC = "main_business";
const COLLECTION_NAME = "system_settings";
const RUNTIME_COLLECTION_NAME = "runtime_settings";

export const DEFAULT_SERVER_SUBSCRIPTION: ClientSubscription = {
  clientId: OSVID_CLIENT_CONFIG.clientId,
  businessName: OSVID_CLIENT_CONFIG.clientName,
  adminEmail: undefined,
  hostingPlan: "enterprise",
  status: "active",
  isSuspended: false,
  suspendedReason: "Hosting subscription payment past due.",
  hostingExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
  gracePeriodDays: 7,
  renewalAmountNgn: 250000,
  showWarning: false,
  warningNotice: "Hosting renewal due soon. Please settle your account to prevent service interruption.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Reads existing authoritative subscription state from Firestore.
 */
async function getExistingSubscription(): Promise<ClientSubscription> {
  try {
    const primarySnap = await adminDb
      .collection(COLLECTION_NAME)
      .doc(PRIMARY_SUBSCRIPTION_DOC)
      .get();

    if (primarySnap.exists) {
      return {
        ...DEFAULT_SERVER_SUBSCRIPTION,
        ...(primarySnap.data() as ClientSubscription),
        id: primarySnap.id,
      };
    }

    const legacySnap = await adminDb
      .collection(COLLECTION_NAME)
      .doc(LEGACY_SUBSCRIPTION_DOC)
      .get();

    if (legacySnap.exists) {
      return {
        ...DEFAULT_SERVER_SUBSCRIPTION,
        ...(legacySnap.data() as ClientSubscription),
        id: legacySnap.id,
      };
    }
  } catch (err) {
    console.warn("Could not read subscription from Firestore, using default fallback:", err);
  }

  return { ...DEFAULT_SERVER_SUBSCRIPTION };
}

/**
 * Computes deterministic subscription lifecycle status and hard suspension threshold.
 */
function computeLifecycle(
  expiryDateStr: string,
  gracePeriodDays: number,
  isExplicitlySuspended: boolean,
  showWarning: boolean
): {
  status: SubscriptionStatus;
  isSuspended: boolean;
  hardSuspendMs: number;
  daysRemaining: number;
} {
  const expiryDate = new Date(expiryDateStr);
  const graceDays = Number.isInteger(gracePeriodDays) && gracePeriodDays >= 0 ? gracePeriodDays : 7;
  const hardSuspendMs = expiryDate.getTime() + graceDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const isHardExpired = now > hardSuspendMs;
  const isPastDue = now > expiryDate.getTime();
  const isGracePeriod = isPastDue && !isHardExpired;
  const daysRemaining = Math.ceil((expiryDate.getTime() - now) / (1000 * 60 * 60 * 24));
  const effectiveSuspended = isExplicitlySuspended || isHardExpired;

  let computedStatus: SubscriptionStatus = "active";
  if (effectiveSuspended) {
    computedStatus = "suspended";
  } else if (isGracePeriod) {
    computedStatus = "grace";
  } else if (showWarning || daysRemaining <= 14) {
    computedStatus = "warning";
  } else {
    computedStatus = "active";
  }

  return {
    status: computedStatus,
    isSuspended: effectiveSuspended,
    hardSuspendMs,
    daysRemaining,
  };
}

/**
 * GET: Retrieves full subscription parameters (Super Admin only).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const sub = await getExistingSubscription();
    return NextResponse.json({ success: true, subscription: sub });
  } catch (err) {
    return authErrorResponse(err);
  }
}

/**
 * POST: Mutates provider subscription state (Super Admin only).
 * Executes atomic batch write across authoritative, runtime, legacy, and audit collections.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireSuperAdmin(req);
    const body = await req.json();
    const { action, payload } = body || {};

    if (!action) {
      return NextResponse.json({ error: "Missing required action parameter" }, { status: 400 });
    }

    const currentSub = await getExistingSubscription();
    const now = new Date().toISOString();

    let updatedSub: ClientSubscription;
    let auditAction = "";
    let auditSummary = "";
    const auditMeta: Record<string, any> = {};

    switch (action) {
      case "update-terms": {
        const {
          hostingExpiryDate,
          renewalAmountNgn,
          gracePeriodDays,
          hostingPlan,
          businessName,
        } = payload || {};

        // 1. Validation
        if (hostingExpiryDate !== undefined) {
          const parsed = new Date(hostingExpiryDate);
          if (isNaN(parsed.getTime())) {
            return NextResponse.json(
              { error: "Invalid hostingExpiryDate format. Expected valid ISO date." },
              { status: 400 }
            );
          }
        }

        if (renewalAmountNgn !== undefined) {
          const num = Number(renewalAmountNgn);
          if (isNaN(num) || !Number.isFinite(num) || num < 0) {
            return NextResponse.json(
              { error: "renewalAmountNgn must be a valid non-negative number." },
              { status: 400 }
            );
          }
        }

        if (gracePeriodDays !== undefined) {
          const days = Number(gracePeriodDays);
          if (!Number.isInteger(days) || days < 0 || days > 90) {
            return NextResponse.json(
              { error: "gracePeriodDays must be an integer between 0 and 90." },
              { status: 400 }
            );
          }
        }

        if (hostingPlan !== undefined) {
          const allowedPlans: HostingPlan[] = ["standard", "professional", "enterprise"];
          if (!allowedPlans.includes(hostingPlan)) {
            return NextResponse.json(
              { error: `hostingPlan must be one of [${allowedPlans.join(", ")}]` },
              { status: 400 }
            );
          }
        }

        if (businessName !== undefined) {
          if (typeof businessName !== "string" || businessName.trim().length === 0 || businessName.length > 150) {
            return NextResponse.json(
              { error: "businessName must be between 1 and 150 characters." },
              { status: 400 }
            );
          }
        }

        const newExpiryStr = hostingExpiryDate
          ? new Date(hostingExpiryDate).toISOString()
          : currentSub.hostingExpiryDate;
        const newGrace = gracePeriodDays !== undefined ? Number(gracePeriodDays) : currentSub.gracePeriodDays;
        const lifecycle = computeLifecycle(newExpiryStr, newGrace, currentSub.isSuspended, currentSub.showWarning);

        updatedSub = {
          ...currentSub,
          hostingExpiryDate: newExpiryStr,
          ...(renewalAmountNgn !== undefined ? { renewalAmountNgn: Number(renewalAmountNgn) } : {}),
          gracePeriodDays: newGrace,
          ...(hostingPlan ? { hostingPlan } : {}),
          ...(businessName ? { businessName: businessName.trim() } : {}),
          status: lifecycle.status,
          isSuspended: lifecycle.isSuspended,
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.update_terms";
        auditSummary = `Updated subscription license terms (Expiry: ${updatedSub.hostingExpiryDate}, Fee: ₦${updatedSub.renewalAmountNgn.toLocaleString()}, Grace: ${updatedSub.gracePeriodDays}d)`;
        auditMeta.before = {
          hostingExpiryDate: currentSub.hostingExpiryDate,
          renewalAmountNgn: currentSub.renewalAmountNgn,
          gracePeriodDays: currentSub.gracePeriodDays,
        };
        auditMeta.after = {
          hostingExpiryDate: updatedSub.hostingExpiryDate,
          renewalAmountNgn: updatedSub.renewalAmountNgn,
          gracePeriodDays: updatedSub.gracePeriodDays,
        };
        break;
      }

      case "set-warning": {
        const { showWarning, warningNotice } = payload || {};

        if (warningNotice !== undefined && typeof warningNotice === "string" && warningNotice.length > 500) {
          return NextResponse.json(
            { error: "warningNotice exceeds maximum allowed length of 500 characters." },
            { status: 400 }
          );
        }

        const nextShowWarning = Boolean(showWarning);
        const lifecycle = computeLifecycle(
          currentSub.hostingExpiryDate,
          currentSub.gracePeriodDays,
          currentSub.isSuspended,
          nextShowWarning
        );

        updatedSub = {
          ...currentSub,
          showWarning: nextShowWarning,
          ...(warningNotice !== undefined ? { warningNotice: String(warningNotice).trim() } : {}),
          status: lifecycle.status,
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.update_warning";
        auditSummary = updatedSub.showWarning
          ? `Enabled dashboard warning notice broadcast: "${updatedSub.warningNotice}"`
          : "Disabled dashboard warning notice broadcast";
        auditMeta.showWarning = updatedSub.showWarning;
        auditMeta.warningNotice = updatedSub.warningNotice;
        break;
      }

      case "suspend": {
        const { reason } = payload || {};
        const suspendReason =
          typeof reason === "string" && reason.trim().length > 0
            ? reason.trim().slice(0, 500)
            : "Annual hosting and licensing subscription is past due.";

        updatedSub = {
          ...currentSub,
          isSuspended: true,
          status: "suspended",
          suspendedReason: suspendReason,
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.suspend";
        auditSummary = `Triggered application killswitch: suspended business operations (${suspendReason})`;
        auditMeta.reason = suspendReason;
        break;
      }

      case "reactivate": {
        const { hostingExpiryDate } = payload || {};
        let targetExpiryStr = currentSub.hostingExpiryDate;

        if (hostingExpiryDate) {
          const parsed = new Date(hostingExpiryDate);
          if (isNaN(parsed.getTime())) {
            return NextResponse.json({ error: "Invalid hostingExpiryDate format" }, { status: 400 });
          }
          targetExpiryStr = parsed.toISOString();
        }

        // Validate that subscription is not past grace period without a renewed date
        const lifecycle = computeLifecycle(
          targetExpiryStr,
          currentSub.gracePeriodDays,
          false, // request un-suspension
          currentSub.showWarning
        );

        if (lifecycle.status === "suspended") {
          return NextResponse.json(
            {
              error:
                "Cannot reactivate subscription: lease is expired past the grace period. Please extend hostingExpiryDate to reactivate.",
            },
            { status: 400 }
          );
        }

        updatedSub = {
          ...currentSub,
          hostingExpiryDate: targetExpiryStr,
          isSuspended: false,
          status: lifecycle.status,
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.reactivate";
        auditSummary = `Reactivated business application (Status: ${lifecycle.status}, Expiry: ${updatedSub.hostingExpiryDate})`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported subscription action '${action}'` },
          { status: 400 }
        );
    }

    // Compute hard suspension timestamp for backend rules evaluation
    const lifecycle = computeLifecycle(
      updatedSub.hostingExpiryDate,
      updatedSub.gracePeriodDays,
      updatedSub.isSuspended,
      updatedSub.showWarning
    );

    const runtimePayload: RuntimeSubscriptionState = {
      clientId: updatedSub.clientId,
      isSuspended: updatedSub.isSuspended,
      suspendedReason: updatedSub.isSuspended ? updatedSub.suspendedReason : undefined,
      hostingExpiryDate: updatedSub.hostingExpiryDate,
      gracePeriodDays: updatedSub.gracePeriodDays,
      hardSuspendAt: Timestamp.fromMillis(lifecycle.hardSuspendMs),
      hardSuspendAtIso: new Date(lifecycle.hardSuspendMs).toISOString(),
      showWarning: updatedSub.showWarning,
      warningNotice: updatedSub.warningNotice,
      updatedAt: now,
      businessName: updatedSub.businessName,
    };

    // ATOMIC BATCH WRITE: commit authoritative, runtime, legacy, and audit record in one transaction
    const batch = adminDb.batch();
    const primaryRef = adminDb.collection(COLLECTION_NAME).doc(PRIMARY_SUBSCRIPTION_DOC);
    const legacyRef = adminDb.collection(COLLECTION_NAME).doc(LEGACY_SUBSCRIPTION_DOC);
    const runtimeRef = adminDb.collection(RUNTIME_COLLECTION_NAME).doc(PRIMARY_SUBSCRIPTION_DOC);
    const { docRef: auditRef, entry: auditEntry } = buildAuditLogRecord({
      clientId: OSVID_CLIENT_CONFIG.clientId,
      actor: {
        uid: caller.uid,
        email: caller.email,
        role: caller.role,
      },
      action: auditAction,
      targetType: "subscription",
      targetId: PRIMARY_SUBSCRIPTION_DOC,
      summary: auditSummary,
      metadata: auditMeta,
    });

    batch.set(primaryRef, updatedSub, { merge: true });
    batch.set(legacyRef, updatedSub, { merge: true });
    batch.set(runtimeRef, runtimePayload, { merge: true });
    batch.set(auditRef, auditEntry);

    await batch.commit();

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      runtime: runtimePayload,
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
