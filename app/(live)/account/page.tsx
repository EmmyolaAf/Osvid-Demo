"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  User,
  ShoppingBag,
  Mail,
  Phone,
  Shield,
  LogOut,
  ChevronRight,
  Package,
  Calendar,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveUserProfile } from "@/lib/firebase/firestore";
import { isSuperAdminEmail, isAdminEmail } from "@/lib/firebase/auth";

export default function AccountPage() {
  const router = useRouter();
  const { user, userProfile, role, logout, isStaff, isAdmin, isSuperAdmin, refreshProfile, loading } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || "");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const isSuper = Boolean(
    isSuperAdmin ||
    role === "super_admin" ||
    userProfile?.role === "super_admin" ||
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(userProfile?.email)
  );

  const isAdminUser = Boolean(
    isAdmin ||
    role === "admin" ||
    userProfile?.role === "admin" ||
    isAdminEmail(user?.email) ||
    isAdminEmail(userProfile?.email)
  );

  const isManagerUser = Boolean(
    role === "manager" ||
    userProfile?.role === "manager"
  );

  const isStaffUser = isSuper || isAdminUser || isManagerUser || Boolean(isStaff);

  React.useEffect(() => {
    if (loading) return;

    if (isSuper) {
      router.replace("/dashboard/super-admin");
    } else if (isAdminUser || isManagerUser || isStaffUser) {
      router.replace("/dashboard");
    }
  }, [isSuper, isAdminUser, isManagerUser, isStaffUser, loading, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSaving(true);
      await saveUserProfile({
        uid: user.uid,
        email: user.email || "",
        displayName,
        phoneNumber,
      });
      await refreshProfile();
      toast.success("Profile details updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Immediate protection: If user is any administrative or management role, intercept and do NOT render customer UI
  if (loading || isSuper || isAdminUser || isManagerUser || isStaffUser) {
    return (
      <div className="bg-slate-50 min-h-screen py-24 px-4 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800">
          {isSuper || isAdminUser || isManagerUser || isStaffUser
            ? "Redirecting to Admin Dashboard..."
            : "Verifying Authentication..."}
        </h2>
        <p className="text-xs text-slate-500 mt-1">Taking you to your administrative control center.</p>
      </div>
    );
  }

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    try {
      setSendingReset(true);
      const { sendPasswordResetEmail } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase/client");
      await sendPasswordResetEmail(auth, user.email);
      toast.success(`Password reset email sent to ${user.email}. Check your inbox.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 rounded-xl p-5 sm:p-7 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-full bg-orange-600 text-white font-bold text-xl flex items-center justify-center shadow-sm shrink-0">
                {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">{userProfile?.displayName || "Customer"}</h1>
                <p className="text-xs text-slate-300">{user?.email}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-orange-300 uppercase tracking-wider border border-white/10">
                  {role?.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isStaff && (
                <Link href="/dashboard">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs rounded-lg shadow-sm h-9 px-3.5">
                    <LayoutDashboard size={14} className="mr-1.5" />
                    Open Staff Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => logout()}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-lg h-9 px-3.5"
              >
                <LogOut size={14} className="mr-1.5" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Grid: Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/account/orders"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">My Chemical Orders</h3>
                  <p className="text-xs text-slate-500">Track shipments & view receipts</p>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-orange-600 transition-colors w-4 h-4" />
            </Link>

            <Link
              href="/shop"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Explore Chemical Store</h3>
                  <p className="text-xs text-slate-500">Browse verified raw materials</p>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-emerald-600 transition-colors w-4 h-4" />
            </Link>
          </div>

          {/* Profile Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-0.5">Account & Organization Details</h2>
            <p className="text-xs text-slate-500 mb-5">Manage your contact information for order deliveries</p>

            <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Full Name / Business Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Email Address (Read-only)</Label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="h-10 rounded-lg text-xs sm:text-sm bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Phone Number for Deliveries</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold h-9 px-4 text-xs shadow-sm transition-colors cursor-pointer"
                >
                  {saving ? "Saving Changes..." : "Save Profile Details"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendResetEmail}
                  disabled={sendingReset}
                  className="border-slate-300 text-slate-700 hover:text-orange-600 hover:border-orange-500 bg-white rounded-lg font-semibold h-9 px-4 text-xs shadow-sm transition-colors cursor-pointer"
                >
                  {sendingReset ? "Sending Reset..." : "Reset Password via Email"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
