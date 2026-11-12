"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicQuoteRequest } from "@/lib/firebase/crm";
import {
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Layers,
  MessageSquare,
  HelpCircle,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledProductName?: string;
}

export default function QuoteRequestModal({
  isOpen,
  onClose,
  prefilledProductName,
}: QuoteRequestModalProps) {
  // Client Info
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<"whatsapp" | "email" | "phone">("whatsapp");

  // Procurement Scope
  const [urgency, setUrgency] = useState<"standard" | "urgent" | "immediate">("standard");
  const [deliveryTimeline, setDeliveryTimeline] = useState("Within 7 days");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Product Line Items
  const [items, setItems] = useState<
    Array<{ productName: string; quantity: number; unit: string; targetPrice?: string }>
  >([
    {
      productName: prefilledProductName || "",
      quantity: 1,
      unit: "Drums (200L)",
      targetPrice: "",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuoteNumber, setSubmittedQuoteNumber] = useState<string | null>(null);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { productName: "", quantity: 1, unit: "Drums (200L)", targetPrice: "" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please provide your full name, email address, and phone number.");
      return;
    }

    const validItems = items.filter((it) => it.productName.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please enter at least one chemical product name and quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitPublicQuoteRequest({
        customerName: customerName.trim(),
        companyName: companyName.trim() || undefined,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        deliveryLocation: deliveryLocation.trim() || undefined,
        urgency,
        preferredContactMethod,
        deliveryTimeline,
        estimatedBudget: estimatedBudget.trim() || undefined,
        items: validItems.map((item) => ({
          productName: item.productName.trim(),
          quantity: Number(item.quantity) || 1,
          unit: item.unit.trim() || "Units",
          targetPrice: item.targetPrice ? Number(item.targetPrice) : undefined,
        })),
        additionalNotes: additionalNotes.trim() || undefined,
      });

      if (res.success && res.quoteNumber) {
        setSubmittedQuoteNumber(res.quoteNumber);
        toast.success(`Quotation request ${res.quoteNumber} submitted successfully!`);
      } else {
        toast.error(res.error || "Failed to submit quotation request.");
      }
    } catch (err: any) {
      console.error("Quote request submission error:", err);
      toast.error("Failed to submit request. Please try again or reach us via WhatsApp.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmittedQuoteNumber(null);
    setCustomerName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setDeliveryLocation("");
    setDeliveryTimeline("Within 7 days");
    setEstimatedBudget("");
    setAdditionalNotes("");
    setItems([
      {
        productName: prefilledProductName || "",
        quantity: 1,
        unit: "Drums (200L)",
        targetPrice: "",
      },
    ]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleResetAndClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-2xl">
        {submittedQuoteNumber ? (
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quotation Request Submitted!
              </h2>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed max-w-md mx-auto">
                Thank you, <span className="font-semibold text-slate-800">{customerName}</span>. Your request has been logged in our Commercial CRM Desk under reference:
              </p>
              <div className="mt-3 inline-block bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl text-lg font-mono font-bold text-orange-600">
                {submittedQuoteNumber}
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Our chemical supply desk will generate a formal proforma quote with volume pricing and freight options sent directly to <strong className="text-slate-700">{email}</strong> within 4-12 business hours.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleResetAndClose}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-xl cursor-pointer"
              >
                Close Window
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.open(
                    `https://wa.me/2348034033324?text=Hello%20OSVID,%20I%20just%20submitted%20wholesale%20quotation%20request%20${submittedQuoteNumber}`,
                    "_blank"
                  );
                }}
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium px-6 py-2.5 rounded-xl cursor-pointer"
              >
                Notify Sales via WhatsApp
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <DialogHeader className="mb-5">
              <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
                <FileSpreadsheet className="w-4 h-4" /> Official Commercial Quotation
              </div>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Request a Commercial Wholesale Quote (RFQ)
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs sm:text-sm">
                Get custom factory-direct pricing, bulk container rates, and negotiated haulage for manufacturing plants, contractors, and wholesale distributors.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Client Info Grid */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1. Contact & Business Coordinates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Full Name *
                    </Label>
                    <Input
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Alhaji Babatunde"
                      className="rounded-xl border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" /> Company / Factory Name
                    </Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Industrial Coatings Ltd"
                      className="rounded-xl border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Business Email *
                    </Label>
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="procurement@company.com"
                      className="rounded-xl border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone / WhatsApp *
                    </Label>
                    <Input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="rounded-xl border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Delivery Destination / State *
                    </Label>
                    <Input
                      required
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. Ikeja Industrial Estate, Lagos"
                      className="rounded-xl border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Preferred Response Channel
                    </Label>
                    <select
                      value={preferredContactMethod}
                      onChange={(e: any) => setPreferredContactMethod(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="whatsapp">WhatsApp Message</option>
                      <option value="email">Official Email</option>
                      <option value="phone">Direct Phone Call</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Chemical Requirements & Quantities *
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddItem}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 text-xs font-semibold gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Product
                  </Button>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm"
                  >
                    <div className="col-span-5 sm:col-span-5">
                      <Input
                        required
                        placeholder="e.g. Industrial Resin / Caustic Soda"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-3">
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 text-xs px-2 bg-white text-slate-700"
                      >
                        <option value="Drums (200L)">Drums (200L)</option>
                        <option value="Kegs (25L)">Kegs (25L)</option>
                        <option value="Containers (4L)">Containers (4L)</option>
                        <option value="IBC Totes (1000L)">IBC Totes (1000L)</option>
                        <option value="Bags (25kg / 50kg)">Bags (25/50kg)</option>
                        <option value="Metric Tonnes (MT)">Metric Tonnes (MT)</option>
                        <option value="Litres">Litres</option>
                        <option value="Pieces / Units">Pieces / Units</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItem(idx)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline & Urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Procurement Urgency
                  </Label>
                  <select
                    value={urgency}
                    onChange={(e: any) => setUrgency(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 px-2.5 text-xs bg-white text-slate-800"
                  >
                    <option value="standard">Standard (3-7 days)</option>
                    <option value="urgent">Urgent (48 hours)</option>
                    <option value="immediate">Immediate Dispatch</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Required Delivery Timeline
                  </Label>
                  <Input
                    value={deliveryTimeline}
                    onChange={(e) => setDeliveryTimeline(e.target.value)}
                    placeholder="e.g. Within 10 days"
                    className="h-9 text-xs bg-white rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Target Budget (₦ Optional)
                  </Label>
                  <Input
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    placeholder="e.g. ₦1,500,000"
                    className="h-9 text-xs bg-white rounded-xl"
                  />
                </div>
              </div>

              {/* Technical Specifications / Additional Notes */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Technical Specifications, Formulation Purity or Notes
                </Label>
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Specify chemical concentration, required certificates (COA/MSDS), packaging preferences, batch frequencies..."
                  className="rounded-xl border-slate-200 text-xs min-h-[75px]"
                />
              </div>

              {/* Submit CTA */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetAndClose}
                  disabled={submitting}
                  className="rounded-xl text-xs h-10 px-5 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-xs h-10 px-6 gap-2 cursor-pointer shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Transmitting RFQ...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Submit RFQ to Commercial Desk
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
