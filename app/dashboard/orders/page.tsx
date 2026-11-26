"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersFromDb, subscribeToOrders, updateOrderStatusInDb, updateOrderInDb, deleteOrderFromDb } from "@/lib/firebase/firestore";
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
  Plus,
  Printer,
  PauseCircle,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Edit,
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
import OrderNotesDrawer from "@/components/dashboard/orders/OrderNotesDrawer";
import OrderInvoiceModal from "@/components/dashboard/orders/OrderInvoiceModal";
import ManualOrderModal from "@/components/dashboard/orders/ManualOrderModal";

const WOO_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

export default function OrdersManagementPage() {
  const { userProfile, role } = useAuth();
  const isAdmin =
    role === "super_admin" ||
    role === "admin" ||
    userProfile?.role === "super_admin" ||
    userProfile?.role === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modals
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Tracking, Note, and Stage Edit State in Modal
  const [modalStatus, setModalStatus] = useState<OrderStatus>("pending");
  const [modalTrackingNumber, setModalTrackingNumber] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Edit Order State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editStreetAddress, setEditStreetAddress] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>("pending");
  const [editOrderStatus, setEditOrderStatus] = useState<OrderStatus>("processing");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    const unsubscribe = subscribeToOrders((realtimeOrders) => {
      setOrders(realtimeOrders);
      setLoading(false);
    });
    return () => unsubscribe();
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

  const openEditModal = (o: Order) => {
    setEditingOrder(o);
    setEditCustomerName(o.customerName || "");
    setEditCustomerEmail(o.customerEmail || "");
    setEditCustomerPhone(o.customerPhone || "");
    setEditStreetAddress(
      o.shippingAddress?.streetAddress || o.shippingAddress?.address || ""
    );
    setEditPaymentStatus(o.paymentStatus || "pending");
    setEditOrderStatus(o.orderStatus || "processing");
    setEditTrackingNumber(o.trackingNumber || "");
    setEditNotes(o.notes || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;
    try {
      setIsSavingEdit(true);
      const updates: Partial<Order> = {
        customerName: editCustomerName.trim() || editingOrder.customerName,
        customerEmail: editCustomerEmail.trim().toLowerCase() || editingOrder.customerEmail,
        customerPhone: editCustomerPhone.trim(),
        paymentStatus: editPaymentStatus as any,
        orderStatus: editOrderStatus,
        trackingNumber: editTrackingNumber.trim() || undefined,
        notes: editNotes.trim() || undefined,
        shippingAddress: {
          fullName: editCustomerName.trim() || editingOrder.customerName,
          streetAddress: editStreetAddress.trim(),
          address: editStreetAddress.trim(),
          city: editingOrder.shippingAddress?.city || "Lagos",
          state: editingOrder.shippingAddress?.state || "Lagos",
          phone: editCustomerPhone.trim() || editingOrder.customerPhone,
          email: editCustomerEmail.trim() || editingOrder.customerEmail,
        },
      };

      const res = await updateOrderInDb(editingOrder.id, updates);
      if (!res.success) {
        toast.error(res.error || "Failed to update order.");
        return;
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id ? ({ ...o, ...updates } as Order) : o
        )
      );
      if (selectedOrder?.id === editingOrder.id) {
        setSelectedOrder((prev) => (prev ? ({ ...prev, ...updates } as Order) : null));
      }

      toast.success("Order details saved directly to database!");
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save order updates.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!isAdmin) {
      toast.error("Deletion forbidden: Only administrators can delete orders.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to permanently delete order #${orderNumber} from database? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteOrderFromDb(orderId);
      if (!res.success) {
        toast.error(res.error || "Failed to delete order.");
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (selectedOrder?.id === orderId) setIsDetailOpen(false);
      toast.success(`Order #${orderNumber} deleted successfully from database.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete order.");
    }
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
      case "completed":
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
            <Clock size={12} /> Processing
          </span>
        );
      case "on-hold":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800">
            <PauseCircle size={12} /> On Hold
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
            <Truck size={12} /> Shipped
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800">
            <RotateCcw size={12} /> Refunded
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800">
            <AlertTriangle size={12} /> Failed
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
            <Clock size={12} /> Pending Payment
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
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                WooCommerce Order Administration
              </h1>
              <p className="text-xs text-slate-500">
                Manage fulfillment pipelines, order notes, manual invoices, and dispatched goods
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsManualOrderOpen(true)}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9 px-4 shadow-sm shadow-orange-600/20"
          >
            <Plus size={14} />
            New Manual Order
          </Button>

          <Button
            onClick={loadOrders}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 h-9 px-3"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="w-full lg:w-80 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, order ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
          {["all", ...WOO_ORDER_STATUSES].map((st) => {
            const count =
              st === "all"
                ? orders.length
                : orders.filter((o) => o.orderStatus === st).length;

            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`text-xs font-bold capitalize rounded-xl h-8 px-3 whitespace-nowrap transition-all border ${
                  statusFilter === st
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {st}
                <span
                  className={`ml-1.5 text-[10px] font-normal px-1.5 py-0.2 rounded-full ${
                    statusFilter === st ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading orders from Firestore...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center px-4">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No matching orders</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no orders matching your current search or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                <tr>
                  <th className="py-3.5 px-6">Order Reference</th>
                  <th className="py-3.5 px-6">Customer</th>
                  <th className="py-3.5 px-6">Grand Total</th>
                  <th className="py-3.5 px-6">Payment</th>
                  <th className="py-3.5 px-6">Order Status</th>
                  <th className="py-3.5 px-6">Change Stage</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-mono font-bold text-slate-900">
                        #{o.orderNumber || o.id.substring(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{o.customerName}</p>
                      <p className="text-[11px] text-slate-400">{o.customerEmail}</p>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">
                        {formatCurrency("NGN", o.totalAmount)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {o.items?.length || 0} item(s)
                      </p>
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          o.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {o.paymentStatus || "pending"}
                      </span>
                      {o.paymentMethod && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {o.paymentMethod}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-6">{getStatusBadge(o.orderStatus)}</td>

                    <td className="py-4 px-6">
                      <select
                        value={o.orderStatus}
                        disabled={updatingId === o.id}
                        onChange={(e) =>
                          handleStatusChange(o.id, e.target.value as OrderStatus)
                        }
                        className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
                      >
                        {WOO_ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInvoiceOrder(o)}
                          title="Print Invoice / Packing Slip"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-xl"
                        >
                          <Printer size={15} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetailModal(o)}
                          title="View Order Details & Notes"
                          className="h-8 w-8 text-slate-500 hover:text-orange-600 rounded-xl"
                        >
                          <Eye size={15} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(o)}
                          title="Edit Order"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-xl"
                        >
                          <Edit size={14} />
                        </Button>

                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteOrder(
                                o.id,
                                o.orderNumber || o.id.substring(0, 8).toUpperCase()
                              )
                            }
                            title="Delete Order (Admin Only)"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
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
        <DialogContent className="sm:max-w-2xl bg-white rounded-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          {selectedOrder && (
            <>
              <DialogHeader className="text-left space-y-1 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-black text-slate-900">
                    Order #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8).toUpperCase()}
                  </DialogTitle>
                  <div>{getStatusBadge(selectedOrder.orderStatus)}</div>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()} &bull; Payment Channel: {selectedOrder.paymentMethod || "Paystack Gateway"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2 text-xs">
                {/* Customer Details */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Customer Information
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">{selectedOrder.customerName}</p>
                  <div className="flex flex-wrap items-center gap-4 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-orange-600" /> {selectedOrder.customerEmail}
                    </span>
                    {selectedOrder.customerPhone && (
                      <span className="flex items-center gap-1.5">
                        <Phone size={13} className="text-orange-600" /> {selectedOrder.customerPhone}
                      </span>
                    )}
                  </div>
                  {selectedOrder.shippingAddress && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80 text-slate-600 flex items-start gap-1.5">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-orange-600" />
                      <span>
                        {selectedOrder.shippingAddress.address || selectedOrder.shippingAddress.streetAddress},{" "}
                        {selectedOrder.shippingAddress.city},{" "}
                        {selectedOrder.shippingAddress.state}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tracking & Stage Management */}
                <div className="p-4 bg-orange-50/70 border border-orange-200/70 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={14} className="text-orange-600" />
                    Dispatch &amp; Order Status Stage
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Change Order Status
                      </label>
                      <select
                        value={modalStatus}
                        onChange={(e) => setModalStatus(e.target.value as OrderStatus)}
                        className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-bold text-slate-800 outline-none"
                      >
                        {WOO_ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Courier Tracking Number
                      </label>
                      <Input
                        placeholder="e.g. GIG-998242-NG"
                        value={modalTrackingNumber}
                        onChange={(e) => setModalTrackingNumber(e.target.value)}
                        className="h-10 rounded-xl border-slate-300 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setInvoiceOrder(selectedOrder)}
                      className="rounded-xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5 h-9"
                    >
                      <Printer size={13} />
                      Print Packing Slip
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleSaveModalDetails}
                      disabled={isSavingModal}
                      className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-2 h-9 px-5 shadow-xs"
                    >
                      {isSavingModal ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      Save Status &amp; Tracking
                    </Button>
                  </div>
                </div>

                {/* Items in order */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Ordered Formulations &amp; Variations
                  </h4>
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          {item.variationAttributes && (
                            <p className="text-[11px] text-orange-600 font-semibold mt-0.5">
                              {Object.entries(item.variationAttributes)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.quantity} &times; {formatCurrency("NGN", item.price)}
                            {item.sku && <span className="ml-2 font-mono">SKU: {item.sku}</span>}
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency("NGN", selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                  </div>
                  {selectedOrder.discountAmount ? (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount Savings:</span>
                      <span>-{formatCurrency("NGN", selectedOrder.discountAmount)}</span>
                    </div>
                  ) : null}
                  {selectedOrder.taxAmount ? (
                    <div className="flex justify-between text-slate-600">
                      <span>VAT (7.5%):</span>
                      <span>{formatCurrency("NGN", selectedOrder.taxAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping Fee:</span>
                    <span>{formatCurrency("NGN", selectedOrder.shippingFee || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-orange-600">{formatCurrency("NGN", selectedOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Interactive Order Notes Timeline */}
                <OrderNotesDrawer
                  orderId={selectedOrder.id}
                  authorName={userProfile?.displayName || "Staff Administrator"}
                />

                {isAdmin && (
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <p className="text-[11px] text-slate-400">Administrative Controls</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsDetailOpen(false);
                          openEditModal(selectedOrder);
                        }}
                        className="rounded-xl text-xs font-bold gap-1.5 h-8"
                      >
                        <Edit size={13} />
                        Edit Order
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleDeleteOrder(
                            selectedOrder.id,
                            selectedOrder.orderNumber || selectedOrder.id.substring(0, 8).toUpperCase()
                          )
                        }
                        className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 size={13} />
                        Delete Order
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6 sm:p-8">
          <DialogHeader className="text-left space-y-1 border-b border-slate-100 pb-4">
            <DialogTitle className="text-lg font-black text-slate-900">
              Edit Order #{editingOrder?.orderNumber || editingOrder?.id.substring(0, 8).toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Directly edit and save customer, delivery, and stage parameters to the database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Name</label>
              <Input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                className="h-9 rounded-xl border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
                <Input
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  className="h-9 rounded-xl border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone</label>
                <Input
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="h-9 rounded-xl border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address / Destination</label>
              <Input
                value={editStreetAddress}
                onChange={(e) => setEditStreetAddress(e.target.value)}
                className="h-9 rounded-xl border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Status</label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 text-xs bg-white px-2.5 font-bold text-slate-800 outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Order Fulfillment Status</label>
                <select
                  value={editOrderStatus}
                  onChange={(e) => setEditOrderStatus(e.target.value as OrderStatus)}
                  className="w-full h-9 rounded-xl border border-slate-300 text-xs bg-white px-2.5 font-bold text-slate-800 outline-none"
                >
                  {WOO_ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Courier Tracking Number</label>
              <Input
                value={editTrackingNumber}
                onChange={(e) => setEditTrackingNumber(e.target.value)}
                placeholder="e.g. GIG-12345-NG"
                className="h-9 rounded-xl border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Order Notes / Internal Instructions</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-300 text-xs p-2.5 outline-none resize-none focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditOrder}
                disabled={isSavingEdit}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-1.5"
              >
                {isSavingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Changes to DB
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Order Modal */}
      <ManualOrderModal
        isOpen={isManualOrderOpen}
        onClose={() => setIsManualOrderOpen(false)}
        onOrderCreated={(newOrder) => {
          setOrders([newOrder, ...orders]);
        }}
      />

      {/* Printable Invoice Modal */}
      <OrderInvoiceModal
        order={invoiceOrder}
        isOpen={Boolean(invoiceOrder)}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
