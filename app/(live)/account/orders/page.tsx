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
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserOrders() {
      if (!user) return;
      try {
        setLoading(true);
        const list = await getUserOrdersFromDb(user.uid);
        setOrders(list);
      } catch (err) {
        console.error("Error fetching customer orders:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUserOrders();
  }, [user]);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusStep = (status: OrderStatus) => {
    const steps = [
      { id: "pending", label: "Order Placed" },
      { id: "processing", label: "Processing" },
      { id: "shipped", label: "Shipped" },
      { id: "delivered", label: "Delivered" },
    ];

    const currentIdx = steps.findIndex((s) => s.id === status);

    return (
      <div className="w-full py-4">
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-1.5 font-bold ${
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
      <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Header */}
          <div className="flex items-center justify-between">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              <span>Back to Account</span>
            </Link>

            <Link href="/shop">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-xl">
                Browse Store
              </Button>
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900">Your Chemical Orders</h1>
            <p className="text-xs text-slate-500 mt-1">
              Live tracking and history of all purchases from OSVID Chemicals
            </p>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No orders placed yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                When you purchase chemicals or materials from our store, they will appear here with live tracking.
              </p>
              <Link href="/shop">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold">
                  Start Shopping
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Order #{order.orderNumber || order.id.substring(0, 8)}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Placed on {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-black text-slate-900">
                        {formatNaira(order.totalAmount)}
                      </p>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          order.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.paymentStatus?.toUpperCase() || "PENDING"}
                      </span>
                    </div>
                  </div>

                  {/* Fulfillment Status Stepper */}
                  <div className="py-2">{getStatusStep(order.orderStatus)}</div>

                  {/* Items List */}
                  <div className="bg-slate-50 rounded-xl p-3 divide-y divide-slate-200/60 text-xs">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{item.productName}</p>
                          <p className="text-[11px] text-slate-400">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-bold text-slate-900">
                          {formatNaira((item.price || 0) * (item.quantity || 1))}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Address */}
                  {order.shippingAddress && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                      <MapPin size={13} className="text-orange-600 shrink-0" />
                      <span>
                        Delivery to: {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
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
