"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CustomSelect, { CustomSelectOption } from "@/components/ui/custom-select";
import { submitPublicQuoteRequest } from "@/lib/firebase/crm";
import { getProducts } from "@/lib/firebase/storefront";
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

const DEFAULT_CHEMICAL_OPTIONS: CustomSelectOption[] = [
  { value: "OSVID Bond Glue Heavy-Duty", label: "OSVID Bond Glue Heavy-Duty", description: "Industrial High-Tensile Adhesive" },
  { value: "Caustic Soda Flakes (NaOH 99%)", label: "Caustic Soda Flakes (NaOH 99%)", description: "Technical / Industrial Grade" },
  { value: "Industrial Resin & Polymer Binder", label: "Industrial Resin & Polymer Binder", description: "High-Strength Emulsion" },
  { value: "Hydrated Lime / Calcium Hydroxide", label: "Hydrated Lime / Calcium Hydroxide", description: "Construction & Industrial Grade" },
  { value: "Sulfuric Acid Technical Grade", label: "Sulfuric Acid Technical Grade", description: "Bulk Liquid Acid" },
  { value: "Hydrochloric Acid (HCl 33%)", label: "Hydrochloric Acid (HCl 33%)", description: "Industrial Pickling & Processing" },
  { value: "Sodium Hypochlorite (Bleach 15%)", label: "Sodium Hypochlorite (Bleach 15%)", description: "Water Treatment & Disinfection" },
  { value: "Degreaser & Industrial Solvent", label: "Degreaser & Industrial Solvent", description: "Heavy Machinery Cleaning" },
  { value: "Liquid Chlorine", label: "Liquid Chlorine", description: "Water Treatment Biocide" },
  { value: "Nitric Acid 68%", label: "Nitric Acid 68%", description: "Industrial Technical Formulation" },
  { value: "Poly Aluminium Chloride (PAC)", label: "Poly Aluminium Chloride (PAC)", description: "Water Flocculant & Coagulant" },
  { value: "Custom Chemical Formulation / Other", label: "Custom Chemical Formulation / Other", description: "Provide details in Technical Specifications" },
];

const PACKAGING_UNITS: CustomSelectOption[] = [
  { value: "Drums (200L)", label: "Drums (200L)" },
  { value: "Kegs (25L)", label: "Kegs (25L)" },
  { value: "Containers (4L)", label: "Containers (4L)" },
  { value: "IBC Totes (1000L)", label: "IBC Totes (1000L)" },
  { value: "Bags (25kg / 50kg)", label: "Bags (25kg / 50kg)" },
  { value: "Metric Tonnes (MT)", label: "Metric Tonnes (MT)" },
  { value: "Litres", label: "Litres" },
  { value: "Pieces / Units", label: "Pieces / Units" },
];

const CONTACT_CHANNELS: CustomSelectOption[] = [
  { value: "whatsapp", label: "WhatsApp Message" },
  { value: "email", label: "Official Business Email" },
  { value: "phone", label: "Direct Phone Call" },
];

