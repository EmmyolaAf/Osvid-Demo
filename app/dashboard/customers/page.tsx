"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { getCustomersFromDb } from "@/lib/firebase/firestore";
import { CustomerProfile } from "@/types/auth";
import {
  Users,
  Search,
  Mail,
  Phone,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  ArrowUpRight,
  UserCheck,
  TrendingUp,
  Download,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import formatCurrency from "@/helpers/formatCurrency";

export default function CustomersPage() {
  const { userProfile, role } = useAuth();
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getCustomersFromDb();
        setCustomers(data);
      } catch (err) {
        console.error("Error loading customers:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalSpentAll = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
  const activeCount = customers.filter((c) => c.status === "active").length;
  const avgSpent = customers.length > 0 ? Math.round(totalSpentAll / customers.length) : 0;

  const filtered = customers.filter(
    (c) =>
      c.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phoneNumber?.includes(searchTerm)
  );

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Client &amp; Customer Intelligence
                </h1>
                <p className="text-xs text-slate-500">
                  Comprehensive directory of wholesale formulators, industrial purchasers, and retail buyers
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Total Registered Clients
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">{customers.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{activeCount} active purchasers</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Cumulative Client Spend
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {formatCurrency("NGN", totalSpentAll)}
              </p>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5">Lifetime Customer Volume</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Average Client LTV
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {formatCurrency("NGN", avgSpent)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Mean transaction value</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Search clients by company name, contact person, email, or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-medium"
          />
          {searchTerm && (
            <span className="text-xs text-slate-400 font-semibold mr-2 shrink-0">
              {filtered.length} found
            </span>
          )}
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading customer directory from Firestore...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No customers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Customer profiles will automatically populate as buyers register or complete orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Client / Formulator</th>
                    <th className="py-3.5 px-6">Contact Channels</th>
                    <th className="py-3.5 px-6">Orders Placed</th>
                    <th className="py-3.5 px-6">Total Spend (LTV)</th>
                    <th className="py-3.5 px-6 text-right">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.map((c) => (
                    <tr key={c.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                            {c.displayName?.charAt(0).toUpperCase() || "C"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{c.displayName}</p>
                            <span className="text-[10px] text-slate-400">
                              Joined {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Recent"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 space-y-1">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Mail size={13} className="text-orange-600" />
                          <span>{c.email}</span>
                        </div>
                        {c.phoneNumber && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone size={13} className="text-slate-400" />
                            <span>{c.phoneNumber}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          <ShoppingBag size={12} />
                          {c.totalOrders} {c.totalOrders === 1 ? "order" : "orders"}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-black text-slate-900">
                        {formatCurrency("NGN", c.totalSpent)}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {c.status === "active" ? "Active Buyer" : "Inactive"}
                        </span>
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
