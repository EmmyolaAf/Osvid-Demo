"use client";

import React from "react";
import { AlertOctagon, CreditCard, ShieldAlert, ExternalLink, LogOut, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessSubscription } from "@/types/auth";

interface SuspensionBarrierProps {
  subscription: BusinessSubscription | null;
}

export default function SuspensionBarrier({ subscription }: SuspensionBarrierProps) {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-red-950/50 text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 mb-2">
            <AlertOctagon size={44} className="animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              Service Temporarily Suspended
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Application Hosting Renewal Required
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              {subscription?.suspendedReason ||
                "Access to this business management portal has been suspended due to an overdue hosting and infrastructure subscription."}
            </p>
          </div>

          {/* Account Details */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-300">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-500">Business Entity:</span>
              <span className="font-semibold text-white">{subscription?.businessName || "OSVID Chemicals Ltd"}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-500">Plan:</span>
              <span className="font-semibold text-orange-400 uppercase">{subscription?.hostingPlan || "Enterprise Tier"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Support / Billing Contact:</span>
              <span className="font-semibold text-white">billing@osvidchemicals.com</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:billing@osvidchemicals.com?subject=Hosting%20Reactivation%20Request"
              className="inline-flex"
            >
              <Button className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold h-11 px-6 rounded-xl shadow-lg shadow-red-600/30 gap-2">
                <CreditCard size={18} />
                <span>Contact Billing & Reactivate</span>
              </Button>
            </a>

            <Button
              variant="outline"
              onClick={logout}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white h-11 px-5 rounded-xl gap-2"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