const URGENCY_OPTIONS: CustomSelectOption[] = [
  { value: "standard", label: "Standard (3-7 days)" },
  { value: "urgent", label: "Urgent (48 hours)" },
  { value: "immediate", label: "Immediate Dispatch" },
];

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
    Array<{ productName: string; quantity: string; unit: string; targetPrice?: string }>
  >([
    {
      productName: prefilledProductName || DEFAULT_CHEMICAL_OPTIONS[0].value,
      quantity: "1",
      unit: "Drums (200L)",
      targetPrice: "",
    },
  ]);

  // Product options catalog
  const [productOptions, setProductOptions] = useState<CustomSelectOption[]>(DEFAULT_CHEMICAL_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuoteNumber, setSubmittedQuoteNumber] = useState<string | null>(null);

  // Fetch live store products on mount to merge with defaults
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await getProducts();
        if (isMounted && res.success && res.data && res.data.length > 0) {
          const fetchedOptions: CustomSelectOption[] = res.data.map((p) => ({
            value: p.name,
            label: p.name,
            description: p.category || (p.price ? `₦${p.price.toLocaleString()}` : undefined),
          }));

          // Merge without duplicates
          const seen = new Set<string>();
          const merged: CustomSelectOption[] = [];

          for (const opt of [...fetchedOptions, ...DEFAULT_CHEMICAL_OPTIONS]) {
            if (!seen.has(opt.value.toLowerCase())) {
              seen.add(opt.value.toLowerCase());
              merged.push(opt);
            }
          }

          // Ensure prefilled product is included if present
          if (prefilledProductName && !seen.has(prefilledProductName.toLowerCase())) {
            merged.unshift({
              value: prefilledProductName,
              label: prefilledProductName,
              description: "Selected Product",
            });
          }

          setProductOptions(merged);
        }
      } catch (e) {
        console.error("Error loading product catalog for RFQ modal:", e);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [prefilledProductName]);

  // Update initial line item if prefilledProductName is provided
  useEffect(() => {
    if (prefilledProductName) {
      setItems((prev) => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[0] = { ...copy[0], productName: prefilledProductName };
        }
        return copy;
      });
    }
  }, [prefilledProductName]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productName: productOptions[0]?.value || DEFAULT_CHEMICAL_OPTIONS[0].value,
        quantity: "1",
        unit: "Drums (200L)",
        targetPrice: "",
      },
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

  // Quantity change with strictly numbers only
  const handleQuantityChange = (index: number, rawVal: string) => {
    const digitsOnly = rawVal.replace(/[^0-9]/g, "");
    handleItemChange(index, "quantity", digitsOnly);
  };

  // Phone change with strictly numbers and valid phone symbols
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/[^0-9+\s\-()]/g, "");
    setPhone(sanitized);
  };

  // Budget change with strictly numbers only
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
    setEstimatedBudget(digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please provide your full name, email address, and phone number.");
      return;
    }

    // Target Budget is strictly mandatory
    if (!estimatedBudget.trim() || Number(estimatedBudget) <= 0) {
      toast.error("Target Budget (₦) is mandatory. Please enter a valid amount (numbers only).");
      return;
    }

    const validItems = items.filter((it) => it.productName.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Please select at least one chemical product and enter a valid quantity (numbers only).");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        customerName: customerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        urgency,
        preferredContactMethod,
        deliveryTimeline,
        estimatedBudget: `₦${Number(estimatedBudget).toLocaleString()}`,
        items: validItems.map((item) => {
          const it: any = {
            productName: item.productName.trim(),
            quantity: Number(item.quantity) || 1,
            unit: item.unit.trim() || "Units",
          };
          if (item.targetPrice && Number(item.targetPrice) > 0) {
            it.targetPrice = Number(item.targetPrice);
          }
          return it;
        }),
      };

      if (companyName.trim()) {
        payload.companyName = companyName.trim();
      }
      if (deliveryLocation.trim()) {
        payload.deliveryLocation = deliveryLocation.trim();
      }
      if (additionalNotes.trim()) {
        payload.additionalNotes = additionalNotes.trim();
      }

      const res = await submitPublicQuoteRequest(payload);

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
        productName: prefilledProductName || productOptions[0]?.value || DEFAULT_CHEMICAL_OPTIONS[0].value,
        quantity: "1",
        unit: "Drums (200L)",
        targetPrice: "",
      },
    ]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleResetAndClose()}>
      <DialogContent data-no-edit="true" className="max-w-2xl w-[96vw] sm:w-full max-h-[92vh] overflow-y-auto no-scrollbar bg-white rounded-xl p-3.5 sm:p-7 border border-slate-200 shadow-2xl">
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
              <div className="bg-slate-50/70 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
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
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone / WhatsApp (Numbers &amp; Symbols Only) *
                    </Label>
                    <Input
                      type="tel"
                      required
                      value={phone}
                      onChange={handlePhoneChange}
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
                    <CustomSelect
                      value={preferredContactMethod}
                      onChange={(val) => setPreferredContactMethod(val as any)}
                      options={CONTACT_CHANNELS}
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/70 space-y-3">
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
                    className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs"
                  >
                    {/* Custom Product Select Dropdown */}
                    <div className="col-span-12 sm:col-span-5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block sm:hidden">
                        Select Product / Chemical *
                      </Label>
                      <CustomSelect
                        value={item.productName}
                        onChange={(val) => handleItemChange(idx, "productName", val)}
                        options={productOptions}
                        searchable={true}
                        searchPlaceholder="Search chemicals..."
                        placeholder="Select Chemical Product"
                        size="sm"
                      />
                    </div>

                    {/* Numeric Quantity Only */}
                    <div className="col-span-5 sm:col-span-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block sm:hidden">
                        Qty (Numbers) *
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        className="h-8 text-xs rounded-lg border-slate-200 bg-white"
                      />
                    </div>

                    {/* Custom Packaging Unit Dropdown */}
                    <div className="col-span-5 sm:col-span-4">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block sm:hidden">
                        Packaging Unit
                      </Label>
                      <CustomSelect
                        value={item.unit}
                        onChange={(val) => handleItemChange(idx, "unit", val)}
                        options={PACKAGING_UNITS}
                        placeholder="Packaging Unit"
                        size="sm"
                      />
                    </div>

                    {/* Remove Action */}
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 cursor-pointer disabled:opacity-30"
                        title="Remove product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline & Urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 sm:p-4 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Procurement Urgency
                  </Label>
                  <CustomSelect
                    value={urgency}
                    onChange={(val) => setUrgency(val as any)}
                    options={URGENCY_OPTIONS}
                    size="md"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Required Delivery Timeline
                  </Label>
                  <Input
                    value={deliveryTimeline}
                    onChange={(e) => setDeliveryTimeline(e.target.value)}
                    placeholder="e.g. Within 10 days"
                    className="h-9 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Target Budget (₦) <span className="text-red-500 font-bold">* Mandatory</span>
                  </Label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400 pointer-events-none">₦</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={estimatedBudget}
                      onChange={handleBudgetChange}
                      placeholder="e.g. 1500000"
                      className="h-9 text-xs pl-7 bg-white rounded-xl border-slate-200 font-medium"
                    />
                  </div>
                  {estimatedBudget && (
                    <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
                      ₦{Number(estimatedBudget).toLocaleString()}
                    </span>
                  )}
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
