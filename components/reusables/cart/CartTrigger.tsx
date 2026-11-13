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
      className="relative w-9 h-9 rounded-lg text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
      onClick={openCart}
      aria-label="Open cart"
    >
      <ShoppingCart className="h-4.5 w-4.5" />
      {totalItems > 0 && (
        <span className="absolute -right-1 -top-1 h-4 min-w-4 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
          {totalItems}
        </span>
      )}
    </Button>
  );
}
