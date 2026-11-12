"use client";

import React, { useState } from "react";
import ContactForm from "@/components/reusables/forms/ContactForm";
import QuoteRequestModal from "@/components/reusables/forms/QuoteRequestModal";
import companyData from "@/data/company";
import { FileSpreadsheet, ArrowRight, ShieldCheck, Truck, Building2, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPageClient() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  return (
    <>
      {/* Commercial RFQ Highlight Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-10 mb-12 shadow-xl border border-slate-700/60 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" /> B2B Commercial Procurement
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Need Bulk Drums, Metric Tonnes, or Custom Formulations?
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Get instant proforma quotes with negotiated factory pricing, volume rebates, and dedicated freight to industrial locations nationwide.
          </p>
        </div>

        <Button
          onClick={() => setIsQuoteModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-6 rounded-2xl text-sm shrink-0 shadow-lg shadow-orange-600/30 flex items-center gap-2 cursor-pointer hover:scale-102 transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Request Wholesale RFQ Quote</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid: Contact Form & Info */}
      <div className="grid md:grid-cols-2 gap-12">
        {/* Left Side: General Inquiries Form */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">
              Send Us a Message
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Have technical inquiries or general questions? Our customer care specialists are on standby.
            </p>
          </div>

          <ContactForm />
        </div>

        {/* Right Side: Company Info & Locations */}
        <div className="flex flex-col gap-8 bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" /> Head Office & Blending Facility
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">{companyData.address}</p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Phone className="w-5 h-5 text-orange-600" /> Commercial Coordinates
            </h3>
            <p className="text-gray-600 text-sm">
              <strong>Phone:</strong> {companyData.phone}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Email:</strong> {companyData.email}
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" /> Operating & Dispatch Hours
            </h3>
            <p className="text-gray-600 text-sm">Monday – Friday: 8:00am – 5:00pm</p>
            <p className="text-gray-600 text-sm mt-0.5">Saturday: 9:00am – 2:00pm</p>
            <p className="text-gray-600 text-sm mt-0.5 text-slate-400">Sunday: Closed for maintenance</p>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center gap-3 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Licensed chemical handler & technical consulting provider in Nigeria.</span>
          </div>
        </div>
      </div>

      <QuoteRequestModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
      />
    </>
  );
}
