"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersFromDb, updateOrderStatusInDb } from "@/lib/firebase/firestore";
import { Order, OrderStatus } from "@/types/auth";
import {
  ShoppingBag,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Eye,
  RefreshCw,
  Save,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import formatCurrency from "@/helpers/formatCurrency";

function getAllowedTransitions(
  currentStatus: OrderStatus,
  deliveryMethod?: "pickup" | "delivery"
): OrderStatus[] {
  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return [currentStatus];
  }

  const method = deliveryMethod === "pickup" ? "pickup" : "delivery";

  if (method === "pickup") {
    if (currentStatus === "pending") return ["pending", "processing", "cancelled"];
    if (currentStatus === "processing") return ["processing", "delivered", "cancelled"];
  } else {
    if (currentStatus === "pending") return ["pending", "processing", "cancelled"];
    if (currentStatus === "processing") return ["processing", "shipped", "cancelled"];
    if (currentStatus === "shipped") return ["shipped", "delivered"];
  }

  return [currentStatus];
}

export default function OrdersManagementPage() {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tracking, Note, and Stage Edit State in Modal
  const [modalStatus, setModalStatus] = useState<OrderStatus>("pending");
  const [modalTrackingNumber, setModalTrackingNumber] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [isSavingModal, setIsSavingModal] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const list = await getOrdersFromDb();
      setOrders(list);
    } catch (err) {
      console.error("Error fetching orders:", err);
      toast.error("Failed to load orders from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
    trackingNumber?: string,
    note?: string
  ) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatusInDb(
        orderId,
        newStatus,
        undefined,
        note || `Fulfillment stage updated to ${newStatus}`,
        trackingNumber
      );

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                orderStatus: newStatus,
                trackingNumber: trackingNumber ?? o.trackingNumber,
              }
            : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                orderStatus: newStatus,
                trackingNumber: trackingNumber ?? prev.trackingNumber,
              }
            : null
        );
      }

      toast.success(`Order status updated to "${newStatus.toUpperCase()}"`);
    } catch (err: any) {
      console.error("Error updating order:", err);
      toast.error(err.message || "Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveModalDetails = async () => {
    if (!selectedOrder) return;
    setIsSavingModal(true);
    try {
      const trackingTrimmed = modalTrackingNumber.trim() || undefined;
      const noteTrimmed = modalNote.trim() || undefined;

      if (
        modalStatus === "shipped" &&
        !trackingTrimmed &&
        !selectedOrder.trackingNumber &&
        selectedOrder.deliveryMethod !== "pickup"
      ) {
        toast.error("Courier tracking reference is required to transition delivery order to Shipped.");
        setIsSavingModal(false);
        return;
      }

      await handleStatusChange(
        selectedOrder.id,
        modalStatus,
        trackingTrimmed,
        noteTrimmed
      );
      toast.success("Shipment details and notes saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save shipment details.");
    } finally {
      setIsSavingModal(false);
    }
  };

  const openDetailModal = (o: Order) => {
    setSelectedOrder(o);
    setModalStatus(o.orderStatus);
    setModalTrackingNumber(o.trackingNumber || "");
    setModalNote("");
    setIsDetailOpen(true);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.paystackReference?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && o.orderStatus !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={12} /> Delivered
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
            <Truck size={12} /> Shipped
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
            <Clock size={12} /> Processing
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-800">
            <Clock size={12} /> Pending
          </span>
        );
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
            <h1 className="text-2xl font-black text-slate-900">
              Order Fulfillment & Dispatch Pipeline
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track customer orders, manage live fulfillment stages & dispatch updates
          </p>
        </div>

        <Button
          onClick={loadOrders}
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh Pipeline
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, order ID, email, Paystack ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["all", "pending", "processing", "shipped", "delivered", "cancelled"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "default" : "outline"}
              onClick={() => setStatusFilter(st)}
              className={`text-xs capitalize rounded-xl ${
                statusFilter === st ? "bg-slate-900 text-white" : "border-slate-200"
              }`}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading orders from Firestore...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-4">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no orders matching your current search or filter criteria.
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
                        #{o.orderNumber || o.id.substring(0, 8).toUpperCase()}
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
                      {formatCurrency("NGN", o.totalAmount)}
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
                        ) : o.orderStatus === "delivered" || o.orderStatus === "cancelled" ? (
                          <span className="text-xs font-semibold text-slate-400 italic">
                            Completed
                          </span>
                        ) : (
                          <select
                            value={o.orderStatus}
                            onChange={(e) => {
                              const targetStatus = e.target.value as OrderStatus;
                              if (targetStatus === o.orderStatus) return;
                              if (
                                targetStatus === "shipped" &&
                                !o.trackingNumber &&
                                o.deliveryMethod !== "pickup"
                              ) {
                                toast.error(
                                  "Tracking reference required before setting status to Shipped. Please enter details."
                                );
                                openDetailModal(o);
                                return;
                              }
                              handleStatusChange(o.id, targetStatus);
                            }}
                            className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {getAllowedTransitions(o.orderStatus, o.deliveryMethod).map((st) => (
                              <option key={st} value={st}>
                                {st.charAt(0).toUpperCase() + st.slice(1)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetailModal(o)}
                        className="text-xs h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold rounded-xl"
                      >
                        <Eye size={14} className="mr-1" /> View Details
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
        <DialogContent className="sm:max-w-xl bg-white rounded-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          {selectedOrder && (
            <>
              <DialogHeader className="text-left space-y-2">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-black text-slate-900">
                    Order #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8).toUpperCase()}
                  </DialogTitle>
                  <div>{getStatusBadge(selectedOrder.orderStatus)}</div>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                {/* Customer Info */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Customer Details
                  </h4>
                  <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Mail size={13} className="text-orange-600" /> {selectedOrder.customerEmail}
                    </span>
                    {selectedOrder.customerPhone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} className="text-orange-600" /> {selectedOrder.customerPhone}
                      </span>
                    )}
                  </div>
                  {selectedOrder.shippingAddress && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80 text-xs text-slate-600 flex items-start gap-1">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-orange-600" />
                      <span>
                        {selectedOrder.shippingAddress.address},{" "}
                        {selectedOrder.shippingAddress.city},{" "}
                        {selectedOrder.shippingAddress.state}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tracking & Note Updater */}
                <div className="p-4 bg-orange-50/70 border border-orange-200/70 rounded-2xl space-y-3">
                  <h4 className="text-[11px] font-bold text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={14} className="text-orange-600" />
                    Dispatch & Tracking Management
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Fulfillment Stage
                      </label>
                      {selectedOrder.orderStatus === "delivered" || selectedOrder.orderStatus === "cancelled" ? (
                        <div className="h-9 px-3 flex items-center bg-slate-100 rounded-xl text-xs font-bold text-slate-500 capitalize">
                          {selectedOrder.orderStatus} (Completed)
                        </div>
                      ) : (
                        <select
                          value={modalStatus}
                          onChange={(e) => setModalStatus(e.target.value as OrderStatus)}
                          className="w-full h-9 rounded-xl border border-slate-300 text-xs bg-white px-2.5 font-medium text-slate-800 outline-none focus:border-orange-500"
                        >
                          {getAllowedTransitions(selectedOrder.orderStatus, selectedOrder.deliveryMethod).map((st) => (
                            <option key={st} value={st}>
                              {st.charAt(0).toUpperCase() + st.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Courier Tracking Number
                        </label>
                        <Input
                          placeholder="e.g. GIG-998242-NG"
                          value={modalTrackingNumber}
                          onChange={(e) => setModalTrackingNumber(e.target.value)}
                          className="rounded-xl border-slate-300 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Internal Status Note
                        </label>
                        <Input
                          placeholder="e.g. Dispatched via Lagos hub"
                          value={modalNote}
                          onChange={(e) => setModalNote(e.target.value)}
                          className="rounded-xl border-slate-300 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveModalDetails}
                    disabled={isSavingModal}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-2 mt-2"
                  >
                    {isSavingModal ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Save Shipment Updates
                  </Button>
                </div>

                {/* Items in order */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Purchased Chemical Formulations
                  </h4>
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden text-xs">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-[11px] text-slate-400">
                            Quantity: {item.quantity} &times; {formatCurrency("NGN", item.price)}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900">
                          {formatCurrency("NGN", (item.price || 0) * (item.quantity || 1))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency("NGN", selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping:</span>
                    <span>{formatCurrency("NGN", selectedOrder.shippingFee || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-orange-600">{formatCurrency("NGN", selectedOrder.totalAmount)}</span>
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
