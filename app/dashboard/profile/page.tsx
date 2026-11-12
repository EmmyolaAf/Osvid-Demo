"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { saveUserProfile } from "@/lib/firebase/firestore";
import { auth } from "@/lib/firebase/client";
import { updatePassword, updateProfile } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  Shield,
  KeyRound,
  CheckCircle2,
  Lock,
  Save,
  Loader2,
  Send,
  Building,
  Crown,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardProfilePage() {
  const { user, userProfile, role, isSuperAdmin, isAdmin, isManager, refreshProfile, resetPassword } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || user?.displayName || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || user?.phoneNumber || "");
  const [customTitle, setCustomTitle] = useState(userProfile?.customTitle || "");
  const [isSaving, setIsSaving] = useState(false);

  // Password Update State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || "");
      setPhoneNumber(userProfile.phoneNumber || user?.phoneNumber || "");
      setCustomTitle(userProfile.customTitle || "");
    }
  }, [userProfile, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!displayName.trim()) {
      toast.error("Please enter a valid display name.");
      return;
    }

    try {
      setIsSaving(true);

      // 1. Update Firebase Auth user display name
      await updateProfile(user, {
        displayName: displayName.trim(),
      });

      // 2. Update Firestore user profile
      await saveUserProfile({
        uid: user.uid,
        email: user.email || "",
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        customTitle: customTitle.trim() || undefined,
        role: userProfile?.role || role,
      });

      await refreshProfile();
      toast.success("Profile details updated successfully!");
    } catch (err: any) {
      console.error("Profile save error:", err);
      toast.error(err.message || "Failed to update profile details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await updatePassword(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully! Please use your new password next time you sign in.");
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === "auth/requires-recent-login") {
        toast.error("For security, please sign out and sign in again before updating your password directly, or use the password reset link below.");
      } else {
        toast.error(err.message || "Failed to update password.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) {
      toast.error("No email associated with this account.");
      return;
    }

    try {
      setIsSendingResetEmail(true);
      await resetPassword(user.email);
      toast.success(`Password reset email sent to ${user.email}. Please check your inbox.`);
    } catch (err: any) {
      console.error("Reset email error:", err);
      toast.error(err.message || "Failed to send reset email.");
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return {
        label: "Super Admin",
        icon: Crown,
        badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
      };
    }
    if (isAdmin) {
      return {
        label: "Administrator",
        icon: Shield,
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      };
    }
    if (isManager) {
      return {
        label: userProfile?.customTitle || "Operations Manager",
        icon: Briefcase,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    return {
      label: "Account User",
      icon: User,
      badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
    };
  };

  const roleMeta = getRoleBadge();
  const RoleIcon = roleMeta.icon;

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-orange-600" />
            <span>Profile & Account Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your personal profile information, contact channels, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${roleMeta.badgeClass}`}>
            <RoleIcon className="w-3.5 h-3.5" />
            <span>{roleMeta.label}</span>
          </span>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
            {displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {displayName || "Unnamed User"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user?.email}</span>
            </p>
            {customTitle && (
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>{customTitle}</span>
              </p>
            )}
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
            Personal & Contact Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Full Name / Display Name *</Label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Abolarinwa Emmanuel"
                className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phone / WhatsApp Number</Label>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+234 814 386 8711"
                className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Email Address (Account ID)</Label>
              <Input
                type="email"
                value={user?.email || ""}
                disabled
                className="h-10 rounded-lg text-xs sm:text-sm bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400">Account emails cannot be changed directly.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Custom Title / Operational Role</Label>
              <Input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Senior Chemical Operations Lead"
                className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Security & Password Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-5 h-5 text-slate-700" />
          <h3 className="text-base font-bold text-slate-900">Security & Password</h3>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Update your authentication password or trigger a verified recovery email to your registered inbox.
        </p>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="h-10 rounded-lg text-xs sm:text-sm border-slate-300"
            />
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={isUpdatingPassword || !newPassword}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSendResetEmail}
              disabled={isSendingResetEmail}
              className="h-9 px-4 rounded-lg text-xs font-semibold border-slate-300 text-slate-700 hover:text-orange-600 hover:border-orange-500 bg-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {isSendingResetEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Email Me Password Reset Link</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Permissions & Governance Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-slate-500" />
          <span>Role & Access Privileges</span>
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {isSuperAdmin && (
            "You have Executive Super Admin authority across governance, store pricing, database records, and system billing."
          )}
          {isAdmin && !isSuperAdmin && (
            "You have Administrator access with permissions to supervise operations, manage products, fulfill orders, review CRM inquiries, and configure website appearance."
          )}
          {isManager && (
            "You have Operations Manager privileges assigned by the system administration desk."
          )}
        </p>
      </div>
    </div>
  );
}

