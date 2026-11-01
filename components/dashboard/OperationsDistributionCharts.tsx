"use client";

import React, { useMemo } from "react";
import { Order, Product } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import {
  Layers,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  RotateCcw,
  Package,
} from "lucide-react";
import Link from "next/link";

interface OperationsDistributionChartsProps {
  orders: Order[];
  products: Product[];
}

const CATEGORY_COLORS = [
  "#ea580c", // Orange
  "#2563eb", // Blue
  "#059669", // Emerald
  "#7c3aed", // Violet
  "#d97706", // Amber
  "#dc2626", // Red
  "#475569", // Slate
];

export default function OperationsDistributionCharts({
  orders,
  products,
}: OperationsDistributionChartsProps) {
  // Category breakdown calculation
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    products.forEach((p) => {
      const cat = p.category?.trim() || "Industrial Formulations";
      if (!map[cat]) map[cat] = { count: 0, value: 0 };
      map[cat].count += 1;
      map[cat].value += (p.price || 0) * (p.stockQuantity || 0);
    });

    const totalProducts = products.length || 1;
    const sorted = Object.entries(map)
      .map(([name, data], idx) => ({
        name,
        count: data.count,
        value: data.value,
        percentage: Math.round((data.count / totalProducts) * 100),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);

    return sorted.slice(0, 5);
  }, [products]);

  // Order status pipeline breakdown
  const orderPipeline = useMemo(() => {
    const total = orders.length || 1;
    const counts = {
      pending: orders.filter((o) => o.orderStatus === "pending").length,
      processing: orders.filter((o) => o.orderStatus === "processing").length,
      onHold: orders.filter((o) => o.orderStatus === "on-hold").length,
      completed: orders.filter((o) => o.orderStatus === "completed" || o.orderStatus === "delivered").length,
      shipped: orders.filter((o) => o.orderStatus === "shipped").length,
      cancelled: orders.filter((o) => o.orderStatus === "cancelled" || o.orderStatus === "failed").length,
    };

    return {
      total: orders.length,
      counts,
      percentages: {
        pending: Math.round((counts.pending / total) * 100),
        processing: Math.round((counts.processing / total) * 100),
        completed: Math.round((counts.completed / total) * 100),
        shipped: Math.round((counts.shipped / total) * 100),
        cancelled: Math.round((counts.cancelled / total) * 100),
      },
      fulfillmentRate: Math.round(((counts.completed + counts.shipped) / total) * 100) || 0,
    };
  }, [orders]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Visual Chart A: Category Inventory & Revenue Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Catalogue Segmentation
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Chemical Category Mix
              </h3>
            </div>
            <Link
              href="/dashboard/products"
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              All Categories &rarr;
            </Link>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="mt-5 space-y-2">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
              {categoryStats.map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    width: `${Math.max(cat.percentage, 4)}%`,
                    backgroundColor: cat.color,
                  }}
                  title={`${cat.name}: ${cat.count} SKUs (${cat.percentage}%)`}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                />
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              Proportion of active chemical formulations across top production lines
            </p>
          </div>

          {/* Category Itemized Breakdown */}
          <div className="mt-5 space-y-3">
            {categoryStats.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-bold text-slate-800 truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-slate-500">
                  <span className="font-medium text-slate-600">{cat.count} SKUs</span>
                  <span className="font-bold text-slate-900 w-10 text-right">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total catalog lines: {products.length} products</span>
          <span className="font-semibold text-slate-800">100% active</span>
        </div>
      </div>

      {/* Visual Chart B: Order Fulfillment & Pipeline Health */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Fulfillment Operations
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Order Pipeline &amp; Delivery Health
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={12} /> {orderPipeline.fulfillmentRate}% Success Rate
            </span>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 py-4 border-b border-slate-100 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Logged</span>
              <p className="text-base font-black text-slate-900 mt-0.5">{orderPipeline.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/70 text-amber-900">
              <span className="text-[10px] font-bold uppercase text-amber-600">In Progress</span>
              <p className="text-base font-black text-amber-950 mt-0.5">
                {orderPipeline.counts.processing + orderPipeline.counts.shipped}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 text-emerald-900">
              <span className="text-[10px] font-bold uppercase text-emerald-600">Fulfilled</span>
              <p className="text-base font-black text-emerald-950 mt-0.5">
                {orderPipeline.counts.completed}
              </p>
            </div>
          </div>

          {/* Pipeline Stage Visual Bars */}
          <div className="mt-4 space-y-3">
            {/* Processing */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Processing &amp; Formulation
                </span>
                <span className="font-bold text-slate-900">
                  {orderPipeline.counts.processing} orders ({orderPipeline.percentages.processing}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${orderPipeline.percentages.processing}%` }}
                />
              </div>
            </div>

            {/* Shipped / In Transit */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Dispatched / In Transit
                </span>
                <span className="font-bold text-slate-900">
                  {orderPipeline.counts.shipped} orders ({orderPipeline.percentages.shipped}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${orderPipeline.percentages.shipped}%` }}
                />
              </div>
            </div>

            {/* Completed */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Delivered &amp; Completed
                </span>
                <span className="font-bold text-slate-900">
                  {orderPipeline.counts.completed} orders ({orderPipeline.percentages.completed}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${orderPipeline.percentages.completed}%` }}
                />
              </div>
            </div>

            {/* Pending Payment */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Pending Payment
                </span>
                <span className="font-bold text-slate-900">
                  {orderPipeline.counts.pending} orders ({orderPipeline.percentages.pending}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{ width: `${orderPipeline.percentages.pending}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Logistics SLA: 24-48 hours</span>
          <Link
            href="/dashboard/orders"
            className="font-bold text-orange-600 hover:text-orange-700"
          >
            Manage Dispatch &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
