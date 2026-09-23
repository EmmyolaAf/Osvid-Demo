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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveUserProfile } from "@/lib/firebase/firestore";

export default function AccountPage() {
  const { user, userProfile, role, logout, isStaff, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || "");
  const [saving, setSaving] = useState(false);

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

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0e166e] to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="text-2xl font-black">{userProfile?.displayName || "Customer"}</h1>
                <p className="text-xs text-slate-300">{user?.email}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-orange-300 uppercase">
                  {role?.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isStaff && (
                <Link href="/dashboard">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs rounded-xl shadow-md">
                    <LayoutDashboard size={14} className="mr-1.5" />
                    Open Staff Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => logout()}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl"
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
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">My Chemical Orders</h3>
                  <p className="text-xs text-slate-500">Track shipments & view receipts</p>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-orange-600 transition-colors" />
            </Link>

            <Link
              href="/shop"
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Explore Chemical Store</h3>
                  <p className="text-xs text-slate-500">Browse verified raw materials</p>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </Link>
          </div>

          {/* Profile Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Account & Organization Details</h2>
            <p className="text-xs text-slate-500 mb-6">Manage your contact information for order deliveries</p>

            <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
              <div>
                <Label className="text-xs font-bold text-slate-700">Full Name / Business Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="mt-1 h-11 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Email Address (Read-only)</Label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="mt-1 h-11 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Phone Number for Deliveries</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="mt-1 h-11 rounded-xl"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold h-11 px-6 shadow-md shadow-orange-600/20"
                >
                  {saving ? "Saving Changes..." : "Save Profile Details"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
