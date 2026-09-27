"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const handleRedirect = (targetProfile?: any) => {
    if (redirectUrl) {
      router.push(redirectUrl);
      return;
    }
    const userRole = targetProfile?.role || role;
    const userEmail = (targetProfile?.email || email).trim().toLowerCase();

    // 1. Platform Super Admin -> Landlord Command Hub
    if (userRole === "super_admin" || userEmail === "abolarinwaemmanuelfree@gmail.com") {
      router.push("/dashboard/super-admin");
      return;
    }

    // 2. Tenant Store Administrator -> Admin Store Management Dashboard
    if (userRole === "admin") {
      router.push("/dashboard");
      return;
    }

    // 3. Operations Manager -> Manager Staff & Operations Hub
    if (userRole === "manager") {
      router.push("/dashboard/managers");
      return;
    }

    // 4. Regular User / Customer -> Customer Account Hub
    router.push("/account");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const profile = await login(email, password);
      toast.success("Welcome back to OSVID!");
      handleRedirect(profile);
    } catch (err: any) {
      console.error("Login submission error:", err);
      toast.error(err.message || "Failed to sign in. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200/90 p-6 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 text-slate-800 mx-auto">
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
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Account Sign In</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Access your chemical catalog, orders, and management tools
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address</Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="pl-10 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 focus-visible:border-orange-500 rounded-xl text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="pl-10 pr-10 h-11 bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 focus-visible:border-orange-500 rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
              <span>Sign In to Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center mt-6 text-xs text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-orange-600 hover:text-orange-700 font-bold underline underline-offset-4">
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 py-12 text-center text-sm font-medium">Loading sign-in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
