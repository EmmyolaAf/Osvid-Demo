"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveNewsletterSubscriberInDb } from "@/lib/firebase/crm";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await saveNewsletterSubscriberInDb(email, undefined, "footer");
      if (res.success) {
        setStatus("success");
        setMessage(
          res.isNew
            ? "Thank you for subscribing to OSVID Chemical updates!"
            : "Welcome back! Your subscription is already active."
        );
        setEmail("");
      } else {
        setStatus("error");
        setMessage(res.error || "Subscription failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Newsletter subscription error:", error);
      setStatus("error");
      setMessage("Something went wrong. Please check your network connection.");
    }
  };

  return (
    <div className="text-white flex flex-col gap-3.5 w-full min-w-0">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-osvid-cream">
        Newsletter
      </h2>
      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
        Subscribe to get industrial chemical product updates, price bulletins, and exclusive wholesale offers.
      </p>
      <form
        onSubmit={handleSubscribe}
        className="flex flex-col bg-[#574e4299] p-3.5 sm:p-4 gap-3 rounded-xl border border-white/10 shadow-lg w-full min-w-0"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter corporate or personal email"
          required
          disabled={status === "loading"}
          className="w-full min-w-0 border-b border-white/30 bg-transparent text-white placeholder:text-gray-300 py-2 outline-none focus:border-osvid-orange transition duration-200 text-xs sm:text-sm disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className="w-full min-h-[42px] h-10 sm:h-11 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-osvid-orange hover:bg-orange-600 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md whitespace-normal break-words text-center"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Subscribing...</span>
            </>
          ) : (
            <span>Subscribe Now</span>
          )}
        </Button>
        {message && (
          <div
            className={`flex items-start gap-2 text-xs font-medium p-2.5 rounded-lg break-words ${
              status === "success"
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                : "bg-red-950/60 text-red-300 border border-red-500/30"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            )}
            <span className="leading-snug">{message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
