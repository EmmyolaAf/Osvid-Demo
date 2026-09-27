"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { submitContactForm } from "@/lib/firebase/storefront";
import { toast } from "sonner";

export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const formData = new FormData(formRef.current!);

    // Name validation
    if (!formData.get("name")?.toString().trim()) {
      newErrors.name = "Full Name is required";
    }

    // Email validation
    const email = formData.get("email")?.toString().trim() || "";
    if (!email) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Message validation
    const message = formData.get("message")?.toString().trim() || "";
    if (!message) {
      newErrors.message = "Message or project inquiry is required";
    } else if (message.length < 10) {
      newErrors.message = "Message should be at least 10 characters long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields accurately.");
      return;
    }

    setStatus("sending");
    setFeedback("");

    const formData = new FormData(formRef.current!);
    const name = formData.get("name")?.toString().trim() || "";
    const email = formData.get("email")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().trim() || "";
    const subject = formData.get("subject")?.toString().trim() || "";
    const message = formData.get("message")?.toString().trim() || "";

    try {
      const result = await submitContactForm({
        name,
        email,
        phone,
        subject,
        message,
      });

      if (result.success) {
        setStatus("success");
        setFeedback("Your inquiry has been received! Our technical team will reach out shortly.");
        toast.success("Message submitted successfully!", {
          description: "Our chemical engineering specialists will contact you within 24 hours.",
        });
        formRef.current?.reset();
      } else {
        setStatus("error");
        setFeedback(result.error || "Failed to submit message. Please try again.");
        toast.error(result.error || "Failed to submit message.");
      }
    } catch (err: any) {
      console.error("Contact form error:", err);
      setStatus("error");
      setFeedback("Something went wrong while transmitting your message. Please reach us via WhatsApp.");
      toast.error("Network error while submitting contact message.");
    }
  };

  const inputClasses = (field: string) =>
    `w-full px-4 py-3.5 rounded-2xl border bg-slate-50/50 text-slate-900 text-sm ${
      errors[field]
        ? "border-red-500 focus:border-red-500 focus:ring-red-100"
        : "border-slate-200 focus:border-orange-500 focus:ring-orange-100"
    } focus:outline-none focus:ring-4 transition-all duration-200 placeholder:text-slate-400 font-medium`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <form
        ref={formRef}
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4 max-w-xl w-full mx-auto"
        noValidate
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Engr. Babatunde Adeyemi"
              aria-label="Your Name"
              className={inputClasses("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              placeholder="name@company.com"
              aria-label="Your Email"
              className={inputClasses("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
              Phone / WhatsApp Number
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="+234 800 000 0000"
              aria-label="Your Phone"
              className={inputClasses("phone")}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
              Inquiry Subject
            </label>
            <input
              type="text"
              name="subject"
              placeholder="e.g. Bulk Epoxy Quote"
              aria-label="Subject"
              className={inputClasses("subject")}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
            Message & Technical Requirements *
          </label>
          <textarea
            name="message"
            placeholder="Please detail your surface area dimensions, chemical formulation requirements, or project scope..."
            aria-label="Your Message"
            rows={5}
            className={inputClasses("message")}
            aria-invalid={!!errors.message}
          />
          {errors.message && (
            <p className="mt-1 text-xs text-red-500 font-medium">{errors.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={status === "sending"}
          className="py-6 mt-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm w-full rounded-2xl shadow-lg shadow-orange-600/20 transition-all gap-2"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting Message...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Technical Inquiry
            </>
          )}
        </Button>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl flex items-start gap-3 border ${
              status === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium leading-relaxed">{feedback}</p>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
