import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { UserProfile } from "@/types/auth";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const staffMap = new Map<string, UserProfile>();

    // 1. Fetch from Firestore `users` collection
    try {
      const snap = await adminDb.collection("users").get();
      snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data() as UserProfile;
        if (
          data &&
          data.email &&
          data.email.trim().toLowerCase() !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() &&
          data.role !== "super_admin"
        ) {
          // Only include recognized staff roles: admin or manager
          if (data.role === "admin" || data.role === "manager") {
            // Admin caller can only see managers
            if (!caller.isSuperAdmin && data.role !== "manager") {
              return;
            }

            staffMap.set(data.email.toLowerCase(), {
              ...data,
              uid: doc.id,
              role: data.role,
              customTitle:
                data.customTitle ||
                (data.role === "manager" ? "Operations Manager" : "Tenant Store Account"),
            });
          }
        }
      });
    } catch (dbErr: any) {
      console.warn("adminDb list query warning:", dbErr.message);
    }

    // 2. Fetch from Firebase Auth to ensure freshly provisioned staff are represented
    try {
      const authUsers = await adminAuth.listUsers(100);
      for (const u of authUsers.users) {
        if (
          u.email &&
          u.email.toLowerCase() !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()
        ) {
          const emailKey = u.email.toLowerCase();
          const existing = staffMap.get(emailKey);
          const claims = (u.customClaims as any) || {};
          const effectiveRole = claims.role || existing?.role;

          // Only include recognized staff roles: admin or manager
          if (effectiveRole === "admin" || effectiveRole === "manager") {
            // Admin caller can only see managers
            if (!caller.isSuperAdmin && effectiveRole !== "manager") {
              continue;
            }

            const profile: UserProfile = {
              uid: u.uid,
              email: u.email,
              displayName:
                u.displayName || existing?.displayName || u.email.split("@")[0],
              phoneNumber:
                claims.phoneNumber || u.phoneNumber || existing?.phoneNumber || "",
              customTitle:
                claims.customTitle ||
                existing?.customTitle ||
                (effectiveRole === "manager"
                  ? "Operations Manager"
                  : "Tenant Store Account"),
              role: effectiveRole,
              permissions: claims.permissions || existing?.permissions || {
                canManageProducts: true,
                canManageOrders: true,
                canViewFinancials: effectiveRole === "admin",
                canManageWebsite: effectiveRole === "admin",
                canManageCustomers: true,
                canManageDiscounts: effectiveRole === "admin",
              },
              isActive: !u.disabled,
              createdAt:
                u.metadata?.creationTime ||
                existing?.createdAt ||
                new Date().toISOString(),
              lastLoginAt:
                u.metadata?.lastSignInTime ||
                existing?.lastLoginAt ||
                new Date().toISOString(),
            };

            staffMap.set(emailKey, profile);
          }
        }
      }
    } catch (authErr: any) {
      console.warn("adminAuth listUsers warning:", authErr.message);
    }

    const tenantStaff = Array.from(staffMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return NextResponse.json({
      success: true,
      admins: tenantStaff,
      total: tenantStaff.length,
    });
  } catch (err: any) {
    console.error("API get admin list error:", err);
    return authErrorResponse(err);
  }
}


