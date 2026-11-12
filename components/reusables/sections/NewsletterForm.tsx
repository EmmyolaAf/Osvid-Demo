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
    <div className="text-white flex flex-col gap-4">
      <h2 className="text-xl md:text-2xl font-bold text-osvid-cream">
        Newsletter
      </h2>
      <p className="text-sm md:text-base text-slate-300">
        Subscribe to get industrial chemical product updates, price bulletins, and exclusive wholesale offers.
      </p>
      <form
        onSubmit={handleSubscribe}
        className="flex flex-col bg-[#574e4299] p-4 gap-4 rounded-xl border border-white/10 shadow-lg"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your corporate or personal email"
          required
          disabled={status === "loading"}
          className="border-b border-white/30 bg-transparent text-white placeholder:text-gray-300 py-2.5 outline-none focus:border-osvid-orange transition duration-200 text-sm disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className="uppercase bg-osvid-orange py-3.5 rounded-lg text-sm font-semibold tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Subscribing...
            </>
          ) : (
            "Subscribe Now"
          )}
        </Button>
        {message && (
          <div
            className={`flex items-center gap-2 text-xs font-medium p-2.5 rounded-lg ${
              status === "success"
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                : "bg-red-950/60 text-red-300 border border-red-500/30"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
