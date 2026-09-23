"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { getDiscountsFromDb, saveDiscountInDb, deleteDiscountFromDb } from "@/lib/firebase/firestore";
import { DiscountCode } from "@/types/auth";
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  Loader2,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function DiscountsPage() {
  const { userProfile, role } = useAuth();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Omit<DiscountCode, "id" | "usageCount" | "createdAt">>({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 0,
    isActive: true,
    expiryDate: "",
  });

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const list = await getDiscountsFromDb();
      setDiscounts(list);
    } catch (err) {
      console.error("Error loading discounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.discountValue) {
      toast.error("Please enter a code and discount value");
      return;
    }

    try {
      setSubmitting(true);
      const id = `disc_${Date.now()}`;
      const newDiscount: DiscountCode = {
        ...formData,
        id,
        code: formData.code.toUpperCase().trim(),
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };

      await saveDiscountInDb(newDiscount);
      toast.success(`Discount coupon "${newDiscount.code}" created!`);
      setIsCreateOpen(false);
      setFormData({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 0,
        isActive: true,
        expiryDate: "",
      });
      loadDiscounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to create discount");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (discount: DiscountCode) => {
    try {
      const updated = { ...discount, isActive: !discount.isActive };
      await saveDiscountInDb(updated);
      toast.success(`Coupon ${updated.code} is now ${updated.isActive ? "Active" : "Disabled"}`);
      setDiscounts((prev) => prev.map((d) => (d.id === discount.id ? updated : d)));
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon code ${code}?`)) return;
    try {
      await deleteDiscountFromDb(id);
      toast.success(`Coupon ${code} deleted`);
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      toast.error("Failed to delete coupon");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center">
                <Tag size={20} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Discounts &amp; Coupons</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Create promotional coupon codes and seasonal percentage discounts for checkout.
            </p>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-2xl shadow-lg shadow-pink-600/25 flex items-center gap-2 h-11 px-5"
          >
            <Plus size={18} />
            <span>Create Coupon Code</span>
          </Button>
        </div>

        {/* Coupons List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading promotional discounts...</p>
            </div>
          ) : discounts.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No active coupons</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Launch discounts (e.g. FLASH10, EASTER25) to boost seasonal conversions.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                variant="outline"
                className="text-xs font-semibold rounded-xl"
              >
                <Plus size={14} className="mr-1.5" />
                Create First Coupon
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  <tr>
                    <th className="py-4 px-6">Coupon Code</th>
                    <th className="py-4 px-6">Discount Value</th>
                    <th className="py-4 px-6">Min. Order</th>
                    <th className="py-4 px-6">Redemptions</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {discounts.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="px-3 py-1 bg-pink-50 text-pink-700 font-black text-xs rounded-xl border border-pink-200 uppercase tracking-wider">
                            {d.code}
                          </div>
                          {d.description && (
                            <span className="text-xs text-slate-500 truncate max-w-xs">{d.description}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-900">
                        {d.discountType === "percentage" ? `${d.discountValue}% Off` : `₦${d.discountValue.toLocaleString()} Off`}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-500">
                        {d.minOrderAmount ? `₦${d.minOrderAmount.toLocaleString()}` : "No minimum"}
                      </td>

                      <td className="py-4 px-6 text-xs font-semibold text-slate-800">
                        {d.usageCount || 0} used
                      </td>

                      <td className="py-4 px-6">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                          d.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {d.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(d)}
                            className="text-xs h-8 rounded-lg"
                          >
                            {d.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(d.id, d.code)}
                            className="text-xs h-8 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Coupon Modal */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Tag className="text-pink-600 w-5 h-5" />
                Create Coupon Code
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Customers can apply this coupon code at checkout to claim special savings.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateDiscount} className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Coupon Code *</Label>
                <Input
                  required
                  placeholder="e.g. FLASH20, BULK10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 h-10 rounded-xl font-bold uppercase"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Description</Label>
                <Input
                  placeholder="e.g. 10% discount on orders over ₦50,000"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Discount Type</Label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as "percentage" | "fixed",
                      })
                    }
                    className="w-full mt-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">
                    {formData.discountType === "percentage" ? "Percent (%)" : "Amount (₦)"} *
                  </Label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Minimum Order Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder="0 (No minimum)"
                  value={formData.minOrderAmount || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-600/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish Coupon"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
