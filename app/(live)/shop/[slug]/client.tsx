"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Product } from "@/types/auth";
import {
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShieldCheck,
  Truck,
  Sparkles,
  PhoneCall,
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

export default function ProductDetailsClient({
  product,
}: ProductDetailsClientProps) {
  const { addToCart, openCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(
    product.imageUrl || "/images/placeholder.webp"
  );
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const inStock = product.stockQuantity > 0 && product.isActive;
  const isLowStock = inStock && product.stockQuantity <= 10;
  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice > 0 &&
    product.discountPrice < product.price;

  const currentPrice = hasDiscount ? product.discountPrice! : product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (inStock && next > product.stockQuantity) {
        return product.stockQuantity;
      }
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!inStock) {
      toast.warning("This item is currently out of stock.");
      return;
    }

    setIsAddingToCart(true);

    try {
      addToCart(
        {
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl || "/images/placeholder.webp",
          variant: product.unit ? `Unit: ${product.unit}` : undefined,
          priceData: {
            price: product.price,
            discountedPrice: product.discountPrice,
            currency: "NGN",
            formatted: {
              price: formatCurrency("NGN", product.price),
              discountedPrice: product.discountPrice
                ? formatCurrency("NGN", product.discountPrice)
                : undefined,
            },
          },
        },
        quantity
      );

      openCart();
      toast.success(`Added ${quantity}x ${product.name} to cart.`);
    } catch (err) {
      console.error("Cart addition error:", err);
      toast.error("Failed to add product to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // WhatsApp Sales Inquiry link
  const cleanPhone = companyData.whatsapp.replace(/\D/g, "");
  const waUrl = `https://wa.me/234${cleanPhone}?text=${encodeURIComponent(
    `Hello OSVID Sales, I would like to inquire about ${product.name} (Price: ${formatCurrency(
      "NGN",
      currentPrice
    )}, Quantity: ${quantity} ${product.unit || "units"}).`
  )}`;

  const allImages = [
    product.imageUrl || "/images/placeholder.webp",
    ...(product.galleryImages || []),
  ].filter(Boolean);

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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Package size={13} />
            {product.category || "Industrial Chemicals"}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {product.name}
          </h1>
          {product.sku && (
            <p className="text-xs text-slate-400 font-mono mt-1">
              SKU: {product.sku}
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
              {formatCurrency("NGN", product.price)}
            </span>
          )}
          {product.unit && (
            <span className="text-xs text-slate-500 font-medium ml-auto">
              Per {product.unit}
            </span>
          )}
        </div>

        {/* Stock Status Badge */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {inStock ? (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={15} />
              <span>In Stock ({product.stockQuantity} available)</span>
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
                        setQuantity(Math.min(val, product.stockQuantity));
                      }
                    }}
                    min={1}
                    max={product.stockQuantity}
                    className="w-16 text-center font-bold text-base border-0 focus-visible:ring-0 shadow-none"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stockQuantity}
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
