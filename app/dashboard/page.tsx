"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardStats, getOrdersFromDb, getProductsFromDb } from "@/lib/firebase/firestore";
import { Order, Product, OrderStatus } from "@/types/auth";
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
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSuperAdminEmail } from "@/lib/firebase/auth";
import formatCurrency from "@/helpers/formatCurrency";
import OperationsTimelineChart from "@/components/dashboard/OperationsTimelineChart";
import OperationsDistributionCharts from "@/components/dashboard/OperationsDistributionCharts";

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { userProfile, user, role, isSuperAdmin, isAdmin, isManager, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalManagers: 0,
  });
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuper = Boolean(
    isSuperAdmin ||
    role === "super_admin" ||
    userProfile?.role === "super_admin" ||
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(userProfile?.email)
  );

  useEffect(() => {
    if (!authLoading && isSuper) {
      router.replace("/dashboard/super-admin");
      return;
    }
  }, [authLoading, isSuper, router]);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isSuper) return;
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [kpis, orders, products] = await Promise.all([
        getDashboardStats(),
        getOrdersFromDb(),
        getProductsFromDb(),
      ]);

      setStats(kpis);
      setAllOrders(orders);
      setAllProducts(products);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSuper]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const lowStockList = useMemo(() => {
    return allProducts.filter((p) => (Number(p.stockQuantity) || 0) < 10);
  }, [allProducts]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return allOrders.slice(0, 8);
    return allOrders.filter((o) => o.orderStatus === orderFilter).slice(0, 8);
  }, [allOrders, orderFilter]);

  const averageOrderValue = useMemo(() => {
    if (allOrders.length === 0) return 0;
    const total = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return Math.round(total / allOrders.length);
  }, [allOrders]);

  const inStockPercentage = useMemo(() => {
    if (allProducts.length === 0) return 0;
    const inStock = allProducts.filter((p) => (Number(p.stockQuantity) || 0) > 0).length;
    return Math.round((inStock / allProducts.length) * 100);
  }, [allProducts]);

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case "delivered":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            Delivered
          </span>
        );
      case "shipped":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            In Transit
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            Processing
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-orange-50 text-orange-700 border border-orange-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Flat Header */}
      <div className="bg-slate-900 text-white rounded-lg p-5 sm:p-6 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-orange-400">
                Operations Hub &bull; {userProfile?.customTitle || (role === "admin" ? "General Administrator" : "Operations Manager")}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome, {userProfile?.displayName || "Manager"}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Live enterprise overview of OSVID Chemical manufacturing, order fulfillment velocity, and warehouse SKU health.
            </p>
          </div>

          {/* Flat Header Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-medium rounded-md h-8.5 px-3 cursor-pointer"
            >
              <RefreshCw size={13} className={`mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Sync Data
            </Button>

            <Link href="/dashboard/orders">
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-md h-8.5 px-3.5 cursor-pointer shadow-none"
              >
                <ShoppingBag size={13} className="mr-1.5" />
                Fulfill Orders
              </Button>
            </Link>

            <Link href="/products" target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent hover:bg-slate-800 text-slate-300 border-slate-700 text-xs font-medium rounded-md h-8.5 px-3 cursor-pointer"
              >
                <ExternalLink size={13} className="mr-1.5" />
                Storefront
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Key Metrics Grid - Flat, Clean Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Revenue & Order Value */}
        <div className="bg-white rounded-lg p-4.5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Gross Store Sales
            </span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency("NGN", stats.totalRevenue)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Avg. Order Value</span>
            <span className="font-semibold text-slate-800">
              {formatCurrency("NGN", averageOrderValue)}
            </span>
          </div>
        </div>

        {/* Metric 2: Active Orders Pipeline */}
        <div className="bg-white rounded-lg p-4.5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.totalOrders}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Fulfillment Backlog</span>
            <span className="font-semibold text-amber-700">
              {stats.pendingOrders} pending
            </span>
          </div>
        </div>

        {/* Metric 3: Warehouse Chemical SKUs */}
        <div className="bg-white rounded-lg p-4.5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Chemical Catalog
            </span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-800 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.totalProducts} <span className="text-xs font-normal text-slate-400">SKUs</span>
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Catalog Availability</span>
            <span className="font-semibold text-emerald-700">
              {inStockPercentage}% in stock
            </span>
          </div>
        </div>

        {/* Metric 4: Low Stock Alert Watchlist */}
        <div className="bg-white rounded-lg p-4.5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Stock Warnings
            </span>
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
              stats.lowStockProducts > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.lowStockProducts} <span className="text-xs font-normal text-slate-400">items</span>
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Threshold (&lt; 10 units)</span>
            <Link
              href="/dashboard/products"
              className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-0.5"
            >
              Restock <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Visual Chart 1: Interactive Timeline Chart */}
      <OperationsTimelineChart orders={allOrders} />

      {/* Visual Chart 2: Fulfillment Pipeline & Category Stock Distribution */}
      <OperationsDistributionCharts orders={allOrders} products={allProducts} />

      {/* Data Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table 1: Recent Store Orders (Span 2) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Orders &amp; Dispatch Status
              </h2>
              <p className="text-xs text-slate-500">
                Live stream of customer purchases and fulfillment status
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {["all", "pending", "processing", "shipped", "delivered"].map((f) => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-2 py-1 rounded text-xs capitalize transition-colors cursor-pointer ${
                    orderFilter === f
                      ? "bg-slate-900 text-white font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 px-4">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>No orders matching filter &quot;{orderFilter}&quot;.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3.5">Order ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                        {order.orderNumber || order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-3 max-w-[140px] truncate">
                        <p className="font-medium text-slate-900 truncate">
                          {order.customerName || "Store Customer"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {order.shippingAddress?.state || "Nigeria"}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {order.items?.length || 1} {order.items?.length === 1 ? "item" : "items"}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency("NGN", order.totalAmount || 0)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(order.orderStatus)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <Link
                          href="/dashboard/orders"
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Showing up to {filteredOrders.length} recent orders</span>
            <Link
              href="/dashboard/orders"
              className="font-medium text-slate-800 hover:text-slate-900 flex items-center gap-1"
            >
              Open Full Orders Directory <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* Table 2: Critical Stock Watchlist */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Critical Stock Watchlist
                </h2>
              </div>
              <Link
                href="/dashboard/products"
                className="text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                Stock Manager &rarr;
              </Link>
            </div>

            {lowStockList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 px-4">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-slate-700">Healthy Warehouse Stock</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All active chemical products have sufficient quantities.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lowStockList.slice(0, 6).map((prod) => {
                  const qty = Number(prod.stockQuantity) || 0;
                  const isOutOfStock = qty <= 0;

                  return (
                    <div key={prod.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {prod.category || "General"} &bull; {prod.unit || "Units"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md ${
                          isOutOfStock
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {qty} left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
            <span>{lowStockList.length} items requiring replenishment</span>
            <Link
              href="/dashboard/products"
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              Update Stock
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
