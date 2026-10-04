import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { UserProfile } from "@/types/auth";
import { requireAdminOrSuperAdmin, authErrorResponse, PRIMARY_SUPER_ADMIN_EMAIL } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const adminMap = new Map<string, UserProfile>();


    // 1. Fetch from Firestore `users` collection (if available)
    try {
      const snap = await adminDb.collection("users").get();
      snap.forEach((doc) => {
        const data = doc.data() as UserProfile;
        if (
          data &&
          data.email &&
          data.email.trim().toLowerCase() !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() &&
          data.role !== "super_admin"
        ) {
          adminMap.set(data.email.toLowerCase(), {
            ...data,
            uid: doc.id,
            role: data.role || "admin",
            customTitle: data.customTitle || "Tenant Store Account",
          });
        }
      });
    } catch (dbErr: any) {
      console.warn("adminDb list query warning:", dbErr.message);
    }

    // 2. Fetch all users from Firebase Auth
    try {
      const authUsers = await adminAuth.listUsers(100);
      for (const u of authUsers.users) {
        if (
          u.email &&
          u.email.toLowerCase() !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()
        ) {
          const emailKey = u.email.toLowerCase();
          const existing = adminMap.get(emailKey);
          const claims = (u.customClaims as any) || {};

          const profile: UserProfile = {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || existing?.displayName || u.email.split("@")[0],
            phoneNumber: claims.phoneNumber || u.phoneNumber || existing?.phoneNumber || "",
            customTitle: claims.customTitle || existing?.customTitle || "Tenant Store Account",
            role: claims.role || existing?.role || "admin",
            permissions: claims.permissions || existing?.permissions || {
              canManageProducts: true,
              canManageOrders: true,
              canViewFinancials: true,
              canManageWebsite: true,
              canManageCustomers: true,
              canManageDiscounts: true,
            },
            isActive: !u.disabled,
            createdAt: u.metadata?.creationTime || existing?.createdAt || new Date().toISOString(),
            lastLoginAt: u.metadata?.lastSignInTime || existing?.lastLoginAt || new Date().toISOString(),
          };

          adminMap.set(emailKey, profile);

          // Background sync to Firestore
          try {
            adminDb.collection("users").doc(u.uid).set(profile, { merge: true }).catch(() => {});
          } catch (e) {}
        }
      }
    } catch (authErr: any) {
      console.warn("adminAuth listUsers warning:", authErr.message);
    }

    const tenantAdmins = Array.from(adminMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return NextResponse.json({
      success: true,
      admins: tenantAdmins,
      total: tenantAdmins.length,
    });
  } catch (err: any) {
    console.error("API get admin list error:", err);
    return authErrorResponse(err);
  }
}


