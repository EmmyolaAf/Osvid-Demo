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
  Star,
  AlertTriangle,
  ChevronDown,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import TopNavBar from "@/components/dashboard/TopNavBar";

interface NavItem {
  title: string;
  href: string;
  icon: any;
  allowed: boolean;
  badge?: string;
  accent?: boolean;
}

interface NavSection {
  sectionTitle: string;
  items: NavItem[];
}

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

  // Build hierarchical grouped navigation
  const navSections: NavSection[] = isSuperAdminUser
    ? [
        {
          sectionTitle: "Executive Governance",
          items: [
            {
              title: "Governance",
              href: "/dashboard/super-admin",
              icon: Crown,
              allowed: true,
              badge: "Executive",
              accent: true,
            },
            {
              title: "Profile & Settings",
              href: "/dashboard/profile",
              icon: User,
              allowed: true,
            },
          ],
        },
      ]
    : [
        {
          sectionTitle: "Overview",
          items: [
            {
              title: "Dashboard Overview",
              href: "/dashboard",
              icon: LayoutDashboard,
              allowed: true,
            },
          ],
        },
        {
          sectionTitle: "Catalogue",
          items: [
            {
              title: "Products & Stock",
              href: "/dashboard/products",
              icon: Package,
              allowed: isAdmin || Boolean(perms?.canManageProducts) || Boolean(perms?.canManageInventory),
            },
            {
              title: "Product Reviews",
              href: "/dashboard/reviews",
              icon: Star,
              allowed: isAdmin || Boolean(perms?.canManageProducts),
            },
          ],
        },
        {
          sectionTitle: "Pricing & Promotions",
          items: [
            {
              title: "Discounts & Pricing",
              href: "/dashboard/discounts",
              icon: Tag,
              allowed: isAdmin || Boolean(perms?.canManageDiscounts),
            },
          ],
        },
        {
          sectionTitle: "Sales & Operations",
          items: [
            {
              title: "Orders & Shipping",
              href: "/dashboard/orders",
              icon: ShoppingBag,
              allowed: isAdmin || Boolean(perms?.canManageOrders),
            },
            {
              title: "CRM & Inquiries",
              href: "/dashboard/crm",
              icon: Mail,
              allowed: isAdmin || Boolean(perms?.canManageCustomers) || Boolean(perms?.canManageOrders),
              badge: "RFQ",
            },
            {
              title: "Customer Directory",
              href: "/dashboard/customers",
              icon: UserCheck,
              allowed: isAdmin || Boolean(perms?.canManageCustomers),
            },
          ],
        },
        {
          sectionTitle: "Administration",
          items: [
            {
              title: "Financial Analytics",
              href: "/dashboard/financials",
              icon: BarChart3,
              allowed: isAdmin || Boolean(perms?.canViewFinancials),
              badge: "Admin",
            },
            {
              title: "Staff & Managers",
              href: "/dashboard/managers",
              icon: Users,
              allowed: isAdmin,
              badge: "Admin",
            },
            {
              title: "Website Appearance",
              href: "/dashboard/website-editor",
              icon: Sparkles,
              allowed: isAdmin || Boolean(perms?.canManageWebsite),
              badge: "Editor",
            },
          ],
        },
        {
          sectionTitle: "Account",
          items: [
            {
              title: "Profile & Settings",
              href: "/dashboard/profile",
              icon: User,
              allowed: true,
            },
          ],
        },
      ];

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return {
        label: "Super Admin",
        icon: Crown,
        bg: "bg-purple-50 text-purple-700 border-purple-200",
      };
    }
    if (role === "admin") {
      return {
        label: "Administrator",
        icon: Shield,
        bg: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (role === "manager") {
      return {
        label: userProfile?.customTitle || "Operations Manager",
        icon: Briefcase,
        bg: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }
    return {
      label: "Customer",
      icon: Shield,
      bg: "bg-slate-100 text-slate-700 border-slate-200",
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
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800 font-sans">
          {/* Mobile Backdrop Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar Navigation */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 h-dvh lg:h-screen shadow-xl lg:shadow-none overflow-hidden ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Scrollable Nav Content */}
            <div className="p-4 overflow-y-auto no-scrollbar flex-1 overscroll-contain">
              {/* Brand Header */}
              <div className="flex items-center justify-between mb-5 px-1.5">
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
                  className="lg:hidden w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* User Profile Card - Flat & Elegant */}
              <Link
                href="/dashboard/profile"
                onClick={() => setSidebarOpen(false)}
                className="block bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl p-3 mb-5 transition-colors group cursor-pointer"
                title="View & Edit Profile"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg font-bold flex items-center justify-center text-xs bg-slate-900 text-white shrink-0 shadow-xs group-hover:bg-orange-600 transition-colors">
                    {userProfile?.displayName?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-orange-600 transition-colors">
                      {userProfile?.displayName || "Operations User"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.bg} flex items-center gap-1 truncate max-w-[120px]`}>
                    <RoleIcon size={11} />
                    <span className="truncate">{roleInfo.label}</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
              </Link>

              {/* Grouped Navigation */}
              <div className="space-y-4">
                {navSections.map((section, sIdx) => {
                  const allowedItems = section.items.filter((it) => it.allowed);
                  if (allowedItems.length === 0) return null;

                  return (
                    <div key={sIdx} className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 px-3 mb-1">
                        {section.sectionTitle}
                      </p>
                      {allowedItems.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-slate-900 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                size={15}
                                className={isActive ? "text-orange-400 shrink-0" : "text-slate-400 shrink-0"}
                              />
                              <span className="truncate">{item.title}</span>
                            </div>
                            {item.badge && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                                  isActive
                                    ? "bg-white/20 text-white"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-slate-200 space-y-1 bg-white shrink-0">
              <Link
                href="/shop"
                target="_blank"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">Storefront View</span>
                </div>
                <ChevronRight size={13} className="text-slate-400 shrink-0" />
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-colors text-left"
              >
                <LogOut size={14} className="shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
            {/* Top Navigation Bar with Search, Breadcrumbs & User Actions (Sticky & Pinned at Top) */}
            <TopNavBar onToggleSidebar={() => setSidebarOpen(true)} />

            {/* Scrollable Main Content Canvas */}
            <div className="flex-1 overflow-y-auto">
              <main className="p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6">
                {/* Warning banner broadcast if active */}
                {subscription?.showWarning && subscription.warningNotice && !isSuperAdmin && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                          Hosting &amp; Service Alert
                        </p>
                        <p className="text-xs font-normal mt-0.5">{subscription.warningNotice}</p>
                      </div>
                    </div>
                    <a
                      href="mailto:billing@osvidchemicals.com?subject=Hosting%20Renewal%20Settlement"
                      className="shrink-0"
                    >
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg h-8 px-4">
                        Contact Billing
                      </Button>
                    </a>
                  </div>
                )}

                {children}
              </main>
            </div>
          </div>
          <Toaster richColors position="top-right" />
        </div>
      )}
    </ProtectedRoute>
  );
}
