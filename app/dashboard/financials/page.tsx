"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersFromDb } from "@/lib/firebase/firestore";
import { Order } from "@/types/auth";
import {
  TrendingUp,
  CreditCard,
  CheckCircle2,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function FinancialsAnalyticsPage() {
  const { role, isSuperAdmin, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const list = await getOrdersFromDb();
        setOrders(list);
      } catch (err) {
        console.error("Error loading financial orders:", err);
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

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Financial Reports & Sales Analytics</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise transaction logs, revenue breakdown, and store monetization metrics
          </p>
        </div>

        {/* Financial KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settled Revenue</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-3">{formatNaira(totalRevenue)}</p>
            <p className="text-xs text-slate-500 mt-1">From {paidOrders.length} completed transactions</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Order Value</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CreditCard size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-3">{formatNaira(averageOrderValue)}</p>
            <p className="text-xs text-slate-500 mt-1">Per paying customer order</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Gateway</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900 mt-3">Paystack Secured</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">&bull; Real-time settlement active</p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Financial Audit Log</h2>
              <p className="text-xs text-slate-500">Full history of e-commerce payment checkouts</p>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading financial records...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  <tr>
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Customer</th>
                    <th className="py-3.5 px-6">Order ID</th>
                    <th className="py-3.5 px-6">Payment Reference</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Settled Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-xs">{o.customerName}</p>
                        <p className="text-[11px] text-slate-400">{o.customerEmail}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        #{o.orderNumber || o.id.substring(0, 8)}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-500">
                        {o.paystackReference || "Direct"}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            o.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.paymentStatus?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-slate-900">
                        {formatNaira(o.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
