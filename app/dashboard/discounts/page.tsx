"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getDiscountsFromDb,
  saveDiscountInDb,
  deleteDiscountFromDb,
  getPricingTiersFromDb,
  savePricingTierInDb,
  deletePricingTierFromDb,
  getProductsFromDb,
} from "@/lib/firebase/firestore";
import { DiscountCode, PricingTierGroup, PricingTierItem, Product } from "@/types/auth";
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
  SlidersHorizontal,
  Package,
  Power,
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
  const [activeTab, setActiveTab] = useState<"coupons" | "pricing_tiers">("coupons");

  // Coupons State
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
    applicableProductId: "",
    isActive: true,
  });

  // Pricing Tiers State
  const [pricingTiers, setPricingTiers] = useState<PricingTierGroup[]>([]);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [submittingTier, setSubmittingTier] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTierGroup | null>(null);

  const [tierForm, setTierForm] = useState({
    name: "",
    description: "",
    isActive: true,
    brackets: [
      { minQuantity: 10, discountPercentage: 2 },
      { minQuantity: 20, discountPercentage: 5 },
    ] as PricingTierItem[],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [discList, tierList, prodList] = await Promise.all([
        getDiscountsFromDb(),
        getPricingTiersFromDb(),
        getProductsFromDb(),
      ]);
      setDiscounts(discList);
      setPricingTiers(tierList);
      setProducts(prodList);
    } catch (err: any) {
      console.error("Error loading discounts & pricing tiers:", err);
      toast.error(err?.message || "Failed to load discount data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Coupon Handlers
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
      applicableProductId: "",
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
      applicableProductId: d.applicableProductIds && d.applicableProductIds.length > 0 ? d.applicableProductIds[0] : "",
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
        applicableProductIds: formData.applicableProductId ? [formData.applicableProductId] : undefined,
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
      loadData();
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
    const existingCoupon = discounts.find((d) => d.id === id);
    if (existingCoupon && Number(existingCoupon.reservedUsageCount || 0) > 0) {
      toast.error(
        `Cannot delete coupon "${code}" because it has ${existingCoupon.reservedUsageCount} active checkout reservation(s).`
      );
      return;
    }
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

  // Pricing Tier Handlers
  const openCreateTierModal = () => {
    setEditingTier(null);
    setTierForm({
      name: "",
      description: "",
      isActive: true,
      brackets: [
        { minQuantity: 10, discountPercentage: 2 },
        { minQuantity: 20, discountPercentage: 5 },
      ],
    });
    setIsTierModalOpen(true);
  };

  const openEditTierModal = (tier: PricingTierGroup) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      description: tier.description || "",
      isActive: tier.isActive,
      brackets: tier.tiers && tier.tiers.length > 0 ? tier.tiers : [{ minQuantity: 10, discountPercentage: 2 }],
    });
    setIsTierModalOpen(true);
  };

  const handleAddBracket = () => {
    const lastBracket = tierForm.brackets[tierForm.brackets.length - 1];
    const nextMin = lastBracket ? lastBracket.minQuantity + 10 : 10;
    const nextPct = lastBracket ? lastBracket.discountPercentage + 3 : 2;
    setTierForm((prev) => ({
      ...prev,
      brackets: [...prev.brackets, { minQuantity: nextMin, discountPercentage: nextPct }],
    }));
  };

  const handleRemoveBracket = (idx: number) => {
    if (tierForm.brackets.length <= 1) {
      toast.warning("At least one quantity bracket is required.");
      return;
    }
    setTierForm((prev) => ({
      ...prev,
      brackets: prev.brackets.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateBracket = (idx: number, field: keyof PricingTierItem, value: any) => {
    setTierForm((prev) => {
      const brackets = [...prev.brackets];
      brackets[idx] = { ...brackets[idx], [field]: Number(value) || 0 };
      return { ...prev, brackets };
    });
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.name.trim()) {
      toast.error("Please enter a name for this pricing tier.");
      return;
    }

    try {
      setSubmittingTier(true);
      const res = await savePricingTierInDb({
        id: editingTier?.id,
        name: tierForm.name.trim(),
        description: tierForm.description.trim(),
        tiers: tierForm.brackets,
        isActive: tierForm.isActive,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to commit pricing tier.");
        return;
      }

      toast.success(
        editingTier
          ? `Pricing Tier "${tierForm.name}" updated successfully!`
          : `Pricing Tier "${tierForm.name}" saved to database!`
      );
      setIsTierModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to commit pricing tier.");
    } finally {
      setSubmittingTier(false);
    }
  };

  const handleDeleteTier = async (id: string, name: string) => {
    if (!confirm(`Delete pricing tier "${name}"? Products using this tier will revert to standard retail pricing.`)) {
      return;
    }
    try {
      const res = await deletePricingTierFromDb(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete pricing tier.");
        return;
      }
      toast.success(`Pricing tier "${name}" removed.`);
      loadData();
    } catch (err: any) {
      toast.error("Error deleting pricing tier.");
    }
  };

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
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Discounts &amp; Pricing Tiers</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Configure coupon codes and automatic quantity-based wholesale pricing tiers for products.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "coupons" ? (
              <Button
                onClick={openCreateModal}
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md shadow-pink-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>Create Coupon Code</span>
              </Button>
            ) : (
              <Button
                onClick={openCreateTierModal}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>Create Pricing Tier</span>
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
            <Tag size={16} /> Coupon Codes ({discounts.length})
          </button>
          <button
            onClick={() => setActiveTab("pricing_tiers")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "pricing_tiers"
                ? "border-orange-600 text-orange-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <SlidersHorizontal size={16} /> Quantity Pricing Tiers ({pricingTiers.length})
          </button>
        </div>

        {/* TAB 1: COUPONS */}
        {activeTab === "coupons" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-pink-600 mb-2" />
                <p className="text-sm">Loading discount coupons...</p>
              </div>
            ) : discounts.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-2xl border border-slate-200">
                <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Discount Codes Active</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Generate promotional voucher codes with custom percentage discounts or fixed deductions.
                </p>
                <Button
                  onClick={openCreateModal}
                  className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl"
                >
                  Create First Coupon
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discounts.map((disc) => {
                  const targetProd = disc.applicableProductIds && disc.applicableProductIds.length > 0
                    ? products.find((p) => p.id === disc.applicableProductIds![0])
                    : null;

                  return (
                    <div
                      key={disc.id}
                      className={`bg-white rounded-2xl p-5 border transition-all relative overflow-hidden flex flex-col justify-between ${
                        disc.isActive ? "border-slate-200 shadow-sm" : "border-slate-200/60 opacity-60 bg-slate-50/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-mono font-black text-lg text-slate-900 bg-slate-100 px-3 py-1 rounded-xl tracking-wider">
                            {disc.code}
                          </span>
                          <button
                            onClick={() => handleToggleStatus(disc)}
                            title={disc.isActive ? "Turn Off Coupon" : "Turn On Coupon"}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                              disc.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            }`}
                          >
                            <Power size={11} />
                            {disc.isActive ? "Active (ON)" : "Disabled (OFF)"}
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 font-medium mb-3">
                          {disc.description || "General promotional discount"}
                        </p>

                        <div className="space-y-1.5 text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex justify-between">
                            <span>Discount:</span>
                            <span className="font-bold text-pink-600">
                              {disc.discountType === "percentage" ? `${disc.discountValue}% OFF` : `₦${disc.discountValue.toLocaleString()} OFF`}
                            </span>
                          </div>
                          {targetProd ? (
                            <div className="flex justify-between">
                              <span>Target Product:</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[140px]">{targetProd.name}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span>Applicable:</span>
                              <span className="font-medium text-slate-600">All Products</span>
                            </div>
                          )}
                          {disc.minOrderAmount ? (
                            <div className="flex justify-between">
                              <span>Min Subtotal:</span>
                              <span className="font-semibold text-slate-800">₦{disc.minOrderAmount.toLocaleString()}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between">
                            <span>Redemptions:</span>
                            <span className="font-semibold text-slate-800">
                              {disc.usageCount || 0} {disc.maxUsageLimit ? `/ ${disc.maxUsageLimit}` : "uses"}
                            </span>
                          </div>
                          {disc.expiryDate && (
                            <div className="flex justify-between">
                              <span>Expires:</span>
                              <span className="font-semibold text-slate-800">
                                {new Date(disc.expiryDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(disc)}
                          className="h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 gap-1"
                        >
                          <Edit size={13} /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(disc.id, disc.code)}
                          className="h-8 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                        >
                          <Trash2 size={13} /> Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUANTITY PRICING TIERS */}
        {activeTab === "pricing_tiers" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
              <SlidersHorizontal className="text-amber-700 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-amber-950">How Quantity Pricing Tiers Work:</p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  Every user signs up natively without needing to apply for a wholesale account. When you assign a pricing tier to a product (e.g. 10 items = 2% discount, 20 items = 5% discount), the discount <strong>automatically kicks in</strong> as soon as the customer has 10 or more in their cart!
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
                <p className="text-sm">Loading pricing tiers...</p>
              </div>
            ) : pricingTiers.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-2xl border border-slate-200">
                <SlidersHorizontal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Quantity Pricing Tiers Configured</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Create a pricing tier template (e.g., 10 units = 2% off, 20 units = 5% off) and select it when creating or editing any product.
                </p>
                <Button
                  onClick={openCreateTierModal}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl"
                >
                  Create First Pricing Tier
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-orange-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-base text-slate-900">{tier.name}</h3>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          {tier.tiers.length} Brackets
                        </span>
                      </div>
                      {tier.description && (
                        <p className="text-xs text-slate-500 mb-3">{tier.description}</p>
                      )}

                      {/* Brackets preview table */}
                      <div className="border border-slate-100 rounded-xl overflow-hidden text-xs mb-4">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                            <tr>
                              <th className="py-1.5 px-3">Units in Cart</th>
                              <th className="py-1.5 px-3 text-right">Discount Given</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {tier.tiers.map((b, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-1.5 px-3 font-medium">
                                  {b.minQuantity} {b.maxQuantity ? `– ${b.maxQuantity}` : "+"} units
                                </td>
                                <td className="py-1.5 px-3 text-right font-bold text-orange-600">
                                  {b.discountPercentage}% OFF
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditTierModal(tier)}
                        className="h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 gap-1"
                      >
                        <Edit size={13} /> Edit Brackets
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTier(tier.id, tier.name)}
                        className="h-8 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      >
                        <Trash2 size={13} /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: CREATE / EDIT COUPON */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {editingDiscount ? `Edit Coupon: ${editingDiscount.code}` : "Create Promotional Coupon"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Create a voucher code customers can apply at checkout.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveDiscount} className="space-y-4 mt-2">
              <div>
                <Label className="text-xs font-bold text-slate-700">Coupon Code *</Label>
                <Input
                  required
                  placeholder="e.g. CHEMICAL10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 font-mono font-bold uppercase tracking-wider text-sm h-9"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Internal Description</Label>
                <Input
                  placeholder="e.g. 10% discount for special launch promotion"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Discount Type</Label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Naira (₦)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">Value *</Label>
                  <Input
                    required
                    type="number"
                    min="1"
                    max={formData.discountType === "percentage" ? 100 : undefined}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="mt-1 text-xs h-9 font-bold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Target Specific Product (Optional)</Label>
                <select
                  value={formData.applicableProductId}
                  onChange={(e) => setFormData({ ...formData, applicableProductId: e.target.value })}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">Apply to Entire Store (All Products)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Min Cart Total (₦)</Label>
                  <Input
                    type="number"
                    placeholder="None"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="mt-1 text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">Expiry Date</Label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="mt-1 text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="couponActiveCheck"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                />
                <label htmlFor="couponActiveCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Coupon is currently Active (ON)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="h-9 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-pink-600 hover:bg-pink-700 text-white h-9 text-xs font-bold">
                  {submitting ? "Saving..." : editingDiscount ? "Update Coupon" : "Publish Coupon"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL 2: CREATE / EDIT PRICING TIER */}
        <Dialog open={isTierModalOpen} onOpenChange={setIsTierModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {editingTier ? `Edit Pricing Tier: ${editingTier.name}` : "Create Quantity Pricing Tier"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Define the quantity thresholds where bulk discounts automatically kick in.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveTier} className="space-y-4 mt-2">
              <div>
                <Label className="text-xs font-bold text-slate-700">Tier Name *</Label>
                <Input
                  required
                  placeholder="e.g. Standard Wholesale (10+ = 2%, 20+ = 5%)"
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  className="mt-1 text-xs h-9 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Description (Optional)</Label>
                <Input
                  placeholder="e.g. Default volume discount for cosmetic ingredients"
                  value={tierForm.description}
                  onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                  className="mt-1 text-xs h-9"
                />
              </div>

              {/* Quantity Brackets Builder */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Quantity Discount Brackets</span>
                  <Button
                    type="button"
                    onClick={handleAddBracket}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-semibold gap-1 bg-white"
                  >
                    <Plus size={12} /> Add Bracket
                  </Button>
                </div>

                <div className="space-y-2">
                  {tierForm.brackets.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                      <div className="flex-1">
                        <Label className="text-[10px] text-slate-400">If Customer Buys At Least:</Label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Input
                            type="number"
                            min="2"
                            value={b.minQuantity}
                            onChange={(e) => handleUpdateBracket(idx, "minQuantity", e.target.value)}
                            className="h-7 text-xs font-bold"
                          />
                          <span className="text-slate-500 text-[11px]">units</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <Label className="text-[10px] text-slate-400">Discount Granted (%):</Label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Input
                            type="number"
                            min="1"
                            max="90"
                            value={b.discountPercentage}
                            onChange={(e) => handleUpdateBracket(idx, "discountPercentage", e.target.value)}
                            className="h-7 text-xs font-bold text-orange-600"
                          />
                          <span className="text-slate-500 text-[11px] font-bold">%</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <Label className="text-[10px] text-slate-400">Volume Equivalent (Optional):</Label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Input
                            type="number"
                            min="1"
                            placeholder="e.g. 120"
                            value={b.minVolumeEquivalent || ""}
                            onChange={(e) => handleUpdateBracket(idx, "minVolumeEquivalent", e.target.value)}
                            className="h-7 text-xs font-semibold"
                          />
                          <span className="text-slate-500 text-[10px]">L/kg</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveBracket(idx)}
                        className="text-slate-400 hover:text-red-500 pt-3 px-1"
                        title="Remove bracket"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsTierModalOpen(false)} className="h-9 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingTier} className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs font-bold">
                  {submittingTier ? "Saving..." : editingTier ? "Update Pricing Tier" : "Save Pricing Tier"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
