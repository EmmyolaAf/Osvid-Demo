"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Product, ProductVariation } from "@/types/auth";
import {
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShieldCheck,
  Truck,
  Sparkles,
  PhoneCall,
  Tag,
  Layers,
} from "lucide-react";
import formatCurrency from "@/helpers/formatCurrency";
import { useCart } from "@/providers/CartProvider";
import { toast } from "sonner";
import { BulkDiscount } from "@/components/reusables/CompactBulkOrder";
import companyData from "@/data/company";
import BackInStockNotificationButton from "@/components/reusables/BackInStockNotificationButton";

interface ProductDetailsClientProps {
  product: Product;
}

export default function ProductDetailsClient({ product }: ProductDetailsClientProps) {
  const { addToCart, openCart } = useCart();
  const isVariable = product.productType === "variable" && (product.variations?.length || 0) > 0;
  const isGrouped = product.productType === "grouped";

  // Attributes state for variable products
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() => {
    if (isVariable && product.attributes && product.attributes.length > 0) {
      const initial: Record<string, string> = {};
      product.attributes.forEach((attr) => {
        if (attr.values && attr.values.length > 0) {
          initial[attr.name] = attr.values[0];
        }
      });
      return initial;
    }
    return {};
  });

  // Find matching variation based on selectedAttributes
  const selectedVariation: ProductVariation | undefined = useMemo(() => {
    if (!isVariable || !product.variations || product.variations.length === 0) {
      return undefined;
    }
    return product.variations.find((v) => {
      const attrs = v.attributes || {};
      return Object.entries(selectedAttributes).every(
        ([key, val]) => !attrs[key] || attrs[key] === val
      );
    }) || product.variations[0];
  }, [isVariable, product.variations, selectedAttributes]);

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(
    selectedVariation?.imageUrl || product.imageUrl || "/images/placeholder.webp"
  );
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Dynamic values depending on variable vs simple product
  const basePrice = selectedVariation ? selectedVariation.price : product.price;
  const salePrice = selectedVariation ? selectedVariation.salePrice : product.discountPrice;
  const hasDiscount = salePrice !== undefined && salePrice > 0 && salePrice < basePrice;
  const currentPrice = hasDiscount ? salePrice! : basePrice;
  const discountPercent = hasDiscount
    ? Math.round(((basePrice - salePrice!) / basePrice) * 100)
    : 0;

  const currentSku = selectedVariation?.sku || product.sku;
  const currentStock = selectedVariation ? selectedVariation.stockQuantity : product.stockQuantity;
  const currentStockStatus = selectedVariation ? selectedVariation.stockStatus : "instock";

  const inStock = currentStock > 0 && currentStockStatus !== "outofstock" && currentStockStatus !== "out_of_stock" && product.isActive !== false;
  const isLowStock = inStock && currentStock <= 10;

  const handleAttributeSelect = (attrName: string, value: string) => {
    const updated = { ...selectedAttributes, [attrName]: value };
    setSelectedAttributes(updated);

    // Look up variation to switch image if available
    if (product.variations) {
      const matching = product.variations.find((v) => {
        const attrs = v.attributes || {};
        return Object.entries(updated).every(
          ([key, val]) => !attrs[key] || attrs[key] === val
        );
      });
      if (matching?.imageUrl) {
        setActiveImage(matching.imageUrl);
      }
    }
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (inStock && next > currentStock) {
        return currentStock;
      }
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!inStock) {
      toast.warning("This item or variation is currently out of stock.");
      return;
    }

    setIsAddingToCart(true);

    try {
      const variantLabel =
        isVariable && Object.keys(selectedAttributes).length > 0
          ? Object.entries(selectedAttributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : product.unit
          ? `Unit: ${product.unit}`
          : undefined;

      addToCart(
        {
          id: product.id,
          name: product.name,
          imageUrl: activeImage,
          variant: variantLabel,
          variationId: selectedVariation?.id,
          variationAttributes: selectedVariation ? selectedAttributes : undefined,
          sku: currentSku,
          pricingTierId: product.pricingTierId,
          pricingTierName: product.pricingTierName,
          pricingTiers: product.pricingTiers,
          priceData: {
            price: basePrice,
            discountedPrice: salePrice,
            currency: "NGN",
            formatted: {
              price: formatCurrency("NGN", basePrice),
              discountedPrice: salePrice ? formatCurrency("NGN", salePrice) : undefined,
            },
          },
        },
        quantity
      );

      openCart();
      toast.success(
        `Added ${quantity}x ${product.name}${
          variantLabel ? ` (${variantLabel})` : ""
        } to cart.`
      );
    } catch (err) {
      console.error("Cart addition error:", err);
      toast.error("Failed to add product to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // WhatsApp Sales Inquiry link
  const cleanPhone = (companyData.whatsapp || "2348000000000").replace(/\D/g, "");
  const waUrl = `https://wa.me/234${cleanPhone}?text=${encodeURIComponent(
    `Hello OSVID Sales, I would like to inquire about ${product.name}${
      selectedVariation ? ` (${Object.entries(selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""
    } (Price: ${formatCurrency("NGN", currentPrice)}, Quantity: ${quantity} ${
      product.unit || "units"
    }).`
  )}`;

  const allImages = [
    product.imageUrl || "/images/placeholder.webp",
    ...(product.galleryImages || []),
    ...(product.variations?.map((v) => v.imageUrl).filter(Boolean) as string[] || []),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      {/* Product Media - Left Column */}
      <div className="lg:col-span-6 space-y-4">
        {/* Main Image Frame */}
        <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm flex items-center justify-center group">
          <Image
            src={activeImage}
            alt={product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
            priority
          />
          {hasDiscount && (
            <div className="absolute top-4 left-4 bg-orange-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-full shadow-md">
              SAVE {discountPercent}%
            </div>
          )}
          {product.isFeatured && (
            <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md text-amber-300 font-bold text-xs px-3 py-1.5 rounded-full border border-amber-300/30 flex items-center gap-1 shadow-md">
              <Sparkles size={13} />
              Featured
            </div>
          )}
        </div>

        {/* Thumbnail Carousel / List */}
        {allImages.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {allImages.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImage(imgUrl)}
                className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${
                  activeImage === imgUrl
                    ? "border-orange-600 ring-2 ring-orange-500/20"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`${product.name} thumbnail ${idx + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Information & Purchase - Right Column */}
      <div className="lg:col-span-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider">
              <Package size={13} />
              {product.category || "Industrial Chemicals"}
            </span>
            {isVariable && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                <Layers size={11} />
                Variable Product
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {product.name}
          </h1>
          {currentSku && (
            <p className="text-xs text-slate-400 font-mono mt-1">
              SKU: {currentSku}
            </p>
          )}
        </div>

        {/* Pricing Block */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-baseline gap-3">
          <span className="text-3xl sm:text-4xl font-black text-orange-600">
            {formatCurrency("NGN", currentPrice)}
          </span>
          {hasDiscount && (
            <span className="text-lg text-slate-400 line-through font-semibold">
              {formatCurrency("NGN", basePrice)}
            </span>
          )}
          {product.unit && (
            <span className="text-xs text-slate-500 font-medium ml-auto">
              Per {product.unit}
            </span>
          )}
        </div>

        {/* Dynamic Variation Options Picker (for Variable Products) */}
        {isVariable && product.attributes && product.attributes.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Select Product Specifications
            </h4>
            <div className="space-y-3">
              {product.attributes.map((attr) => (
                <div key={attr.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{attr.name}:</span>
                    <span className="font-semibold text-orange-600">
                      {selectedAttributes[attr.name] || "None selected"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const isSelected = selectedAttributes[attr.name] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAttributeSelect(attr.name, val)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/30 scale-105"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grouped Product Notice */}
        {isGrouped && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <Layers size={14} className="text-blue-600" />
              Grouped Product Bundle
            </div>
            <p>
              This is a grouped catalog package. Choose your desired child items or contact customer service for bulk packaging options.
            </p>
          </div>
        )}

        {/* Volume & Wholesale Pricing Tiers */}
        {product.pricingTiers && product.pricingTiers.length > 0 && (
          <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-orange-950 flex items-center gap-1.5">
                <Tag size={13} className="text-orange-600" />
                Wholesale &amp; Volume Discounts
              </span>
              <span className="text-[11px] font-bold text-orange-700 bg-orange-100/90 px-2 py-0.5 rounded-full">
                Auto-Applied at Cart
              </span>
            </div>
            <p className="text-xs text-orange-900/80">
              Bulk pricing unlocks automatically when your cart reaches the minimum units below:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {product.pricingTiers.map((tier, idx) => {
                const isReached =
                  quantity >= tier.minQuantity &&
                  (!tier.maxQuantity || quantity <= tier.maxQuantity);
                const tierPrice =
                  tier.unitPrice ||
                  Math.round(currentPrice * (1 - tier.discountPercentage / 100));
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      isReached
                        ? "bg-white border-orange-500 ring-2 ring-orange-500/20 shadow-sm"
                        : "bg-white/80 border-orange-200/60 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{tier.minQuantity}+ {product.unit || "units"}</span>
                      <span className="text-orange-600 font-black">-{tier.discountPercentage}%</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                      {formatCurrency("NGN", tierPrice)} / {product.unit || "unit"}
                    </div>
                    {isReached && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Active for qty {quantity}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock Status Badge */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {inStock ? (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={15} />
              <span>In Stock ({currentStock} available)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
              <AlertTriangle size={15} />
              <span>Currently Out of Stock</span>
            </div>
          )}
          {isLowStock && (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-full">
              Low Stock Alert
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div className="prose prose-sm text-slate-600 leading-relaxed max-w-none border-t border-b border-slate-100 py-4">
            <p>{product.description}</p>
          </div>
        )}

        {/* Quantity Controls & Add to Cart */}
        {inStock ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Purchase Quantity ({product.unit || "Units"})
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-2xl bg-white p-1 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="h-10 w-10 rounded-xl text-slate-700 font-bold"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        setQuantity(Math.min(val, currentStock));
                      }
                    }}
                    min={1}
                    max={currentStock}
                    className="w-16 text-center font-bold text-base border-0 focus-visible:ring-0 shadow-none"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= currentStock}
                    className="h-10 w-10 rounded-xl text-slate-700 font-bold"
                  >
                    +
                  </Button>
                </div>
                <span className="text-xs text-slate-500">
                  Total:{" "}
                  <strong className="text-slate-900">
                    {formatCurrency("NGN", currentPrice * quantity)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                size="lg"
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-orange-600/20 text-sm gap-2 transition-all"
              >
                <ShoppingCart size={18} />
                {isAddingToCart ? "Adding to Cart..." : "Add to Order"}
              </Button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-slate-300 hover:bg-slate-50 text-slate-800 font-bold py-6 rounded-2xl text-sm gap-2"
                >
                  <PhoneCall size={18} className="text-emerald-600" />
                  Direct WhatsApp Order
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <BackInStockNotificationButton
              product={
                {
                  _id: product.id,
                  name: product.name,
                  slug: product.slug,
                } as any
              }
              selectedOptions={{}}
              className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm"
            />
          </div>
        )}

        {/* Bulk Wholesale Discount Callout */}
        <BulkDiscount percentage={10} minItems={5} />

        {/* Assurance Guarantees */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-600 shrink-0" />
            <span>Industrial Quality Tested</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-orange-600 shrink-0" />
            <span>Nationwide Nigerian Dispatch</span>
          </div>
        </div>
      </div>
    </div>
  );
}
