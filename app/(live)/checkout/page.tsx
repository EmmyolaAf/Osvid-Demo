// components/checkout/CheckoutPage.tsx
"use client";

import { useCheckout } from "@/providers/CheckoutProvider";
import { useCart } from "@/providers/CartProvider";
import { Card } from "@/components/ui/card";
import {
  CheckoutHeader,
  LoadingState,
  EmptyCartState,
  CheckoutErrorBoundary,
} from "@/components/reusables/checkout";
import {
  DeliveryMethodStep,
  ShippingAddressStep,
  PickupLocationStep,
  OrderSummaryStep,
  ConfirmationStep,
} from "@/components/reusables/checkout";
import { CHECKOUT_STEPS, CheckoutStep } from "@/types/checkout.type";

export default function CheckoutPage() {
  const { cart, isLoading } = useCart();
  const { checkoutData, currentStep } = useCheckout();

  if (isLoading) return <LoadingState />;
  if (!cart.length) return <EmptyCartState />;

  return (
    <CheckoutErrorBoundary>
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <CheckoutHeader currentStep={currentStep as CheckoutStep} />

        <Card className="shadow-sm mt-6 p-4">
          {currentStep === CHECKOUT_STEPS.DELIVERY_METHOD && (
            <DeliveryMethodStep />
          )}

          {currentStep === CHECKOUT_STEPS.ADDRESS_PICKUP &&
            (checkoutData.deliveryMethod === "shipping" ? (
              <ShippingAddressStep />
            ) : (
              <PickupLocationStep />
            ))}

          {currentStep === CHECKOUT_STEPS.SUMMARY && <OrderSummaryStep />}

          {currentStep === CHECKOUT_STEPS.CONFIRMATION && <ConfirmationStep />}
        </Card>
      </main>
    </CheckoutErrorBoundary>
  );
}
