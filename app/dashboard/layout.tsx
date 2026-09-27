"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SuspensionBarrier from "@/components/auth/SuspensionBarrier";
import { getSubscriptionStatus } from "@/lib/firebase/subscription";
import { BusinessSubscription } from "@/types/auth";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  BarChart3,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Shield,
  Crown,
  Briefcase,
  ChevronRight,
  Sparkles,
  Tag,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, role, logout, isSuperAdmin, isAdmin } = useAuth();

  useEffect(() => {
    async function checkSub() {
      const res = await getSubscriptionStatus();
      if (res.success && res.data) {
        setSubscription(res.data as any);
      }
    }
    checkSub();
  }, []);

  // Close sidebar on pathname change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll on mobile when sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [sidebarOpen]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const perms = userProfile?.permissions;

  interface NavItem {
    title: string;
    href: string;
    icon: any;
    allowed: boolean;
    badge?: string;
    accent?: boolean;
  }

  // Build granular navigation items strictly separated by role
  const navItems: NavItem[] = isSuperAdmin
    ? [
        {
          title: "Enterprise Governance",
          href: "/dashboard/super-admin",
          icon: Crown,
          allowed: true,
          badge: "Executive",
          accent: true,
        },
      ]
    : [
        {
          title: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
          allowed: true,
        },
        {
          title: "Managers & Roles",
          href: "/dashboard/managers",
          icon: Users,
          allowed: isAdmin,
          badge: "Admin",
        },
        {
          title: "Products & Stock",
          href: "/dashboard/products",
          icon: Package,
          allowed: isAdmin || Boolean(perms?.canManageProducts),
        },
        {
          title: "Orders & Fulfillment",
          href: "/dashboard/orders",
          icon: ShoppingBag,
          allowed: isAdmin || Boolean(perms?.canManageOrders),
        },
        {
          title: "Customer Directory",
          href: "/dashboard/customers",
          icon: UserCheck,
          allowed: isAdmin || Boolean(perms?.canManageCustomers),
        },
        {
          title: "Discounts & Coupons",
          href: "/dashboard/discounts",
          icon: Tag,
          allowed: isAdmin || Boolean(perms?.canManageDiscounts),
        },
        {
          title: "Website Content Builder",
          href: "/dashboard/website-editor",
          icon: Sparkles,
          allowed: isAdmin || Boolean(perms?.canManageWebsite),
          badge: "Builder",
        },
        {
          title: "Financials & Analytics",
          href: "/dashboard/financials",
          icon: BarChart3,
          allowed: isAdmin || Boolean(perms?.canViewFinancials),
          badge: "Admin",
        },
      ];

  const visibleNav = navItems.filter((item) => item.allowed);

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return {
        label: "Super Admin",
        icon: Crown,
        bg: "bg-purple-100 text-purple-800 border-purple-200",
      };
    }
    if (role === "admin") {
      return {
        label: "Administrator",
        icon: Shield,
        bg: "bg-blue-100 text-blue-800 border-blue-200",
      };
    }
    if (role === "manager") {
      return {
        label: userProfile?.customTitle || "Operations Manager",
        icon: Briefcase,
        bg: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    return {
      label: "Customer",
      icon: Shield,
      bg: "bg-gray-100 text-gray-800 border-gray-200",
    };
  };

  const roleInfo = getRoleBadge();
  const RoleIcon = roleInfo.icon;

  const isSuspendedForUser = Boolean(subscription?.isSuspended && !isSuperAdmin);

  // Super Admin dedicated view
  if (isSuperAdmin || pathname.startsWith("/dashboard/super-admin")) {
    return (
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-orange-600 selection:text-white">
          {children}
          <Toaster richColors position="top-right" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      {isSuspendedForUser ? (
        <SuspensionBarrier subscription={subscription} />
      ) : (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800">
          {/* Mobile Top App Bar */}
          <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/images/logo.webp"
                alt="OSVID Logo"
                width={120}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleInfo.bg} flex items-center gap-1`}>
                <RoleIcon size={12} />
                <span className="truncate max-w-[100px]">{roleInfo.label}</span>
              </span>
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="p-2 rounded-xl hover:bg-orange-50 text-slate-700 hover:text-orange-600 transition-colors"
                aria-label="Toggle navigation drawer"
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </header>

          {/* Mobile Backdrop Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 h-dvh lg:h-screen shadow-2xl lg:shadow-none overflow-hidden ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Scrollable Nav Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
              {/* Brand Header */}
              <div className="flex items-center justify-between mb-6">
                <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center">
                  <Image
                    src="/images/logo.webp"
                    alt="OSVID Chemicals"
                    width={140}
                    height={42}
                    className="h-9 w-auto object-contain"
                  />
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Profile Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 mb-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl font-bold flex items-center justify-center text-sm shadow-xs shrink-0 ${
                      isSuperAdmin
                        ? "bg-gradient-to-tr from-purple-700 to-indigo-600 text-white"
                        : "bg-gradient-to-tr from-orange-600 to-amber-500 text-white"
                    }`}
                  >
                    {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {userProfile?.displayName || "Operations User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {userProfile?.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.bg} flex items-center gap-1`}>
                    <RoleIcon size={12} />
                    <span className="truncate max-w-[120px]">{roleInfo.label}</span>
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-3 mb-2">
                  Management Modules
                </p>
                {visibleNav.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                        isActive
                          ? item.accent
                            ? "bg-purple-700 text-white shadow-md shadow-purple-700/20 font-semibold"
                            : "bg-orange-600 text-white shadow-md shadow-orange-600/20 font-semibold"
                          : item.accent
                          ? "text-purple-700 hover:bg-purple-50 font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          size={18}
                          className={
                            isActive
                              ? "text-white"
                              : item.accent
                              ? "text-purple-600"
                              : "text-slate-500"
                          }
                        />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isActive
                              ? "bg-white/20 text-white"
                              : item.accent
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 space-y-2 bg-white shrink-0">
              <Link
                href="/"
                target="_blank"
                className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink size={15} />
                  <span>View Live Storefront</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </Link>

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-medium h-9 rounded-xl gap-2"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </Button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl">
            {/* Warning banner broadcast if active */}
            {subscription?.showWarning && subscription.warningNotice && !isSuperAdmin && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Hosting Billing Alert</p>
                    <p className="text-xs font-medium mt-0.5">{subscription.warningNotice}</p>
                  </div>
                </div>
                <a
                  href="mailto:billing@osvidchemicals.com?subject=Hosting%20Renewal%20Settlement"
                  className="shrink-0"
                >
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl h-8">
                    Contact Billing
                  </Button>
                </a>
              </div>
            )}

            {children}
          </main>
          <Toaster richColors position="top-right" />
        </div>
      )}
    </ProtectedRoute>
  );
}
