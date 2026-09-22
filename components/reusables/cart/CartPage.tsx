// components/cart/CartPage.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useCart } from "@/providers/CartProvider";
import { CartItem } from "./CartItem";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { EmptyCartState } from "../checkout/EmptyState";

export function CartPage() {
  const { cart, subtotal, totalItems, isLoading, error } = useCart();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p>Loading your cart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <p>{error}</p>
        <Button variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (cart.length === 0) {
    return <EmptyCartState />;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-2 mb-8">
        <ShoppingCart className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Your Cart ({totalItems})</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <CartItem key={item.cartItemId} item={item} />
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="border rounded-lg p-6 sticky top-4">
            <h2 className="text-lg font-medium mb-4">Order Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-muted-foreground">
                  Calculated at checkout
                </span>
              </div>
              <div className="border-t pt-4 flex justify-between font-medium">
                <span>Total</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
            </div>

            <Button asChild className="w-full mt-6" size="lg">
              <Link href="/checkout">Proceed to Checkout</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
