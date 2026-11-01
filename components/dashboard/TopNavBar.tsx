"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  ExternalLink,
  Bell,
  Plus,
  ShoppingBag,
  Package,
  Tag,
  LogOut,
  ChevronRight,
  Shield,
  Crown,
  Briefcase,
  User,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopNavBarProps {
  onToggleSidebar?: () => void;
  pendingOrdersCount?: number;
  pendingReviewsCount?: number;
}

export default function TopNavBar({
  pendingOrdersCount = 0,
  pendingReviewsCount = 0,
}: TopNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, role, logout, isSuperAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Generate clean breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const url = "/" + pathSegments.slice(0, index + 1).join("/");
    const label =
      segment === "dashboard"
        ? "Overview"
        : segment
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, url, isLast: index === pathSegments.length - 1 };
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/dashboard/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const totalNotifications = pendingOrdersCount + pendingReviewsCount;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs & Page Context */}
        <div className="flex items-center gap-2 min-w-0">
          <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.url}>
                {idx > 0 && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                {crumb.isLast ? (
                  <span className="text-slate-900 font-bold truncate">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.url}
                    className="hover:text-slate-800 transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
          <div className="sm:hidden font-bold text-sm text-slate-900 truncate">
            {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <form onSubmit={handleSearchSubmit} className="w-full relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, orders, customers..."
              className="w-full h-9 pl-9 pr-14 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center text-[10px] font-mono font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              Ctrl K
            </kbd>
          </form>
        </div>

        {/* Right: Quick Actions, Storefront Link, Notifications & User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Action Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold h-9 px-3 gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Action</span>
            </Button>

            {showQuickMenu && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setShowQuickMenu(false)}
              >
                <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Quick Create
                </div>
                <Link
                  href="/dashboard/products"
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Package size={14} className="text-orange-600" />
                  Add Product
                </Link>
                <Link
                  href="/dashboard/orders"
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <ShoppingBag size={14} className="text-blue-600" />
                  Manual Order
                </Link>
                <Link
                  href="/dashboard/discounts"
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Tag size={14} className="text-emerald-600" />
                  Create Coupon
                </Link>
              </div>
            )}
          </div>

          {/* Live Storefront Link */}
          <Link href="/shop" target="_blank">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold h-9 px-3 gap-1.5"
            >
              <ExternalLink size={13} className="text-slate-400" />
              <span className="hidden sm:inline">Live Store</span>
            </Button>
          </Link>

          {/* Notifications Indicator */}
          <Link href="/dashboard/orders">
            <button
              className="relative w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title={`${pendingOrdersCount} pending orders`}
            >
              <Bell size={15} />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </span>
              )}
            </button>
          </Link>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {userProfile?.displayName?.charAt(0).toUpperCase() || "A"}
              </div>
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setShowUserMenu(false)}
              >
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {userProfile?.displayName || "Operations User"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full capitalize">
                    {role || "Manager"}
                  </span>
                </div>

                <div className="py-1">
                  <Link
                    href="/dashboard/super-admin"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Sliders size={14} className="text-slate-400" />
                    System Settings
                  </Link>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

