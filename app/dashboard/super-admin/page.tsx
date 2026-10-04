"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/client";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getExecutiveGovernanceStats,
  getTenantAdministrators,
  saveUserProfile,
  toggleUserStatus,
} from "@/lib/firebase/firestore";
import {
  getSubscriptionStatus,
  updateSubscriptionSettings,
  toggleAppSuspension,
  SubscriptionStatusInfo,
} from "@/lib/firebase/subscription";
import { UserProfile } from "@/types/auth";
import {
  Crown,
  Shield,
  LayoutDashboard,
  Users,
  BellRing,
  Power,
  RefreshCw,
  Calendar,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  Search,
  ShoppingBag,
  Package,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Menu,
  X,
  Radio,
  Loader2,
  Server,
  ArrowRight,
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

type SuperAdminTab = "overview" | "tenant-admins" | "notifications" | "lease-control";

export default function SuperAdminDashboard() {
  const { userProfile, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live Stats & Directory State
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
  const [searchQuery, setSearchQuery] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState(false);

  // Tab 2: Modals
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<UserProfile | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminPhone, setEditAdminPhone] = useState("");
  const [editAdminBusiness, setEditAdminBusiness] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  // New Admin Form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminBusiness, setNewAdminBusiness] = useState("Tenant Store Account");
  const [newAdminPassword, setNewAdminPassword] = useState("OsvidAdmin2026!");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newAdminPhone, setNewAdminPhone] = useState("");

  // Tab 3: Notification Broadcast State
  const [showWarningToggle, setShowWarningToggle] = useState(false);
  const [warningText, setWarningText] = useState(
    "Hosting renewal due soon. Please settle your account to prevent service interruption."
  );

  // Tab 4: Lease & Killswitch State
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("Annual hosting and licensing subscription is past due.");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [newRenewalAmount, setNewRenewalAmount] = useState(250000);
  const [newGracePeriod, setNewGracePeriod] = useState(7);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Live Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [kpis, adminList, subRes] = await Promise.all([
        getExecutiveGovernanceStats(),
        getTenantAdministrators(),
        getSubscriptionStatus(),
      ]);
      setStats(kpis);
      setAdmins(adminList);

      if (subRes.success && subRes.data) {
        setSubscription(subRes.data);
        setShowWarningToggle(subRes.data.showWarning);
        setWarningText(subRes.data.warningNotice || warningText);
        setSuspendReason(subRes.data.suspendedReason || suspendReason);
        setNewExpiryDate(
          subRes.data.hostingExpiryDate
            ? new Date(subRes.data.hostingExpiryDate).toISOString().split("T")[0]
            : ""
        );
        setNewRenewalAmount(subRes.data.renewalAmountNgn || 250000);
        setNewGracePeriod(subRes.data.gracePeriodDays || 7);
      }
    } catch (err: any) {
      console.error("Error loading super admin governance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Signed out of Super Admin dashboard.");
      router.push("/login");
    } catch (e: any) {
      toast.error("Failed to sign out");
    }
  };

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // ==========================================
  // TAB 2 ACTIONS: TENANT ADMIN MANAGEMENT
  // ==========================================
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminName) {
      toast.error("Please enter email and full name");
      return;
    }
    try {
      setSavingAction(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required to create administrator");
      }

      const res = await fetch("/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newAdminEmail.trim().toLowerCase(),
          displayName: newAdminName.trim(),
          businessName: newAdminBusiness.trim() || "Tenant Store Account",
          password: newAdminPassword || "OsvidAdmin2026!",
          phoneNumber: newAdminPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create administrator");
      }

      if (data.user) {
        setAdmins((prev) => [data.user, ...prev.filter((a) => a.uid !== data.user.uid)]);
        try {
          await saveUserProfile(data.user);
        } catch (syncErr) {
          console.warn("Client fallback user profile sync warning:", syncErr);
        }
      }

      toast.success(`Tenant Store Account "${newAdminName}" created with full administrative permissions!`);
      setIsAddAdminOpen(false);
      setNewAdminEmail("");
      setNewAdminName("");
      setNewAdminPhone("");
      setNewAdminBusiness("Tenant Store Account");
      setNewAdminPassword("OsvidAdmin2026!");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create administrator");
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenEditAdmin = (adm: UserProfile) => {
    setSelectedAdmin(adm);
    setEditAdminName(adm.displayName || "");
    setEditAdminEmail(adm.email || "");
    setEditAdminPhone(adm.phoneNumber || "");
    setEditAdminBusiness(adm.customTitle || "Tenant Store Account");
    setEditAdminPassword("");
    setIsEditAdminOpen(true);
  };

  const handleSaveAdminUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    try {
      setSavingAction(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required to update administrator");
      }

      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: selectedAdmin.uid,
          email: editAdminEmail.trim().toLowerCase(),
          displayName: editAdminName.trim(),
          phoneNumber: editAdminPhone.trim(),
          businessName: editAdminBusiness.trim() || "Tenant Store Account",
          password: editAdminPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update tenant admin");
      }

      toast.success(`Administrator details for "${editAdminName}" updated successfully!`);
      setIsEditAdminOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to update admin credentials");
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleAdminStatus = async (adm: UserProfile) => {
    try {
      const newStatus = !adm.isActive;
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required to alter admin status");
      }

      const res = await fetch("/api/admin/toggle-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: adm.uid, isActive: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to change admin status");
      }

      await toggleUserStatus(adm.uid, newStatus);
      toast.success(`Tenant Admin status changed to ${newStatus ? "Active" : "Disabled"}`);
      setAdmins((prev) =>
        prev.map((a) => (a.uid === adm.uid ? { ...a, isActive: newStatus } : a))
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to change admin status");
    }
  };

  const handleDeleteAdmin = async (adm: UserProfile) => {
    if (!confirm(`Are you sure you want to delete administrator account for "${adm.displayName}"?`)) {
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required to delete admin");
      }

      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: adm.uid }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete admin");
      }

      toast.success(`Admin "${adm.displayName}" deleted successfully`);
      setAdmins((prev) => prev.filter((a) => a.uid !== adm.uid));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete admin");
    }
  };

  // ==========================================
  // TAB 3 ACTIONS: WARNING BROADCAST
  // ==========================================
  const handleApplyWarningTemplate = (templateType: "7days" | "14days" | "grace" | "maintenance") => {
    if (templateType === "7days") {
      setWarningText("URGENT: Annual hosting subscription renewal is due in 7 days. Please settle your account to prevent service interruption.");
      setShowWarningToggle(true);
    } else if (templateType === "14days") {
      setWarningText("NOTICE: Annual hosting renewal due in 14 days. Please arrange payment with your platform provider.");
      setShowWarningToggle(true);
    } else if (templateType === "grace") {
      setWarningText("CRITICAL: Account is in a 7-day grace period. Application features will be locked unless payment is confirmed.");
      setShowWarningToggle(true);
    } else if (templateType === "maintenance") {
      setWarningText("Scheduled system infrastructure maintenance will occur tonight at 02:00 AM WAT. Storefront will remain operational.");
      setShowWarningToggle(true);
    }
  };

  const handleSaveWarningNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAction(true);
      const res = await updateSubscriptionSettings({
        showWarning: showWarningToggle,
        warningNotice: warningText.trim(),
      });

      if (!res.success) {
        toast.error(res.error || "Failed to save warning broadcast settings.");
        return;
      }

      await loadData();
      toast.success("Warning broadcast settings saved successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update warning notice");
    } finally {
      setSavingAction(false);
    }
  };

  // ==========================================
  // TAB 4 ACTIONS: LEASE & KILLSWITCH
  // ==========================================
  const handleSaveLicenseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpiryDate) {
      toast.error("Please select a valid expiry date");
      return;
    }

    try {
      setSavingAction(true);
      const isoDate = new Date(newExpiryDate).toISOString();

      const res = await updateSubscriptionSettings({
        hostingExpiryDate: isoDate,
        renewalAmountNgn: Number(newRenewalAmount) || 250000,
        gracePeriodDays: Number(newGracePeriod) || 7,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update license parameters.");
        return;
      }

      await loadData();
      toast.success("Annual lease parameters updated successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update subscription parameters.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleQuickExtendLicense = async (days: number) => {
    try {
      setSavingAction(true);
      const baseDate = subscription?.hostingExpiryDate
        ? new Date(subscription.hostingExpiryDate)
        : new Date();
      const extendedDate = new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * days).toISOString();

      const res = await updateSubscriptionSettings({
        hostingExpiryDate: extendedDate,
        isSuspended: false,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to extend license.");
        return;
      }

      await loadData();
      toast.success(`Annual lease extended by +${days} days!`);
    } catch (e: any) {
      toast.error(e.message || "Database action failed.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleBusinessSuspension = async () => {
    if (!subscription) return;
    try {
      setSavingAction(true);
      const targetSuspended = !subscription.isSuspended;

      const res = await toggleAppSuspension(targetSuspended, suspendReason);

      if (!res.success) {
        toast.error(res.error || "Failed to update suspension flag.");
        return;
      }

      setIsSuspendModalOpen(false);
      await loadData();

      if (targetSuspended) {
        toast.error("KILLSWITCH ACTIVE: Business application has been suspended.");
      } else {
        toast.success("Business application has been reactivated.");
      }
    } catch (e: any) {
      toast.error(e.message || "Action timed out or failed.");
    } finally {
      setSavingAction(false);
    }
  };

  const filteredAdmins = admins.filter((adm) => {
    if (!adm) return false;
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return true;
    const name = (adm.displayName || "").toLowerCase();
    const email = (adm.email || "").toLowerCase();
    const title = (adm.customTitle || "").toLowerCase();
    const phone = (adm.phoneNumber || "").toLowerCase();
    const role = (adm.role || "").toLowerCase();
    const uid = (adm.uid || "").toLowerCase();
    return (
      name.includes(q) ||
      email.includes(q) ||
      title.includes(q) ||
      phone.includes(q) ||
      role.includes(q) ||
      uid.includes(q)
    );
  });

  const navTabs = [
    {
      id: "overview" as SuperAdminTab,
      label: "Overview & Telemetry",
      icon: LayoutDashboard,
      badge: "Live",
    },
    {
      id: "tenant-admins" as SuperAdminTab,
      label: "Tenant Admin Directory",
      icon: Users,
      badge: `${admins.length}`,
    },
    {
      id: "notifications" as SuperAdminTab,
      label: "Warning Broadcast Center",
      icon: BellRing,
      badge: showWarningToggle ? "Active" : undefined,
    },
    {
      id: "lease-control" as SuperAdminTab,
      label: "Lease & App Kill-Switch",
      icon: Power,
      badge: subscription?.isSuspended ? "LOCKED" : "ACTIVE",
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
        {/* ============================================================ */}
        {/* MOBILE TOP BAR */}
        {/* ============================================================ */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block leading-tight">OSVID Super Admin</span>
              <span className="text-[11px] text-slate-500 block">Landlord Control Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold h-8 rounded-lg gap-1"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DESKTOP & MOBILE SIDEBAR */}
        {/* ============================================================ */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full overflow-y-auto p-5">
            {/* Logo & Brand Header */}
            <div className="mb-6 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/20">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1">
                      <span>OSVID</span>
                      <span className="text-orange-600">HUB</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">Super Admin Console</p>
                  </div>
                </Link>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Pill */}
              <div className="mt-4 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${subscription?.isSuspended ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
                  <span className="text-slate-600 font-semibold">Tenant App Status</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    subscription?.isSuspended
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {subscription?.isSuspended ? "Suspended" : "Active"}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-1.5 flex-1">
              <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400 px-3 mb-2">
                Landlord Modules
              </p>
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-orange-600 text-white font-bold shadow-md shadow-orange-600/20"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={18}
                        className={isActive ? "text-white" : "text-slate-400"}
                      />
                      <span className="text-xs">{tab.label}</span>
                    </div>

                    {tab.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* User Profile & Sign Out Button */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-xs">
                  AE
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">Abolarinwa Emmanuel</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">abolarinwaemmanuelfree@gmail.com</p>
                </div>
              </div>

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <LogOut size={16} />
                <span>Sign Out of Dashboard</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* MAIN DASHBOARD CANVAS */}
        {/* ============================================================ */}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-slate-50">
          {/* Top Header Bar */}
          <header className="bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-40">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>Landlord Control</span>
                <span>/</span>
                <span className="text-orange-600 font-bold">
                  {navTabs.find((t) => t.id === activeTab)?.label}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                {activeTab === "overview" && "Business Telemetry & Performance"}
                {activeTab === "tenant-admins" && "Tenant Administrator Directory"}
                {activeTab === "notifications" && "Tenant Warning & Notice Broadcast"}
                {activeTab === "lease-control" && "Annual Lease Terms & Kill-Switch"}
              </h2>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
                <Clock size={14} className="text-orange-600" />
                <span>{currentTime || "Loading..."}</span>
              </div>

              <Link href="/" target="_blank">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-700 text-xs font-semibold gap-1.5 rounded-xl h-9 bg-white hover:bg-slate-50"
                >
                  <ExternalLink size={14} />
                  <span>Storefront</span>
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="text-slate-700 text-xs font-semibold gap-1.5 rounded-xl h-9 bg-white hover:bg-slate-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-orange-600" : "text-slate-500"} />
                <span>Refresh DB</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsSuspendModalOpen(true)}
                className={`font-bold text-xs gap-1.5 rounded-xl h-9 shadow-sm ${
                  subscription?.isSuspended
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                <Power size={14} />
                <span>{subscription?.isSuspended ? "Reactivate App" : "Killswitch"}</span>
              </Button>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="p-6 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
            {/* ============================================================ */}
            {/* TAB 1: OVERVIEW & BUSINESS TELEMETRY */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* 4 Clean KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Gross Revenue */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Tenant Gross Sales
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        ₦
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatNaira(stats.grossRevenue)}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>Direct Paystack verified sales</span>
                    </p>
                  </div>

                  {/* Total Orders */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Total Orders
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        <ShoppingBag size={18} />
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {stats.totalOrders}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-bold text-orange-600">{stats.paidOrders}</span> paid orders
                    </p>
                  </div>

                  {/* Active Products */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Products Listed
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Package size={18} />
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {stats.totalProducts}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Active chemical items in catalog</p>
                  </div>

                  {/* Customers */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Customer Accounts
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <UserCheck size={18} />
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {stats.totalCustomers}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Registered buyers in directory</p>
                  </div>
                </div>

                {/* 2 Clean Summary & Quick Action Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* SaaS Lease Summary */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                      <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Calendar size={18} className="text-orange-600" />
                        SaaS Subscription Status
                      </h4>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                        {subscription?.daysRemaining ?? 365} Days Remaining
                      </span>
                    </div>

                    <div className="space-y-3 text-xs text-slate-700">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Annual Expiration Date:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {subscription?.hostingExpiryDate
                            ? new Date(subscription.hostingExpiryDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "1 Year Active"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Annual Renewal Fee:</span>
                        <span className="font-bold text-emerald-600 font-mono">
                          {formatNaira(subscription?.renewalAmountNgn || 250000)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Grace Period:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {subscription?.gracePeriodDays ?? 7} Days
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">Lockout Authority:</span>
                        <span className="font-bold text-red-600">Super Admin Kill-Switch</span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100">
                      <Button
                        onClick={() => setActiveTab("lease-control")}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 rounded-xl"
                      >
                        Manage Lease Parameters
                      </Button>
                    </div>
                  </div>

                  {/* Landlord Quick Actions */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Zap size={18} className="text-orange-600" />
                          Landlord Quick Actions
                        </h4>
                        <span className="text-xs font-bold text-slate-400">Direct Actions</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Perform fast operations on tenant credentials, annual terms, and warning banners.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={() => setIsAddAdminOpen(true)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-10 rounded-xl gap-2 shadow-sm"
                      >
                        <Plus size={16} />
                        <span>Provision New Tenant Admin</span>
                      </Button>

                      <Button
                        onClick={() => handleQuickExtendLicense(365)}
                        disabled={savingAction}
                        variant="outline"
                        className="w-full text-slate-700 hover:bg-slate-50 font-bold text-xs h-10 rounded-xl gap-2 border-slate-200"
                      >
                        <Calendar size={15} className="text-orange-600" />
                        <span>+1 Year Term Quick Extend</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 2: TENANT ADMIN DIRECTORY & CREDENTIALS */}
            {/* ============================================================ */}
            {activeTab === "tenant-admins" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                  {/* Search and Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Shield className="text-orange-600 w-5 h-5" />
                          Tenant Business Administrator Accounts
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                          {admins.length} {admins.length === 1 ? "Account" : "Accounts"} in Database
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Inspect all database administrators, modify login credentials, reset passwords, and manage permissions.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search by name, email, phone, UID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-xs w-64"
                        />
                      </div>

                      <Button
                        variant="outline"
                        onClick={loadData}
                        disabled={loading}
                        className="text-xs font-semibold rounded-xl h-10 gap-1.5 bg-white hover:bg-slate-50 border-slate-200"
                      >
                        <RefreshCw size={14} className={loading ? "animate-spin text-orange-600" : "text-slate-500"} />
                        <span>Refresh DB</span>
                      </Button>

                      <Button
                        onClick={() => setIsAddAdminOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-10 gap-2 shadow-sm"
                      >
                        <Plus size={16} />
                        <span>Provision Tenant Store Account</span>
                      </Button>
                    </div>
                  </div>

                  {/* Clean Table */}
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3.5">Administrator</th>
                          <th className="px-4 py-3.5">Login Email & Role</th>
                          <th className="px-4 py-3.5">Store Title & Contact</th>
                          <th className="px-4 py-3.5">Operational Access</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Landlord Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAdmins.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Users size={32} className="text-slate-300" />
                                <p className="font-semibold text-slate-600">
                                  {admins.length === 0
                                    ? "No tenant business administrator accounts found in Firestore."
                                    : "No administrator matches your search query."}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Click &ldquo;Provision Tenant Store Account&rdquo; above to register a new administrator.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredAdmins.map((adm) => (
                            <tr key={adm.uid} className="hover:bg-slate-50/80 transition-colors">
                              {/* Column 1: Admin Identity */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-xs shadow-sm">
                                    {adm.displayName?.charAt(0).toUpperCase() || "A"}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">{adm.displayName || "Unnamed Admin"}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">UID: {adm.uid}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Column 2: Login Email & Role */}
                              <td className="px-4 py-3.5">
                                <p className="font-mono font-medium text-slate-800">{adm.email}</p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                    Role: {adm.role === "admin" ? "Admin (Store Account)" : adm.role || "Admin"}
                                  </span>
                                </div>
                              </td>

                              {/* Column 3: Store Title & Contact */}
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-slate-800">{adm.customTitle || "Tenant Store Account"}</p>
                                <p className="text-[11px] text-slate-500 font-mono">{adm.phoneNumber || "No phone set"}</p>
                              </td>

                              {/* Column 4: Operational Access */}
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Full Store Permissions
                                </span>
                              </td>

                              {/* Column 5: Status */}
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    adm.isActive
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      adm.isActive ? "bg-emerald-600" : "bg-red-600"
                                    }`}
                                  />
                                  {adm.isActive ? "Active" : "Disabled"}
                                </span>
                              </td>

                              {/* Column 6: Landlord Controls */}
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditAdmin(adm)}
                                    className="text-xs font-semibold rounded-lg gap-1.5 bg-white hover:bg-slate-50 border-slate-200 h-8 text-slate-800"
                                  >
                                    <Key size={13} className="text-orange-600" />
                                    <span>Edit Details</span>
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleAdminStatus(adm)}
                                    className={`text-xs font-semibold rounded-lg h-8 ${
                                      adm.isActive
                                        ? "text-amber-700 hover:bg-amber-50"
                                        : "text-emerald-700 hover:bg-emerald-50"
                                    }`}
                                  >
                                    {adm.isActive ? "Disable" : "Enable"}
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAdmin(adm)}
                                    className="text-red-600 hover:bg-red-50 rounded-lg p-1.5 h-8"
                                    title="Delete Administrator"
                                  >
                                    <Trash2 size={14} />
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
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 3: NOTIFICATION & WARNING BROADCAST CENTER */}
            {/* ============================================================ */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                  <div className="mb-5 pb-3 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BellRing className="text-orange-600 w-5 h-5" />
                      Tenant Dashboard Warning Notice Broadcast
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Draft notices or select quick templates to display on top of the tenant Admin&apos;s dashboard.
                    </p>
                  </div>

                  {/* Notice Templates */}
                  <div className="mb-5">
                    <Label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                      Quick Notice Templates
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => handleApplyWarningTemplate("7days")}
                        className="p-3 text-left rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100/70 transition-all text-xs"
                      >
                        <p className="font-bold text-amber-900">7-Day Expiry Notice</p>
                        <p className="text-amber-700 text-[11px] mt-0.5">Urgent renewal reminder</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyWarningTemplate("14days")}
                        className="p-3 text-left rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100/70 transition-all text-xs"
                      >
                        <p className="font-bold text-blue-900">14-Day Advance Notice</p>
                        <p className="text-blue-700 text-[11px] mt-0.5">Standard advance billing reminder</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyWarningTemplate("grace")}
                        className="p-3 text-left rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/70 transition-all text-xs"
                      >
                        <p className="font-bold text-red-900">Grace Period Critical</p>
                        <p className="text-red-700 text-[11px] mt-0.5">Account in final grace window</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyWarningTemplate("maintenance")}
                        className="p-3 text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-xs"
                      >
                        <p className="font-bold text-slate-900">Scheduled Maintenance</p>
                        <p className="text-slate-600 text-[11px] mt-0.5">Routine infrastructure notice</p>
                      </button>
                    </div>
                  </div>

                  {/* Form & Live Preview */}
                  <form onSubmit={handleSaveWarningNotice} className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Broadcast Banner State</p>
                        <p className="text-[11px] text-slate-500">
                          When enabled, this banner is displayed at the top of the tenant Admin&apos;s screen.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold uppercase ${
                            showWarningToggle ? "text-amber-700" : "text-slate-400"
                          }`}
                        >
                          {showWarningToggle ? "Live Broadcast Active" : "Muted"}
                        </span>
                        <input
                          type="checkbox"
                          checked={showWarningToggle}
                          onChange={(e) => setShowWarningToggle(e.target.checked)}
                          className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-700 uppercase">Warning Notice Text</Label>
                      <textarea
                        value={warningText}
                        onChange={(e) => setWarningText(e.target.value)}
                        rows={3}
                        required
                        className="w-full mt-1 p-3 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-xs focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Live Preview Box */}
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        Tenant Screen Preview
                      </Label>
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                            <AlertTriangle size={15} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                              Hosting Billing Alert
                            </p>
                            <p className="text-xs font-medium text-amber-900 mt-0.5">{warningText}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 shrink-0">
                          Tenant View
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={savingAction}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-sm"
                      >
                        {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Broadcast Notice"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 4: LEASE & SUSPENSION CONTROL (KILLSWITCH) */}
            {/* ============================================================ */}
            {activeTab === "lease-control" && (
              <div className="space-y-6">
                {/* Status & Kill-Switch Banner */}
                <div
                  className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${
                    subscription?.isSuspended
                      ? "bg-red-50 border-red-200 text-red-950"
                      : "bg-emerald-50 border-emerald-200 text-emerald-950"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white shadow-sm">
                      <Power size={13} className={subscription?.isSuspended ? "text-red-600" : "text-emerald-600"} />
                      <span>The Landlord Kill-Switch</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {subscription?.isSuspended
                        ? "Tenant Application is currently SUSPENDED & LOCKED"
                        : "Tenant Application is LIVE & OPERATIONAL"}
                    </h3>
                    <p className="text-xs text-slate-600 max-w-xl">
                      {subscription?.isSuspended
                        ? "The tenant Admin and operations managers are locked out of their dashboard with the payment barrier."
                        : "The tenant Admin has full operational access to the storefront and dashboard."}
                    </p>
                  </div>

                  <Button
                    onClick={() => setIsSuspendModalOpen(true)}
                    className={`font-bold text-xs px-5 py-5 rounded-xl shadow-sm shrink-0 ${
                      subscription?.isSuspended
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    <Power size={16} className="mr-1.5" />
                    <span>{subscription?.isSuspended ? "Reactivate Application" : "Trigger Killswitch / Lockout"}</span>
                  </Button>
                </div>

                {/* Lease Settings Form */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                  <div className="mb-5 pb-3 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar size={18} className="text-orange-600" />
                      Annual SaaS Lease Term Settings
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure the annual hosting expiration date, renewal settlement fee, and auto-suspension grace period.
                    </p>
                  </div>

                  {/* Quick Term Extension */}
                  <div className="mb-5">
                    <Label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                      Quick Term Extension
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleQuickExtendLicense(30)}
                        disabled={savingAction}
                        className="h-10 rounded-xl text-xs font-bold hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                      >
                        +30 Days Extension
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleQuickExtendLicense(90)}
                        disabled={savingAction}
                        className="h-10 rounded-xl text-xs font-bold hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                      >
                        +90 Days Extension
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleQuickExtendLicense(365)}
                        disabled={savingAction}
                        className="h-10 rounded-xl text-xs font-bold hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                      >
                        +1 Full Year Extension
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveLicenseSettings} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 uppercase">Exact Expiry Date</Label>
                        <Input
                          type="date"
                          value={newExpiryDate}
                          onChange={(e) => setNewExpiryDate(e.target.value)}
                          required
                          className="mt-1 h-10 bg-white border-slate-200 text-slate-900 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 uppercase">Annual Renewal Fee (NGN)</Label>
                        <Input
                          type="number"
                          value={newRenewalAmount}
                          onChange={(e) => setNewRenewalAmount(Number(e.target.value))}
                          required
                          className="mt-1 h-10 bg-white border-slate-200 text-slate-900 rounded-xl text-xs font-mono"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 uppercase">Grace Period (Days)</Label>
                        <Input
                          type="number"
                          value={newGracePeriod}
                          onChange={(e) => setNewGracePeriod(Number(e.target.value))}
                          min={0}
                          max={30}
                          required
                          className="mt-1 h-10 bg-white border-slate-200 text-slate-900 rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={savingAction}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm h-10 px-6"
                      >
                        {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Lease Settings"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ============================================================ */}
        {/* MODAL: PROVISION NEW TENANT ADMIN */}
        {/* ============================================================ */}
        <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
          <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Crown className="text-orange-600 w-5 h-5" />
                Provision Tenant Store Account
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Appoint a Tenant Store Account with full administrator privileges for store operations.
              </DialogDescription>
            </DialogHeader>

            {/* Permission & Designation Guarantee Banner */}
            <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl my-1 text-xs">
              <div className="flex items-center justify-between font-bold text-orange-900 mb-1">
                <span>Designation: Tenant Store Account</span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] rounded-full uppercase">Admin Role</span>
              </div>
              <p className="text-[11px] text-orange-800 leading-relaxed">
                Automatically granted all operational permissions: Products & Stock, Orders & Fulfillment, Financials, Customers, Discounts, and Website Content.
              </p>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3 my-2">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Administrator Full Name *</Label>
                <Input
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Adebayo Adeola"
                  required
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Account Title / Branch Name</Label>
                <Input
                  value={newAdminBusiness}
                  onChange={(e) => setNewAdminBusiness(e.target.value)}
                  placeholder="e.g. Tenant Store Account"
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
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
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
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
                    className="pr-10 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
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
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4 pt-2">
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
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Tenant Account"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* MODAL: EDIT TENANT ADMIN CREDENTIALS */}
        {/* ============================================================ */}
        <Dialog open={isEditAdminOpen} onOpenChange={setIsEditAdminOpen}>
          <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="text-orange-600 w-5 h-5" />
                Edit Administrator Account Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Modify login email, password, full name, phone number, and store account title under Super Admin authority.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveAdminUpdates} className="space-y-3 my-2">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Administrator Full Name *</Label>
                <Input
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  required
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Login Email Address *</Label>
                <Input
                  type="email"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  required
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Reset Password (Optional)</Label>
                <p className="text-[11px] text-slate-500 mb-1">Enter a new password (min 6 characters) or leave blank to keep unchanged.</p>
                <div className="relative">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    value={editAdminPassword}
                    onChange={(e) => setEditAdminPassword(e.target.value)}
                    placeholder="Enter new password to reset..."
                    className="pr-10 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Phone Number</Label>
                <Input
                  type="tel"
                  value={editAdminPhone}
                  onChange={(e) => setEditAdminPhone(e.target.value)}
                  placeholder="e.g. +234 803 000 0000"
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase">Account Title / Store Branch</Label>
                <Input
                  value={editAdminBusiness}
                  onChange={(e) => setEditAdminBusiness(e.target.value)}
                  placeholder="e.g. Tenant Store Account"
                  className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditAdminOpen(false)}
                  disabled={savingAction}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAction}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  {savingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Updates"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* MODAL: KILLSWITCH CONFIRMATION */}
        {/* ============================================================ */}
        <Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
          <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {subscription?.isSuspended ? "Reactivate Tenant Application" : "Evict / Suspend Tenant App"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                {subscription?.isSuspended
                  ? "Reactivating will restore full dashboard access and storefront operations for the tenant Admin."
                  : "Triggering the killswitch will lock the tenant Admin from their dashboard with the payment barrier."}
              </DialogDescription>
            </DialogHeader>

            {!subscription?.isSuspended && (
              <div className="space-y-3 my-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase">Lockout Reason / Notice</Label>
                  <Input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="e.g. Annual hosting subscription past due."
                    className="mt-1 h-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This notice will be displayed on the lockdown screen.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
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
                  subscription?.isSuspended
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {savingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : subscription?.isSuspended ? (
                  "Confirm Reactivation"
                ) : (
                  "Confirm Eviction & Lockout"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
