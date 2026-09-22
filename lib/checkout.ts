import { CheckoutData, ShippingAddress } from "@/types/checkout.type";

export const loadCheckoutData = (key: string): CheckoutData | null => {
  if (typeof window === "undefined") return null;
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error loading checkout data:", error);
    return null;
  }
};

export const saveCheckoutData = (key: string, data: CheckoutData) => {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving checkout data:", error);
    }
  }
};

export const clearCheckoutData = (key: string) => {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(key);
  }
};

// lib/checkout.ts
export function validateShippingAddress(address?: ShippingAddress): string[] {
  const errors: string[] = [];
  if (!address) {
    return ["Shipping address is required"];
  }
  if (!address.streetAddress?.trim()) {
    errors.push("Street address is required");
  }
  if (!address.city?.trim()) {
    errors.push("City is required");
  }
  if (!address.state?.trim()) {
    errors.push("State is required");
  }
  return errors;
}

export const validateContactInfo = (contactInfo: {
  name: string;
  email: string;
  phone: string;
}) => {
  const errors: string[] = [];
  if (!contactInfo.name.trim()) errors.push("Name is required");
  if (!contactInfo.email.trim()) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) {
    errors.push("Invalid email format");
  }
  if (!contactInfo.phone.trim()) {
    errors.push("Phone number is required");
  }
  return errors;
};
