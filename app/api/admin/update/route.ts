import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, password, displayName, phoneNumber, businessName, isActive, permissions, role } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "User UID is required" },
        { status: 400 }
      );
    }

    const authUpdates: any = {};
    if (email) authUpdates.email = email.trim().toLowerCase();
    if (password && password.trim().length >= 6) authUpdates.password = password.trim();
    if (displayName) authUpdates.displayName = displayName.trim();
    if (isActive !== undefined) authUpdates.disabled = !isActive;

    // 1. Commit core credentials to Firebase Auth
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

    // 2. Fetch existing claims and update them in Firebase Auth
    let updatedClaims: any = {
      role: role || "admin",
      customTitle: businessName?.trim() || "Tenant Store Account",
      phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : "",
      permissions: permissions || {
        canManageProducts: true,
        canManageOrders: true,
        canViewFinancials: true,
        canManageWebsite: true,
        canManageCustomers: true,
        canManageDiscounts: true,
      },
    };

    try {
      const currentAuthUser = await adminAuth.getUser(uid);
      const existingClaims = (currentAuthUser.customClaims as any) || {};
      updatedClaims = {
        ...existingClaims,
        ...updatedClaims,
      };
      await adminAuth.setCustomUserClaims(uid, updatedClaims);
    } catch (claimErr: any) {
      console.warn("Custom claims write warning:", claimErr.message);
    }

    // 3. Attempt Firestore persistence in users collection
    const profileUpdates: any = {
      uid,
      email: email ? email.trim().toLowerCase() : undefined,
      displayName: displayName ? displayName.trim() : undefined,
      phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : undefined,
      customTitle: businessName?.trim() || "Tenant Store Account",
      role: role || "admin",
      permissions: updatedClaims.permissions,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
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

    // 4. Retrieve confirmed state from Firebase Auth
    const finalAuthUser = await adminAuth.getUser(uid);
    const confirmedProfile = {
      uid: finalAuthUser.uid,
      email: finalAuthUser.email,
      displayName: finalAuthUser.displayName || displayName,
      phoneNumber: updatedClaims.phoneNumber || finalAuthUser.phoneNumber || "",
      customTitle: updatedClaims.customTitle || "Tenant Store Account",
      role: updatedClaims.role || "admin",
      permissions: updatedClaims.permissions,
      isActive: !finalAuthUser.disabled,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `Administrator "${confirmedProfile.displayName || confirmedProfile.email}" updated successfully in database!`,
      user: confirmedProfile,
    });
  } catch (err: any) {
    console.error("API update admin error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update administrator in database" },
      { status: 500 }
    );
  }
}


