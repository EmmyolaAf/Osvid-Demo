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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

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
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Customer Directory</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              View and manage registered clients, order activity, and lifetime store spending.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading customer directory...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No customers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Customer profiles will automatically appear as buyers register or complete storefront purchases.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  <tr>
                    <th className="py-4 px-6">Customer</th>
                    <th className="py-4 px-6">Contact Email &amp; Phone</th>
                    <th className="py-4 px-6">Orders Placed</th>
                    <th className="py-4 px-6">Lifetime Spent</th>
                    <th className="py-4 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filtered.map((c) => (
                    <tr key={c.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm">
                            {c.displayName?.charAt(0).toUpperCase() || "C"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{c.displayName}</p>
                            <span className="text-[11px] text-slate-400">Since {new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Mail size={13} className="text-slate-400" />
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          <ShoppingBag size={12} />
                          {c.totalOrders} {c.totalOrders === 1 ? "Order" : "Orders"}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-900">
                        {formatNaira(c.totalSpent)}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                          c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {c.status === "active" ? "Active" : "Inactive"}
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
