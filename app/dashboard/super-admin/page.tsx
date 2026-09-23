"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getExecutiveGovernanceStats,
  getUsersByRole,
  toggleUserStatus,
  saveUserProfile,
} from "@/lib/firebase/firestore";
import {
  getBusinessSubscription,
  updateBusinessSubscription,
} from "@/lib/firebase/subscription";
import { UserProfile, BusinessSubscription } from "@/types/auth";
import {
  Crown,
  Shield,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  DollarSign,
  Users,
  ShoppingBag,
  Bell,
  RefreshCw,
  Power,
  Calendar,
  Lock,
  Plus,
  Loader2,
  FileText,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function SuperAdminGovernancePage() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({
    grossRevenue: 0,
    totalOrders: 0,
    paidOrders: 0,
    totalProducts: 0,
    activeAdmins: 0,
    activeManagers: 0,
    totalCustomers: 0,
    systemHealth: "Optimal 99.98%",
    serverUptime: "Active",
  });
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & form state
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("Hosting subscription payment past due.");
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [warningText, setWarningText] = useState("Hosting renewal due in 14 days. Please settle your account to prevent service interruption.");
  const [showWarningToggle, setShowWarningToggle] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminBusiness, setNewAdminBusiness] = useState("OSVID Chemicals Limited");
  const [newAdminPassword, setNewAdminPassword] = useState("OsvidAdmin2026!");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kpis, adminList, sub] = await Promise.all([
        getExecutiveGovernanceStats(),
        getUsersByRole("admin"),
        getBusinessSubscription(),
      ]);
      setStats(kpis);
      setAdmins(adminList);
      setSubscription(sub);
      setShowWarningToggle(sub.showWarning);
      setWarningText(sub.warningNotice || warningText);
      setSuspendReason(sub.suspendedReason || suspendReason);
    } catch (err) {
      console.error("Error loading super admin data:", err);
      toast.error("Failed to load governance telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleToggleBusinessSuspension = async () => {
    if (!subscription) return;
    try {
      setSavingAction(true);
      const newSuspendedState = !subscription.isSuspended;
      const updated = await updateBusinessSubscription({
        isSuspended: newSuspendedState,
        suspendedReason: newSuspendedState ? suspendReason : undefined,
      });
      setSubscription(updated);
      setIsSuspendModalOpen(false);
      if (newSuspendedState) {
        toast.error("Business portal and all tenant dashboards have been SUSPENDED.");
      } else {
        toast.success("Business portal has been REACTIVATED successfully.");
      }
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveWarningNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAction(true);
      const updated = await updateBusinessSubscription({
        showWarning: showWarningToggle,
        warningNotice: warningText,
      });
      setSubscription(updated);
      setIsWarningModalOpen(false);
      toast.success("Warning broadcast settings updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update warning notice");
    } finally {
      setSavingAction(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminName) {
      toast.error("Please fill in email and name");
      return;
    }
    try {
      setSavingAction(true);

      const res = await fetch("/api/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAdminEmail.trim().toLowerCase(),
          displayName: newAdminName.trim(),
          businessName: newAdminBusiness.trim() || "Business Administrator",
          password: newAdminPassword || "OsvidAdmin2026!",
          phoneNumber: newAdminPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create administrator");
      }

      toast.success(`New Business Administrator "${newAdminName}" created successfully!`);
      setIsAddAdminOpen(false);
      setNewAdminEmail("");
      setNewAdminName("");
      setNewAdminPhone("");
      setNewAdminPassword("OsvidAdmin2026!");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create administrator");
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleAdminStatus = async (adm: UserProfile) => {
    try {
      const newStatus = !adm.isActive;
      await fetch("/api/admin/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: adm.uid, isActive: newStatus }),
      });
      await toggleUserStatus(adm.uid, newStatus);
      toast.success(`Admin status updated to ${newStatus ? "Active" : "Disabled"}`);
      setAdmins((prev) =>
        prev.map((a) => (a.uid === adm.uid ? { ...a, isActive: newStatus } : a))
      );
    } catch (e: any) {
      toast.error("Failed to change admin status");
    }
  };

  const handleDeleteAdmin = async (adm: UserProfile) => {
    if (!confirm(`Are you sure you want to delete administrator account for ${adm.displayName}?`)) {
      return;
    }
    try {
      await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: adm.uid }),
      });
      toast.success(`Admin ${adm.displayName} deleted successfully`);
      setAdmins((prev) => prev.filter((a) => a.uid !== adm.uid));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete admin");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="space-y-8">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-purple-800/30">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Crown size={14} className="text-amber-400" />
                Super Admin Governance Hub
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Enterprise &amp; Tenant Governance
              </h1>
              <p className="text-purple-200/80 text-sm mt-1 max-w-2xl">
                High-level business oversight, infrastructure health, tenant admin administration, and hosting lifecycle control.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs font-semibold gap-2 rounded-xl"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>Refresh Telemetry</span>
              </Button>

              <Button
                onClick={() => setIsSuspendModalOpen(true)}
                className={`font-bold text-xs gap-2 rounded-xl shadow-lg ${
                  subscription?.isSuspended
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                    : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                }`}
              >
                <Power size={14} />
                <span>{subscription?.isSuspended ? "Reactivate Business Portal" : "Suspend Business Portal"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Business Status & Warning Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hosting Status Card */}
          <div className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${
            subscription?.isSuspended
              ? "bg-red-500/10 border-red-500/30 text-red-900"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950"
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                subscription?.isSuspended ? "bg-red-500 text-white" : "bg-emerald-600 text-white"
              }`}>
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Business Tenant Status</p>
                <h3 className="text-base font-extrabold flex items-center gap-2 text-slate-900">
                  {subscription?.businessName || "OSVID Chemicals Ltd"}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    subscription?.isSuspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {subscription?.isSuspended ? "Suspended" : "Live & Operational"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plan: <span className="font-semibold text-slate-700 uppercase">{subscription?.hostingPlan}</span> &bull; Renewal: {subscription?.hostingExpiryDate ? new Date(subscription.hostingExpiryDate).toLocaleDateString() : "Active"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSuspendModalOpen(true)}
              className="text-xs font-semibold rounded-xl bg-white"
            >
              Configure Status
            </Button>
          </div>

          {/* Renewal / Warning Broadcast Card */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <Bell size={24} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hosting Billing Broadcast</p>
                <h3 className="text-base font-extrabold flex items-center gap-2 text-slate-900">
                  Renewal Notification
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    subscription?.showWarning ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {subscription?.showWarning ? "Broadcasting to Admins" : "Muted"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                  {subscription?.showWarning ? subscription.warningNotice : "No active warning shown to tenant admins."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWarningModalOpen(true)}
              className="text-xs font-semibold rounded-xl bg-white"
            >
              Broadcast Alert
            </Button>
          </div>
        </div>

        {/* High-Level Executive Stats */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Activity size={20} className="text-purple-600" />
              Executive Business Telemetry
            </h2>
            <span className="text-xs text-slate-500 font-medium">Auto-aggregated across all store operations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Gross Sales</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ₦
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{formatNaira(stats.grossRevenue)}</h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">From {stats.paidOrders} confirmed orders</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Orders Volume</span>
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{stats.totalOrders}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Processed on storefront</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Admins &amp; Managers</span>
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Users size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{stats.activeAdmins + stats.activeManagers}</h3>
              <p className="text-xs text-purple-600 font-medium mt-1">
                {stats.activeAdmins} Admins &bull; {stats.activeManagers} Managers
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">System Infrastructure</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Server size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{stats.systemHealth}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Uptime: {stats.serverUptime}</p>
            </div>
          </div>
        </div>

        {/* Business Administrators Management Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" />
                Tenant Business Administrators
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                The primary business operators. Tenant Admins have full control over day-to-day products, orders, and managers with no visibility into Super Admin oversight.
              </p>
            </div>

            <Button
              onClick={() => setIsAddAdminOpen(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-xl gap-2 shadow-sm"
            >
              <Plus size={16} />
              <span>Create Business Admin</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Administrator</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Scope</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      No designated business admin accounts found.
                    </td>
                  </tr>
                ) : (
                  admins.map((adm) => (
                    <tr key={adm.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm">
                            {adm.displayName?.charAt(0).toUpperCase() || "A"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{adm.displayName}</p>
                            <p className="text-[11px] text-slate-400">UID: {adm.uid.slice(0, 12)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{adm.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                          Business Admin
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                          adm.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${adm.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                          {adm.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAdminStatus(adm)}
                            className={`text-xs font-semibold rounded-lg ${
                              adm.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {adm.isActive ? "Suspend Admin" : "Activate Admin"}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAdmin(adm)}
                            className="text-xs text-red-600 hover:bg-red-50 rounded-lg p-1.5"
                            title="Delete Administrator Account"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suspend / Reactivate Modal */}
        <Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900">
                {subscription?.isSuspended ? "Reactivate Business Portal" : "Suspend Business Portal"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                {subscription?.isSuspended
                  ? "Reactivating will restore instant access to all Admins, Managers, and business operations."
                  : "Suspending will block all Admins and Managers from accessing the dashboard with a payment/hosting renewal barrier."}
              </DialogDescription>
            </DialogHeader>

            {!subscription?.isSuspended && (
              <div className="space-y-4 my-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase">Suspension Reason / Message</Label>
                  <Input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="e.g. Hosting subscription past due."
                    className="mt-1 h-10 rounded-xl"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This message will be shown on the lockout screen when admins try to log in.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setIsSuspendModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleToggleBusinessSuspension}
                disabled={savingAction}
                className={`text-xs font-bold rounded-xl text-white ${
                  subscription?.isSuspended ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {savingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : subscription?.isSuspended ? (
                  "Confirm Reactivation"
                ) : (
                  "Confirm Suspension"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Broadcast Warning Alert Modal */}
        <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900">
                Broadcast Renewal Notice
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Send a renewal reminder banner at the top of the Admin dashboard before payment is due.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveWarningNotice} className="space-y-4 my-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-900">Display Warning Banner</p>
                  <p className="text-[11px] text-slate-500">Show notification banner on Admin dashboard</p>
                </div>
                <input
                  type="checkbox"
                  checked={showWarningToggle}
                  onChange={(e) => setShowWarningToggle(e.target.checked)}
                  className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Warning Notice Content</Label>
                <textarea
                  value={warningText}
                  onChange={(e) => setWarningText(e.target.value)}
                  rows={3}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="e.g. Hosting renewal due in 14 days."
                />
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWarningModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAction}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl"
                >
                  {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Broadcast"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Business Admin Modal */}
        <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Shield className="text-purple-600 w-5 h-5" />
                Create Business Admin
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Appoint a primary business administrator for the store. They will manage products, orders, and managers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5 my-2">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Administrator Full Name *</Label>
                <Input
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Adebayo Adeola"
                  required
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Business / Branch Name</Label>
                <Input
                  value={newAdminBusiness}
                  onChange={(e) => setNewAdminBusiness(e.target.value)}
                  placeholder="e.g. OSVID Chemicals Lagos"
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Admin Login Email *</Label>
                <Input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="e.g. adebayoadmin@osvidchemicals.com"
                  required
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Admin Initial Password *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showAdminPassword ? "text" : "password"}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="e.g. OsvidAdmin2026!"
                    required
                    className="pr-10 h-10 rounded-xl font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Phone Number</Label>
                <Input
                  type="tel"
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  placeholder="e.g. +234 803 000 0000"
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddAdminOpen(false)}
                  disabled={savingAction}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAction}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-700/20"
                >
                  {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Provision Admin"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
