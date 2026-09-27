"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, User, Phone, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      await register(email.trim().toLowerCase(), password, name.trim(), phone.trim());
      toast.success("Account created successfully! Welcome to OSVID.");
      router.push("/account");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200/90 p-6 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 text-slate-800 my-4 mx-auto">
      {/* Brand Logo & Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <Link href="/" className="inline-block mb-4 hover:opacity-90 transition-opacity">
          <Image
            src="/images/logo.webp"
            alt="OSVID Chemicals"
            width={160}
            height={50}
            className="h-12 w-auto object-contain mx-auto"
            priority
          />
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create OSVID Account</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Join OSVID for chemical purchases, tracking &amp; custom quotes
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name / Business Name *</Label>
          <div className="relative mt-1">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe / Apex Manufacturing"
              required
              className="pl-10 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 rounded-xl text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address *</Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="pl-10 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 rounded-xl text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Phone Number</Label>
          <div className="relative mt-1">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              className="pl-10 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password *</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-10 pr-9 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 rounded-xl text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Confirm *</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-10 pr-9 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 rounded-xl text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 mt-4"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center mt-6 text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-orange-600 hover:text-orange-700 font-bold underline underline-offset-4">
          Sign In
        </Link>
      </div>
    </div>
  );
}
