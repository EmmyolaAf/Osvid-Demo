"use client";

import React from "react";
import { Order, Product } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import { Package, Truck, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface OperationsDistributionChartsProps {
  orders: Order[];
  products: Product[];
}

export default function OperationsDistributionCharts({
  orders,
  products,
}: OperationsDistributionChartsProps) {
  // Fulfillment Pipeline Calculations
  const totalOrders = orders.length;
  const counts = {
    delivered: orders.filter((o) => o.orderStatus === "delivered").length,
    shipped: orders.filter((o) => o.orderStatus === "shipped").length,
    processing: orders.filter((o) => o.orderStatus === "processing").length,
    pending: orders.filter((o) => o.orderStatus === "pending" || !o.orderStatus).length,
  };

  const getPercent = (count: number) => {
    if (totalOrders === 0) return 0;
    return Math.round((count / totalOrders) * 100);
  };

  // Category Inventory Calculations
  const categoryMap = new Map<string, { count: number; totalStock: number; valuation: number }>();
  let totalStockUnits = 0;
  let totalValuation = 0;

  products.forEach((p) => {
    const cat = p.category || "General Chemicals";
    const existing = categoryMap.get(cat) || { count: 0, totalStock: 0, valuation: 0 };
    const stock = Number(p.stockQuantity) || 0;
    const price = Number(p.price) || 0;
    const itemValuation = stock * price;

    totalStockUnits += stock;
    totalValuation += itemValuation;

    categoryMap.set(cat, {
      count: existing.count + 1,
      totalStock: existing.totalStock + stock,
      valuation: existing.valuation + itemValuation,
    });
  });

  const categories = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalStock - a.totalStock)
    .slice(0, 5);

  const maxCategoryStock = Math.max(...categories.map((c) => c.totalStock), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart 1: Fulfillment Pipeline Distribution */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Fulfillment Pipeline
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {totalOrders} Total Orders
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Order lifecycle progression across warehouse dispatch
          </p>

          {/* Segmented Horizontal Progress Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-md overflow-hidden flex gap-0.5 p-0.5">
            {counts.delivered > 0 && (
              <div
                style={{ width: `${getPercent(counts.delivered)}%` }}
                className="h-full bg-emerald-600 rounded-xs transition-all"
                title={`Delivered: ${counts.delivered} (${getPercent(counts.delivered)}%)`}
              />
            )}
            {counts.shipped > 0 && (
              <div
                style={{ width: `${getPercent(counts.shipped)}%` }}
                className="h-full bg-blue-600 rounded-xs transition-all"
                title={`In Transit: ${counts.shipped} (${getPercent(counts.shipped)}%)`}
              />
            )}
            {counts.processing > 0 && (
              <div
                style={{ width: `${getPercent(counts.processing)}%` }}
                className="h-full bg-amber-500 rounded-xs transition-all"
                title={`Formulating/Packing: ${counts.processing} (${getPercent(counts.processing)}%)`}
              />
            )}
            {counts.pending > 0 && (
              <div
                style={{ width: `${getPercent(counts.pending)}%` }}
                className="h-full bg-orange-600 rounded-xs transition-all"
                title={`Pending: ${counts.pending} (${getPercent(counts.pending)}%)`}
              />
            )}
            {totalOrders === 0 && (
              <div className="h-full w-full bg-slate-200 rounded-xs" />
            )}
          </div>

          {/* Pipeline Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            <div className="p-2.5 rounded-md border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-1.5 text-orange-600">
                <Clock size={13} />
                <span className="text-[11px] font-medium">Pending</span>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{counts.pending}</p>
              <p className="text-[10px] text-slate-500">{getPercent(counts.pending)}% of total</p>
            </div>

            <div className="p-2.5 rounded-md border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-1.5 text-amber-600">
                <Package size={13} />
                <span className="text-[11px] font-medium">Packing</span>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{counts.processing}</p>
              <p className="text-[10px] text-slate-500">{getPercent(counts.processing)}% of total</p>
            </div>

            <div className="p-2.5 rounded-md border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Truck size={13} />
                <span className="text-[11px] font-medium">In Transit</span>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{counts.shipped}</p>
              <p className="text-[10px] text-slate-500">{getPercent(counts.shipped)}% of total</p>
            </div>

            <div className="p-2.5 rounded-md border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 size={13} />
                <span className="text-[11px] font-medium">Delivered</span>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{counts.delivered}</p>
              <p className="text-[10px] text-slate-500">{getPercent(counts.delivered)}% of total</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Active fulfillment backlog</span>
          <span className="font-semibold text-slate-800">
            {counts.pending + counts.processing} orders awaiting shipment
          </span>
        </div>
      </div>

      {/* Chart 2: Inventory & Category Stock Distribution */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Inventory by Chemical Category
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {totalStockUnits.toLocaleString()} Units in Warehouse
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Stock volume and catalog presence across primary application lines
          </p>

          {/* Category Horizontal Distribution Bars */}
          {categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No product categories recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat, idx) => {
                const percentOfMax = Math.round((cat.totalStock / maxCategoryStock) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">
                        {cat.name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        <strong className="text-slate-900">{cat.totalStock.toLocaleString()}</strong> units &bull; {cat.count} SKUs
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        style={{ width: `${percentOfMax}%` }}
                        className="h-full bg-slate-800 rounded-sm transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Estimated On-Hand Valuation</span>
          <span className="font-bold text-slate-900">
            {formatCurrency("NGN", totalValuation)}
          </span>
        </div>
      </div>
    </div>
  );
}
