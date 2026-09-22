"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, ShoppingCart, Loader2, Check } from "lucide-react";
import { media as wixMedia } from "@wix/sdk";
import Link from "next/link";
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
    variant?: string;
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

  const mainImage = product.image
    ? wixMedia.getScaledToFillImageUrl(product.image, 800, 800, {})
    : "/images/placeholder-product.jpg";

  const hasDiscount =
    product.discountPrice !== undefined &&
    product.price !== undefined &&
    product.discountPrice < product.price;

  const discountPercentage = hasDiscount
    ? Math.round(
        ((Number(product.price) - Number(product.discountPrice)) /
          Number(product.price)) *
          100
      )
    : 0;

  const isInCart = cart.some(
    (item) => item.id === product.id && item.variant === product.variant
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
          price: product.price || 0,
          discountedPrice: product.discountPrice,
          currency,
          formatted: {
            price: formatCurrency(currency, product.price || 0),
            ...(hasDiscount && {
              discountedPrice: formatCurrency(
                currency,
                product.discountPrice || 0
              ),
            }),
          },
        },
        imageUrl: mainImage,
        variant: product.variant,
      };

      await addToCart(cartItem, 1);
      setJustAdded(true);
      toast.success("Added to cart!");
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
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      <Link
        href={`/shop/${product.slug}`}
        className="absolute inset-0 z-10 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded-xl"
        aria-label={`View details for ${product.name}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="sr-only">View details for {product.name}</span>
      </Link>

      {/* Image Container */}
      <div className="relative w-full aspect-square overflow-hidden">
        {product.image ? (
          <Image
            src={mainImage}
            alt={product.name || "Product"}
            fill
            className={`object-cover transition-transform duration-500 ${
              isHovered ? "scale-105" : "scale-100"
            }`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={index < 4}
          />
        ) : (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-400">
            <ShoppingCart size={48} className="mb-2" />
            <span className="text-sm">No Image Available</span>
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-4 left-4 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full z-20 shadow-md">
            {discountPercentage}% OFF
          </div>
        )}

        {/* Quick Add Button */}
        <div className="absolute bottom-4 left-0 right-0 px-4 z-20">
          <Button
            onClick={handleAddToCart}
            className={`w-full font-medium shadow-md transition-all duration-300 ${
              justAdded || isInCart
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-white text-orange-600 hover:bg-orange-50"
            } ${
              isHovered
                ? "translate-y-0 opacity-100"
                : "translate-y-20 opacity-0"
            }`}
            disabled={isAddingToCart || isInCart}
            aria-live="polite"
            aria-busy={isAddingToCart}
          >
            {isAddingToCart ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : justAdded || isInCart ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {isInCart ? "In Cart" : "Added!"}
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Quick Add
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {product.name}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            {product.price !== undefined && (
              <>
                {hasDiscount && product.discountPrice !== undefined ? (
                  <span className="text-gray-500 text-sm line-through">
                    {formatCurrency(currency, Number(product.price))}
                  </span>
                ) : null}
                <span className="text-lg font-bold text-gray-900">
                  {hasDiscount
                    ? formatCurrency(currency, Number(product.discountPrice))
                    : formatCurrency(currency, Number(product.price))}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Star
              size={16}
              fill="currentColor"
              className="text-yellow-400"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-600">{rating.toFixed(1)}</span>
          </div>
        </div>

        <Button
          variant="link"
          className="w-full text-orange-600 hover:text-orange-700 p-0 h-auto justify-start"
          asChild
        >
          <Link href={`/shop/${product.slug}`}>
            View Details <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </FadeInAnimationWrapper>
  );
}
