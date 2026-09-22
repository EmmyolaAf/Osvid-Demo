// components/checkout/OrderSummaryStep.tsx
"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from "react";
import { useCheckout } from "@/providers/CheckoutProvider";
import { useCart } from "@/providers/CartProvider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { initPaystack, handlePayment } from "@/lib/payment";
import { OrderItemsList } from "./OrderItemsList";
import formatCurrency from "@/helpers/formatCurrency";
import Link from "next/link";

type PaymentStatus = "idle" | "processing" | "success" | "failed";

export function OrderSummaryStep() {
  const { cart, clearCart } = useCart();
  const { checkoutData, goToPrevStep, goToNextStep } = useCheckout();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [isPaystackReady, setIsPaystackReady] = useState(false);

  const { subtotal, shippingFee, total } = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) =>
        sum +
        (item.priceData.discountedPrice || item.priceData.price) *
          item.quantity,
      0
    );
    const shippingFee = checkoutData.deliveryMethod === "shipping" ? 0 : 0;
    const total = subtotal + shippingFee;
    return { subtotal, shippingFee, total };
  }, [cart, checkoutData.deliveryMethod]);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        await initPaystack();
        setIsPaystackReady(true);
      } catch (error) {
        toast.error("Payment system unavailable");
        console.error("Payment initialization failed:", error);
      }
    };

    initializePayment();
  }, []);

  const handlePaymentClick = async () => {
    if (!isPaystackReady || paymentStatus === "processing") return;

    setPaymentStatus("processing");
    const toastId = toast.loading("Processing payment...");

    try {
      // Validate contact info
      if (!checkoutData.contactInfo?.email || !checkoutData.contactInfo?.name) {
        throw new Error("Contact information is incomplete");
      }

      // Generate order ID
      const orderId = `ORD-${Date.now()}`;
      const amountInKobo = total * 100; // Convert to kobo for Paystack

      // Process payment with Paystack
      const paymentData = await handlePayment({
        email: checkoutData.contactInfo.email,
        amount: amountInKobo,
        metadata: {
          orderId,
          customerName: checkoutData.contactInfo.name,
          items: JSON.stringify(
            cart.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.priceData.price,
            }))
          ),
        },
      });

      // Verify payment and send email
      const verificationResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: paymentData.reference,
          email: checkoutData.contactInfo.email,
          orderData: {
            orderId,
            items: cart.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.priceData.price,
            })),
            total,
            subtotal,
            shippingFee,
            currency: "NGN",
            deliveryMethod: checkoutData.deliveryMethod,
            shippingAddress: checkoutData.shippingAddress,
            pickupLocationId: checkoutData.pickupLocationId,
            customerInfo: checkoutData.contactInfo,
          },
        }),
      });

      // Check response content type
      const contentType = verificationResponse.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const textResponse = await verificationResponse.text();
        console.error("Non-JSON response:", textResponse);
        throw new Error("Server returned unexpected response format");
      }

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success) {
        throw new Error(
          verificationResult.error ||
            verificationResult.message ||
            "Payment verification failed"
        );
      }

      // Clear cart and proceed to confirmation
      clearCart();
      goToNextStep();

      // Show appropriate success message
      if (verificationResult.emailSent) {
        toast.success("Payment successful! Confirmation email sent", {
          id: toastId,
        });
      } else {
        toast.success("Payment successful! Check your email for confirmation", {
          id: toastId,
          description: "Email receipt may be delayed",
        });
      }
    } catch (error) {
      console.error("Payment error:", error);

      // Clean error message display
      let errorMessage = "Payment failed";
      if (error instanceof Error) {
        // Remove any HTML tags and truncate long messages
        errorMessage = error.message
          .replace(/<[^>]*>?/gm, "")
          .substring(0, 120);
      }

      toast.error(errorMessage, { id: toastId });
      setPaymentStatus("failed");
    }
  };

  const paymentButtonConfig = {
    processing: {
      text: "Processing Payment",
      icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
      disabled: true,
      variant: "default" as const,
    },
    success: {
      text: "Payment Completed",
      icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
      disabled: true,
      variant: "default" as const,
    },
    failed: {
      text: "Retry Payment",
      icon: <AlertCircle className="mr-2 h-4 w-4" />,
      disabled: false,
      variant: "destructive" as const,
    },
    idle: {
      text: "Proceed to Payment",
      icon: null,
      disabled: !isPaystackReady,
      variant: "default" as const,
    },
  }[paymentStatus];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <OrderItemsList
          items={cart.map((item) => ({
            ...item,
            _id: (item as any)._id ?? "",
            slug: (item as any).slug ?? "",
          }))}
        />
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  {formatCurrency("NGN", subtotal)}
                </span>
              </div>

              <small></small>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shipping:</span>
                <span className="font-medium text-sm">
                  <Link href="https://wa.me/2349121090303" target="_blank">
                    Customer care
                  </Link>{" "}
                </span>
              </div>

              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-primary">
                  {formatCurrency("NGN", total)}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={handlePaymentClick}
                disabled={paymentButtonConfig.disabled}
                variant={paymentButtonConfig.variant}
                className="w-full"
                size="lg"
              >
                {paymentButtonConfig.icon}
                {paymentButtonConfig.text}
              </Button>
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="w-full"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
