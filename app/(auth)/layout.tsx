import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between relative">
      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between container mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.webp"
            alt="OSVID Chemicals"
            width={140}
            height={42}
            className="h-9 w-auto object-contain"
          />
        </Link>
      </header>

      {/* Form Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 font-medium">
        &copy; {new Date().getFullYear()} OSVID Chemicals &amp; Allied Products Ltd. All rights reserved.
      </footer>
      <Toaster richColors position="top-right" />
    </div>
  );
}
