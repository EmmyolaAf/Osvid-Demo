import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  AuthError,
  assertCanDeleteStaff,
} from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    // Lookup target user
    let targetUser;
    try {
      targetUser = await adminAuth.getUser(uid);
    } catch (e: any) {
      // If not in Auth, check if in Firestore
      const snap = await adminDb.collection("users").doc(uid).get();
      if (!snap.exists) {
        return NextResponse.json({ error: `User not found: ${e.message}` }, { status: 404 });
      }
      targetUser = {
        uid,
        email: snap.data()?.email,
        customClaims: { role: snap.data()?.role },
      };
    }

    const targetClaims = (targetUser.customClaims as any) || {};
    let targetRole = targetClaims.role;
    if (!targetRole) {
      const snap = await adminDb.collection("users").doc(uid).get();
      targetRole = snap.data()?.role || "user";
    }

    // Enforce hierarchy and deletion rules
    assertCanDeleteStaff(caller, {
      uid,
      email: targetUser.email,
      role: targetRole,
    });

    let authDeleted = false;
    let firestoreDeleted = false;
    let authError: string | null = null;
    let firestoreError: string | null = null;

    try {
      await adminAuth.deleteUser(uid);
      authDeleted = true;
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        authDeleted = true; // Safely idempotent / retryable
      } else {
        authError = e.message;
        console.error("Firebase Auth delete user error:", e);
      }
    }

    try {
      await adminDb.collection("users").doc(uid).delete();
      firestoreDeleted = true;
    } catch (e: any) {
      firestoreError = e.message;
      console.error("Firestore delete user error:", e);
    }

    if (!authDeleted || !firestoreDeleted) {
      return NextResponse.json(
        {
          error: "Deletion operation failed or partially succeeded",
          details: {
            authDeleted,
            firestoreDeleted,
            authError,
            firestoreError,
          },
          retryable: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Staff account deleted successfully",
    });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}

