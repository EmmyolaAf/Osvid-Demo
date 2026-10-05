import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  AuthError,
  assertStaffEndpointTarget,
  assertCanManageTargetStaff,
  assertCanUpdateStaffFields,
} from "@/lib/server/auth";
import { logAuditEvent } from "@/lib/server/audit";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    await assertOperationalSubscription(caller);
    const { uid, isActive } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    // Lookup target user
    let targetUser;
    try {
      targetUser = await adminAuth.getUser(uid);
    } catch (e: any) {
      return NextResponse.json({ error: `User not found: ${e.message}` }, { status: 404 });
    }

    const targetClaims = (targetUser.customClaims as any) || {};
    let targetRole = targetClaims.role;
    if (!targetRole) {
      const snap = await adminDb.collection("users").doc(uid).get();
      targetRole = snap.data()?.role || "user";
    }

    // Enforce Staff Administration Target Restriction
    assertStaffEndpointTarget(targetRole);

    const targetAccount = {
      uid,
      email: targetUser.email,
      role: targetRole,
    };

    // Enforce authoritative hierarchy and field update constraints
    assertCanManageTargetStaff(caller, targetAccount);
    assertCanUpdateStaffFields(caller, targetAccount, { isActive });

    const previousDisabled = targetUser.disabled;

    // 1. Commit status change to Firebase Auth
    try {
      await adminAuth.updateUser(uid, { disabled: !isActive });
    } catch (e: any) {
      console.error("Firebase Auth toggle status error:", e);
      return NextResponse.json(
        { error: `Failed to update authentication account status: ${e.message}` },
        { status: 500 }
      );
    }

    // 2. Commit status change to Firestore users collection
    try {
      await adminDb.collection("users").doc(uid).set(
        { isActive: Boolean(isActive), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e: any) {
      let revertAuthError: string | null = null;
      try {
        await adminAuth.updateUser(uid, { disabled: previousDisabled });
      } catch (revertErr: any) {
        revertAuthError = revertErr.message;
        console.error("Failed to revert Auth user disabled state:", revertErr);
      }
      return NextResponse.json(
        {
          error: `Failed to update user status in database: ${e.message}`,
          inconsistency: true,
          compensationFailed: Boolean(revertAuthError),
          recoveryDetails: {
            targetUid: uid,
            stepFailed: "firestore_profile",
            revertAuthError,
          },
        },
        { status: 500 }
      );
    }

    // 3. Audit log event
    const auditRes = await logAuditEvent({
      actor: {
        uid: caller.uid,
        email: caller.email,
        role: caller.role,
      },
      action:
        targetRole === "admin"
          ? isActive
            ? "admin.activate"
            : "admin.deactivate"
          : isActive
          ? "manager.activate"
          : "manager.deactivate",
      targetType: targetRole,
      targetId: uid,
      summary: `${isActive ? "Activated" : "Deactivated"} ${
        targetRole === "admin" ? "Administrator" : "Manager"
      } account (${targetUser.email})`,
      metadata: {
        targetUid: uid,
        targetEmail: targetUser.email,
        isActive: Boolean(isActive),
      },
    });

    if (!auditRes.success) {
      console.error("AUDIT WARNING: Staff account status toggled but audit log failed:", auditRes.error);
    }

    return NextResponse.json({
      success: true,
      isActive: Boolean(isActive),
      auditRecorded: Boolean(auditRes.success),
      ...(!auditRes.success
        ? { auditWarning: "Staff status toggled successfully, but audit log entry failed to record." }
        : {}),
    });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}

