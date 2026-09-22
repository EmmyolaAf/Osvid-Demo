// lib/payment.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

type PaystackOptions = {
  key: string;
  email: string;
  amount: number; // in Naira
  metadata?: Record<string, any>;
  onClose?: () => void;
  onSuccess?: (response: PaystackResponse) => void;
};

type PaystackResponse = {
  reference: string;
  status: "success" | "failed";
  message: string;
  metadata: Record<string, any>;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: any) => {
        openIframe: () => void;
      };
    };
  }
}

export const initPaystack = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      return resolve(); // Already loaded
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;

    script.onload = () => {
      if (window.PaystackPop) {
        resolve();
      } else {
        reject(new Error("Paystack failed to initialize"));
      }
    };

    script.onerror = () => reject(new Error("Failed to load Paystack script"));

    document.body.appendChild(script);
  });
};

export const handlePayment = ({
  email,
  amount,
  metadata,
  onClose,
  onSuccess,
}: Omit<PaystackOptions, "key">): Promise<PaystackResponse> => {
  return new Promise((resolve, reject) => {
    if (!window.PaystackPop) {
      return reject(new Error("Paystack is not initialized"));
    }

    const paystack = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email,
      amount: amount, // Convert to kobo
      currency: "NGN",
      metadata,
      callback: (response: any) => {
        const fullResponse: PaystackResponse = {
          reference: response.reference,
          status: "success",
          message: "Payment complete",
          metadata: metadata || {},
        };
        if (onSuccess) onSuccess(fullResponse);
        resolve(fullResponse);
      },
      onClose: () => {
        if (onClose) onClose();
        reject(new Error("Payment closed by user"));
      },
    });

    paystack.openIframe();
  });
};
