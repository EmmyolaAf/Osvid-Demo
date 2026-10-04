import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdminOrSuperAdmin, authErrorResponse, AuthError, isSuperAdminEmail } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize caller: Super Admin or Admin required
    const caller = await requireAdminOrSuperAdmin(req);

    const body = await req.json();
    const { uid, email, password, displayName, phoneNumber, businessName, isActive, permissions, role } = body;

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

    const isTargetSuperAdmin = isSuperAdminEmail(targetAuthUser.email) || targetRole === "super_admin";

    // 3. Enforce Hierarchy & Protection Constraints:
    // A. Protect Super Admin:
    if (isTargetSuperAdmin) {
      if (!caller.isSuperAdmin) {
        throw new AuthError("Forbidden: Administrators cannot modify Super Admin accounts", 403);
      }
      // Accidental demotion / deactivation prevention for platform owner
      if (isActive === false) {
        throw new AuthError("Forbidden: Cannot deactivate the primary Super Admin account", 403);
      }
      if (role && role !== "super_admin") {
        throw new AuthError("Forbidden: Cannot demote the primary Super Admin account", 403);
      }
    }

    // B. Prevent assigning 'super_admin' role to anyone
    if (role === "super_admin" && !isTargetSuperAdmin) {
      throw new AuthError("Forbidden: Cannot grant Super Admin role via update", 403);
    }

    // C. Rules for Admin callers:
    if (!caller.isSuperAdmin) {
      // Admin cannot modify an Admin account (unless self-editing permitted details without privilege escalation)
      if (targetRole === "admin" && uid !== caller.uid) {
        throw new AuthError("Forbidden: Administrators cannot modify other Administrator accounts", 403);
      }

      // Admin modifying self: cannot change their own role, status, or permissions
      if (uid === caller.uid) {
        if (role && role !== "admin") {
          throw new AuthError("Forbidden: Cannot alter your own administrative role", 403);
        }
        if (isActive !== undefined && !isActive) {
          throw new AuthError("Forbidden: Cannot deactivate your own administrator account", 403);
        }
      }

      // Admin modifying staff: cannot promote manager to admin
      if (targetRole === "manager" && role && role !== "manager") {
        throw new AuthError("Forbidden: Administrators cannot promote Managers to Administrator", 403);
      }
    }

    // Determine final effective role for target
    const finalRole = isTargetSuperAdmin
      ? "super_admin"
      : caller.isSuperAdmin
      ? role || targetRole || "admin"
      : targetRole;

    const authUpdates: any = {};
    if (email) authUpdates.email = email.trim().toLowerCase();
    if (password && password.trim().length >= 6) authUpdates.password = password.trim();
    if (displayName) authUpdates.displayName = displayName.trim();
    if (isActive !== undefined) authUpdates.disabled = !isActive;

    // 4. Commit core credentials to Firebase Auth
    if (Object.keys(authUpdates).length > 0) {
      try {
        await adminAuth.updateUser(uid, authUpdates);
      } catch (authErr: any) {
        console.error("Firebase Auth credential update error:", authErr);
        return NextResponse.json(
          { error: `Firebase Auth error: ${authErr.message || "Failed to update authentication credentials"}` },
          { status: 500 }
        );
      }
    }

    // 5. Update custom claims in Firebase Auth
    const updatedClaims = {
      ...existingClaims,
      role: finalRole,
      customTitle: businessName?.trim() || existingClaims.customTitle || (finalRole === "manager" ? "Operations Manager" : "Tenant Store Account"),
      phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : existingClaims.phoneNumber || "",
      permissions: permissions || existingClaims.permissions || (finalRole === "manager" ? {
        canManageProducts: true,
        canManageOrders: true,
        canViewFinancials: false,
        canManageWebsite: false,
        canManageCustomers: true,
        canManageDiscounts: false,
      } : {
        canManageProducts: true,
        canManageOrders: true,
        canViewFinancials: true,
        canManageWebsite: true,
        canManageCustomers: true,
        canManageDiscounts: true,
      }),
    };

    try {
      await adminAuth.setCustomUserClaims(uid, updatedClaims);
    } catch (claimErr: any) {
      console.warn("Custom claims write warning:", claimErr.message);
    }

    // 6. Persist in Firestore users collection
    const profileUpdates: any = {
      uid,
      email: email ? email.trim().toLowerCase() : targetAuthUser.email,
      displayName: displayName ? displayName.trim() : (targetAuthUser.displayName || displayName),
      phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : updatedClaims.phoneNumber,
      customTitle: updatedClaims.customTitle,
      role: finalRole,
      permissions: updatedClaims.permissions,
      isActive: isActive !== undefined ? Boolean(isActive) : !targetAuthUser.disabled,
      updatedAt: new Date().toISOString(),
    };

    // Strip undefined
    Object.keys(profileUpdates).forEach(
      (key) => profileUpdates[key] === undefined && delete profileUpdates[key]
    );

    try {
      await adminDb.collection("users").doc(uid).set(profileUpdates, { merge: true });
    } catch (dbErr: any) {
      console.warn("Firestore database write warning:", dbErr.message);
    }

    // 7. Retrieve confirmed state from Firebase Auth
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

    return NextResponse.json({
      success: true,
      message: `Account "${confirmedProfile.displayName || confirmedProfile.email}" updated successfully!`,
      user: confirmedProfile,
    });
  } catch (err: any) {
    console.error("API update admin error:", err);
    return authErrorResponse(err);
  }
}



