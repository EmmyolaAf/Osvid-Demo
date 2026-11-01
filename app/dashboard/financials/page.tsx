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
  Percent,
} from "lucide-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import formatCurrency from "@/helpers/formatCurrency";

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

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalVat = paidOrders.reduce((acc, o) => acc + (o.taxAmount || 0), 0);
  const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]} requiredPermission="canViewFinancials">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Financial Audit &amp; Monetization Analytics
              </h1>
              <p className="text-xs text-slate-500">
                Enterprise transaction ledger, VAT accrual, and checkout settlement stream
              </p>
            </div>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Settled Revenue
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {formatCurrency("NGN", totalRevenue)}
              </p>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                {paidOrders.length} completed transactions
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Average Order Value
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {formatCurrency("NGN", averageOrderValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Per verified order</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Total VAT Collected (7.5%)
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {formatCurrency("NGN", totalVat)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Standard tax accrual</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Gateway Status
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">Paystack Gateway</p>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5">&bull; PCI-DSS Level 1 active</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Settlement History
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Financial Audit Ledger
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {orders.length} total entries
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading ledger from Firestore...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                  <tr>
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Customer</th>
                    <th className="py-3.5 px-6">Order ID</th>
                    <th className="py-3.5 px-6">Channel / Gateway Ref</th>
                    <th className="py-3.5 px-6">Payment Status</th>
                    <th className="py-3.5 px-6 text-right">Settled Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 text-slate-500 whitespace-nowrap font-medium">
                        {new Date(o.createdAt).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900">{o.customerName}</p>
                        <p className="text-[11px] text-slate-400">{o.customerEmail}</p>
                      </td>

                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        #{o.orderNumber || o.id.substring(0, 8).toUpperCase()}
                      </td>

                      <td className="py-4 px-6 font-mono text-[11px] text-slate-500">
                        {o.paystackReference || o.paymentMethod || "Verified Offline"}
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            o.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                              : "bg-amber-50 text-amber-700 border border-amber-200/80"
                          }`}
                        >
                          {o.paymentStatus || "pending"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right font-black text-slate-900">
                        {formatCurrency("NGN", o.totalAmount)}
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
