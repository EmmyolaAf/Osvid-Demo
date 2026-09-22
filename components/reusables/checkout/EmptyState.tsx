// components/checkout/EmptyCartState.tsx
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyCartState() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-6">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
        <ShoppingBag className="h-12 w-12 text-gray-400" />
        <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
          0
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Your cart is empty
        </h2>
        <p className="text-muted-foreground">
          Looks like you haven&apos;t added anything to your cart yet
        </p>
      </div>
      <Link href="/products">
        <Button className="px-8 py-4 text-lg">Continue Shopping</Button>
      </Link>
    </div>
  );
}
