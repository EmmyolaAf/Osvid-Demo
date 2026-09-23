"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, loginWithGoogle, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const handleRedirect = (targetEmail?: string) => {
    if (redirectUrl) {
      router.push(redirectUrl);
      return;
    }
    const clean = (targetEmail || email).trim().toLowerCase();
    if (clean === "abolarinwaemmanuelfree@gmail.com" || role === "super_admin") {
      router.push("/dashboard/super-admin");
      return;
    }
    router.push("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      toast.success("Welcome back to OSVID!");
      setTimeout(() => handleRedirect(email), 300);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
      toast.success("Signed in with Google successfully!");
      setTimeout(handleRedirect, 400);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Google Sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200/80 p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 text-slate-800">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 mb-3 shadow-md shadow-orange-600/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Account Sign In</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Access your OSVID portal, orders, and business management tools
        </p>
      </div>

      {/* Google Sign In */}
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="w-full h-11 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center gap-3 rounded-2xl border border-slate-200 shadow-sm transition-all mb-5"
      >
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-700" /> : <FcGoogle className="w-5 h-5" />}
        Continue with Google
      </Button>

      <div className="relative flex items-center justify-center mb-5">
        <div className="border-t border-slate-200 w-full" />
        <span className="bg-white px-3 text-[11px] text-slate-400 uppercase tracking-wider font-bold">
          or with email
        </span>
        <div className="border-t border-slate-200 w-full" />
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
              className="pl-10 h-11 bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 focus-visible:border-orange-500 rounded-xl text-sm"
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
              className="pl-10 pr-10 h-11 bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-500 focus-visible:border-orange-500 rounded-xl text-sm"
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
          disabled={loading || googleLoading}
          className="w-full h-11 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Sign In</span>
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
    <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
