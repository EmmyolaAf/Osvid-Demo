"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PricingTierItem } from "@/types/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Star,
  ShoppingCart,
  Loader2,
  Check,
  Eye,
  Tag,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { FadeInAnimationWrapper } from "../custom-animation-wrapper";
import formatCurrency from "@/helpers/formatCurrency";
import { useCart } from "@/providers/CartProvider";
import { toast } from "sonner";
import type { CartItem } from "@/providers/CartProvider";

interface ProductCardProps {
  product: {
    id: string;
    slug: string;
    name: string;
    price?: number;
    discountPrice?: number;
    image?: string;
    imageUrl?: string;
    variant?: string;
    category?: string;
    productType?: "simple" | "variable" | "grouped";
    variations?: any[];
    pricingTierId?: string;
    pricingTierName?: string;
    pricingTiers?: PricingTierItem[];
    volumeDiscountThreshold?: number;
    volumeDiscountPercentage?: number;
    volumeUnit?: string;
  };
  index: number;
  currency?: string;
  rating?: number;
}

export default function ProductCard({
  product,
  index,
  currency = "NGN",
  rating = 5,
}: ProductCardProps) {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { cart, addToCart } = useCart();

  const mainImage = product.imageUrl || product.image || "/images/placeholder.webp";
  const isVariableWithOptions =
    product.productType === "variable" &&
    Array.isArray(product.variations) &&
    product.variations.length > 1;

  // Determine effective display price
  let displayPrice = product.price;
  let displayDiscountPrice = product.discountPrice;

  if (
    (!displayPrice || displayPrice <= 0) &&
    Array.isArray(product.variations) &&
    product.variations.length > 0
  ) {
    const validPrices = product.variations
      .map((v) => Number(v.salePrice || v.regularPrice || v.price))
      .filter((p) => !isNaN(p) && p > 0);
    if (validPrices.length > 0) {
      displayPrice = Math.min(...validPrices);
    }
  }

  const hasDiscount =
    displayDiscountPrice !== undefined &&
    displayPrice !== undefined &&
    displayDiscountPrice < displayPrice;

  const discountPercentage = hasDiscount
    ? Math.round(
        ((Number(displayPrice) - Number(displayDiscountPrice)) /
          Number(displayPrice)) *
          100
      )
    : 0;

  const isInCart = cart.some(
    (item) => item.id === product.id && (!product.variant || item.variant === product.variant)
  );

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInCart) {
      toast.info("This item is already in your cart");
      return;
    }

    setIsAddingToCart(true);
    try {
      const cartItem: Omit<CartItem, "cartItemId" | "quantity"> = {
        id: product.id,
        name: product.name,
        priceData: {
          price: displayPrice || 0,
          discountedPrice: displayDiscountPrice,
          currency,
          formatted: {
            price: formatCurrency(currency, displayPrice || 0),
            ...(hasDiscount && {
              discountedPrice: formatCurrency(
                currency,
                displayDiscountPrice || 0
              ),
            }),
          },
        },
        imageUrl: mainImage,
        variant: product.variant,
        pricingTierId: product.pricingTierId,
        pricingTierName: product.pricingTierName,
        pricingTiers: product.pricingTiers,
        volumeDiscountThreshold: product.volumeDiscountThreshold,
        volumeDiscountPercentage: product.volumeDiscountPercentage,
        volumeUnit: product.volumeUnit,
      };

      await addToCart(cartItem, 1);
      setJustAdded(true);
      toast.success(`${product.name} added to cart!`);
      setTimeout(() => setJustAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      toast.error("Failed to add to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <FadeInAnimationWrapper
      type="fadeInY"
      index={index}
      className="group flex flex-col bg-white rounded-2xl border border-slate-200/90 hover:border-orange-500/40 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 overflow-hidden"
    >
      {/* Product Image Frame */}
      <div
        className="relative w-full aspect-square overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link
          href={`/shop/${product.slug}`}
          className="absolute inset-0 z-10"
          aria-label={`View ${product.name}`}
        >
          <span className="sr-only">View {product.name}</span>
        </Link>

        {product.image ? (
          <Image
            src={mainImage}
            alt={product.name || "Product"}
            fill
            className={`object-cover transition-transform duration-700 ease-out ${
              isHovered ? "scale-108" : "scale-100"
            }`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={index < 4}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <ShoppingCart size={40} className="mb-2 text-slate-300" />
            <span className="text-xs font-medium text-slate-400">OSVID Chemical Formulation</span>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-3 inset-x-3 flex items-start justify-between z-20 pointer-events-none">
          <div className="flex flex-col gap-1.5 items-start">
            {hasDiscount && (
              <span className="bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md tracking-wider">
                {discountPercentage}% OFF
              </span>
            )}
            {product.pricingTierName && (
              <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm text-orange-700 border border-orange-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                <Tag size={10} />
                Bulk Tier
              </span>
            )}
          </div>

          {product.category && (
            <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              {product.category}
            </span>
          )}
        </div>

        {/* Floating Quick Action Overlay on Desktop Hover */}
        <div
          className={`absolute inset-x-3 bottom-3 z-20 flex gap-2 transition-all duration-300 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none hidden lg:flex"
          }`}
        >
          <Link
            href={`/shop/${product.slug}`}
            className="flex-1"
          >
            <Button
              size="sm"
              variant="outline"
              className="w-full h-9 bg-white/95 hover:bg-white text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-md backdrop-blur-sm gap-1.5"
            >
              <Eye size={13} className="text-orange-600" />
              <span>Details</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1.5">
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {product.category || "Industrial Formulation"}
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
              <Star size={13} fill="currentColor" />
              <span>{rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Product Title */}
          <Link
            href={`/shop/${product.slug}`}
            className="block group-hover:text-orange-600 transition-colors"
          >
            <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Pricing & Cart Action */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              {displayPrice !== undefined && (
                <>
                  <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {isVariableWithOptions && !hasDiscount ? "From " : ""}
                    {hasDiscount
                      ? formatCurrency(currency, Number(displayDiscountPrice))
                      : formatCurrency(currency, Number(displayPrice))}
                  </span>
                  {hasDiscount && displayDiscountPrice !== undefined ? (
                    <span className="text-xs text-slate-400 line-through font-medium">
                      {formatCurrency(currency, Number(displayPrice))}
                    </span>
                  ) : null}
                </>
              )}
            </div>

            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={11} />
              In Stock
            </span>
          </div>

          {/* Add to Cart or Select Options for Variable Products */}
          {isVariableWithOptions ? (
            <Link href={`/shop/${product.slug}`} className="block w-full">
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl text-xs font-bold transition-all border-slate-300 hover:border-orange-600 hover:bg-orange-50 text-slate-800 hover:text-orange-600 flex items-center justify-center gap-2"
              >
                <Layers className="h-3.5 w-3.5 text-orange-600" />
                <span>Select Options ({product.variations?.length} sizes)</span>
              </Button>
            </Link>
          ) : (
            <Button
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              className={`w-full h-10 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                justAdded || isInCart
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-orange-600 hover:bg-orange-700 text-white hover:shadow-orange-600/20 hover:shadow-md"
              }`}
            >
              {isAddingToCart ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding to Cart...</span>
                </>
              ) : justAdded || isInCart ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isInCart ? "In Your Cart" : "Added to Cart!"}</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Add to Cart</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </FadeInAnimationWrapper>
  );
}
