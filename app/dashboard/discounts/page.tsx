"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getDiscountsFromDb,
  saveDiscountInDb,
  deleteDiscountFromDb,
} from "@/lib/firebase/firestore";
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
  Edit,
  TrendingUp,
  AlertCircle,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "10",
    minOrderAmount: "",
    maxUsageLimit: "",
    expiryDate: "",
    isActive: true,
  });

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const list = await getDiscountsFromDb();
      setDiscounts(list);
    } catch (err: any) {
      console.error("Error loading discounts:", err);
      toast.error(err?.message || "Failed to load discount coupons from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const openCreateModal = () => {
    setEditingDiscount(null);
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "10",
      minOrderAmount: "",
      maxUsageLimit: "",
      expiryDate: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (d: DiscountCode) => {
    setEditingDiscount(d);
    setFormData({
      code: d.code,
      description: d.description || "",
      discountType: d.discountType,
      discountValue: d.discountValue.toString(),
      minOrderAmount: d.minOrderAmount ? d.minOrderAmount.toString() : "",
      maxUsageLimit: d.maxUsageLimit ? d.maxUsageLimit.toString() : "",
      expiryDate: d.expiryDate ? d.expiryDate.split("T")[0] : "",
      isActive: d.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error("Please enter a coupon code.");
      return;
    }

    const val = parseFloat(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid discount value greater than zero.");
      return;
    }

    if (formData.discountType === "percentage" && val > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }

    try {
      setSubmitting(true);
      const id = editingDiscount?.id || `disc_${formData.code.trim().toUpperCase()}_${Date.now()}`;
      const payload: DiscountCode = {
        id,
        code: formData.code.toUpperCase().trim(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue: val,
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
        maxUsageLimit: formData.maxUsageLimit ? parseInt(formData.maxUsageLimit) : undefined,
        usageCount: editingDiscount ? editingDiscount.usageCount : 0,
        isActive: formData.isActive,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
        createdAt: editingDiscount ? editingDiscount.createdAt : new Date().toISOString(),
      };

      const result = await saveDiscountInDb(payload);
      if (!result.success) {
        toast.error(result.error || "Failed to commit discount coupon to Firestore.");
        return;
      }

      toast.success(
        editingDiscount
          ? `Coupon "${payload.code}" updated successfully in database!`
          : `Coupon "${payload.code}" published to Firestore!`
      );
      setIsModalOpen(false);
      loadDiscounts();
    } catch (err: any) {
      toast.error(err?.message || "An unexpected database error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (discount: DiscountCode) => {
    try {
      const updated: DiscountCode = { ...discount, isActive: !discount.isActive };
      const result = await saveDiscountInDb(updated);
      if (!result.success) {
        toast.error(result.error || "Failed to update coupon status.");
        return;
      }
      toast.success(`Coupon ${updated.code} is now ${updated.isActive ? "Active" : "Disabled"}`);
      setDiscounts((prev) => prev.map((d) => (d.id === discount.id ? updated : d)));
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status in database.");
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon code "${code}" from Firestore? This cannot be undone.`)) return;
    try {
      const result = await deleteDiscountFromDb(id);
      if (!result.success) {
        toast.error(result.error || "Failed to delete coupon.");
        return;
      }
      toast.success(`Coupon code "${code}" deleted from database.`);
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete coupon.");
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
              Live promotional discounts, coupon validation rules &amp; redemption controls
            </p>
          </div>

          <Button
            onClick={openCreateModal}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md shadow-pink-600/20 flex items-center gap-2 h-10 px-4 text-xs"
          >
            <Plus size={16} />
            <span>Create Coupon Code</span>
          </Button>
        </div>

        {/* Coupons Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading promotional discounts from Firestore...</p>
            </div>
          ) : discounts.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No discount codes configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Launch promotional codes (e.g. FLASH10, EASTER25, BULK50) to reward checkout customers.
              </p>
              <Button
                onClick={openCreateModal}
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
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  <tr>
                    <th className="py-3.5 px-5">Coupon Code</th>
                    <th className="py-3.5 px-5">Discount Value</th>
                    <th className="py-3.5 px-5">Min. Spend</th>
                    <th className="py-3.5 px-5">Usage / Limit</th>
                    <th className="py-3.5 px-5">Expiry Date</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {discounts.map((d) => {
                    const isExpired = d.expiryDate && new Date(d.expiryDate).getTime() < Date.now();
                    const isLimitReached = d.maxUsageLimit && (d.usageCount || 0) >= d.maxUsageLimit;

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 bg-pink-50 text-pink-700 font-black text-xs rounded-lg border border-pink-200 uppercase font-mono">
                              {d.code}
                            </span>
                            {d.description && (
                              <span className="text-xs text-slate-500 truncate max-w-xs">{d.description}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-5 font-bold text-slate-900 text-xs sm:text-sm">
                          {d.discountType === "percentage" ? (
                            <span className="text-emerald-700">{d.discountValue}% Off</span>
                          ) : (
                            <span className="text-emerald-700">₦{d.discountValue.toLocaleString()} Off</span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-xs text-slate-500">
                          {d.minOrderAmount ? `₦${d.minOrderAmount.toLocaleString()}` : "None"}
                        </td>

                        <td className="py-3.5 px-5 text-xs font-semibold text-slate-800">
                          {d.usageCount || 0}
                          {d.maxUsageLimit ? ` / ${d.maxUsageLimit}` : " (Unlimited)"}
                        </td>

                        <td className="py-3.5 px-5 text-xs text-slate-500">
                          {d.expiryDate ? (
                            <span className={isExpired ? "text-red-600 font-bold" : ""}>
                              {new Date(d.expiryDate).toLocaleDateString()}
                              {isExpired && " (Expired)"}
                            </span>
                          ) : (
                            "No Expiry"
                          )}
                        </td>

                        <td className="py-3.5 px-5">
                          {isExpired || isLimitReached ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-red-100 text-red-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              {isExpired ? "Expired" : "Limit Reached"}
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                d.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  d.isActive ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              {d.isActive ? "Active" : "Disabled"}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(d)}
                              className="text-xs h-7 px-2.5 rounded-lg"
                            >
                              {d.isActive ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(d)}
                              className="text-xs h-7 w-7 p-0 text-slate-600 hover:text-slate-900 rounded-lg"
                              title="Edit Coupon"
                            >
                              <Edit size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(d.id, d.code)}
                              className="text-xs h-7 w-7 p-0 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Coupon"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Coupon Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="text-pink-600 w-5 h-5" />
                {editingDiscount ? "Edit Coupon Code" : "Create Coupon Code"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Directly writes coupon configuration to Firestore <span className="font-mono font-bold">discounts</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveDiscount} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Coupon Code *</Label>
                <Input
                  required
                  placeholder="e.g. FLASH20, BULK10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 h-10 rounded-xl font-mono font-bold uppercase text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Description</Label>
                <Input
                  placeholder="e.g. 10% discount on orders over ₦50,000"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-xs"
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
                    className="w-full mt-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-pink-500"
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
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Min. Order (₦)</Label>
                  <Input
                    type="number"
                    placeholder="0 (No minimum)"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Max Redemptions</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxUsageLimit}
                    onChange={(e) => setFormData({ ...formData, maxUsageLimit: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Expiration Date</Label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-600/20 px-4"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingDiscount ? (
                    "Update Coupon"
                  ) : (
                    "Publish Coupon"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
