"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole, ManagerPermissions, normalizeManagerPermissions } from "@/types/auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof ManagerPermissions;
  requireAuth?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles = ["super_admin", "admin", "manager", "user"],
  requiredPermission,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { user, userProfile, role, isSuperAdmin, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }, [user, loading, requireAuth, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
        <p className="text-gray-500 font-medium text-sm">Verifying access permissions...</p>
      </div>
    );
  }

  if (requireAuth && !user) {
    return null;
  }

  // Check role authorization
  const roleAllowed = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);

  // Check granular permission requirement
  let permissionAllowed = true;
  if (requiredPermission) {
    if (isSuperAdmin || isAdmin) {
      permissionAllowed = true;
    } else if (role === "manager" && userProfile?.permissions) {
      const normalized = normalizeManagerPermissions(userProfile.permissions);
      permissionAllowed = Boolean(normalized[requiredPermission]);
    } else {
      permissionAllowed = false;
    }
  }

  if (!roleAllowed || !permissionAllowed) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 max-w-md mb-6 text-sm">
          {!roleAllowed
            ? `You do not have the required role (${allowedRoles.join(", ")}) to access this page. Current role: ${role}.`
            : `Your staff account lacks the required operational permission (${String(requiredPermission)}) to access this module.`}
        </p>
        <div className="flex gap-3">
          <Link href="/">
            <Button variant="outline">Return to Homepage</Button>
          </Link>
          {role === "user" ? (
            <Link href="/account">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">Go to My Account</Button>
            </Link>
          ) : (
            <Link href={role === "super_admin" ? "/dashboard/super-admin" : "/dashboard"}>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">Go to Dashboard</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
