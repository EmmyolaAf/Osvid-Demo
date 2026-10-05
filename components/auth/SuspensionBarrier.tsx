"use client";

import React from "react";
import {
  AlertOctagon,
  LogOut,
  Crown,
  Building2,
  Calendar,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { OSVID_CLIENT_CONFIG } from "@/config/client";
import Link from "next/link";

interface SuspensionBarrierProps {
  subscription?: {
    businessName?: string;
    hostingExpiryDate?: string;
    suspendedReason?: string;
    isSuspended?: boolean;
    status?: string;
  } | null;
}

export default function SuspensionBarrier({ subscription }: SuspensionBarrierProps) {
  const { logout, isSuperAdmin, user } = useAuth();

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
                "Access to this portal has been restricted by the platform provider due to an overdue annual hosting and licensing subscription."}
            </p>
          </div>

          {/* Account & Status Breakdown */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 text-left space-y-3 text-xs text-slate-300">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-500" />
                Organization:
              </span>
              <span className="font-bold text-white">
                {subscription?.businessName || OSVID_CLIENT_CONFIG.businessName}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                Subscription Status:
              </span>
              <span className="font-semibold text-red-400">
                Access Suspended
              </span>
            </div>

            {subscription?.hostingExpiryDate && (
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  License Expiration:
                </span>
                <span className="font-medium text-slate-300">
                  {new Date(subscription.hostingExpiryDate).toLocaleDateString("en-NG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}

            <div className="pt-2 text-slate-400 text-center leading-relaxed text-[11px]">
              Please contact the platform service provider or designated system administrator to resolve hosting renewal and restore operations.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="inline-flex w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white h-11 px-5 rounded-xl gap-2 text-xs font-semibold"
              >
                <ArrowLeft size={16} />
                <span>Return to Storefront</span>
              </Button>
            </Link>

            {user && (
              <Button
                onClick={logout}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-red-600/30 gap-2 text-xs uppercase tracking-wider"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </Button>
            )}
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

            {!user && (
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
