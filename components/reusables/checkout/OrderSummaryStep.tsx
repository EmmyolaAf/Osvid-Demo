// components/checkout/OrderSummaryStep.tsx
"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from "react";
import { useCheckout } from "@/providers/CheckoutProvider";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Tag,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { initPaystack, handlePayment } from "@/lib/payment";
import { OrderItemsList } from "./OrderItemsList";
import formatCurrency from "@/helpers/formatCurrency";
import { validateDiscountCode, incrementDiscountUsage } from "@/lib/firebase/firestore";

type PaymentStatus = "idle" | "processing" | "success" | "failed";

export function OrderSummaryStep() {
  const { cart, clearCart } = useCart();
  const { checkoutData, goToPrevStep, goToNextStep } = useCheckout();
  const { user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [isPaystackReady, setIsPaystackReady] = useState(false);

  // Promo Code State
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountAmount: number;
    discountType: "percentage" | "fixed";
    discountValue: number;
  } | null>(null);

  const { subtotal, shippingFee, discountAmount, total } = useMemo(() => {
    const rawSubtotal = cart.reduce(
      (sum, item) =>
        sum +
        (item.priceData.discountedPrice || item.priceData.price) *
          item.quantity,
      0
    );
    const shipping = checkoutData.deliveryMethod === "shipping" ? 0 : 0;
    const discount = appliedDiscount ? appliedDiscount.discountAmount : 0;
    const finalTotal = Math.max(0, rawSubtotal - discount + shipping);

    return {
      subtotal: rawSubtotal,
      shippingFee: shipping,
      discountAmount: discount,
      total: finalTotal,
    };
  }, [cart, checkoutData.deliveryMethod, appliedDiscount]);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        await initPaystack();
        setIsPaystackReady(true);
      } catch (error) {
        toast.error("Paystack payment system unavailable. Please check your internet connection.");
        console.error("Payment initialization failed:", error);
      }
    };

    initializePayment();
  }, []);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) {
      toast.error("Please enter a coupon code.");
      return;
    }

    try {
      setValidatingCoupon(true);
      const res = await validateDiscountCode(couponInput, subtotal);

      if (!res.success || !res.valid || !res.discount) {
        toast.error(res.error || "Invalid coupon code.");
        return;
      }

      setAppliedDiscount({
        code: res.discount.code,
        discountAmount: res.discountAmount,
        discountType: res.discount.discountType,
        discountValue: res.discount.discountValue,
      });

      toast.success(
        `Coupon "${res.discount.code}" applied! Saved ₦${res.discountAmount.toLocaleString()}`
      );
      setCouponInput("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to validate coupon code.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(null);
    toast.info("Coupon removed.");
  };

  const handlePaymentClick = async () => {
    if (!isPaystackReady || paymentStatus === "processing") return;

    setPaymentStatus("processing");
    const toastId = toast.loading("Connecting to Paystack...");

    try {
      // Validate contact info
      if (!checkoutData.contactInfo?.email || !checkoutData.contactInfo?.name) {
        throw new Error("Customer contact name and email are required to proceed.");
      }

      if (cart.length === 0) {
        throw new Error("Your cart is empty. Please add items before checking out.");
      }

      // Generate unique order ID
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const amountInKobo = Math.round(total * 100);

      // 1. Process payment with Paystack popup
      const paymentData = await handlePayment({
        email: checkoutData.contactInfo.email,
        amount: amountInKobo,
        metadata: {
          orderId,
          customerName: checkoutData.contactInfo.name,
          userId: user?.uid || undefined,
          couponCode: appliedDiscount?.code || undefined,
          discountAmount: appliedDiscount?.discountAmount || 0,
          items: JSON.stringify(
            cart.map((item) => ({
              productId: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.priceData.discountedPrice || item.priceData.price,
            }))
          ),
        },
      });

      toast.loading("Verifying payment and writing order to database...", { id: toastId });

      // 2. Verify payment server-side and write directly into Firestore
      const verificationResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: paymentData.reference,
          email: checkoutData.contactInfo.email,
          orderData: {
            orderId,
            userId: user?.uid || undefined,
            items: cart.map((item) => ({
              productId: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.priceData.discountedPrice || item.priceData.price,
              imageUrl: item.imageUrl,
              unit: item.variant,
            })),
            total,
            subtotal,
            shippingFee,
            discountAmount,
            couponCode: appliedDiscount?.code,
            currency: "NGN",
            deliveryMethod: checkoutData.deliveryMethod,
            shippingAddress: checkoutData.shippingAddress,
            pickupLocationId: checkoutData.pickupLocationId,
            customerInfo: checkoutData.contactInfo,
          },
        }),
      });

      const contentType = verificationResponse.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Payment server returned an invalid response format.");
      }

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success) {
        throw new Error(
          verificationResult.error || "Payment verification could not be completed."
        );
      }

      // If a coupon was applied, increment its usage in Firestore
      if (appliedDiscount?.code) {
        incrementDiscountUsage(appliedDiscount.code).catch((err) =>
          console.warn("Usage increment notice:", err)
        );
      }

      // 3. ONLY clear cart and proceed upon verified success
      setPaymentStatus("success");
      clearCart();
      goToNextStep();

      if (verificationResult.emailSent) {
        toast.success("Payment verified! Order receipt sent to your email.", {
          id: toastId,
        });
      } else {
        toast.success("Payment verified! Your order has been placed.", {
          id: toastId,
          description: `Order #${orderId} is being prepared for dispatch.`,
        });
      }
    } catch (error: any) {
      console.error("Payment or database write error:", error);
      setPaymentStatus("failed");

      let errorMessage = "Payment could not be processed.";
      if (error instanceof Error) {
        errorMessage = error.message.replace(/<[^>]*>?/gm, "").substring(0, 140);
      }

      toast.error(errorMessage, { id: toastId });
    }
  };

  const paymentButtonConfig = {
    processing: {
      text: "Processing Order & Payment...",
      icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
      disabled: true,
      variant: "default" as const,
    },
    success: {
      text: "Payment Confirmed",
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
      text: `Pay ${formatCurrency("NGN", total)} with Paystack`,
      icon: null,
      disabled: !isPaystackReady || cart.length === 0,
      variant: "default" as const,
    },
  }[paymentStatus];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <OrderItemsList
          items={cart.map((item) => ({
            ...item,
            _id: (item as any)._id ?? item.id,
            slug: (item as any).slug ?? item.id,
          }))}
        />
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-6 rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-lg font-black text-slate-900">
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {/* Promo Code Input Box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90">
              {appliedDiscount ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900 font-mono">
                        {appliedDiscount.code}
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        {appliedDiscount.discountType === "percentage"
                          ? `${appliedDiscount.discountValue}% discount applied`
                          : `₦${appliedDiscount.discountValue.toLocaleString()} fixed savings`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-emerald-700 hover:text-emerald-900 p-1"
                    title="Remove coupon"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1">
                    <Tag size={12} className="text-pink-600" />
                    Have a promo coupon?
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. FLASH20"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="h-9 text-xs rounded-xl font-mono uppercase bg-white"
                    />
                    <Button
                      type="submit"
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                    >
                      {validatingCoupon ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <div className="space-y-2.5 text-sm pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium text-xs">Subtotal ({cart.length} items):</span>
                <span className="font-bold text-slate-800 text-xs">
                  {formatCurrency("NGN", subtotal)}
                </span>
              </div>

              {appliedDiscount && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="font-medium text-xs">Discount Savings:</span>
                  <span className="font-bold text-xs">
                    -{formatCurrency("NGN", discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium text-xs">Delivery:</span>
                <span className="font-medium text-[11px] text-orange-600">
                  {checkoutData.deliveryMethod === "pickup"
                    ? "Free Pickup"
                    : "Nationwide Dispatch"}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="font-black text-slate-900">Total Amount:</span>
                <span className="font-black text-xl text-orange-600">
                  {formatCurrency("NGN", total)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                onClick={handlePaymentClick}
                disabled={paymentButtonConfig.disabled}
                variant={paymentButtonConfig.variant}
                className={`w-full py-5 rounded-2xl font-bold text-sm shadow-md transition-all ${
                  paymentStatus === "idle"
                    ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
                    : ""
                }`}
                size="lg"
              >
                {paymentButtonConfig.icon}
                {paymentButtonConfig.text}
              </Button>

              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={paymentStatus === "processing"}
                className="w-full rounded-2xl py-5 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                Back to Delivery Details
              </Button>
            </div>

            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Secured 256-bit Paystack PCI-DSS Gateway</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
