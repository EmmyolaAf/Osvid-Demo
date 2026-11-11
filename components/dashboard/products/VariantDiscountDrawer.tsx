"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PricingTierItem, ProductVariation } from "@/types/auth";
import {
  calculateEffectiveVariantPrice,
  VariantFlashSaleConfig,
} from "@/lib/pricing/variant-pricing-engine";
import formatCurrency from "@/helpers/formatCurrency";
import {
  Tag,
  Plus,
  Trash2,
  Sparkles,
  ShieldAlert,
  Percent,
  Calendar,
  Layers,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface VariantDiscountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  variant: ProductVariation;
  variantIndex: number;
  baseProductPrice: number;
  onSaveVariantDiscount: (
    index: number,
    updates: Partial<ProductVariation>
  ) => void;
}

export function VariantDiscountDrawer({
  isOpen,
  onClose,
  variant,
  variantIndex,
  baseProductPrice,
  onSaveVariantDiscount,
}: VariantDiscountDrawerProps) {
  // Stepped Volume Tiers state
  const [tiers, setTiers] = useState<PricingTierItem[]>(() => {
    return Array.isArray(variant.pricingTiers) && variant.pricingTiers.length > 0
      ? variant.pricingTiers
      : [
          { minQuantity: 5, discountPercentage: 5 },
          { minQuantity: 10, discountPercentage: 10 },
        ];
  });

  // Promotional / Flash Sale state
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">(
    variant.discountType || "percentage"
  );
  const [discountValue, setDiscountValue] = useState<string>(
    variant.discountValue !== undefined ? variant.discountValue.toString() : ""
  );
  const [badgeText, setBadgeText] = useState<string>(
    variant.badgeText || "Special Flash Deal"
  );
  const [startsAt, setStartsAt] = useState<string>(
    variant.startsAt || variant.saleStartDate || ""
  );
  const [endsAt, setEndsAt] = useState<string>(
    variant.endsAt || variant.saleEndDate || ""
  );
  const [isFlashSaleActive, setIsFlashSaleActive] = useState<boolean>(
    variant.isFlashSaleActive !== undefined
      ? variant.isFlashSaleActive
      : Boolean(variant.discountValue || variant.salePrice)
  );

  // Cost Floor Guardrails state
  const [minPriceFloor, setMinPriceFloor] = useState<string>(
    variant.minPriceFloor !== undefined ? variant.minPriceFloor.toString() : ""
  );
  const [costPrice, setCostPrice] = useState<string>(
    variant.costPrice !== undefined ? variant.costPrice.toString() : ""
  );

  // Handlers for Volume Tiers
  const handleAddTier = () => {
    const last = tiers[tiers.length - 1];
    const nextMin = last ? last.minQuantity + 5 : 5;
    const nextPct = last ? Math.min(100, (last.discountPercentage || 0) + 5) : 5;
    setTiers([...tiers, { minQuantity: nextMin, discountPercentage: nextPct }]);
  };

  const handleRemoveTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const handleUpdateTier = (idx: number, field: keyof PricingTierItem, val: any) => {
    const copy = [...tiers];
    copy[idx] = { ...copy[idx], [field]: Number(val) || 0 };
    setTiers(copy);
  };

  // Live simulation for previewing effective prices
  const previewCalculation = (qty: number) => {
    const parsedFloor = parseFloat(minPriceFloor) || undefined;
    const parsedCost = parseFloat(costPrice) || undefined;
    const parsedDiscountVal = parseFloat(discountValue) || undefined;

    return calculateEffectiveVariantPrice({
      baseProductPrice,
      variant: {
        ...variant,
        minPriceFloor: parsedFloor,
        costPrice: parsedCost,
        pricingTiers: tiers,
        discountType,
        discountValue: parsedDiscountVal,
        badgeText,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        isFlashSaleActive,
      },
      quantity: qty,
    });
  };

  const handleApply = () => {
    const parsedFloor = minPriceFloor ? parseFloat(minPriceFloor) : undefined;
    const parsedCost = costPrice ? parseFloat(costPrice) : undefined;
    const parsedDiscountVal = discountValue ? parseFloat(discountValue) : undefined;

    const validTiers = tiers.filter((t) => t.minQuantity > 0 && ((t.discountPercentage || 0) > 0 || (t.tierPrice || 0) > 0));

    onSaveVariantDiscount(variantIndex, {
      pricingTiers: validTiers.length > 0 ? validTiers : undefined,
      pricingTierName: validTiers.length > 0 ? `Custom Ladder (${validTiers.length} tiers)` : undefined,
      pricingTierId: validTiers.length > 0 ? "custom" : undefined,
      minPriceFloor: parsedFloor,
      costPrice: parsedCost,
      discountType: isFlashSaleActive && parsedDiscountVal ? discountType : undefined,
      discountValue: isFlashSaleActive && parsedDiscountVal ? parsedDiscountVal : undefined,
      badgeText: isFlashSaleActive && parsedDiscountVal ? badgeText : undefined,
      startsAt: isFlashSaleActive && startsAt ? startsAt : undefined,
      endsAt: isFlashSaleActive && endsAt ? endsAt : undefined,
      isFlashSaleActive: isFlashSaleActive && Boolean(parsedDiscountVal),
    });

    onClose();
  };

  const attributeString = Object.entries(variant.attributes || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" • ") || variant.sku || `Variant #${variantIndex + 1}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider">
            <Tag size={14} />
            Per-Variant Discounting Engine
          </div>
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center justify-between">
            <span>{variant.sku || `Variant #${variantIndex + 1}`}</span>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              Base: {formatCurrency("NGN", variant.priceOverride || variant.regularPrice || variant.price || baseProductPrice)}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Configure independent volume ladders, flash sales, and price-floor safeguards for:{" "}
            <strong className="text-slate-800">{attributeString}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* 1. VOLUME LADDER SECTION */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Layers size={14} className="text-orange-600" />
                  1. Stepped Volume Pricing Ladder
                </h4>
                <p className="text-[11px] text-slate-500">
                  Reward bulk orders with automatic volume tier discounts specific to this variant SKU.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddTier}
                className="h-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1 shadow-xs"
              >
                <Plus size={12} /> Add Tier
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                No volume tiers configured. Variant will sell at standard unit price for all order quantities.
              </div>
            ) : (
              <div className="space-y-2">
                {tiers.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 font-mono text-[11px]">#{idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] font-bold text-slate-600">Min Qty:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={t.minQuantity}
                          onChange={(e) => handleUpdateTier(idx, "minQuantity", e.target.value)}
                          className="h-8 w-16 text-center font-bold rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] font-bold text-slate-600">Max Qty:</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="&infin;"
                          value={t.maxQuantity || ""}
                          onChange={(e) => handleUpdateTier(idx, "maxQuantity", e.target.value)}
                          className="h-8 w-16 text-center rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] font-bold text-emerald-700">Discount %:</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={t.discountPercentage || ""}
                          onChange={(e) => handleUpdateTier(idx, "discountPercentage", e.target.value)}
                          className="h-8 w-16 text-center font-black text-emerald-600 rounded-lg text-xs"
                        />
                        <span className="text-[10px] font-bold text-slate-400">%</span>
                      </div>

                      <span className="text-slate-300">or</span>

                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] font-bold text-slate-600">Fixed Tier Price:</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Override ₦"
                          value={t.tierPrice || t.unitPrice || ""}
                          onChange={(e) => handleUpdateTier(idx, "tierPrice", e.target.value)}
                          className="h-8 w-24 text-right rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTier(idx)}
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. PROMOTIONAL / FLASH SALE SECTION */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-amber-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  2. Promotional Flash Sale (Time-Bound)
                </h4>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isFlashSaleActive}
                  onChange={(e) => setIsFlashSaleActive(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                Enable Flash Deal
              </label>
            </div>

            {isFlashSaleActive && (
              <div className="space-y-3 pt-2 bg-white p-3.5 rounded-xl border border-amber-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-600">Discount Type</Label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="mt-1 w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"
                    >
                      <option value="percentage">Percentage (% Off)</option>
                      <option value="fixed_amount">Fixed Amount (₦ Off)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold text-slate-600">
                      Discount Value ({discountType === "percentage" ? "%" : "₦"})
                    </Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="any"
                      placeholder={discountType === "percentage" ? "e.g. 15" : "e.g. 2000"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs font-bold text-amber-700"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold text-slate-600">Badge Text (UI)</Label>
                    <Input
                      placeholder="e.g. Early Bird 15% Off"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                      <Calendar size={11} /> Starts At (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                      <Calendar size={11} /> Ends At (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. COST & PRICE FLOOR GUARDRAILS */}
          <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                3. Cost Floor &amp; Profit Guardrails
              </h4>
            </div>
            <p className="text-[11px] text-slate-500">
              Set an absolute minimum price floor to prevent volume tiers or flash discounts from selling below your operational acquisition cost.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-rose-200">
              <div>
                <Label className="text-[10px] font-bold text-slate-700">
                  Cost of Production / SKU Acquisition (₦)
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 8500"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="mt-1 h-8 rounded-lg text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400">Internal baseline for margin calculation</span>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-rose-700">
                  Absolute Minimum Price Floor (₦) *
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 10000"
                  value={minPriceFloor}
                  onChange={(e) => setMinPriceFloor(e.target.value)}
                  className="mt-1 h-8 rounded-lg text-xs font-mono font-bold text-rose-700 border-rose-200"
                />
                <span className="text-[10px] text-rose-500 font-medium">
                  Guaranteed minimum: No discount can price lower than this
                </span>
              </div>
            </div>
          </div>

          {/* 4. REAL-TIME ENGINE PRICE SIMULATION */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-orange-400">
                <Sparkles size={13} />
                Engine Simulation Preview (Sequential Order of Operations)
              </span>
              <span className="text-[10px] text-slate-400">Deterministic Pure Function Output</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              {[1, 5, 10, 50].map((testQty) => {
                const res = previewCalculation(testQty);
                return (
                  <div key={testQty} className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Qty: {testQty} {testQty === 1 ? "unit" : "units"}
                    </span>
                    <p className="text-sm font-black text-white font-mono">
                      {formatCurrency("NGN", res.unitPrice)}
                      <span className="text-[9px] font-normal text-slate-400 block">/ unit</span>
                    </p>
                    <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-700/60">
                      <span className="text-emerald-400 font-bold">
                        {res.discountPercentage > 0 ? `-${res.discountPercentage}%` : "No discount"}
                      </span>
                      {res.isFloorEnforced && (
                        <span className="text-amber-400 font-bold text-[9px] bg-amber-400/20 px-1 rounded">
                          Floor
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <CheckCircle2 size={14} />
            Apply Variant Discounting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

