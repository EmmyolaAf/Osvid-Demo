// lib/payment.ts

export interface PaystackTransactionSuccess {
  reference: string;
  status: "success";
  id?: string | number;
}

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

/**
 * Loads Paystack Inline Popup V2 script into document head/body.
 */
export const initPaystack = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return resolve();
    }

    if (window.PaystackPop) {
      return resolve(); // Already loaded
    }

    // Check if script tag is already in DOM
    const existingScript = document.querySelector(
      'script[src="https://js.paystack.co/v2/inline.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Paystack V2 script"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;

    script.onload = () => {
      if (window.PaystackPop) {
        resolve();
      } else {
        reject(new Error("Paystack V2 failed to initialize in window."));
      }
    };

    script.onerror = () => reject(new Error("Failed to load Paystack V2 script"));

    document.body.appendChild(script);
  });
};

export interface ResumePaymentOptions {
  accessCode: string;
  onCancel?: () => void;
  onSuccess?: (response: PaystackTransactionSuccess) => void;
}

/**
 * Resumes a server-initialized Paystack transaction using the official Popup V2 flow.
 * The browser never chooses the amount, reference, or authoritative metadata.
 */
export const resumePayment = ({
  accessCode,
  onCancel,
  onSuccess,
}: ResumePaymentOptions): Promise<PaystackTransactionSuccess> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.PaystackPop) {
      return reject(new Error("Paystack V2 popup is not initialized."));
    }

    if (!accessCode) {
      return reject(new Error("Missing access_code for Paystack transaction."));
    }

    try {
      const popup = new window.PaystackPop();

      popup.resumeTransaction(accessCode, {
        onSuccess: (transaction: any) => {
          const res: PaystackTransactionSuccess = {
            reference: transaction.reference,
            status: "success",
            id: transaction.id,
          };
          if (onSuccess) onSuccess(res);
          resolve(res);
        },
        onCancel: () => {
          if (onCancel) onCancel();
          reject(new Error("Payment window was closed by the user."));
        },
        onError: (err: any) => {
          reject(new Error(err?.message || "An error occurred in Paystack popup."));
        },
      });
    } catch (err: any) {
      reject(new Error(`Failed to launch Paystack popup: ${err?.message || String(err)}`));
    }
  });
};
