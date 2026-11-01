"use client";

import React, { useRef } from "react";
import { Order, OrderNote } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import { Button } from "@/components/ui/button";
import { Printer, Download, X } from "lucide-react";
import companyData from "@/data/company";

interface OrderInvoiceModalProps {
  order: Order | null;
  notes?: OrderNote[];
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderInvoiceModal({
  order,
  notes = [],
  isOpen,
  onClose,
}: OrderInvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const customerNotes = notes.filter((n) => n.isCustomerVisible);
  const orderNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Top Action Bar (hidden in print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Commercial Invoice / Packing Slip
            </span>
            <span className="text-xs text-slate-300 font-mono">#{orderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs h-8 px-4 gap-1.5"
            >
              <Printer size={13} />
              Print / Save as PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl h-8 w-8 p-0"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div
          ref={invoiceRef}
          className="p-8 sm:p-12 space-y-8 bg-white text-slate-800 text-xs font-sans print:p-0 print:m-0"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {companyData.name || "OSVID CHEMICALS LTD"}
              </h1>
              <p className="text-slate-500 text-[11px] font-semibold mt-1">
                Industrial Raw Materials, Ingredients &amp; Chemical Formulations
              </p>
              <div className="mt-2 space-y-0.5 text-slate-500 text-[11px]">
                <p>{companyData.address || "Lagos, Nigeria"}</p>
                <p>Phone: {companyData.phone || "+234 800 000 0000"}</p>
                <p>Email: {companyData.email || "sales@osvid.ng"}</p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-black uppercase">
                INVOICE / RECEIPT
              </span>
              <p className="font-mono text-sm font-black text-slate-900 mt-2">
                Order #{orderNumber}
              </p>
              <p className="text-slate-500 text-[11px]">Date: {dateFormatted}</p>
              <p className="text-slate-500 text-[11px] capitalize">
                Status: <strong className="text-slate-800 font-bold">{order.orderStatus}</strong>
              </p>
              <p className="text-slate-500 text-[11px]">
                Payment: <strong className="text-emerald-700 font-bold">{order.paymentStatus || "Paid"}</strong>
              </p>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Billed To
              </h4>
              <p className="font-bold text-slate-900 text-sm">{order.customerName}</p>
              <p className="text-slate-600 mt-0.5">{order.customerEmail}</p>
              {order.customerPhone && <p className="text-slate-600">{order.customerPhone}</p>}
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Shipping Destination
              </h4>
              <p className="font-semibold text-slate-800 capitalize">
                Method: {order.deliveryMethod === "pickup" ? "Depot Pickup" : "Courier Delivery"}
              </p>
              {order.shippingAddress ? (
                <div className="text-slate-600 mt-1 leading-relaxed">
                  <p>{order.shippingAddress.address}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 italic mt-1">Standard pickup location</p>
              )}
              {order.trackingNumber && (
                <p className="mt-1 font-mono text-[11px] text-orange-700 font-bold">
                  Tracking: {order.trackingNumber}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-2.5">Item Description</th>
                  <th className="py-2.5 text-center">Unit Price</th>
                  <th className="py-2.5 text-center">Quantity</th>
                  <th className="py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items?.map((item, idx) => (
                  <tr key={idx} className="py-3">
                    <td className="py-3 pr-2">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      {item.variationAttributes && (
                        <p className="text-[11px] text-orange-600 font-medium">
                          {Object.entries(item.variationAttributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>
                      )}
                    </td>
                    <td className="py-3 text-center text-slate-600 font-medium">
                      {formatCurrency("NGN", item.price)}
                    </td>
                    <td className="py-3 text-center font-bold text-slate-900">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      {formatCurrency("NGN", (item.price || 0) * (item.quantity || 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Financial Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200">
            <div className="w-full sm:w-1/2 space-y-2">
              {customerNotes.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60">
                  <h5 className="font-bold text-blue-900 text-[10px] uppercase tracking-wider mb-1">
                    Special Instructions / Notes
                  </h5>
                  {customerNotes.map((n) => (
                    <p key={n.id} className="text-blue-950 text-xs">
                      {n.content}
                    </p>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-slate-400 space-y-0.5">
                <p>Payment Reference: {order.paystackReference || "Verified"}</p>
                <p>All chemical materials comply with technical grade specifications.</p>
              </div>
            </div>

            <div className="w-full sm:w-1/2 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">
                  {formatCurrency("NGN", order.subtotal || order.totalAmount)}
                </span>
              </div>
              {order.discountAmount ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount Applied:</span>
                  <span className="font-semibold">
                    -{formatCurrency("NGN", order.discountAmount)}
                  </span>
                </div>
              ) : null}
              {order.taxAmount ? (
                <div className="flex justify-between text-slate-600">
                  <span>VAT (7.5%):</span>
                  <span className="font-semibold">
                    {formatCurrency("NGN", order.taxAmount)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-600">
                <span>Delivery / Logistics Fee:</span>
                <span className="font-semibold">
                  {formatCurrency("NGN", order.shippingFee || 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-base pt-2 border-t-2 border-slate-900">
                <span>Grand Total:</span>
                <span className="text-orange-600">
                  {formatCurrency("NGN", order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer & Signature Line */}
          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-[11px] text-slate-500">
            <div>
              <p className="font-bold text-slate-800">Thank you for your business!</p>
              <p>For chemical technical support or COA requests, contact our quality lab.</p>
            </div>
            <div className="text-right">
              <div className="w-40 border-b border-slate-300 mb-1" />
              <p className="text-[10px] text-slate-400">Authorized Officer Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
