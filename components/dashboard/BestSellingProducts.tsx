"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product, Order } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface BestSellingProductsProps {
  products: Product[];
  orders: Order[];
}

export default function BestSellingProducts({
  products,
  orders,
}: BestSellingProductsProps) {
  const [activeTab, setActiveTab] = useState<"bestsellers" | "lowstock">("bestsellers");

  // Calculate units sold and revenue per product from completed orders
  const productSalesMap = React.useMemo(() => {
    const map: Record<string, { units: number; revenue: number }> = {};
    orders.forEach((o) => {
      o.items?.forEach((it) => {
        if (!map[it.productId]) {
          map[it.productId] = { units: 0, revenue: 0 };
        }
        map[it.productId].units += it.quantity || 1;
        map[it.productId].revenue += (it.price || 0) * (it.quantity || 1);
      });
    });
    return map;
  }, [orders]);

  // Sort bestsellers
  const bestsellers = React.useMemo(() => {
    return [...products]
      .map((p) => {
        const sales = productSalesMap[p.id] || { units: 0, revenue: 0 };
        return {
          ...p,
          unitsSold: sales.units,
          revenueGenerated: sales.revenue,
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold || b.price - a.price)
      .slice(0, 5);
  }, [products, productSalesMap]);

  // Filter low stock products (< 10 units)
  const lowStockProducts = React.useMemo(() => {
    return products
      .filter((p) => (Number(p.stockQuantity) || 0) < 10)
      .sort((a, b) => (Number(a.stockQuantity) || 0) - (Number(b.stockQuantity) || 0))
      .slice(0, 5);
  }, [products]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header with Tab Switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Inventory Intelligence
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
              {activeTab === "bestsellers" ? "Top Performing Chemicals" : "Critical Stock Watchlist"}
            </h3>
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveTab("bestsellers")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "bestsellers"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Top Selling
            </button>
            <button
              onClick={() => setActiveTab("lowstock")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "lowstock"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Low Stock ({lowStockProducts.length})
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="mt-4 divide-y divide-slate-100">
          {activeTab === "bestsellers" ? (
            bestsellers.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No sales recorded yet.</p>
            ) : (
              bestsellers.map((prod) => (
                <div
                  key={prod.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      <Image
                        src={prod.imageUrl || "/images/placeholder.webp"}
                        alt={prod.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {prod.sku ? `SKU: ${prod.sku}` : prod.category || "Chemical"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-900">
                      {prod.revenueGenerated > 0
                        ? formatCurrency("NGN", prod.revenueGenerated)
                        : formatCurrency("NGN", prod.price)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {prod.unitsSold > 0 ? `${prod.unitsSold} sold` : `${prod.stockQuantity} in stock`}
                    </p>
                  </div>
                </div>
              ))
            )
          ) : lowStockProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              All chemical products have healthy stock levels (&ge; 10 units).
            </div>
          ) : (
            lowStockProducts.map((prod) => {
              const qty = Number(prod.stockQuantity) || 0;
              const isOut = qty <= 0;

              return (
                <div
                  key={prod.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      <Image
                        src={prod.imageUrl || "/images/placeholder.webp"}
                        alt={prod.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {prod.category || "General"} &bull; Unit: {prod.unit || "unit"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                        isOut
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isOut ? "Out of Stock" : `${qty} remaining`}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatCurrency("NGN", prod.price)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400">Total catalogue: {products.length} items</span>
        <Link
          href="/dashboard/products"
          className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
        >
          Manage Catalogue <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

