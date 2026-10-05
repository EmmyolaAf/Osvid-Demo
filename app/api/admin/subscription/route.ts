import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin, authErrorResponse } from "@/lib/server/auth";
import { logAuditEvent } from "@/lib/server/audit";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
import { ClientSubscription } from "@/types/subscription";

const PRIMARY_SUBSCRIPTION_DOC = "subscription";
const LEGACY_SUBSCRIPTION_DOC = "main_business";
const COLLECTION_NAME = "system_settings";

export const DEFAULT_SERVER_SUBSCRIPTION: ClientSubscription = {
  clientId: OSVID_CLIENT_CONFIG.clientId,
  businessName: OSVID_CLIENT_CONFIG.clientName,
  adminEmail: OSVID_CLIENT_CONFIG.defaultAdminEmail,
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
 * Reads existing subscription state with dual-read fallback.
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
    console.warn("Could not read subscription from Firestore, using default:", err);
  }

  return { ...DEFAULT_SERVER_SUBSCRIPTION };
}

/**
 * Synchronizes updates to both primary and legacy documents to prevent divergence.
 */
async function persistDualSubscription(payload: ClientSubscription): Promise<void> {
  const batch = adminDb.batch();
  const primaryRef = adminDb.collection(COLLECTION_NAME).doc(PRIMARY_SUBSCRIPTION_DOC);
  const legacyRef = adminDb.collection(COLLECTION_NAME).doc(LEGACY_SUBSCRIPTION_DOC);

  batch.set(primaryRef, payload, { merge: true });
  batch.set(legacyRef, payload, { merge: true });

  await batch.commit();
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
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireSuperAdmin(req);
    const body = await req.json();
    const { action, payload } = body;

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

        if (hostingExpiryDate && isNaN(new Date(hostingExpiryDate).getTime())) {
          return NextResponse.json(
            { error: "Invalid hostingExpiryDate format" },
            { status: 400 }
          );
        }

        updatedSub = {
          ...currentSub,
          ...(hostingExpiryDate ? { hostingExpiryDate: new Date(hostingExpiryDate).toISOString() } : {}),
          ...(renewalAmountNgn !== undefined ? { renewalAmountNgn: Number(renewalAmountNgn) } : {}),
          ...(gracePeriodDays !== undefined ? { gracePeriodDays: Number(gracePeriodDays) } : {}),
          ...(hostingPlan ? { hostingPlan } : {}),
          ...(businessName ? { businessName: businessName.trim() } : {}),
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.update_terms";
        auditSummary = `Updated subscription license terms (Expiry: ${updatedSub.hostingExpiryDate}, Fee: ₦${updatedSub.renewalAmountNgn.toLocaleString()})`;
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

        updatedSub = {
          ...currentSub,
          showWarning: Boolean(showWarning),
          ...(warningNotice !== undefined ? { warningNotice: String(warningNotice).trim() } : {}),
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
        const suspendReason = reason?.trim() || "Annual hosting and licensing subscription is past due.";

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
        updatedSub = {
          ...currentSub,
          isSuspended: false,
          status: "active",
          updatedAt: now,
          updatedBy: caller.email,
        };

        auditAction = "subscription.reactivate";
        auditSummary = "Reactivated business application: restored normal operations";
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported subscription action '${action}'` },
          { status: 400 }
        );
    }

    // Persist synchronously to both documents
    await persistDualSubscription(updatedSub);

    // Emit tamper-resistant audit event
    await logAuditEvent({
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

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
