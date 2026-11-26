"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getDiscountsFromDb,
  subscribeToDiscounts,
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
  Edit,
  Power,
  Sparkles,
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
import formatCurrency from "@/helpers/formatCurrency";

export default function DiscountsPage() {
  const { userProfile, role } = useAuth();
  const isAdmin =
    role === "super_admin" ||
    role === "admin" ||
    userProfile?.role === "super_admin" ||
    userProfile?.role === "admin";

  const [activeTab, setActiveTab] = useState<"coupons" | "discounts">("coupons");
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
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
    isAutomaticDiscount: false,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const discList = await getDiscountsFromDb();
      setDiscounts(discList);
    } catch (err: any) {
      console.error("Error loading discounts:", err);
      toast.error(err?.message || "Failed to load discount data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDiscounts((realtimeDiscounts) => {
      setDiscounts(realtimeDiscounts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter coupons vs automatic discounts
  const couponCodes = discounts.filter((d) => !(d as any).isAutomaticDiscount);
  const automaticDiscounts = discounts.filter((d) => Boolean((d as any).isAutomaticDiscount));

  const openCreateCouponModal = () => {
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
      isAutomaticDiscount: false,
    });
    setIsModalOpen(true);
  };

  const openCreateDiscountModal = () => {
    setEditingDiscount(null);
    setFormData({
      code: `DISCOUNT-${Date.now().toString().slice(-4)}`,
      description: "",
      discountType: "percentage",
      discountValue: "5",
      minOrderAmount: "",
      maxUsageLimit: "",
      expiryDate: "",
      isActive: true,
      isAutomaticDiscount: true,
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
      isAutomaticDiscount: Boolean((d as any).isAutomaticDiscount),
    });
    setIsModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error("Please enter a code or identifier.");
      return;
    }

    const numVal = parseFloat(formData.discountValue);
    if (isNaN(numVal) || numVal <= 0) {
      toast.error("Please enter a valid discount amount.");
      return;
    }

    if (formData.discountType === "percentage" && numVal > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await saveDiscountInDb({
        id: editingDiscount?.id,
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue: numVal,
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
        maxUsageLimit: formData.maxUsageLimit ? parseInt(formData.maxUsageLimit, 10) : undefined,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
        isActive: formData.isActive,
        isAutomaticDiscount: formData.isAutomaticDiscount,
      } as any);

      if (!res.success) {
        toast.error(res.error || "Failed to commit discount.");
        return;
      }

      toast.success(
        editingDiscount
          ? `Discount "${formData.code}" updated successfully!`
          : `Discount "${formData.code}" created and active!`
      );
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save discount.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (discount: DiscountCode) => {
    try {
      const updated = { ...discount, isActive: !discount.isActive };
      const res = await saveDiscountInDb(updated);
      if (!res.success) {
        toast.error(res.error || "Failed to toggle status.");
        return;
      }
      setDiscounts((prev) => prev.map((d) => (d.id === discount.id ? updated : d)));
      toast.success(`Discount "${discount.code}" is now ${updated.isActive ? "active" : "disabled"}.`);
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const handleDeleteDiscount = async (id: string, code: string) => {
    if (!isAdmin) {
      toast.error("Forbidden: Only administrators can delete discount codes.");
      return;
    }
    if (!confirm(`Are you sure you want to delete discount code "${code}"?`)) return;

    try {
      const res = await deleteDiscountFromDb(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete discount.");
        return;
      }
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Discount "${code}" deleted permanently.`);
    } catch {
      toast.error("Failed to delete discount.");
    }
  };

  const displayedList = activeTab === "coupons" ? couponCodes : automaticDiscounts;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
              Create and manage promotional coupon codes and automatic store discounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "coupons" ? (
              <Button
                onClick={openCreateCouponModal}
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md shadow-pink-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>Create Coupon Code</span>
              </Button>
            ) : (
              <Button
                onClick={openCreateDiscountModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>Create Store Discount</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("coupons")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "coupons"
                ? "border-pink-600 text-pink-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Tag size={16} /> Coupon Codes ({couponCodes.length})
          </button>
          <button
            onClick={() => setActiveTab("discounts")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "discounts"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles size={16} /> Automatic Store Discounts ({automaticDiscounts.length})
          </button>
        </div>

        {/* LIST VIEW */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-pink-600 mb-2" />
              <p className="text-sm">Loading promotions...</p>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl border border-slate-200">
              <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {activeTab === "coupons" ? "No Coupon Codes Active" : "No Store Discounts Active"}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {activeTab === "coupons"
                  ? "Create checkout promo codes to reward loyal customers or drive seasonal campaigns."
                  : "Create store discounts to offer automatic percentage or fixed price reductions."}
              </p>
              <Button
                onClick={activeTab === "coupons" ? openCreateCouponModal : openCreateDiscountModal}
                className={`text-white font-bold rounded-xl text-xs ${
                  activeTab === "coupons"
                    ? "bg-pink-600 hover:bg-pink-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                <Plus size={14} className="mr-1.5" />
                {activeTab === "coupons" ? "Add First Coupon" : "Add First Store Discount"}
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Identifier / Code</th>
                      <th className="py-3.5 px-6">Discount Benefit</th>
                      <th className="py-3.5 px-6">Requirements</th>
                      <th className="py-3.5 px-6">Usage &amp; Expiry</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedList.map((disc) => (
                      <tr key={disc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                disc.discountType === "percentage"
                                  ? "bg-pink-50 text-pink-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {disc.discountType === "percentage" ? (
                                <Percent size={14} />
                              ) : (
                                <DollarSign size={14} />
                              )}
                            </div>
                            <div>
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {disc.code}
                              </span>
                              {disc.description && (
                                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs truncate">
                                  {disc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 font-bold text-slate-900">
                          {disc.discountType === "percentage"
                            ? `${disc.discountValue}% OFF`
                            : `-${formatCurrency("NGN", disc.discountValue)}`}
                        </td>

                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {disc.minOrderAmount ? (
                            <span>Min spend {formatCurrency("NGN", disc.minOrderAmount)}</span>
                          ) : (
                            <span className="text-slate-400">No minimum</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-slate-500 space-y-0.5">
                          <div>
                            {disc.maxUsageLimit ? (
                              <span className="font-semibold text-slate-700">
                                {disc.usageCount || 0} / {disc.maxUsageLimit} used
                              </span>
                            ) : (
                              <span>{disc.usageCount || 0} uses (unlimited)</span>
                            )}
                          </div>
                          {disc.expiryDate && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar size={11} />
                              <span>Expires {new Date(disc.expiryDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleToggleStatus(disc)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                              disc.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            <Power size={11} />
                            {disc.isActive ? "Active" : "Disabled"}
                          </button>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(disc)}
                              className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-xl"
                            >
                              <Edit size={14} />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDiscount(disc.id, disc.code)}
                                className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
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
            </div>
          )}
        </div>

        {/* CREATE / EDIT MODAL */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900">
                {editingDiscount
                  ? `Edit ${formData.isAutomaticDiscount ? "Store Discount" : "Coupon Code"}`
                  : `Create New ${formData.isAutomaticDiscount ? "Store Discount" : "Coupon Code"}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {formData.isAutomaticDiscount
                  ? "Configure automatic storewide or promotional discounts."
                  : "Configure coupon code parameters and usage rules for customer checkout."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveDiscount} className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">
                  {formData.isAutomaticDiscount ? "Discount Title / Name" : "Coupon Code"}
                </Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={formData.isAutomaticDiscount ? "PROMO-FLASH-SALE" : "e.g. FLASH20"}
                  required
                  className="font-mono uppercase font-bold text-xs rounded-xl h-9"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">Description (Optional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 10% discount on initial orders"
                  className="text-xs rounded-xl h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">Discount Type</Label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({ ...formData, discountType: e.target.value as "percentage" | "fixed" })
                    }
                    className="w-full h-9 rounded-xl border border-slate-300 text-xs bg-white px-2.5 font-bold outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">
                    {formData.discountType === "percentage" ? "Percentage Value (%)" : "Fixed Amount (₦)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    required
                    className="text-xs rounded-xl h-9 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">Min. Order Value (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Optional (e.g. 50000)"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="text-xs rounded-xl h-9"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">Usage Limit</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited if empty"
                    value={formData.maxUsageLimit}
                    onChange={(e) => setFormData({ ...formData, maxUsageLimit: e.target.value })}
                    className="text-xs rounded-xl h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">Expiration Date</Label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="text-xs rounded-xl h-9"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="discIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4"
                />
                <Label htmlFor="discIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Activate discount immediately
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                  {editingDiscount ? "Save Changes" : "Create Discount"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
