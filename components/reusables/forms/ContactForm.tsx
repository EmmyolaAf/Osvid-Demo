"use client";

import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

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
      newErrors.name = "Name is required";
    }

    // Email validation
    const email = formData.get("email")?.toString().trim() || "";
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Message validation
    if (!formData.get("message")?.toString().trim()) {
      newErrors.message = "Message is required";
    } else if ((formData.get("message")?.toString().trim() || "").length < 10) {
      newErrors.message = "Message should be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setStatus("sending");
    setFeedback("");

    try {
      await emailjs.sendForm(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        formRef.current!,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );

      setStatus("success");
      setFeedback("Your message has been sent successfully!");
      formRef.current?.reset();

      // Reset success message after 5 seconds
      setTimeout(() => {
        if (status === "success") {
          setStatus("idle");
          setFeedback("");
        }
      }, 5000);
    } catch (error) {
      console.error("Email sending error:", error);
      setStatus("error");
      setFeedback("Oops! Something went wrong. Please try again later.");
    }
  };

  const inputClasses = (field: string) =>
    `w-full px-4 py-3 rounded-lg border ${
      errors[field]
        ? "border-red-500 focus:border-red-500"
        : "border-gray-300 focus:border-orange-500"
    } focus:outline-none focus:ring-2 ${
      errors[field] ? "focus:ring-red-200" : "focus:ring-orange-200"
    } transition-all duration-200`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <form
        ref={formRef}
        onSubmit={sendEmail}
        className="flex flex-col gap-6 max-w-xl w-full mx-auto"
        noValidate
      >
        <div>
          <input
            type="text"
            name="name"
            placeholder="Your Name*"
            aria-label="Your Name"
            className={inputClasses("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-500">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <input
            type="email"
            name="email"
            placeholder="Your Email*"
            aria-label="Your Email"
            className={inputClasses("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-500">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <textarea
            name="message"
            placeholder="Your Message*"
            aria-label="Your Message"
            rows={5}
            className={inputClasses("message")}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
          {errors.message && (
            <p id="message-error" className="mt-1 text-sm text-red-500">
              {errors.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={status === "sending"}
          className="py-6 mt-2 bg-osvid-orange hover:bg-orange-700 text-white font-bold text-base w-full transition-colors duration-300 relative"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Message"
          )}
        </Button>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg flex items-start gap-3 ${
              status === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {status === "success" ? (
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-sm">{feedback}</p>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
