"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/providers/CartProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Sparkles,
  ArrowRight,
  X,
  Clock,
  CheckCircle2,
  Package,
  Layers,
} from "lucide-react";

const SNOOZE_STORAGE_KEY = "osvid_cart_snooze_until";
const WEEKLY_PROMPT_KEY = "osvid_cart_weekly_prompt_ts";
const emptySubscribe = () => () => {};

export function InteractiveCartReminder() {
  const { cart, subtotal, totalItems, totalCartPoints, openCart } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [isDismissedThisSession, setIsDismissedThisSession] = useState(false);

  // 1. Evaluate triggers on mount or cart change
  useEffect(() => {
    if (!isMounted || cart.length === 0) {
      setIsWidgetVisible(false);
      return;
    }

    // Do not display on cart or checkout pages
    if (pathname?.startsWith("/checkout") || pathname === "/cart") {
      setIsWidgetVisible(false);
      return;
    }

    if (isDismissedThisSession) {
      return;
    }

    // Check snooze status
    const snoozeUntil = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (snoozeUntil && Date.now() < Number(snoozeUntil)) {
      return;
    }

    // Check for weekly / returning visitor pop-up prompt
    const cartMetaRaw = localStorage.getItem("osvid_cart_meta_v2");
    if (cartMetaRaw) {
      try {
        const meta = JSON.parse(cartMetaRaw);
        const createdAtTime = meta.createdAt ? new Date(meta.createdAt).getTime() : 0;
        const lastWeeklyPrompt = localStorage.getItem(WEEKLY_PROMPT_KEY);
        const lastPromptTime = lastWeeklyPrompt ? Number(lastWeeklyPrompt) : 0;
        const oneDayMs = 24 * 60 * 60 * 1000;
        const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

        // If cart has been waiting for more than 24 hours, and hasn't shown weekly popup in 5 days
        if (
          createdAtTime > 0 &&
          Date.now() - createdAtTime > oneDayMs &&
          Date.now() - lastPromptTime > fiveDaysMs
        ) {
          setIsWeeklyModalOpen(true);
          localStorage.setItem(WEEKLY_PROMPT_KEY, Date.now().toString());
          return;
        }
      } catch (e) {
        console.warn("Could not parse cart metadata:", e);
      }
    }

    // Initial polite entrance timer for floating interactive widget
    const timer = setTimeout(() => {
      setIsWidgetVisible(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, [isMounted, cart.length, pathname, isDismissedThisSession]);

  if (!isMounted || cart.length === 0) return null;

  // Don't render on checkout or cart pages
  if (pathname?.startsWith("/checkout") || pathname === "/cart") return null;

  const handleSnooze = (hours: number = 4) => {
    setIsWidgetVisible(false);
    setIsDismissedThisSession(true);
    try {
      const snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
      localStorage.setItem(SNOOZE_STORAGE_KEY, snoozeUntil.toString());
    } catch {}
  };

  const handleCheckoutClick = () => {
    setIsWidgetVisible(false);
    router.push("/checkout");
  };

  const previewItems = cart.slice(0, 3);
  const remainingCount = cart.length - 3;

  return (
    <>
      {/* ======================================================== */}
      {/* 1. FLOATING INTERACTIVE CART MARKETING WIDGET            */}
      {/* ======================================================== */}
      {isWidgetVisible && (
        <div className="fixed bottom-4 right-4 z-40 max-w-[90vw] sm:max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-950 text-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-800 relative overflow-hidden backdrop-blur-xl">
            {/* Top Glow Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400" />

            {/* Header with dismiss */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-white">
                  <ShoppingCart size={16} />
                  <span className="animate-ping absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Saved Cart Items ({totalItems})
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Your chemicals are reserved
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleSnooze(4)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Remind me later"
                aria-label="Dismiss cart reminder"
              >
                <X size={16} />
              </button>
            </div>

            {/* Product thumbnails preview */}
            <div className="flex items-center gap-2 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800/80 mb-3 overflow-hidden">
              <div className="flex items-center -space-x-2 shrink-0">
                {previewItems.map((item, idx) => (
                  <div
                    key={item.cartItemId || idx}
                    className="relative w-9 h-9 rounded-xl border-2 border-slate-950 bg-slate-800 overflow-hidden shrink-0 shadow-sm"
                  >
                    <Image
                      src={item.imageUrl || "/images/placeholder.webp"}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                    <span className="absolute bottom-0 right-0 bg-orange-600 text-[8px] font-bold text-white px-1 rounded-tl-sm">
                      {item.quantity}
                    </span>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <div className="w-9 h-9 rounded-xl border-2 border-slate-950 bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                    +{remainingCount}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pl-1">
                <p className="text-xs font-bold text-slate-100 truncate">
                  {cart[0]?.name || "Items in cart"}
                </p>
                <p className="text-[11px] text-emerald-400 font-mono font-bold">
                  ₦{subtotal.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Points / Wholesale Discount Marketing Funnel */}
            {totalCartPoints > 0 ? (
              <div className="mb-3.5 bg-gradient-to-r from-amber-950/60 to-orange-950/50 border border-amber-800/60 rounded-xl p-2.5 flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-200 font-medium leading-tight">
                  <strong className="text-amber-300 font-bold">{totalCartPoints.toFixed(1)} Wholesale Points</strong> accumulated. Complete purchase to claim bulk discounts!
                </p>
              </div>
            ) : (
              <div className="mb-3.5 bg-slate-900/80 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
                <Package size={14} className="text-orange-400 shrink-0" />
                <p className="text-[11px] text-slate-300 leading-tight">
                  Factory-direct batch ready for dispatch upon checkout.
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsWidgetVisible(false);
                  openCart();
                }}
                className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl h-9 cursor-pointer"
              >
                Review Cart
              </Button>
              <Button
                size="sm"
                onClick={handleCheckoutClick}
                className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl h-9 gap-1 shadow-lg shadow-orange-900/30 cursor-pointer"
              >
                Checkout <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. RETURNING VISITOR WEEKLY RE-ENGAGEMENT MODAL          */}
      {/* ======================================================== */}
      <Dialog open={isWeeklyModalOpen} onOpenChange={setIsWeeklyModalOpen}>
        <DialogContent className="w-[90vw] sm:w-full sm:max-w-[60vw] max-h-[90vh] bg-white rounded-3xl p-6 sm:p-8 shadow-2xl">
          <DialogHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-sm border border-orange-100">
              <ShoppingCart size={24} />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Welcome Back! Your Cart is Still Here
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              We saved the chemical formulations from your previous visit. Your factory-direct pricing and wholesale point eligibility are still reserved.
            </DialogDescription>
          </DialogHeader>

          {/* Items Summary */}
          <div className="my-4 divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50/60 max-h-56 overflow-y-auto p-2">
            {cart.map((item) => (
              <div key={item.cartItemId} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                    <Image
                      src={item.imageUrl || "/images/placeholder.webp"}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Qty: {item.quantity} &bull; ₦{item.priceData.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold font-mono text-slate-900">
                    ₦{(item.priceData.price * item.quantity).toLocaleString()}
                  </span>
                  {item.pointsPerUnit && item.pointsPerUnit > 0 && (
                    <span className="block text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                      +{(item.pointsPerUnit * item.quantity).toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal & Points Banner */}
          <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Total Items Subtotal</span>
              <span className="text-lg font-black text-slate-900 font-mono">
                ₦{subtotal.toLocaleString()}
              </span>
            </div>
            {totalCartPoints > 0 && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-orange-200 text-orange-800 font-bold">
                <Sparkles size={14} className="text-orange-600" />
                <span>{totalCartPoints.toFixed(1)} Wholesale Points</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <Button
              variant="outline"
              onClick={() => setIsWeeklyModalOpen(false)}
              className="w-full sm:w-auto rounded-xl text-xs font-bold border-slate-200 text-slate-600 cursor-pointer"
            >
              Continue Browsing
            </Button>
            <Button
              onClick={() => {
                setIsWeeklyModalOpen(false);
                router.push("/checkout");
              }}
              className="w-full sm:flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-lg shadow-orange-600/20 cursor-pointer"
            >
              Complete Purchase Now <ArrowRight size={14} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
