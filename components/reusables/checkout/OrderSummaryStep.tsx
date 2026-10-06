// components/checkout/OrderSummaryStep.tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { initPaystack, resumePayment } from "@/lib/payment";
import { OrderItemsList } from "./OrderItemsList";
import formatCurrency from "@/helpers/formatCurrency";

type PaymentStatus = "idle" | "processing" | "success" | "failed";
type QuoteState = "loading" | "ready" | "error";

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

  // Server Authoritative Quote State (Requirement 7)
  const [quoteState, setQuoteState] = useState<QuoteState>("loading");
  const [quoteTotals, setQuoteTotals] = useState<{
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    total: number;
  }>(() => {
    const fallbackSubtotal = cart.reduce(
      (sum, item) =>
        sum +
        (item.priceData.discountedPrice || item.priceData.price) * item.quantity,
      0
    );
    return {
      subtotal: fallbackSubtotal,
      shippingFee: 0,
      discountAmount: 0,
      total: fallbackSubtotal,
    };
  });

  // Stable Client Checkout Request ID (Requirement 8)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string>(() =>
    `crq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  const intentSignature = JSON.stringify({
    items: cart
      .map((i) => ({ id: i.id, q: i.quantity }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    deliveryMethod: checkoutData.deliveryMethod,
    shippingAddress: checkoutData.shippingAddress,
    pickupLocationId: checkoutData.pickupLocationId,
    coupon: appliedDiscount?.code || "",
    contact: checkoutData.contactInfo,
  });

  const prevIntentRef = useRef(intentSignature);

  useEffect(() => {
    if (prevIntentRef.current !== intentSignature) {
      prevIntentRef.current = intentSignature;
      // Regenerate checkoutRequestId ONLY when checkout intent materially changes
      setCheckoutRequestId(
        `crq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      );
    }
  }, [intentSignature]);

  // Fetch Authoritative Server Quote
  const fetchAuthoritativeQuote = async (couponToUse?: string) => {
    if (cart.length === 0) {
      setQuoteState("ready");
      return;
    }

    setQuoteState("loading");
    try {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((it) => ({
            productId: it.id,
            quantity: it.quantity,
          })),
          deliveryMethod: checkoutData.deliveryMethod,
          shippingAddress: checkoutData.shippingAddress,
          pickupLocationId: checkoutData.pickupLocationId,
          couponCode: couponToUse !== undefined ? couponToUse : appliedDiscount?.code,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQuoteTotals({
          subtotal: data.subtotal,
          shippingFee: data.shippingFee,
          discountAmount: data.discountAmount,
          total: data.totalAmount,
        });

        if (data.coupon) {
          setAppliedDiscount({
            code: data.coupon.code,
            discountAmount: data.discountAmount,
            discountType: data.coupon.discountType,
            discountValue: data.coupon.discountValue,
          });
        }
        setQuoteState("ready");
      } else {
        setQuoteState("error");
      }
    } catch (err) {
      console.warn("Could not retrieve server quote:", err);
      setQuoteState("error");
    }
  };


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

  // Update server quote when cart, delivery method, shipping address, or pickup location changes (Requirement 17)
  useEffect(() => {
    fetchAuthoritativeQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    checkoutData.deliveryMethod,
    checkoutData.shippingAddress?.state,
    checkoutData.shippingAddress?.city,
    checkoutData.shippingAddress?.streetAddress,
    checkoutData.pickupLocationId,
  ]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a coupon code.");
      return;
    }

    try {
      setValidatingCoupon(true);
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((it) => ({
            productId: it.id,
            quantity: it.quantity,
          })),
          deliveryMethod: checkoutData.deliveryMethod,
          shippingAddress: checkoutData.shippingAddress,
          pickupLocationId: checkoutData.pickupLocationId,
          couponCode: code,
        }),
      });

      const data = await res.json();

      if (!data.success || !data.coupon) {
        toast.error(data.error || "Invalid coupon code.");
        return;
      }

      setAppliedDiscount({
        code: data.coupon.code,
        discountAmount: data.discountAmount,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
      });

      setQuoteTotals({
        subtotal: data.subtotal,
        shippingFee: data.shippingFee,
        discountAmount: data.discountAmount,
        total: data.totalAmount,
      });

      toast.success(
        `Coupon "${data.coupon.code}" applied! Saved ₦${data.discountAmount.toLocaleString()}`
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
    fetchAuthoritativeQuote("");
    toast.info("Coupon removed.");
  };

  const handlePaymentClick = async () => {
    if (quoteState === "error") {
      fetchAuthoritativeQuote();
      return;
    }

    if (!isPaystackReady || paymentStatus === "processing" || quoteState !== "ready") return;

    setPaymentStatus("processing");
    const toastId = toast.loading("Preparing secure checkout session...");

    let activeSessionId: string | null = null;
    let activeReleaseToken: string | null = null;

    try {
      // Validate contact info
      if (!checkoutData.contactInfo?.email || !checkoutData.contactInfo?.name) {
        throw new Error("Customer contact name and email are required to proceed.");
      }

      if (cart.length === 0) {
        throw new Error("Your cart is empty. Please add items before checking out.");
      }

      // Attach genuine authenticated ID token if customer is logged in
      // Requirement 15: If logged in but obtaining ID token fails, abort checkout with error.
      // Do NOT silently downgrade to guest checkout.
      let authHeaders: Record<string, string> = {};
      if (user) {
        try {
          const idToken = await user.getIdToken();
          if (!idToken) {
            throw new Error("Empty authentication credentials.");
          }
          authHeaders = { Authorization: `Bearer ${idToken}` };
        } catch (tokErr) {
          console.error("Authenticated customer token retrieval failed:", tokErr);
          toast.dismiss(toastId);
          setPaymentStatus("idle");
          toast.error(
            "Your login session could not be verified. Please refresh the page or sign in again to proceed."
          );
          return;
        }
      }

      // 1. Initialize payment server-side (reserves stock and coupon, creates checkout session)
      const initRes = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          checkoutRequestId, // Stable client request ID (Requirement 8)
          items: cart.map((it) => ({
            productId: it.id,
            quantity: it.quantity,
          })),
          customerInfo: checkoutData.contactInfo,
          deliveryMethod: checkoutData.deliveryMethod,
          shippingAddress: checkoutData.shippingAddress,
          pickupLocationId: checkoutData.pickupLocationId,
          couponCode: appliedDiscount?.code,
        }),
      });

      const initData = await initRes.json();

      if (!initData.success || !initData.accessCode) {
        throw new Error(initData.error || "Failed to initialize payment session with server.");
      }

      // Requirement 7: Prompt to reconfirm if authoritative server total changed
      const serverTotal = initData.totals?.totalAmount;
      if (
        typeof serverTotal === "number" &&
        Math.abs(serverTotal - quoteTotals.total) > 0.01
      ) {
        setQuoteTotals({
          subtotal: initData.totals.subtotal,
          shippingFee: initData.totals.shippingFee,
          discountAmount: initData.totals.discountAmount,
          total: initData.totals.totalAmount,
        });
        setPaymentStatus("idle");
        toast.dismiss(toastId);
        toast.error(
          `Order total has been updated to ₦${serverTotal.toLocaleString()}. Please review and confirm your order.`
        );
        return;
      }

      activeSessionId = initData.checkoutSessionId;
      activeReleaseToken = initData.releaseToken || null;

      toast.loading("Awaiting Paystack payment...", { id: toastId });

      // 2. Open Paystack Popup V2 with server-generated access code
      let paymentSuccessRef: string | null = null;

      try {
        const popupResult = await resumePayment({
          accessCode: initData.accessCode,
          onCancel: () => {
            // Promptly release reservation on cancellation
            if (activeSessionId && activeReleaseToken) {
              fetch("/api/checkout/release", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  checkoutSessionId: activeSessionId,
                  releaseToken: activeReleaseToken,
                }),
              }).catch((e) => console.warn("Release reservation notice:", e));
            }
          },
        });

        paymentSuccessRef = popupResult.reference;
      } catch (popupErr: any) {
        // User closed modal or popup error
        setPaymentStatus("idle");
        toast.dismiss(toastId);
        return;
      }

      toast.loading("Verifying payment and finalizing order...", { id: toastId });

      // 3. Post-payment reconciliation endpoint (converges with webhook)
      const verificationResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: paymentSuccessRef || initData.reference,
          checkoutSessionId: activeSessionId,
        }),
      });

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success) {
        if (verificationResult.anomaly) {
          toast.error("Item stock was unavailable. A safe refund has been initiated.", {
            id: toastId,
          });
        } else {
          throw new Error(
            verificationResult.error || "Payment verification could not be completed."
          );
        }
        setPaymentStatus("failed");
        return;
      }

      // 4. ONLY clear cart and proceed upon verified server finalization
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
          description: `Order #${verificationResult.data?.orderId || ""} is being prepared.`,
        });
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      setPaymentStatus("failed");

      let errorMessage = "Payment could not be processed.";
      if (error instanceof Error) {
        errorMessage = error.message.replace(/<[^>]*>?/gm, "").substring(0, 140);
      }

      toast.error(errorMessage, { id: toastId });
    }
  };

  const isQuoteReady = quoteState === "ready";
  const isQuoteLoading = quoteState === "loading";
  const isQuoteError = quoteState === "error";

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
      disabled: !isQuoteReady,
      variant: "destructive" as const,
    },
    idle: {
      text: isQuoteLoading
        ? "Calculating latest prices..."
        : isQuoteError
        ? "Price check failed (Tap to retry)"
        : `Pay ${formatCurrency("NGN", quoteTotals.total)} with Paystack`,
      icon: isQuoteLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isQuoteError ? (
        <AlertCircle className="mr-2 h-4 w-4" />
      ) : null,
      disabled: !isQuoteReady || !isPaystackReady || cart.length === 0,
      variant: isQuoteError ? ("destructive" as const) : ("default" as const),
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
                <span className="text-slate-500 font-medium text-xs">
                  Subtotal ({cart.length} items):
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  {formatCurrency("NGN", quoteTotals.subtotal)}
                </span>
              </div>

              {appliedDiscount && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="font-medium text-xs">Discount Savings:</span>
                  <span className="font-bold text-xs">
                    -{formatCurrency("NGN", quoteTotals.discountAmount)}
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
                  {formatCurrency("NGN", quoteTotals.total)}
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
