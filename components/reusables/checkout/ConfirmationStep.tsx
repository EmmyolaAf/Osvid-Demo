// components/checkout/ConfirmationStep.tsx
"use client";

import { CheckCircle2, Truck, Store, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCheckout } from "@/providers/CheckoutProvider";
import { useCart } from "@/providers/CartProvider";
import formatCurrency from "@/helpers/formatCurrency";
import { format } from "date-fns";
import { useEffect } from "react";

export function ConfirmationStep() {
  const { checkoutData, clearCheckoutData } = useCheckout();
  const { cart, clearCart } = useCart();

  // Calculate delivery date (3 days for shipping, 1 for pickup)
  const deliveryDate = new Date();
  deliveryDate.setDate(
    deliveryDate.getDate() +
      (checkoutData.deliveryMethod === "shipping" ? 3 : 1)
  );

  // Calculate order summary
  const orderSummary = {
    items: cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.priceData.discountedPrice || item.priceData.price,
    })),
    subtotal: cart.reduce(
      (sum, item) =>
        sum +
        (item.priceData.discountedPrice || item.priceData.price) *
          item.quantity,
      0
    ),
    shipping: checkoutData.deliveryMethod === "shipping" ? 5 : 0, // Example shipping cost
    total: 0, // Will be calculated below
  };
  orderSummary.total = orderSummary.subtotal + orderSummary.shipping;

  // Clear cart and checkout data when component unmounts
  useEffect(() => {
    return () => {
      clearCart();
      clearCheckoutData();
    };
  }, [clearCart, clearCheckoutData]);

  if (!checkoutData.orderId) {
    return (
      <div className="py-8 text-center">
        <h2 className="text-2xl font-bold">Order Processing</h2>
        <p className="mt-2 text-muted-foreground">
          Your order is being processed...
        </p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="text-center mb-8">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold">Thank you for your order!</h2>
        <p className="mt-2 text-muted-foreground">
          Order #{checkoutData.orderId} has been placed successfully.
        </p>
      </div>

      <div className="max-w-md mx-auto border rounded-lg p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          {checkoutData.deliveryMethod === "shipping" ? (
            <Truck className="h-5 w-5 text-primary" />
          ) : (
            <Store className="h-5 w-5 text-primary" />
          )}
          <div>
            <h3 className="font-medium">
              {checkoutData.deliveryMethod === "shipping"
                ? "Delivery to Address"
                : "Store Pickup"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {checkoutData.deliveryMethod === "shipping"
                ? `${checkoutData.shippingAddress?.streetAddress}, ${checkoutData.shippingAddress?.city}`
                : checkoutData.pickupLocationId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-medium">Estimated Delivery</h3>
            <p className="text-sm text-muted-foreground">
              {format(deliveryDate, "EEEE, MMMM do")}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Order Summary</h3>
          <div className="space-y-2 text-sm">
            {orderSummary.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatCurrency("NGN", item.price * item.quantity)}</span>
              </div>
            ))}
            {orderSummary.shipping > 0 && (
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{formatCurrency("NGN", orderSummary.shipping)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Total</span>
              <span>{formatCurrency("NGN", orderSummary.total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          A confirmation has been sent to {checkoutData.contactInfo?.email}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link href="/orders">
          <Button variant="outline">View Order History</Button>
        </Link>
        <Link href="/products">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}
