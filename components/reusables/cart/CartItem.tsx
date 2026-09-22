"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/providers/CartProvider";
import { ChangeEvent, useState } from "react";
import { X } from "lucide-react";
import { CartItemImage } from "./CartItemImage";

interface CartItemProps {
  item: {
    id: string;
    cartItemId: string;
    name: string;
    priceData: {
      price: number;
      discountedPrice?: number;
      formatted: {
        price: string;
        discountedPrice?: string;
      };
    };
    quantity: number;
    imageUrl: string;
    variant?: string;
  };
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart } = useCart();
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

  // Calculate item subtotal
  const itemSubtotal = item.priceData.discountedPrice
    ? item.priceData.discountedPrice * item.quantity
    : item.priceData.price * item.quantity;

  const formattedSubtotal = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(itemSubtotal);

  return (
    <div className="flex items-start gap-4 py-4 border-b">
      <div className="relative aspect-square w-16 overflow-hidden rounded-md border">
        <CartItemImage
          src={item.imageUrl || ""}
          alt={item.name || "Product image"}
          className="flex-none bg-secondary"
          width={110}
          height={110}
        />
      </div>

      <div className="flex-1">
        <div className="flex justify-between">
          <div>
            <h3 className="font-medium py-2">{item.name}</h3>
            {item.variant && (
              <p className="text-sm text-muted-foreground">{item.variant}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeFromCart(item.cartItemId)}
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Price display above quantity selector */}
        <div className="flex items-center justify-between">
          {item.priceData.discountedPrice ? (
            <div className="flex flex-col">
              <span className="line-through text-muted-foreground text-sm">
                {item.priceData.formatted.price}
              </span>
              <span className="font-medium text-red-600">
                {item.priceData.formatted.discountedPrice}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  (per item)
                </span>
              </span>
            </div>
          ) : (
            <span className="font-medium">
              {item.priceData.formatted.price}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (per item)
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={decrementQuantity}
              disabled={item.quantity <= 1 || isUpdating}
              className="h-8 w-8"
            >
              -
            </Button>
            <Input
              type="number"
              min="1"
              value={item.quantity}
              onChange={handleQuantityChange}
              className="w-16 text-center"
              disabled={isUpdating}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={incrementQuantity}
              disabled={isUpdating}
              className="h-8 w-8"
            >
              +
            </Button>
          </div>

          {/* Item subtotal display */}
          <div className="text-right">
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">
                {item.quantity} ×{" "}
                {item.priceData.discountedPrice
                  ? item.priceData.formatted.discountedPrice
                  : item.priceData.formatted.price}
              </span>
              <span className="font-semibold">{formattedSubtotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
