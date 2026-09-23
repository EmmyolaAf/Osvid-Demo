"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersFromDb, updateOrderStatusInDb } from "@/lib/firebase/firestore";
import { Order, OrderStatus } from "@/types/auth";
import {
  ShoppingBag,
  Search,
  Filter,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function OrdersManagementPage() {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const list = await getOrdersFromDb();
      setOrders(list);
    } catch (err) {
      console.error("Error fetching orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      const updaterName = userProfile?.displayName || "Operations Manager";
      await updateOrderStatusInDb(orderId, newStatus, updaterName, `Status updated to ${newStatus}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, orderStatus: newStatus } : null));
      }
      toast.success(`Order marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && o.orderStatus !== statusFilter) return false;
    return true;
  });

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "delivered":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800"><CheckCircle2 size={12} /> Delivered</span>;
      case "shipped":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800"><Truck size={12} /> Shipped</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800"><Clock size={12} /> Processing</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800"><XCircle size={12} /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-800"><Clock size={12} /> Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Order Fulfillment Pipeline</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track customer orders, manage fulfillment stages & dispatch updates
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, order ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {["all", "pending", "processing", "shipped", "delivered", "cancelled"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "default" : "outline"}
              onClick={() => setStatusFilter(st)}
              className={`text-xs capitalize rounded-xl ${
                statusFilter === st ? "bg-slate-900 text-white" : ""
              }`}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-4">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no orders matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <tr>
                  <th className="py-3.5 px-6">Order ID / Date</th>
                  <th className="py-3.5 px-6">Customer</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Payment</th>
                  <th className="py-3.5 px-6">Fulfillment Status</th>
                  <th className="py-3.5 px-6">Update Stage (Manager)</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-mono font-bold text-xs text-slate-900">
                        #{o.orderNumber || o.id.substring(0, 8)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{o.customerName}</p>
                      <p className="text-xs text-slate-500">{o.customerEmail}</p>
                    </td>

                    <td className="py-4 px-6 font-bold text-slate-900">
                      {formatNaira(o.totalAmount)}
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          o.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {o.paymentStatus?.toUpperCase() || "PENDING"}
                      </span>
                    </td>

                    <td className="py-4 px-6">{getStatusBadge(o.orderStatus)}</td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        {updatingId === o.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                        ) : (
                          <select
                            value={o.orderStatus}
                            onChange={(e) =>
                              handleStatusChange(o.id, e.target.value as OrderStatus)
                            }
                            className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(o);
                          setIsDetailOpen(true);
                        }}
                        className="text-xs h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold"
                      >
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-xl bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    Order #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                  </DialogTitle>
                  <div>{getStatusBadge(selectedOrder.orderStatus)}</div>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                {/* Customer Contact */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Customer Information
                  </h4>
                  <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
                    <span className="flex items-center gap-1">
                      <Mail size={13} /> {selectedOrder.customerEmail}
                    </span>
                    {selectedOrder.customerPhone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} /> {selectedOrder.customerPhone}
                      </span>
                    )}
                  </div>
                  {selectedOrder.shippingAddress && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80 text-xs text-slate-600 flex items-start gap-1">
                      <MapPin size={13} className="shrink-0 mt-0.5" />
                      <span>
                        {selectedOrder.shippingAddress.address},{" "}
                        {selectedOrder.shippingAddress.city},{" "}
                        {selectedOrder.shippingAddress.state}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items in order */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Purchased Items
                  </h4>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">
                            {item.productName || item.id}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Quantity: {item.quantity} &times; {formatNaira(item.price)}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900 text-xs">
                          {formatNaira((item.price || 0) * (item.quantity || 1))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatNaira(selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping Fee:</span>
                    <span>{formatNaira(selectedOrder.shippingFee || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-slate-200">
                    <span>Total Amount:</span>
                    <span>{formatNaira(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
