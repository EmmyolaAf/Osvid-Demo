// components/cart/CartTrigger.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/providers/CartProvider";

export function CartTrigger() {
  const { totalItems, openCart } = useCart();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative w-9 h-9 rounded-lg text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
      onClick={openCart}
      aria-label="Open cart"
      title="Shopping Cart"
    >
      <ShoppingCart size={20} className="shrink-0 text-slate-700 hover:text-orange-600 transition-colors" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs">
          {totalItems}
        </span>
      )}
    </Button>
  );
}
