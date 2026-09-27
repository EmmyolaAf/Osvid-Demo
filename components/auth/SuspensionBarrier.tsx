"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  CreditCard,
  ShieldAlert,
  ExternalLink,
  LogOut,
  PhoneCall,
  Crown,
  MessageSquare,
  Building2,
  Calendar,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessSubscription } from "@/types/auth";
import Link from "next/link";

interface SuspensionBarrierProps {
  subscription: BusinessSubscription | null;
}

export default function SuspensionBarrier({ subscription }: SuspensionBarrierProps) {
  const { logout, isSuperAdmin, user } = useAuth();
  const [isCopied, setIsCopied] = useState(false);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 250000);
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText("0123456789 - OSVID Chemicals Ltd - Access Bank");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-xl w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-red-950/70 text-center relative overflow-hidden my-auto">
        {/* Ambient glow accent */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top Icon Badge */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/40 text-red-500 mb-1 shadow-lg shadow-red-500/10">
            <AlertOctagon size={44} className="animate-pulse" />
          </div>

          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              <Lock size={13} />
              <span>Service Access Suspended</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Application Hosting Renewal Required
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              {subscription?.suspendedReason ||
                "Access to this portal has been restricted due to an overdue annual hosting and licensing subscription."}
            </p>
          </div>

          {/* Account & Billing Breakdown */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 text-left space-y-3 text-xs text-slate-300">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-500" />
                Business Entity:
              </span>
              <span className="font-bold text-white">{subscription?.businessName || "OSVID Chemicals Limited"}</span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                License Expiry:
              </span>
              <span className="font-semibold text-red-400">
                {subscription?.hostingExpiryDate
                  ? new Date(subscription.hostingExpiryDate).toLocaleDateString("en-NG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Expired"}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CreditCard size={14} className="text-slate-500" />
                Renewal Settlement:
              </span>
              <span className="font-bold text-emerald-400 text-sm">
                {formatNaira(subscription?.renewalAmountNgn || 250000)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Support / Billing Desk:</span>
              <span className="font-semibold text-white">billing@osvidchemicals.com</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:billing@osvidchemicals.com?subject=Hosting%20Reactivation%20%26%20Settlement"
              className="inline-flex w-full sm:w-auto"
            >
              <Button className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-red-600/30 gap-2 text-xs uppercase tracking-wider">
                <CreditCard size={16} />
                <span>Contact Billing to Reactivate</span>
              </Button>
            </a>

            <a
              href="https://wa.me/2349121090303?text=Hello%20OSVID%20Billing,%20I%20would%20like%20to%20settle%20our%20hosting%20subscription%20renewal."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto"
            >
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/80 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 h-11 px-4 rounded-xl gap-2 text-xs font-semibold"
              >
                <MessageSquare size={16} />
                <span>WhatsApp Desk</span>
              </Button>
            </a>
          </div>

          {/* Footer Controls: Sign Out or Super Admin Bypass */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            {isSuperAdmin ? (
              <Link
                href="/dashboard/super-admin"
                className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold"
              >
                <Crown size={14} className="text-amber-400" />
                <span>Super Admin Governance Bypass</span>
              </Link>
            ) : (
              <span>Locked by Platform Governor</span>
            )}

            {user ? (
              <button
                onClick={logout}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                Admin Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
