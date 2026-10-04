import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdminOrSuperAdmin, authErrorResponse, AuthError, isSuperAdminEmail } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    // Prevent self-deletion via administrative endpoint
    if (uid === caller.uid) {
      throw new AuthError("Forbidden: Self-deletion is not permitted", 400);
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

    const isTargetSuper = isSuperAdminEmail(targetUser.email) || targetRole === "super_admin";

    // 1. Super Admin cannot be deleted
    if (isTargetSuper) {
      throw new AuthError("Forbidden: The primary Super Admin account cannot be deleted", 403);
    }

    // 2. Admin cannot delete another Admin or Super Admin
    if (!caller.isSuperAdmin) {
      if (targetRole === "admin") {
        throw new AuthError("Forbidden: Administrators cannot delete other Administrator accounts", 403);
      }
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (e: any) {
      console.warn("Firebase Auth delete user warning:", e.message);
    }

    try {
      await adminDb.collection("users").doc(uid).delete();
    } catch (e: any) {
      console.warn("Firestore delete user warning:", e.message);
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}

