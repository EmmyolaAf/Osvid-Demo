"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      //   const res = await fetch("/api/subscribe", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({ email }),
      //   });

      //   const data = await res.json();

      //   if (!res.ok) {
      //     setStatus("error");
      //     setMessage(data.error || "Subscription failed");
      //     return;
      //   }

      setStatus("success");
      setMessage("Successfully subscribed! Check your email.");
      setEmail("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="text-white flex flex-col gap-4">
      <h2 className="text-xl md:text-2xl font-bold text-osvid-cream">
        Newsletter
      </h2>
      <p className="text-sm md:text-base">
        Subscribe to get updates, industry news, and exclusive offers.
      </p>
      <form
        onSubmit={handleSubscribe}
        className="flex flex-col bg-[#574e4299] p-4 gap-4 rounded-md"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          className="border-b bg-transparent text-white placeholder:text-gray-300 py-2 outline-none focus:border-osvid-orange transition duration-200"
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className="uppercase bg-osvid-orange py-4 rounded-md text-base hover:bg-orange-600 transition-colors"
        >
          {status === "loading" ? "Subscribing..." : "Subscribe"}
        </Button>
        {message && (
          <p
            className={`text-sm ${
              status === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
