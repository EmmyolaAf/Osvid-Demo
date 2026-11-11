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
  Copy,
  Check,
  Share2,
  FileText,
  Clock,
  HelpCircle,
  Star,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import formatCurrency from "@/helpers/formatCurrency";
import { useCart } from "@/providers/CartProvider";
import { toast } from "sonner";
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
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "wholesale" | "shipping">("overview");
  const [copiedSku, setCopiedSku] = useState(false);

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

  // Active pricing tier calculation
  const activePricingTier = useMemo(() => {
    if (!product.pricingTiers || product.pricingTiers.length === 0) return null;
    return (
      product.pricingTiers.find(
        (t) =>
          quantity >= t.minQuantity &&
          (!t.maxQuantity || quantity <= t.maxQuantity)
      ) || null
    );
  }, [product.pricingTiers, quantity]);

  const effectiveUnitPrice = useMemo(() => {
    if (activePricingTier) {
      if (activePricingTier.unitPrice) return activePricingTier.unitPrice;
      return Math.round(currentPrice * (1 - activePricingTier.discountPercentage / 100));
    }
    return currentPrice;
  }, [activePricingTier, currentPrice]);

  const effectiveTotal = effectiveUnitPrice * quantity;
  const standardTotal = currentPrice * quantity;
  const tierSavings = standardTotal - effectiveTotal;

  const handleAttributeSelect = (attrName: string, value: string) => {
    const updated = { ...selectedAttributes, [attrName]: value };
    setSelectedAttributes(updated);

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

  const handleCopySku = () => {
    if (!currentSku) return;
    navigator.clipboard.writeText(currentSku);
    setCopiedSku(true);
    toast.success(`SKU copied: ${currentSku}`);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleShareProduct = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Product link copied to clipboard!");
    }
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
    `Hello OSVID Technical Sales, I am interested in purchasing ${product.name}${
      selectedVariation ? ` (${Object.entries(selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""
    } (Price: ${formatCurrency("NGN", effectiveUnitPrice)}, Quantity: ${quantity} ${
      product.unit || "units"
    }). Please advise on immediate dispatch availability.`
  )}`;

  const allImages = [
    product.imageUrl || "/images/placeholder.webp",
    ...(product.galleryImages || []),
    ...(product.variations?.map((v) => v.imageUrl).filter(Boolean) as string[] || []),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Top Product Presentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left Column: Product Gallery */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-28">
          {/* Main Visual Display */}
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/90 shadow-sm flex items-center justify-center group">
            <Image
              src={activeImage}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
              priority
            />

            {/* Badges Overlay */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-10">
              <div className="flex flex-col gap-2">
                {hasDiscount && (
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                    SAVE {discountPercent}%
                  </span>
                )}
                {product.pricingTierName && (
                  <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-md text-orange-800 border border-orange-200/80 font-extrabold text-[11px] px-3 py-1 rounded-full shadow-sm">
                    <Tag size={12} className="text-orange-600" />
                    Bulk Tier Available
                  </span>
                )}
              </div>

              {product.isFeatured && (
                <div className="bg-slate-900/90 backdrop-blur-md text-amber-300 font-bold text-xs px-3.5 py-1.5 rounded-full border border-amber-300/30 flex items-center gap-1.5 shadow-md">
                  <Sparkles size={14} />
                  <span>Featured Quality</span>
                </div>
              )}
            </div>

            {/* Quick Share Button */}
            <button
              onClick={handleShareProduct}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-700 p-2.5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-sm transition-all hover:scale-105 z-10"
              title="Share product link"
            >
              <Share2 size={16} />
            </button>
          </div>

          {/* Thumbnail Carousel */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(imgUrl)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all shrink-0 bg-slate-50 ${
                    activeImage === imgUrl
                      ? "border-orange-600 ring-4 ring-orange-500/20 scale-102"
                      : "border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100"
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

        {/* Right Column: Product Info & Commerce Panel */}
        <div className="lg:col-span-6 space-y-6">
          {/* Header & Meta */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-900 text-xs font-black uppercase tracking-wider">
                <Package size={13} className="text-orange-600" />
                {product.category || "Industrial Chemicals"}
              </span>

              {isVariable && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  <Layers size={12} />
                  Multiple Sizes
                </span>
              )}

              <div className="flex items-center gap-1 text-amber-500 font-extrabold text-xs ml-auto">
                <Star size={14} fill="currentColor" />
                <span>5.0</span>
                <span className="text-slate-400 font-normal">(Verified Formulation)</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* SKU & Stock Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              {currentSku && (
                <button
                  onClick={handleCopySku}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 transition-colors"
                  title="Click to copy SKU"
                >
                  <span>SKU: {currentSku}</span>
                  {copiedSku ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} className="text-slate-400" />
                  )}
                </button>
              )}

              <div className="flex items-center gap-1.5">
                {inStock ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={13} />
                    In Stock ({currentStock} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full">
                    <AlertTriangle size={13} />
                    Currently Out of Stock
                  </span>
                )}
                {isLowStock && (
                  <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px]">
                    Low Stock
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Highlight Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-xl space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                  Unit Price
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {formatCurrency("NGN", effectiveUnitPrice)}
                  </span>
                  {(hasDiscount || activePricingTier) && (
                    <span className="text-lg text-slate-400 line-through font-semibold">
                      {formatCurrency("NGN", basePrice)}
                    </span>
                  )}
                </div>
              </div>

              {product.unit && (
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-medium">Measurement</span>
                  <span className="block text-sm font-bold text-orange-400 uppercase">
                    Per {product.unit}
                  </span>
                </div>
              )}
            </div>

            {/* Savings Callout */}
            {activePricingTier && tierSavings > 0 && (
              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles size={13} />
                  Wholesale Tier Active (-{activePricingTier.discountPercentage}%)
                </span>
                <span className="font-extrabold text-emerald-300">
                  Total Saved: {formatCurrency("NGN", tierSavings)}
                </span>
              </div>
            )}
          </div>

          {/* Variable Product Specification Picker */}
          {isVariable && product.attributes && product.attributes.length > 0 && (
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-4">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Select Chemical Specifications
              </h4>
              <div className="space-y-3.5">
                {product.attributes.map((attr) => (
                  <div key={attr.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{attr.name}:</span>
                      <span className="font-extrabold text-orange-600">
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
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20 scale-102"
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

          {/* Wholesale & Tiered Pricing Breakdown */}
          {product.pricingTiers && product.pricingTiers.length > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-50/80 border border-orange-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-orange-950 flex items-center gap-1.5">
                  <Tag size={14} className="text-orange-600" />
                  Wholesale &amp; Bulk Discount Tiers
                </span>
                <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100/90 px-2.5 py-0.5 rounded-full border border-orange-200">
                  Auto-Applied
                </span>
              </div>
              <p className="text-xs text-orange-950/80 leading-relaxed">
                Order in commercial quantities to unlock tiered manufacturer pricing:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
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
                      className={`p-3 rounded-2xl border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                        isReached
                          ? "bg-white border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                          : "bg-white/80 border-orange-200/60 text-slate-700 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-extrabold text-slate-900">
                        <span>{tier.minQuantity}+ {product.unit || "units"}</span>
                        <span className="text-orange-600 font-black">-{tier.discountPercentage}%</span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">
                        {formatCurrency("NGN", tierPrice)} / {product.unit || "unit"}
                      </div>
                      {isReached && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
                          <Check size={11} /> Active for your order
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped Product Notice */}
          {isGrouped && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                Grouped Chemical Package
              </div>
              <p className="text-slate-600">
                This is a bundled industrial formulation. Contact our technical team for custom container sizes or tailored blending.
              </p>
            </div>
          )}

          {/* Purchase Controls & Quantity Stepper */}
          {inStock ? (
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Quantity ({product.unit || "Units"})
                </Label>

                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-300 rounded-2xl bg-white p-1 shadow-sm">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="h-10 w-10 rounded-xl text-slate-800 font-extrabold hover:bg-slate-100"
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
                      className="w-16 text-center font-black text-base border-0 focus-visible:ring-0 shadow-none text-slate-900"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= currentStock}
                      className="h-10 w-10 rounded-xl text-slate-800 font-extrabold hover:bg-slate-100"
                    >
                      +
                    </Button>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">Subtotal</span>
                    <strong className="text-sm sm:text-base font-black text-slate-900">
                      {formatCurrency("NGN", effectiveTotal)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="flex-1 h-14 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-2xl shadow-lg shadow-orange-600/25 text-sm gap-2 transition-all hover:scale-101"
                >
                  <ShoppingCart size={18} />
                  {isAddingToCart ? "Adding to Cart..." : `Add ${quantity} to Cart`}
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
                    className="w-full h-14 border-slate-300 hover:bg-slate-100 text-slate-800 font-extrabold rounded-2xl text-sm gap-2"
                  >
                    <PhoneCall size={18} className="text-emerald-600" />
                    <span>WhatsApp Order</span>
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
                className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-extrabold text-sm shadow-md"
              />
            </div>
          )}

          {/* Trust Guarantees 4-Column Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-slate-600 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <ShieldCheck size={18} className="text-orange-600 shrink-0" />
              <span className="font-bold text-[11px] text-slate-800">Lab Tested Formulation</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <Truck size={18} className="text-orange-600 shrink-0" />
              <span className="font-bold text-[11px] text-slate-800">Prompt Dispatch</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <FileText size={18} className="text-orange-600 shrink-0" />
              <span className="font-bold text-[11px] text-slate-800">MSDS on Request</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <Clock size={18} className="text-orange-600 shrink-0" />
              <span className="font-bold text-[11px] text-slate-800">Direct Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Tab Deep Dive Specification & Overview Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide bg-slate-50/50">
          {[
            { id: "overview", label: "Overview & Applications", icon: FileText },
            { id: "specs", label: "Technical Specifications", icon: ShieldCheck },
            { id: "wholesale", label: "Wholesale & Bulk Orders", icon: Tag },
            { id: "shipping", label: "Delivery & Storage", icon: Truck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 shrink-0 ${
                  isActive
                    ? "border-orange-600 text-orange-600 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panes */}
        <div className="p-6 sm:p-10">
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-3">
                  Product Overview &amp; Applications
                </h3>
                <div className="prose prose-slate text-sm text-slate-600 leading-relaxed max-w-none">
                  {product.description ? (
                    <p>{product.description}</p>
                  ) : (
                    <p>
                      High-grade industrial formulation engineered by OSVID Chemicals. Designed for optimal performance, durability, and chemical compatibility in heavy-duty commercial and manufacturing environments.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Recommended Applications
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    <li>Industrial surface treatment &amp; protection</li>
                    <li>Commercial manufacturing processes</li>
                    <li>Structural bonding, sealing &amp; coating</li>
                    <li>High-performance construction applications</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Storage &amp; Handling
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Store tightly sealed in original container in a dry, ventilated area between 15°C and 30°C. Protect from direct sunlight and freezing temperatures.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "specs" && (
            <div className="space-y-6 max-w-4xl">
              <h3 className="text-lg font-black text-slate-900 mb-2">
                Chemical &amp; Technical Specifications
              </h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-900 w-1/3">Product Name</td>
                      <td className="px-5 py-3 text-slate-700">{product.name}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-900">Category</td>
                      <td className="px-5 py-3 text-slate-700">{product.category || "Industrial Formulation"}</td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-900">Standard Packaging Unit</td>
                      <td className="px-5 py-3 text-slate-700">{product.unit || "Kilograms (kg)"}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-900">SKU Reference</td>
                      <td className="px-5 py-3 font-mono text-slate-700">{currentSku || "OSV-IND-STD"}</td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-900">Shelf Life</td>
                      <td className="px-5 py-3 text-slate-700">18–24 months in unopened factory containers</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-900">Safety Data Sheet (MSDS)</td>
                      <td className="px-5 py-3 text-slate-700">Available upon request via technical support desk</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "wholesale" && (
            <div className="space-y-6 max-w-4xl">
              <h3 className="text-lg font-black text-slate-900 mb-2">
                Wholesale &amp; Contract Bulk Pricing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                OSVID Chemicals provides verified volume purchasing tiers for manufacturers, project contractors, and regional distributors. Tier discounts calculate automatically at checkout:
              </p>

              {product.pricingTiers && product.pricingTiers.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase">
                      <tr>
                        <th className="px-5 py-3">Order Volume</th>
                        <th className="px-5 py-3">Discount</th>
                        <th className="px-5 py-3">Effective Unit Price</th>
                        <th className="px-5 py-3">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {product.pricingTiers.map((tier, i) => (
                        <tr key={i} className="hover:bg-orange-50/40">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {tier.minQuantity} {tier.maxQuantity ? `– ${tier.maxQuantity}` : "+"} {product.unit || "units"}
                          </td>
                          <td className="px-5 py-3.5 text-orange-600 font-black">
                            -{tier.discountPercentage}%
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {formatCurrency(
                              "NGN",
                              tier.unitPrice ||
                                Math.round(currentPrice * (1 - tier.discountPercentage / 100))
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">Standard / Pallet Dispatch</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  For bulk pallet or tanker truck quantities, please contact our wholesale sales desk directly via WhatsApp or phone.
                </div>
              )}
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="space-y-6 max-w-4xl">
              <h3 className="text-lg font-black text-slate-900 mb-2">
                Nationwide Delivery &amp; Logistics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Lagos &amp; South-West
                  </h4>
                  <p className="text-xs text-slate-600">
                    24–48 hours direct warehouse courier dispatch or facility pickup.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Abuja &amp; North-Central
                  </h4>
                  <p className="text-xs text-slate-600">
                    48–72 hours via specialized freight logistics partners.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Nationwide Nigeria
                  </h4>
                  <p className="text-xs text-slate-600">
                    Interstate heavy freight to Port Harcourt, Kano, Onitsha, and all regional terminals.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
