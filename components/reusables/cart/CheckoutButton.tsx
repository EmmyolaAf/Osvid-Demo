"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function CheckoutButton({ size = "default", ...props }: ButtonProps) {
  const router = useRouter();

  const handleCheckout = () => {
    // Here you would typically send the cart to your backend
    // For now we'll just clear the cart and redirect
    // closeCart();
    router.push("/checkout/");
  };

  return (
    <Button size={size} onClick={handleCheckout} {...props}>
      Checkout
    </Button>
  );
}
