import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { normalizeManagerPermissions } from "@/types/auth";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  AuthError,
  isSuperAdminEmail,
  assertStaffEndpointTarget,
  assertCanManageTargetStaff,
  assertCanUpdateStaffFields,
} from "@/lib/server/auth";
import { logAuditEvent } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize caller: Super Admin or Admin required
    const caller = await requireAdminOrSuperAdmin(req);

    const body = await req.json();
    const {
      uid,
      email,
      password,
      displayName,
      phoneNumber,
      businessName,
      isActive,
      permissions,
      role,
    } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "User UID is required" },
        { status: 400 }
      );
    }

    // 2. Fetch existing target user state
    let targetAuthUser;
    try {
      targetAuthUser = await adminAuth.getUser(uid);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Target user not found: ${e.message}` },
        { status: 404 }
      );
    }

    const existingClaims = (targetAuthUser.customClaims as any) || {};
    let targetRole = existingClaims.role;
    if (!targetRole) {
      try {
        const docSnap = await adminDb.collection("users").doc(uid).get();
        targetRole = docSnap.data()?.role || "user";
      } catch (e) {
        targetRole = "user";
      }
    }

    // 3. Enforce Staff Administration Target Restriction
    // Target must be a staff account (admin, manager, super_admin); cannot manage ordinary customers
    assertStaffEndpointTarget(targetRole);

    const targetAccount = {
      uid,
      email: targetAuthUser.email,
      role: targetRole,
    };

    // 4. Enforce authoritative hierarchy and field update constraints
    assertCanManageTargetStaff(caller, targetAccount);
    assertCanUpdateStaffFields(caller, targetAccount, { role, isActive });

    const isTargetSuperAdmin = isSuperAdminEmail(targetAuthUser.email);

    // Determine final effective role for target
    const finalRole = isTargetSuperAdmin
      ? "super_admin"
      : caller.isSuperAdmin
      ? role || targetRole || "admin"
      : targetRole;

    const authUpdates: any = {};
    const previousAuthProps: any = {};
    if (email) {
      authUpdates.email = email.trim().toLowerCase();
      previousAuthProps.email = targetAuthUser.email;
    }
    if (password && typeof password === "string" && password.trim().length > 0) {
      const trimmedPwd = password.trim();
      if (trimmedPwd.length < 8) {
        throw new AuthError("Password must be at least 8 characters long", 400);
      }
      authUpdates.password = trimmedPwd;
    }
    if (displayName) {
      authUpdates.displayName = displayName.trim();
      previousAuthProps.displayName = targetAuthUser.displayName;
    }
    if (isActive !== undefined) {
      authUpdates.disabled = !isActive;
      previousAuthProps.disabled = targetAuthUser.disabled;
    }

    // 5. Commit core credentials to Firebase Auth
    if (Object.keys(authUpdates).length > 0) {
      try {
        await adminAuth.updateUser(uid, authUpdates);
      } catch (authErr: any) {
        console.error("Firebase Auth credential update error:", authErr);
        return NextResponse.json(
          {
            error: `Firebase Auth error: ${
              authErr.message || "Failed to update authentication credentials"
            }`,
          },
          { status: 500 }
        );
      }
    }

    // 6. Update custom claims in Firebase Auth (fail-closed, do not swallow)
    const updatedClaims = {
      ...existingClaims,
      role: finalRole,
      customTitle:
        businessName?.trim() ||
        existingClaims.customTitle ||
        (finalRole === "manager"
          ? "Operations Manager"
          : "Tenant Store Account"),
      phoneNumber:
        phoneNumber !== undefined
          ? phoneNumber.trim()
          : existingClaims.phoneNumber || "",
      permissions:
        finalRole === "manager"
          ? normalizeManagerPermissions(permissions || existingClaims.permissions)
          : {
              canManageProducts: true,
              canManageInventory: true,
              canManageOrders: true,
              canViewFinancials: true,
              canManageWebsite: true,
              canManageCustomers: true,
              canManageDiscounts: true,
            },
    };

    try {
      await adminAuth.setCustomUserClaims(uid, updatedClaims);
    } catch (claimErr: any) {
      console.error("Custom claims write error:", claimErr);

      // Best-effort compensation rollback for Auth updates
      let rollbackAuthError: string | null = null;
      if (Object.keys(previousAuthProps).length > 0) {
        try {
          await adminAuth.updateUser(uid, previousAuthProps);
        } catch (rbAuthErr: any) {
          rollbackAuthError = rbAuthErr.message;
        }
      }

      return NextResponse.json(
        {
          error: `Failed to persist custom authorization claims: ${claimErr.message}`,
          inconsistency: true,
          compensationFailed: Boolean(rollbackAuthError),
          recoveryDetails: {
            targetUid: uid,
            stepFailed: "custom_claims",
            rollbackAuthError,
          },
        },
        { status: 500 }
      );
    }

    // 7. Persist in Firestore users collection (fail-closed, do not swallow)
    const profileUpdates: any = {
      uid,
      email: email ? email.trim().toLowerCase() : targetAuthUser.email,
      displayName: displayName
        ? displayName.trim()
        : targetAuthUser.displayName || displayName,
      phoneNumber:
        phoneNumber !== undefined
          ? phoneNumber.trim()
          : updatedClaims.phoneNumber,
      customTitle: updatedClaims.customTitle,
      role: finalRole,
      permissions: updatedClaims.permissions,
      isActive:
        isActive !== undefined ? Boolean(isActive) : !targetAuthUser.disabled,
      updatedAt: new Date().toISOString(),
    };

    // Strip undefined
    Object.keys(profileUpdates).forEach(
      (key) => profileUpdates[key] === undefined && delete profileUpdates[key]
    );

    try {
      await adminDb.collection("users").doc(uid).set(profileUpdates, { merge: true });
    } catch (dbErr: any) {
      console.error("Firestore database write error:", dbErr);

      // Best-effort compensation rollback for custom claims and auth updates
      let rollbackClaimsError: string | null = null;
      try {
        await adminAuth.setCustomUserClaims(uid, existingClaims);
      } catch (rbClaimErr: any) {
        rollbackClaimsError = rbClaimErr.message;
      }

      let rollbackAuthError: string | null = null;
      if (Object.keys(previousAuthProps).length > 0) {
        try {
          await adminAuth.updateUser(uid, previousAuthProps);
        } catch (rbAuthErr: any) {
          rollbackAuthError = rbAuthErr.message;
        }
      }

      return NextResponse.json(
        {
          error: `Failed to persist updated user profile in database: ${dbErr.message}`,
          inconsistency: true,
          compensationFailed: Boolean(rollbackClaimsError || rollbackAuthError),
          recoveryDetails: {
            targetUid: uid,
            stepFailed: "firestore_profile",
            rollbackClaimsError,
            rollbackAuthError,
          },
        },
        { status: 500 }
      );
    }

    // 8. Retrieve confirmed state from Firebase Auth
    const finalAuthUser = await adminAuth.getUser(uid);
    const confirmedProfile = {
      uid: finalAuthUser.uid,
      email: finalAuthUser.email,
      displayName: finalAuthUser.displayName || displayName,
      phoneNumber: updatedClaims.phoneNumber || finalAuthUser.phoneNumber || "",
      customTitle: updatedClaims.customTitle || "Tenant Store Account",
      role: updatedClaims.role || finalRole,
      permissions: updatedClaims.permissions,
      isActive: !finalAuthUser.disabled,
      updatedAt: new Date().toISOString(),
    };

    // 9. Audit log event
    await logAuditEvent({
      actor: {
        uid: caller.uid,
        email: caller.email,
        role: caller.role,
      },
      action: finalRole === "admin" ? "admin.update" : "manager.update",
      targetType: finalRole,
      targetId: uid,
      summary: `Updated ${finalRole === "admin" ? "Administrator" : "Manager"} account "${confirmedProfile.displayName || confirmedProfile.email}"`,
      metadata: {
        role: finalRole,
        changedFields: Object.keys(profileUpdates),
        permissions: updatedClaims.permissions,
        customTitle: updatedClaims.customTitle,
        isActive: confirmedProfile.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account "${
        confirmedProfile.displayName || confirmedProfile.email
      }" updated successfully!`,
      user: confirmedProfile,
    });
  } catch (err: any) {
    console.error("API update admin error:", err);
    return authErrorResponse(err);
  }
}



