"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart, CartItem as CartItemType, getEffectiveCartItemPrice } from "@/providers/CartProvider";
import { ChangeEvent, useState } from "react";
import { X, Tag, Sparkles } from "lucide-react";
import { CartItemImage } from "./CartItemImage";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart, cart } = useCart();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value);
    if (!isNaN(newQuantity)) {
      setIsUpdating(true);
      updateQuantity(item.cartItemId, newQuantity);
      setIsUpdating(false);
    }
  };

  const incrementQuantity = () => {
    setIsUpdating(true);
    updateQuantity(item.cartItemId, item.quantity + 1);
    setIsUpdating(false);
  };

  const decrementQuantity = () => {
    setIsUpdating(true);
    updateQuantity(item.cartItemId, item.quantity - 1);
    setIsUpdating(false);
  };

  // Authoritative dynamic tier and volume pricing calculation
  const effective = getEffectiveCartItemPrice(item, cart);
  const isDiscountActive = effective.discountPercentage > 0;
  const itemSubtotal = effective.unitPrice * item.quantity;

  const formattedSubtotal = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(itemSubtotal);

  const formattedEffectiveUnitPrice = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(effective.unitPrice);

  // Check if there is an upcoming tier nudge
  const sortedTiers = Array.isArray(item.pricingTiers)
    ? [...item.pricingTiers].sort((a, b) => a.minQuantity - b.minQuantity)
    : [];
  const nextTier = sortedTiers.find((t) => t.minQuantity > item.quantity);
  const unitsNeeded = nextTier ? nextTier.minQuantity - item.quantity : 0;

  return (
    <div className="flex items-start gap-4 py-4 border-b">
      <div className="relative aspect-square w-16 overflow-hidden rounded-xl border border-slate-200 shrink-0">
        <CartItemImage
          src={item.imageUrl || ""}
          alt={item.name || "Product image"}
          className="flex-none bg-secondary object-cover"
          width={110}
          height={110}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 leading-snug">{item.name}</h3>
            {item.variant && (
              <p className="text-xs text-slate-500 mt-0.5">{item.variant}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeFromCart(item.cartItemId)}
            aria-label="Remove item"
            className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Pricing & Tier Status Display */}
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isDiscountActive ? (
              <div className="flex items-baseline gap-1.5">
                <span className="line-through text-slate-400 text-xs">
                  {item.priceData.formatted.price}
                </span>
                <span className="font-bold text-orange-600 text-sm">
                  {formattedEffectiveUnitPrice}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">
                    (per item)
                  </span>
                </span>
              </div>
            ) : item.priceData.discountedPrice ? (
              <div className="flex items-baseline gap-1.5">
                <span className="line-through text-slate-400 text-xs">
                  {item.priceData.formatted.price}
                </span>
                <span className="font-bold text-orange-600 text-sm">
                  {item.priceData.formatted.discountedPrice}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">
                    (per item)
                  </span>
                </span>
              </div>
            ) : (
              <span className="font-bold text-slate-900 text-sm">
                {item.priceData.formatted.price}
                <span className="text-[10px] font-normal text-slate-500 ml-1">
                  (per item)
                </span>
              </span>
            )}
          </div>

          {/* Active Wholesale Tier or Volume Discount Badge */}
          {effective.isVolumeDiscountApplied ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
              <Sparkles size={11} className="text-emerald-600" />
              <span>
                Volume Wholesale Applied: {effective.discountPercentage}% OFF ({effective.cumulativeVolume} {effective.volumeUnit} equivalent reached)
              </span>
            </div>
          ) : effective.appliedTier ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
              <Sparkles size={11} className="text-emerald-600" />
              <span>
                Bulk Tier Applied: {effective.discountPercentage}% OFF ({effective.appliedTier?.minQuantity}+ items)
              </span>
            </div>
          ) : null}

          {/* Volume Stacking Nudge if threshold is set but not yet met */}
          {effective.volumeThreshold && !effective.isVolumeDiscountApplied && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-medium">
              <Tag size={10} className="text-orange-600" />
              <span>
                Add {Math.max(0, effective.volumeThreshold - effective.cumulativeVolume)} more {effective.volumeUnit} across any container size to unlock {item.volumeDiscountPercentage}% bulk wholesale discount!
              </span>
            </div>
          )}

          {/* Quantity Tier Nudge */}
          {!isDiscountActive && nextTier && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-medium">
              <Tag size={10} className="text-orange-600" />
              <span>
                Add {unitsNeeded} more to unlock {nextTier.discountPercentage}% bulk discount!
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={decrementQuantity}
              disabled={item.quantity <= 1 || isUpdating}
              className="h-7 w-7 rounded-lg text-slate-700"
            >
              -
            </Button>
            <Input
              type="number"
              min="1"
              value={item.quantity}
              onChange={handleQuantityChange}
              className="w-14 h-7 text-center text-xs font-bold px-1 rounded-lg"
              disabled={isUpdating}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={incrementQuantity}
              disabled={isUpdating}
              className="h-7 w-7 rounded-lg text-slate-700"
            >
              +
            </Button>
          </div>

          {/* Item Subtotal */}
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">
              {item.quantity} &times; {formattedEffectiveUnitPrice}
            </span>
            <span className="font-black text-sm text-slate-900">{formattedSubtotal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
