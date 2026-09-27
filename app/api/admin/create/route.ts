import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DEFAULT_MANAGER_PERMISSIONS } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName, phoneNumber, businessName, customTitle, role, permissions } = body;

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "Email and Full Name are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = role === "manager" ? "manager" : "admin";
    const userPassword = password || (assignedRole === "manager" ? "OsvidManager2026!" : "OsvidAdmin2026!");
    const userName = displayName.trim();
    const title = customTitle || businessName || (assignedRole === "manager" ? "Operations Manager" : "Tenant Store Account");

    const assignedPermissions = permissions || (assignedRole === "manager" ? DEFAULT_MANAGER_PERMISSIONS : {
      canManageProducts: true,
      canManageOrders: true,
      canViewFinancials: true,
      canManageWebsite: true,
      canManageCustomers: true,
      canManageDiscounts: true,
    });

    let uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Create or update user in Firebase Auth
    try {
      const userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: userPassword,
        displayName: userName,
        emailVerified: true,
      });
      uid = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === "auth/email-already-exists") {
        const existing = await adminAuth.getUserByEmail(cleanEmail);
        uid = existing.uid;
        if (password) {
          await adminAuth.updateUser(uid, { password: userPassword, displayName: userName });
        }
      } else {
        console.warn("Firebase Auth creation warning:", authErr.message);
      }
    }

    // 2. Set custom claims in Firebase Auth
    try {
      await adminAuth.setCustomUserClaims(uid, {
        role: assignedRole,
        customTitle: title,
        phoneNumber: phoneNumber || "",
        permissions: assignedPermissions,
      });
    } catch (claimErr: any) {
      console.warn("Could not set custom claims:", claimErr.message);
    }

    // 3. Save profile in Firestore users collection
    const profileData = {
      uid,
      email: cleanEmail,
      displayName: userName,
      phoneNumber: phoneNumber || "",
      customTitle: title,
      role: assignedRole,
      permissions: assignedPermissions,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await adminDb.collection("users").doc(uid).set(profileData, { merge: true });
    } catch (dbErr: any) {
      console.warn("Firestore Admin save warning:", dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `${assignedRole === "manager" ? "Manager" : "Administrator"} "${userName}" created successfully!`,
      user: profileData,
    });
  } catch (err: any) {
    console.error("API create user error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

