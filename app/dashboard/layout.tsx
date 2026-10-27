"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SuspensionBarrier from "@/components/auth/SuspensionBarrier";
import { getSubscriptionStatus } from "@/lib/firebase/subscription";
import { BusinessSubscription, normalizeManagerPermissions } from "@/types/auth";
import { isSuperAdminEmail } from "@/lib/firebase/auth";
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
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }
  const router = useRouter();
  const { user, userProfile, role, logout, isSuperAdmin, isAdmin } = useAuth();

  const isSuperAdminUser = Boolean(
    isSuperAdmin ||
    role === "super_admin" ||
    userProfile?.role === "super_admin" ||
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(userProfile?.email)
  );

  useEffect(() => {
    async function checkSub() {
      const res = await getSubscriptionStatus();
      if (res.success && res.data) {
        setSubscription(res.data as any);
      }
    }
    checkSub();
  }, []);

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

  const rawPerms = userProfile?.permissions;
  const perms = rawPerms ? normalizeManagerPermissions(rawPerms) : undefined;

  interface NavItem {
    title: string;
    href: string;
    icon: any;
    allowed: boolean;
    badge?: string;
    accent?: boolean;
  }

  // Build granular navigation items strictly separated by role
  const navItems: NavItem[] = isSuperAdminUser
    ? [
        {
          title: "Governance",
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
          title: "Orders & Shipping",
          href: "/dashboard/orders",
          icon: ShoppingBag,
          allowed: isAdmin || Boolean(perms?.canManageOrders),
        },
        {
          title: "Products & Stock",
          href: "/dashboard/products",
          icon: Package,
          allowed: isAdmin || Boolean(perms?.canManageProducts) || Boolean(perms?.canManageInventory),
        },
        {
          title: "Customers",
          href: "/dashboard/customers",
          icon: UserCheck,
          allowed: isAdmin || Boolean(perms?.canManageCustomers),
        },
        {
          title: "Discounts & Promos",
          href: "/dashboard/discounts",
          icon: Tag,
          allowed: isAdmin || Boolean(perms?.canManageDiscounts),
        },
        {
          title: "Website Editor",
          href: "/dashboard/website-editor",
          icon: Sparkles,
          allowed: isAdmin || Boolean(perms?.canManageWebsite),
          badge: "Editor",
        },
        {
          title: "Staff & Managers",
          href: "/dashboard/managers",
          icon: Users,
          allowed: isAdmin,
          badge: "Admin",
        },
        {
          title: "Financial Reports",
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

  const isSuspendedForUser = Boolean(subscription?.isSuspended && !isSuperAdminUser);

  // Super Admin dedicated view
  if (isSuperAdminUser || pathname.startsWith("/dashboard/super-admin")) {
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
          <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
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
              <Link href="/products" target="_blank">
                <Button
                  size="sm"
                  className="h-8 px-2.5 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Storefront</span>
                </Button>
              </Link>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${roleInfo.bg} flex items-center gap-1 whitespace-nowrap`}>
                <RoleIcon size={12} />
                <span className="truncate max-w-[90px]">{roleInfo.label}</span>
              </span>
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition-colors"
                aria-label="Toggle navigation drawer"
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </header>

          {/* Mobile Backdrop Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 h-dvh lg:h-screen shadow-xl lg:shadow-none overflow-hidden ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Scrollable Nav Content */}
            <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Brand Header */}
              <div className="flex items-center justify-between mb-5 px-1">
                <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center">
                  <Image
                    src="/images/logo.webp"
                    alt="OSVID Chemicals"
                    width={130}
                    height={38}
                    className="h-8 w-auto object-contain"
                  />
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* User Profile Card - Flat & Compact */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md font-bold flex items-center justify-center text-xs bg-slate-900 text-white shrink-0">
                    {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate whitespace-nowrap">
                      {userProfile?.displayName || "Operations User"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                      {userProfile?.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${roleInfo.bg} flex items-center gap-1 whitespace-nowrap`}>
                    <RoleIcon size={11} />
                    <span className="truncate max-w-[110px]">{roleInfo.label}</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
              </div>

              {/* Navigation Links - Single line guaranteed */}
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-2.5 mb-1.5">
                  Menu
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
                      className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors whitespace-nowrap ${
                        isActive
                          ? "bg-slate-900 text-white font-medium"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          size={16}
                          className={isActive ? "text-white shrink-0" : "text-slate-500 shrink-0"}
                        />
                        <span className="truncate whitespace-nowrap">{item.title}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 whitespace-nowrap ml-2 ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
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
            <div className="p-3 border-t border-slate-200 space-y-1.5 bg-white shrink-0">
              <Link
                href="/products"
                target="_blank"
                className="flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink size={14} className="text-slate-500 shrink-0" />
                  <span className="truncate whitespace-nowrap">Visit Storefront</span>
                </div>
                <ChevronRight size={13} className="text-slate-400 shrink-0" />
              </Link>

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-medium h-8.5 rounded-md gap-2 px-2.5 whitespace-nowrap cursor-pointer"
              >
                <LogOut size={15} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Sign Out</span>
              </Button>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
            {/* Desktop Top Header Bar - Flat & Professional */}
            <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-3 items-center justify-between sticky top-0 z-30 shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-slate-400">OSVID Hub</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-800 font-semibold capitalize">
                  {pathname === "/dashboard"
                    ? "Overview"
                    : pathname.replace("/dashboard/", "").replace(/-/g, " ")}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/products" target="_blank">
                  <Button
                    size="sm"
                    className="h-8.5 px-3.5 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 cursor-pointer shadow-none"
                  >
                    <ExternalLink size={13} />
                    <span>Visit Storefront</span>
                  </Button>
                </Link>
                <div className="h-4 w-px bg-slate-200" />
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${roleInfo.bg} flex items-center gap-1.5 whitespace-nowrap`}>
                  <RoleIcon size={12} />
                  <span>{roleInfo.label}</span>
                </span>
              </div>
            </header>

            <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full flex-1">
              {/* Warning banner broadcast if active */}
              {subscription?.showWarning && subscription.warningNotice && !isSuperAdmin && (
                <div className="mb-6 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Hosting Billing Alert</p>
                      <p className="text-xs font-normal mt-0.5">{subscription.warningNotice}</p>
                    </div>
                  </div>
                  <a
                    href="mailto:billing@osvidchemicals.com?subject=Hosting%20Renewal%20Settlement"
                    className="shrink-0"
                  >
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md h-8">
                      Contact Billing
                    </Button>
                  </a>
                </div>
              )}

              {children}
            </main>
          </div>
          <Toaster richColors position="top-right" />
        </div>
      )}
    </ProtectedRoute>
  );
}
