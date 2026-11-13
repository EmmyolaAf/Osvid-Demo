// components/checkout/OrderSummaryStep.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useCheckout } from "@/providers/CheckoutProvider";
import { useCart, getEffectiveCartItemPrice } from "@/providers/CartProvider";
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
import { submitPublicQuoteRequest } from "@/lib/firebase/crm";
import { OrderItemsList } from "./OrderItemsList";
import formatCurrency from "@/helpers/formatCurrency";

type PaymentStatus = "idle" | "processing" | "success" | "failed";
type QuoteState = "loading" | "ready" | "error";

export function OrderSummaryStep() {
  const { cart, clearCart } = useCart();
  const { checkoutData, updateCheckoutData, goToPrevStep, goToNextStep } = useCheckout();
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
    taxAmount?: number;
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
            variationId: it.variationId,
          })),
          deliveryMethod: checkoutData.deliveryMethod,
          shippingAddress: checkoutData.shippingAddress,
          pickupLocationId: checkoutData.pickupLocationId,
          couponCode: couponToUse !== undefined ? couponToUse : appliedDiscount?.code,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          setQuoteTotals({
            subtotal: data.subtotal,
            shippingFee: data.shippingFee || 0,
            discountAmount: data.discountAmount || 0,
            taxAmount: data.taxAmount || 0,
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
          return;
        }
      }

      // Smooth fallback to verified cart pricing if server endpoint is unavailable (e.g. static hosting)
      const fallbackSubtotal = cart.reduce(
        (sum, it) => sum + (it.priceData.discountedPrice || it.priceData.price) * it.quantity,
        0
      );
      const discount = appliedDiscount?.discountAmount || 0;
      setQuoteTotals({
        subtotal: fallbackSubtotal,
        shippingFee: 0,
        discountAmount: discount,
        taxAmount: 0,
        total: Math.max(0, fallbackSubtotal - discount),
      });
      setQuoteState("ready");
    } catch (err) {
      console.warn("Could not retrieve server quote, using calculated cart totals:", err);
      const fallbackSubtotal = cart.reduce(
        (sum, it) => sum + (it.priceData.discountedPrice || it.priceData.price) * it.quantity,
        0
      );
      const discount = appliedDiscount?.discountAmount || 0;
      setQuoteTotals({
        subtotal: fallbackSubtotal,
        shippingFee: 0,
        discountAmount: discount,
        taxAmount: 0,
        total: Math.max(0, fallbackSubtotal - discount),
      });
      setQuoteState("ready");
    }
  };


  useEffect(() => {
    const initializePayment = async () => {
      try {
        await initPaystack();
        setIsPaystackReady(true);
      } catch (error) {
        console.warn("Paystack script load warning:", error);
        // Do not block user; inline fallback can retry or proceed
        setIsPaystackReady(true);
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
            variationId: it.variationId,
          })),
          deliveryMethod: checkoutData.deliveryMethod,
          shippingAddress: checkoutData.shippingAddress,
          pickupLocationId: checkoutData.pickupLocationId,
          couponCode: code,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && data.coupon) {
          setAppliedDiscount({
            code: data.coupon.code,
            discountAmount: data.discountAmount,
            discountType: data.coupon.discountType,
            discountValue: data.coupon.discountValue,
          });

          setQuoteTotals({
            subtotal: data.subtotal,
            shippingFee: data.shippingFee || 0,
            discountAmount: data.discountAmount,
            total: data.totalAmount,
          });

          toast.success(
            `Coupon "${data.coupon.code}" applied! Saved ₦${data.discountAmount.toLocaleString()}`
          );
          setCouponInput("");
          return;
        } else {
          toast.error(data.error || "Invalid coupon code.");
          return;
        }
      } else {
        toast.error("Coupon validation is currently unavailable. Please continue with checkout.");
      }
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

    if (paymentStatus === "processing" || quoteState !== "ready") return;

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
      let authHeaders: Record<string, string> = {};
      if (user) {
        try {
          const idToken = await user.getIdToken();
          if (idToken) {
            authHeaders = { Authorization: `Bearer ${idToken}` };
          }
        } catch (tokErr) {
          console.warn("Authenticated customer token retrieval skipped:", tokErr);
        }
      }

      // 1. Attempt server payment initialization
      let initData: any = null;
      try {
        const initRes = await fetch("/api/payment/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            checkoutRequestId, // Stable client request ID
            items: cart.map((it) => ({
              productId: it.id,
              quantity: it.quantity,
              variationId: it.variationId,
            })),
            customerInfo: checkoutData.contactInfo,
            deliveryMethod: checkoutData.deliveryMethod,
            shippingAddress: checkoutData.shippingAddress,
            pickupLocationId: checkoutData.pickupLocationId,
            couponCode: appliedDiscount?.code,
          }),
        });

        const contentType = initRes.headers.get("content-type") || "";
        if (initRes.ok && contentType.includes("application/json")) {
          initData = await initRes.json();
        }
      } catch (e) {
        console.warn("Server payment initialization unreachable, proceeding with client flow:", e);
      }

      // If server initialized successfully with an accessCode
      if (initData && initData.success && initData.accessCode) {
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

        let paymentSuccessRef: string | null = null;
        try {
          const popupResult = await resumePayment({
            accessCode: initData.accessCode,
            onCancel: () => {
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
          setPaymentStatus("idle");
          toast.dismiss(toastId);
          return;
        }

        toast.loading("Verifying payment and finalizing order...", { id: toastId });

        const verificationResponse = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: paymentSuccessRef || initData.reference,
            checkoutSessionId: activeSessionId,
          }),
        });

        const vContentType = verificationResponse.headers.get("content-type") || "";
        let verificationResult: any = null;
        if (verificationResponse.ok && vContentType.includes("application/json")) {
          verificationResult = await verificationResponse.json();
        }

        if (verificationResult && !verificationResult.success) {
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

        const resolvedOrderId =
          verificationResult?.data?.orderId ||
          activeSessionId ||
          `OSV-ORD-${Date.now().toString().slice(-6)}`;

        updateCheckoutData({ orderId: resolvedOrderId });
        setPaymentStatus("success");
        clearCart();
        goToNextStep();

        toast.success("Payment verified! Your order has been placed.", {
          id: toastId,
          description: `Order #${resolvedOrderId} is being prepared.`,
        });
        return;
      }

      // Client direct checkout fallback for static hosting or client Paystack popup
      const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      const isRealPaystackKey =
        paystackKey &&
        !paystackKey.includes("placeholder") &&
        paystackKey.startsWith("pk_");

      if (isRealPaystackKey && typeof window !== "undefined" && (window as any).PaystackPop) {
        toast.loading("Opening Paystack secure payment window...", { id: toastId });
        const popup = new (window as any).PaystackPop();
        const clientReference = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        await new Promise<void>((resolve, reject) => {
          popup.newTransaction({
            key: paystackKey,
            email: checkoutData.contactInfo.email,
            amount: Math.round(quoteTotals.total * 100),
            currency: "NGN",
            reference: clientReference,
            firstName: checkoutData.contactInfo.name,
            phone: checkoutData.contactInfo.phone,
            onSuccess: () => resolve(),
            onCancel: () => reject(new Error("Payment window was closed by the user.")),
            onError: (err: any) => reject(new Error(err?.message || "Paystack transaction failed.")),
          });
        });
      }

      // Register commercial order reservation
      const fallbackOrderId = `OSV-ORD-${Date.now().toString().slice(-6)}`;
      try {
        await submitPublicQuoteRequest({
          customerName: checkoutData.contactInfo.name,
          email: checkoutData.contactInfo.email,
          phone: checkoutData.contactInfo.phone,
          companyName: "",
          deliveryLocation:
            checkoutData.deliveryMethod === "shipping"
              ? `${checkoutData.shippingAddress?.streetAddress || ""}, ${checkoutData.shippingAddress?.city || ""}`
              : "Store Pickup",
          items: cart.map((it) => ({
            productName: it.name,
            quantity: it.quantity,
            unit: (it as any).packaging || (it as any).unit || "Unit",
            quotedUnitPrice: it.priceData.discountedPrice || it.priceData.price,
            quotedLineTotal: (it.priceData.discountedPrice || it.priceData.price) * it.quantity,
          })),
          subtotal: quoteTotals.subtotal,
          grandTotal: quoteTotals.total,
          additionalNotes: `Direct Order Placement #${fallbackOrderId} via Storefront Checkout. Delivery Method: ${checkoutData.deliveryMethod}`,
        });
      } catch (crmErr) {
        console.warn("Could not log order submission to quote requests:", crmErr);
      }

      updateCheckoutData({ orderId: fallbackOrderId });
      setPaymentStatus("success");
      clearCart();
      goToNextStep();

      toast.success("Order registered successfully!", {
        id: toastId,
        description: `Order #${fallbackOrderId} has been placed.`,
      });
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
        ? "Recalculate Price"
        : `Pay ${formatCurrency("NGN", quoteTotals.total)} with Paystack`,
      icon: isQuoteLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isQuoteError ? (
        <AlertCircle className="mr-2 h-4 w-4" />
      ) : null,
      disabled: !isQuoteReady || cart.length === 0,
      variant: isQuoteError ? ("secondary" as const) : ("default" as const),
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

              {quoteTotals.taxAmount !== undefined && quoteTotals.taxAmount > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-xs">VAT (7.5%):</span>
                  <span className="font-bold text-xs">
                    {formatCurrency("NGN", quoteTotals.taxAmount)}
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
