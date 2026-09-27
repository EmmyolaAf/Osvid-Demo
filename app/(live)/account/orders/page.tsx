"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { getUserOrdersFromDb } from "@/lib/firebase/firestore";
import { Order, OrderStatus } from "@/types/auth";
import {
  ShoppingBag,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Package,
  MapPin,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import formatCurrency from "@/helpers/formatCurrency";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const list = await getUserOrdersFromDb(user.uid, user.email || undefined);
      setOrders(list);
    } catch (err: any) {
      console.error("Error fetching customer orders:", err);
      setError("Failed to retrieve your order records. Please try again.");
      toast.error("Could not load your order history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserOrders();
  }, [user]);

  const getStatusStep = (status: OrderStatus) => {
    const steps = [
      { id: "pending", label: "Order Confirmed" },
      { id: "processing", label: "Formulating / Packing" },
      { id: "shipped", label: "In Transit" },
      { id: "delivered", label: "Delivered" },
    ];

    const currentIdx = steps.findIndex((s) => s.id === status);

    return (
      <div className="w-full py-3">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 w-full z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-orange-600 transition-all duration-500 z-0"
            style={{
              width: currentIdx >= 0 ? `${(currentIdx / (steps.length - 1)) * 100}%` : "0%",
            }}
          />

          {steps.map((step, idx) => {
            const isCompleted = currentIdx >= idx;
            const isCurrent = currentIdx === idx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/30 ring-4 ring-orange-100"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={15} /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] mt-1.5 font-bold text-center ${
                    isCurrent ? "text-orange-600 font-extrabold" : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="bg-slate-50/50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header & Back Navigation */}
          <div className="flex items-center justify-between">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Account Overview</span>
            </Link>

            <Link href="/shop">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md">
                Browse Chemicals
              </Button>
            </Link>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Your Chemical Purchases & Live Tracking
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time fulfillment tracking and transactional history for all your orders with OSVID CHEMICALS LTD.
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center space-y-3 shadow-sm">
              <AlertCircle size={28} className="text-red-600 mx-auto" />
              <p className="text-xs text-red-800 font-medium">{error}</p>
              <Button
                onClick={loadUserOrders}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw size={13} className="mr-1.5 animate-spin" />
                Retry Loading
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">
                Fetching your order records from database...
              </p>
            </div>
          ) : orders.length === 0 && !error ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  No orders placed yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  When you purchase chemicals or materials from our store, your order summary and live delivery dispatch tracker will appear here.
                </p>
              </div>
              <Link href="/shop">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold px-6 py-5 shadow-lg shadow-orange-600/20">
                  Explore Products & Order
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 transition-all hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 tracking-wider">
                          ORDER #{order.orderNumber || order.id.substring(0, 8).toUpperCase()}
                        </span>
                        {order.deliveryMethod && (
                          <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                            {order.deliveryMethod}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Placed on {new Date(order.createdAt).toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-baseline sm:flex-col sm:items-end justify-between gap-1">
                      <p className="text-xl font-black text-slate-900">
                        {formatCurrency("NGN", order.totalAmount)}
                      </p>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                          order.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Payment: {order.paymentStatus?.toUpperCase() || "PAID"}
                      </span>
                    </div>
                  </div>

                  {/* Tracking Stepper */}
                  <div className="pt-2">{getStatusStep(order.orderStatus)}</div>

                  {/* Tracking Number Callout */}
                  {order.trackingNumber && (
                    <div className="p-3 bg-orange-50/80 border border-orange-200/80 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-orange-600" />
                        <span className="font-bold text-orange-950">
                          Tracking Number: {order.trackingNumber}
                        </span>
                      </div>
                      <span className="text-[11px] text-orange-700 font-medium">
                        Courier Dispatched
                      </span>
                    </div>
                  )}

                  {/* Items Purchased List */}
                  <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-200/60 text-xs">
                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                      Items in this Shipment
                    </p>
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-[11px] text-slate-400">
                            Quantity: {item.quantity} {item.unit ? `(${item.unit})` : ""}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900">
                          {formatCurrency("NGN", (item.price || 0) * (item.quantity || 1))}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Destination Information */}
                  {order.shippingAddress && (
                    <div className="text-xs text-slate-600 flex items-start gap-2 pt-1 border-t border-slate-100">
                      <MapPin size={15} className="text-orange-600 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-800">Delivery Address: </strong>
                        {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
                        {order.shippingAddress.state}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
