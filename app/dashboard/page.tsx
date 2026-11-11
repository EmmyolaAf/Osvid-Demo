"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDashboardStats,
  getOrdersFromDb,
  getProductsFromDb,
  getProductReviewsFromDb,
  getDiscountsFromDb,
  getCustomersFromDb,
} from "@/lib/firebase/firestore";
import { Order, Product, OrderStatus, ProductReview } from "@/types/auth";
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
  Layers,
  Sparkles,
  BarChart3,
  RefreshCw,
  Plus,
  Star,
  Tag,
  Calendar,
  CreditCard,
  Eye,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSuperAdminEmail } from "@/lib/firebase/auth";
import formatCurrency from "@/helpers/formatCurrency";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import OperationsTimelineChart from "@/components/dashboard/OperationsTimelineChart";
import OperationsDistributionCharts from "@/components/dashboard/OperationsDistributionCharts";
import BestSellingProducts from "@/components/dashboard/BestSellingProducts";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";

interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  totalManagers: number;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { userProfile, user, role, isSuperAdmin, isAdmin, isManager, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<DashboardMetrics>({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalManagers: 0,
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [activePromosCount, setActivePromosCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);

  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"7D" | "14D" | "30D" | "ALL">("14D");
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

  // Real-time listener for orders and products so stats are instant and always fresh
  useEffect(() => {
    if (isSuper) return;

    let unsubOrders: (() => void) | null = null;
    let unsubProducts: (() => void) | null = null;

    try {
      unsubOrders = onSnapshot(
        query(collection(db, "orders"), orderBy("createdAt", "desc")),
        (snapshot) => {
          const orders = snapshot.docs.map((d) => d.data() as Order);
          setAllOrders(orders);
          setStats((prev: DashboardMetrics) => {
            const paidRev = orders
              .filter((o) => o.paymentStatus === "paid")
              .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const pending = orders.filter(
              (o) => o.orderStatus === "pending" || o.orderStatus === "processing"
            ).length;
            const updated: DashboardMetrics = {
              ...prev,
              totalOrders: orders.length,
              pendingOrders: pending,
              totalRevenue: paidRev,
            };
            return updated;
          });
          setDataLoaded(true);
          setLoading(false);
        },
        (err) => {
          console.warn("Orders real-time listener error:", err);
        }
      );

      unsubProducts = onSnapshot(
        collection(db, "products"),
        (snapshot) => {
          const products = snapshot.docs.map((d) => d.data() as Product);
          setAllProducts(products);
          setStats((prev: DashboardMetrics) => {
            const lowStock = products.filter(
              (p) => (Number(p.stockQuantity) || 0) < 10
            ).length;
            const updated: DashboardMetrics = {
              ...prev,
              totalProducts: products.length,
              lowStockProducts: lowStock,
            };
            return updated;
          });
          setDataLoaded(true);
          setLoading(false);
        },
        (err) => {
          console.warn("Products real-time listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach real-time dashboard listeners:", e);
    }

    return () => {
      if (unsubOrders) unsubOrders();
      if (unsubProducts) unsubProducts();
    };
  }, [isSuper]);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isSuper) return;
    try {
      if (isManualRefresh) setRefreshing(true);

      const [kpis, revs, discounts, customers] = await Promise.all([
        getDashboardStats(),
        getProductReviewsFromDb(),
        getDiscountsFromDb(),
        getCustomersFromDb(),
      ]);

      setStats(kpis);
      setReviews(revs);
      setActivePromosCount(discounts.filter((d) => d.isActive).length);
      setCustomersCount(customers.length);
      setDataLoaded(true);
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

  const pendingReviewsCount = useMemo(() => {
    return reviews.filter((r) => r.status === "pending").length;
  }, [reviews]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return allOrders.slice(0, 8);
    return allOrders.filter((o) => o.orderStatus === orderFilter).slice(0, 8);
  }, [allOrders, orderFilter]);

  // Greeting generator
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case "delivered":
      case "completed":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            Completed
          </span>
        );
      case "shipped":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
            In Transit
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
            Processing
          </span>
        );
      case "on-hold":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200/80">
            On Hold
          </span>
        );
      case "cancelled":
      case "failed":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200/80">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Welcome & Action Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">
              Operations Center &bull; {userProfile?.customTitle || (role === "admin" ? "General Administrator" : "Operations Manager")}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {greeting}, {userProfile?.displayName?.split(" ")[0] || "Manager"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <Calendar size={13} className="text-slate-400" />
            {new Date().toLocaleDateString("en-NG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            <span>&bull;</span>
            <span>OSVID Chemicals Manufacturing Hub</span>
          </p>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-3 gap-1.5"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-600" : ""} />
            Sync Metrics
          </Button>

          <Link href="/dashboard/products">
            <Button
              size="sm"
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold h-9 px-3.5 gap-1.5 shadow-xs"
            >
              <Package size={14} />
              Add Product
            </Button>
          </Link>

          <Link href="/dashboard/orders">
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold h-9 px-4 gap-1.5 shadow-xs"
            >
              <ShoppingBag size={14} />
              New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* 8 Key Performance Indicators (KPIs) Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Sales */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Gross Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-32 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency("NGN", stats.totalRevenue)}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Avg. Order Value</span>
            <span className="font-bold text-slate-800">
              {formatCurrency("NGN", averageOrderValue)}
            </span>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalOrders}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Awaiting Dispatch</span>
            <span className="font-bold text-amber-600">
              {stats.pendingOrders} pending
            </span>
          </div>
        </div>

        {/* KPI 3: Chemical Catalog SKUs */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Active Formulations
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalProducts} <span className="text-xs font-medium text-slate-400">SKUs</span>
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Warehouse In-Stock</span>
            <span className="font-bold text-emerald-600">
              {inStockPercentage}% available
            </span>
          </div>
        </div>

        {/* KPI 4: Stock Watchlist */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Stock Warnings
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                stats.lowStockProducts > 0
                  ? "bg-rose-50 text-rose-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.lowStockProducts}{" "}
                <span className="text-xs font-medium text-slate-400">items</span>
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Threshold: &lt;10 units</span>
            <Link
              href="/dashboard/products"
              className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
            >
              Restock <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* KPI 5: Customer Reviews */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Product Feedback
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {reviews.length}{" "}
                <span className="text-xs font-medium text-slate-400">reviews</span>
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Moderation Feed</span>
            <Link
              href="/dashboard/reviews"
              className="font-bold text-orange-600 hover:text-orange-700"
            >
              {pendingReviewsCount} pending &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 6: Customer Accounts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Registered Clients
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {customersCount}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Directory</span>
            <Link
              href="/dashboard/customers"
              className="font-bold text-orange-600 hover:text-orange-700"
            >
              View accounts &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 7: Active Promotions */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Active Promotions
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Tag size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {activePromosCount}{" "}
                <span className="text-xs font-medium text-slate-400">coupons</span>
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Tier Pricing</span>
            <Link
              href="/dashboard/discounts"
              className="font-bold text-orange-600 hover:text-orange-700"
            >
              Manage &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 8: Staff Access */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Operations Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="my-2">
            {!dataLoaded ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg my-0.5" />
            ) : (
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalManagers || 1}{" "}
                <span className="text-xs font-medium text-slate-400">managers</span>
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">RBAC Controls</span>
            <span className="font-bold text-emerald-600">Active</span>
          </div>
        </div>
      </div>

      {/* Visual Chart 1: Interactive Revenue & Sales Velocity Chart */}
      <OperationsTimelineChart orders={allOrders} />

      {/* Visual Chart 2: Category Mix & Order Fulfillment Pipeline */}
      <OperationsDistributionCharts orders={allOrders} products={allProducts} />

      {/* Data & Operations Section (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Column (Span 2): Recent Store Orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Transaction Stream
                </span>
                <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                  Recent Orders &amp; Fulfillment Stage
                </h3>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                {["all", "pending", "processing", "shipped", "completed"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderFilter(st)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold capitalize transition-all ${
                      orderFilter === st
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 px-4">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No orders matching filter &quot;{orderFilter}&quot;</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Items</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          #{o.orderNumber || o.id.slice(0, 8).toUpperCase()}
                        </td>

                        <td className="py-3.5 px-3 max-w-[130px] truncate">
                          <p className="font-bold text-slate-900 truncate">
                            {o.customerName || "Store Customer"}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {o.shippingAddress?.state || o.customerEmail}
                          </p>
                        </td>

                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap font-medium">
                          {o.createdAt
                            ? new Date(o.createdAt).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                              })
                            : "Recent"}
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap font-semibold">
                          {o.items?.length || 1} item{o.items?.length === 1 ? "" : "s"}
                        </td>

                        <td className="py-3.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                          {formatCurrency("NGN", o.totalAmount || 0)}
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(o.orderStatus)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href="/dashboard/orders"
                            className="font-bold text-orange-600 hover:text-orange-700"
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
          </div>

          <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredOrders.length} of {allOrders.length} total orders</span>
            <Link
              href="/dashboard/orders"
              className="font-bold text-slate-800 hover:text-slate-900 flex items-center gap-1"
            >
              Open Full Orders Directory <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* Sidebar Column (Span 1): Best Selling Products & Inventory Watchlist */}
        <div className="space-y-6">
          <BestSellingProducts products={allProducts} orders={allOrders} />
          <RecentActivityFeed orders={allOrders} products={allProducts} />
        </div>
      </div>
    </div>
  );
}
