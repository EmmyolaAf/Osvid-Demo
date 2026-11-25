"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getCustomersFromDb,
  updateCustomerInDb,
  deleteCustomerInDb,
} from "@/lib/firebase/firestore";
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
  Edit,
  Trash2,
  Save,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import formatCurrency from "@/helpers/formatCurrency";

export default function CustomersPage() {
  const { userProfile, role } = useAuth();
  const isAdmin =
    role === "super_admin" ||
    role === "admin" ||
    userProfile?.role === "super_admin" ||
    userProfile?.role === "admin";

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editPoints, setEditPoints] = useState<number | string>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleOpenEdit = (c: CustomerProfile) => {
    setEditingCustomer(c);
    setEditDisplayName(c.displayName || "");
    setEditPhoneNumber(c.phoneNumber || "");
    setEditStatus(c.status === "inactive" ? "inactive" : "active");
    setEditPoints(c.accumulatedQualifyingPoints ?? 0);
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    try {
      setIsSaving(true);
      const pointsVal = Number(editPoints) || 0;
      const res = await updateCustomerInDb(editingCustomer.uid, {
        displayName: editDisplayName.trim() || editingCustomer.displayName,
        phoneNumber: editPhoneNumber.trim(),
        isActive: editStatus === "active",
        accumulatedQualifyingPoints: pointsVal,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update customer profile.");
        return;
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.uid === editingCustomer.uid
            ? {
                ...c,
                displayName: editDisplayName.trim() || c.displayName,
                phoneNumber: editPhoneNumber.trim(),
                status: editStatus,
                accumulatedQualifyingPoints: pointsVal,
              }
            : c
        )
      );

      toast.success("Customer profile updated in database!");
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update customer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (uid: string, name: string) => {
    if (!isAdmin) {
      toast.error("Deletion forbidden: Only administrators can delete customers.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to permanently delete customer "${name}" from database? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteCustomerInDb(uid);
      if (!res.success) {
        toast.error(res.error || "Failed to delete customer.");
        return;
      }

      setCustomers((prev) => prev.filter((c) => c.uid !== uid));
      toast.success(`Customer "${name}" deleted from database.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete customer.");
    }
  };

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
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Client / Formulator</th>
                    <th className="py-3.5 px-6">Contact Channels</th>
                    <th className="py-3.5 px-6">Orders Placed</th>
                    <th className="py-3.5 px-6">Qualifying Points</th>
                    <th className="py-3.5 px-6">Total Spend (LTV)</th>
                    <th className="py-3.5 px-6">Account Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
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

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          <Award size={12} className="text-indigo-600" />
                          {c.accumulatedQualifyingPoints ?? 0} pts
                        </span>
                      </td>

                      <td className="py-4 px-6 font-black text-slate-900">
                        {formatCurrency("NGN", c.totalSpent)}
                      </td>

                      <td className="py-4 px-6">
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

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Customer"
                            className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-xl"
                          >
                            <Edit size={14} />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCustomer(c.uid, c.displayName || c.email)}
                              title="Delete Customer (Admin Only)"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Customer Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-8">
            <DialogHeader className="text-left space-y-1 border-b border-slate-100 pb-4">
              <DialogTitle className="text-lg font-black text-slate-900">
                Edit Client Profile
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update customer contact parameters and active buyer status in database.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Display Name</label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="h-9 rounded-xl border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address</label>
                <Input
                  value={editingCustomer?.email || ""}
                  disabled
                  className="h-9 rounded-xl border-slate-200 bg-slate-50 text-xs text-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number</label>
                <Input
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="+234..."
                  className="h-9 rounded-xl border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Accumulated Qualifying Points
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editPoints}
                  onChange={(e) => setEditPoints(e.target.value)}
                  className="h-9 rounded-xl border-slate-300 text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Points balance used to evaluate automatic product discounts when thresholds are met.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                  className="w-full h-9 rounded-xl border border-slate-300 text-xs bg-white px-2.5 font-bold text-slate-800 outline-none"
                >
                  <option value="active">Active Buyer</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCustomer}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Changes to DB
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
