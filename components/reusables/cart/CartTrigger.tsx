// components/cart/CartTrigger.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import Badge from "@/components/ui/badge";

export function CartTrigger() {
  const { totalItems, openCart } = useCart();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={openCart}
      aria-label="Open cart"
    >
      <ShoppingCart className="h-5 w-5" />
      {totalItems > 0 && (
        <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
          {totalItems}
        </Badge>
      )}
    </Button>
  );
}
