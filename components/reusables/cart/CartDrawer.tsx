// components/cart/CartDrawer.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useCart } from "@/providers/CartProvider";
import { CartItem } from "./CartItem";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CartDrawer() {
  const {
    cart,
    isCartOpen,
    closeCart,
    subtotal,
    totalItems,
    isLoading,
    error,
  } = useCart();
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <Sheet open={isCartOpen} onOpenChange={closeCart}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p>Loading cart...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500">
            <p>{error}</p>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Your cart is empty</p>
            <Button
              onClick={() => {
                router.push("/shop");
                closeCart();
              }}
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {cart.map((item) => (
                  <CartItem key={item.cartItemId} item={item} />
                ))}
              </div>
            </div>

            <SheetFooter className="border-t pt-4">
              <div className="w-full space-y-4">
                <div className="flex justify-between text-lg font-medium">
                  <span>Subtotal</span>
                  <span>₦{subtotal.toLocaleString()}</span>
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/checkout" onClick={closeCart}>
                    Proceed to Checkout
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    router.push("/shop");
                    closeCart();
                  }}
                >
                  Continue Shopping
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
