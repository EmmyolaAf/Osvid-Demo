"use client";

import React, { useState, useEffect } from "react";
import { Order, OrderItem, Product, OrderStatus } from "@/types/auth";
import { getProductsFromDb, createManualOrderInDb } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ShoppingCart,
  User,
  MapPin,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import formatCurrency from "@/helpers/formatCurrency";
import { nigerianStates } from "@/lib/constants";

interface ManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}

export default function ManualOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
}: ManualOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Customer Form
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Lagos");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");

  // Line items
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState("");

  // Payment & Status
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("processing");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [shippingFee, setShippingFee] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoadingProducts(true);
        const list = await getProductsFromDb();
        setProducts(list.filter((p) => p.isActive !== false));
      } catch (err) {
        console.warn("Could not fetch products for manual order:", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const variations = currentProduct?.variations || [];
  const currentVariation = variations.find((v) => v.id === selectedVariationId);

  const handleAddItem = () => {
    if (!currentProduct) {
      toast.error("Please select a product to add.");
      return;
    }

    if (currentProduct.productType === "variable" && variations.length > 0 && !currentVariation) {
      toast.error("Please select a variation for this product.");
      return;
    }

    const price = customPrice
      ? parseFloat(customPrice)
      : currentVariation
      ? currentVariation.salePrice || currentVariation.price
      : currentProduct.discountPrice || currentProduct.price;

    const newItem: OrderItem = {
      id: `${currentProduct.id}-${Date.now()}`,
      productId: currentProduct.id,
      productName: currentProduct.name,
      quantity: itemQuantity,
      price: price || 0,
      sku: currentVariation?.sku || currentProduct.sku,
      variationId: currentVariation?.id,
      variationAttributes: currentVariation?.attributes,
      unit: currentProduct.unit || "unit",
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setSelectedVariationId("");
    setItemQuantity(1);
    setCustomPrice("");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * it.quantity, 0);
  const numDiscount = parseFloat(discountAmount) || 0;
  const numShipping = parseFloat(shippingFee) || 0;
  const taxableBase = Math.max(0, subtotal - numDiscount);
  const taxAmount = Math.round(taxableBase * 0.075); // 7.5% standard VAT
  const totalAmount = Math.max(0, taxableBase + taxAmount + numShipping);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error("Customer name and email are required.");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one line item to the order.");
      return;
    }

    try {
      setSubmitting(true);

      const orderPayload: Omit<Order, "id" | "createdAt" | "updatedAt"> = {
        orderNumber: `OSV-ORD-${Date.now().toString().slice(-6)}`,
        userId: "manual_staff_order",
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim() || undefined,
        items,
        totalAmount,
        subtotal,
        discountAmount: numDiscount > 0 ? numDiscount : undefined,
        taxAmount,
        shippingFee: numShipping,
        orderStatus,
        paymentStatus: orderStatus === "completed" || orderStatus === "processing" ? "paid" : "pending",
        paymentMethod,
        deliveryMethod,
        shippingAddress:
          deliveryMethod === "delivery"
            ? {
                streetAddress: streetAddress.trim(),
                city: city.trim(),
                state,
                address: `${streetAddress.trim()}, ${city.trim()}`,
                country: "Nigeria",
              }
            : undefined,
        internalNotes: adminNote.trim() || undefined,
      };

      const res = await createManualOrderInDb(orderPayload);

      if (res.success && res.data) {
        toast.success(`Manual order #${res.data.orderNumber} created successfully!`);
        onOrderCreated(res.data);
        onClose();
      } else {
        toast.error(res.error || "Failed to create manual order.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create manual order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-orange-500" />
            <h3 className="text-sm font-black uppercase tracking-wider">
              Create Manual Order / Proforma Invoice
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-xl p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Customer Details */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <User size={13} className="text-orange-600" />
              Customer Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] font-bold text-slate-600">Customer Full Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Chief Adebayo Okon"
                  className="h-10 text-xs rounded-xl bg-white border-slate-200 mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-600">Email Address *</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. adebayo@apexchemicals.ng"
                  className="h-10 text-xs rounded-xl bg-white border-slate-200 mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-600">Phone Number</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +234 803 123 4567"
                  className="h-10 text-xs rounded-xl bg-white border-slate-200 mt-1"
                />
              </div>
            </div>

            {/* Delivery Details */}
            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] font-bold text-slate-600">Fulfillment Method</Label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value as any)}
                  className="w-full h-10 text-xs rounded-xl bg-white border border-slate-200 px-2 mt-1"
                >
                  <option value="delivery">Courier Delivery</option>
                  <option value="pickup">Depot / Warehouse Pickup</option>
                </select>
              </div>
              {deliveryMethod === "delivery" && (
                <>
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-600">Delivery Street Address</Label>
                    <Input
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. 24 Industrial Layout, Ikeja"
                      className="h-10 text-xs rounded-xl bg-white border-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-slate-600">State</Label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full h-10 text-xs rounded-xl bg-white border border-slate-200 px-2 mt-1"
                    >
                      {nigerianStates.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Line Items Builder */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShoppingCart size={13} className="text-orange-600" />
              Order Items &amp; Products
            </h4>

            {/* Add Item Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-2xl border border-slate-200">
              <div className="sm:col-span-4">
                <Label className="text-[10px] font-bold text-slate-500">Select Product</Label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariationId("");
                  }}
                  className="w-full h-9 rounded-xl border border-slate-200 text-xs px-2 mt-1"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency("NGN", p.price)})
                    </option>
                  ))}
                </select>
              </div>

              {variations.length > 0 && (
                <div className="sm:col-span-3">
                  <Label className="text-[10px] font-bold text-slate-500">Variation</Label>
                  <select
                    value={selectedVariationId}
                    onChange={(e) => setSelectedVariationId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 text-xs px-2 mt-1"
                  >
                    <option value="">-- Select Variation --</option>
                    {variations.map((v) => (
                      <option key={v.id} value={v.id}>
                        {Object.entries(v.attributes || {})
                          .map(([k, val]) => `${k}:${val}`)
                          .join(", ")}{" "}
                        - {formatCurrency("NGN", v.salePrice || v.price)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label className="text-[10px] font-bold text-slate-500">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-xs rounded-xl mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[10px] font-bold text-slate-500">Price (₦ Override)</Label>
                <Input
                  type="number"
                  placeholder="Catalog price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1"
                />
              </div>

              <div className="sm:col-span-1 flex items-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  disabled={!selectedProductId}
                  className="w-full h-9 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold"
                >
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {/* Added Items List */}
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                No items added yet. Use the selector above to add products.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                {items.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{it.productName}</span>
                      {it.variationAttributes && (
                        <span className="text-[11px] text-orange-600 ml-2">
                          ({Object.entries(it.variationAttributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")})
                        </span>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {it.quantity} &times; {formatCurrency("NGN", it.price || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">
                        {formatCurrency("NGN", (it.price || 0) * it.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financials & Status Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CreditCard size={13} className="text-orange-600" />
                Payment &amp; Status
              </h4>

              <div>
                <Label className="text-[11px] font-bold text-slate-600">Initial Order Status</Label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                  className="w-full h-10 text-xs rounded-xl bg-white border border-slate-200 px-2 mt-1"
                >
                  <option value="pending">Pending Payment</option>
                  <option value="processing">Processing (Paid)</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed / Dispatched</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-600">Payment Channel</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 text-xs rounded-xl bg-white border border-slate-200 px-2 mt-1"
                >
                  <option value="Bank Transfer">Direct Bank Transfer</option>
                  <option value="POS Terminal">POS Card Terminal</option>
                  <option value="Cash on Delivery">Cash at Depot / Delivery</option>
                  <option value="Credit Terms (Wholesale)">Wholesale Credit Terms</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-600">Staff Internal Note</Label>
                <Input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Authorized by Sales Manager"
                  className="h-10 text-xs rounded-xl bg-white border-slate-200 mt-1"
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-2 text-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                Order Financial Totals
              </h4>

              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold">{formatCurrency("NGN", subtotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Discount Amount (₦):</span>
                <Input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-28 h-8 text-xs text-right rounded-lg bg-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Shipping Fee (₦):</span>
                <Input
                  type="number"
                  min={0}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="w-28 h-8 text-xs text-right rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-between text-slate-600 pt-1">
                <span>VAT (7.5%):</span>
                <span className="font-bold">{formatCurrency("NGN", taxAmount)}</span>
              </div>

              <div className="flex justify-between text-slate-900 font-black text-base pt-3 border-t-2 border-slate-900">
                <span>Grand Total:</span>
                <span className="text-orange-600">{formatCurrency("NGN", totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs h-11 border-slate-200 px-5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs h-11 px-7 gap-2 shadow-md shadow-orange-600/20"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShoppingCart size={14} />
              )}
              Confirm &amp; Create Order
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
