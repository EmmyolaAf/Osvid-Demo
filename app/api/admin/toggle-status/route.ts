import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdminOrSuperAdmin, authErrorResponse, AuthError, isSuperAdminEmail } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const { uid, isActive } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    // Lookup target user
    const targetUser = await adminAuth.getUser(uid);
    const targetClaims = (targetUser.customClaims as any) || {};
    let targetRole = targetClaims.role;
    if (!targetRole) {
      const snap = await adminDb.collection("users").doc(uid).get();
      targetRole = snap.data()?.role || "user";
    }

    const isTargetSuper = isSuperAdminEmail(targetUser.email) || targetRole === "super_admin";

    // 1. Never allow deactivating the platform Super Admin
    if (isTargetSuper && !isActive) {
      throw new AuthError("Forbidden: Cannot deactivate the primary Super Admin account", 403);
    }

    // 2. Admin cannot alter status of Admin or Super Admin accounts
    if (!caller.isSuperAdmin) {
      if (isTargetSuper || targetRole === "admin") {
        throw new AuthError("Forbidden: Administrators cannot alter status of Administrator accounts", 403);
      }
    }

    try {
      await adminAuth.updateUser(uid, { disabled: !isActive });
    } catch (e: any) {
      console.warn("Firebase Auth toggle status warning:", e.message);
    }

    try {
      await adminDb.collection("users").doc(uid).set(
        { isActive: Boolean(isActive), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e: any) {
      console.warn("Firestore toggle status warning:", e.message);
    }

    return NextResponse.json({ success: true, isActive: Boolean(isActive) });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}

