"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardStats, getOrdersFromDb, getProductsFromDb } from "@/lib/firebase/firestore";
import { Order, Product } from "@/types/auth";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  Users,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Truck,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { userProfile, role, isSuperAdmin, isAdmin, isManager, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalManagers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockList, setLowStockList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      router.replace("/dashboard/super-admin");
      return;
    }
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) return;
    async function loadData() {
      try {
        const [kpis, orders, products] = await Promise.all([
          getDashboardStats(),
          getOrdersFromDb(),
          getProductsFromDb(),
        ]);
        setStats(kpis);
        setRecentOrders(orders.slice(0, 5));
        setLowStockList(products.filter((p) => p.stockQuantity < 10));
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Delivered</span>;
      case "shipped":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Shipped</span>;
      case "processing":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Processing</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">Pending</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0e166e] to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                OSVID Chemical Portal &bull; {role?.replace("_", " ").toUpperCase()}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {userProfile?.displayName || "Admin"}!
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-xl">
                {role === "manager"
                  ? "Here is your operations overview. Monitor fulfillment and manage warehouse chemical inventory."
                  : "Here is your enterprise overview. Track sales, manage management accounts, and oversee store operations."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/orders">
                <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold">
                  <ShoppingBag size={14} className="mr-1.5" />
                  View Orders
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/dashboard/managers">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md shadow-orange-600/20">
                    <Plus size={14} className="mr-1.5" />
                    Manage Staff
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card (Super Admin & Admin) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Sales</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {formatNaira(stats.totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">&bull; Active</span> from verified checkouts
            </p>
          </div>
        )}

        {/* Orders Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Orders</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats.totalOrders}
          </p>
          <p className="text-xs text-amber-600 font-medium mt-1">
            {stats.pendingOrders} pending fulfillment
          </p>
        </div>

        {/* Products Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory SKUs</span>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Package size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats.totalProducts}
          </p>
          <p className="text-xs text-red-600 font-medium mt-1">
            {stats.lowStockProducts} low stock warnings
          </p>
        </div>

        {/* Staff/Manager Card */}
        {isAdmin && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Managers Active</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {stats.totalManagers}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Operations accounts active
            </p>
          </div>
        )}
      </div>

      {/* Two Column Layout: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (Span 2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Customer Orders</h2>
              <p className="text-xs text-slate-500">Live order stream from store checkout</p>
            </div>
            <Link
              href="/dashboard/orders"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No orders placed yet. New orders will appear here in real-time.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <div key={order.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {order.customerName || "Customer"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.items?.length || 0} items &bull; {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {formatNaira(order.totalAmount)}
                    </p>
                    <div className="mt-1">{getStatusBadge(order.orderStatus)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Attention / Low Stock */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Stock Alert</h2>
            </div>
            <Link
              href="/dashboard/products"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {lowStockList.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs text-slate-600 font-medium">All chemical stock levels are optimal.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockList.slice(0, 5).map((prod) => (
                <div key={prod.id} className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                    <p className="text-[11px] text-slate-500">{prod.category}</p>
                  </div>
                  <span className="text-xs font-extrabold text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                    {prod.stockQuantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
