import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DEFAULT_MANAGER_PERMISSIONS, UserRole } from "@/types/auth";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  AuthError,
  assertCanCreateStaffRole,
  generateSecureTemporaryPassword,
} from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize caller: Super Admin or Admin required
    const caller = await requireAdminOrSuperAdmin(req);

    const body = await req.json();
    const {
      email,
      password,
      displayName,
      phoneNumber,
      businessName,
      customTitle,
      role,
      permissions,
    } = body;

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "Email and Full Name are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Authoritative role hierarchy check
    const assignedRole: UserRole = assertCanCreateStaffRole(
      caller,
      role,
      cleanEmail
    );

    // 3. Password handling: explicit sufficiently strong password or secure temporary password
    let userPassword = "";
    let temporaryPasswordIssued: string | null = null;

    if (password && typeof password === "string" && password.trim().length > 0) {
      const trimmedPwd = password.trim();
      if (trimmedPwd.length < 8) {
        throw new AuthError(
          "Password must be at least 8 characters long",
          400
        );
      }
      userPassword = trimmedPwd;
    } else {
      userPassword = generateSecureTemporaryPassword();
      temporaryPasswordIssued = userPassword;
    }

    const userName = displayName.trim();
    const title =
      customTitle ||
      businessName ||
      (assignedRole === "manager"
        ? "Operations Manager"
        : "Tenant Store Account");

    const assignedPermissions =
      permissions ||
      (assignedRole === "manager"
        ? DEFAULT_MANAGER_PERMISSIONS
        : {
            canManageProducts: true,
            canManageOrders: true,
            canViewFinancials: true,
            canManageWebsite: true,
            canManageCustomers: true,
            canManageDiscounts: true,
          });

    // 4. Create user in Firebase Auth (fail-closed, no fabricated UID)
    let uid: string;
    try {
      const userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: userPassword,
        displayName: userName,
        emailVerified: true,
      });
      uid = userRecord.uid;
    } catch (authErr: any) {
      console.error("Firebase Auth creation error:", authErr);
      return NextResponse.json(
        {
          error: `Failed to create authentication user: ${authErr.message}`,
        },
        { status: authErr.code === "auth/email-already-exists" ? 409 : 500 }
      );
    }

    // 5. Set custom claims in Firebase Auth (with compensation on failure)
    try {
      await adminAuth.setCustomUserClaims(uid, {
        role: assignedRole,
        customTitle: title,
        phoneNumber: phoneNumber || "",
        permissions: assignedPermissions,
      });
    } catch (claimErr: any) {
      console.error("Failed to set custom claims, compensating:", claimErr);
      try {
        await adminAuth.deleteUser(uid);
      } catch (compensationErr) {
        console.error("Compensation delete failed:", compensationErr);
      }
      return NextResponse.json(
        {
          error: `Failed to initialize user authorization claims: ${claimErr.message}`,
        },
        { status: 500 }
      );
    }

    // 6. Save profile in Firestore users collection (with compensation on failure)
    const profileData = {
      uid,
      email: cleanEmail,
      displayName: userName,
      phoneNumber: phoneNumber || "",
      customTitle: title,
      role: assignedRole,
      permissions: assignedPermissions,
      isActive: true,
      createdBy: caller.uid,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await adminDb.collection("users").doc(uid).set(profileData);
    } catch (dbErr: any) {
      console.error("Firestore Admin profile save error, compensating:", dbErr);
      try {
        await adminAuth.deleteUser(uid);
      } catch (compensationErr) {
        console.error("Compensation delete failed:", compensationErr);
      }
      return NextResponse.json(
        {
          error: `Failed to establish user profile in database: ${dbErr.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${
        assignedRole === "manager" ? "Manager" : "Administrator"
      } "${userName}" created successfully!`,
      user: profileData,
      ...(temporaryPasswordIssued
        ? { temporaryPassword: temporaryPasswordIssued }
        : {}),
    });
  } catch (err: any) {
    console.error("API create user error:", err);
    return authErrorResponse(err);
  }
}


