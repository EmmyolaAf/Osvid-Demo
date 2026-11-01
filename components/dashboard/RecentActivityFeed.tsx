"use client";

import React from "react";
import { Order, Product } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface RecentActivityFeedProps {
  orders: Order[];
  products: Product[];
}

export default function RecentActivityFeed({
  orders,
  products,
}: RecentActivityFeedProps) {
  // Synthesize recent chronological activity items
  const activities = React.useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      time: string;
      type: "order" | "stock" | "delivery";
      badge: string;
      badgeColor: string;
    }> = [];

    // Add recent orders
    orders.slice(0, 5).forEach((o) => {
      list.push({
        id: `ord-${o.id}`,
        title: `New order #${o.orderNumber || o.id.slice(0, 6)} received`,
        subtitle: `${o.customerName || "Customer"} &bull; ${formatCurrency("NGN", o.totalAmount || 0)} (${o.items?.length || 1} items)`,
        time: o.createdAt
          ? new Date(o.createdAt).toLocaleDateString("en-NG", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Recently",
        type: "order",
        badge: o.orderStatus.toUpperCase(),
        badgeColor:
          o.orderStatus === "completed"
            ? "bg-emerald-50 text-emerald-700"
            : o.orderStatus === "processing"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-700",
      });
    });

    // Add critical stock alerts
    products
      .filter((p) => (Number(p.stockQuantity) || 0) < 10)
      .slice(0, 3)
      .forEach((p) => {
        list.push({
          id: `stk-${p.id}`,
          title: `Low stock alert: ${p.name}`,
          subtitle: `Only ${p.stockQuantity} ${p.unit || "units"} remaining in warehouse inventory`,
          time: "Attention needed",
          type: "stock",
          badge: "RESTOCK",
          badgeColor: "bg-rose-50 text-rose-700",
        });
      });

    return list.slice(0, 6);
  }, [orders, products]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Operations Audit
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
              Live Business Activity
            </h3>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
        </div>

        <div className="mt-4 space-y-3.5">
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No recent activity logged.</p>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    act.type === "order"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {act.type === "order" ? <ShoppingBag size={13} /> : <AlertTriangle size={13} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 truncate">{act.title}</p>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${act.badgeColor}`}
                    >
                      {act.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{act.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{act.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400">Activity auto-logged to Firestore</span>
        <Link
          href="/dashboard/orders"
          className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
        >
          View Pipeline <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

