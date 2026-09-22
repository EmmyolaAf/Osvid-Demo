// types/checkout.ts

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

export type ShippingAddress = {
  streetAddress: string;
  city: string;
  state: string;
  country: "Nigeria";
  postalCode?: string;
};

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  businessHours?: string;
}

export interface CheckoutData {
  deliveryMethod: "shipping" | "pickup";
  contactInfo: ContactInfo;
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
  paymentMethod?: string;
  paymentReference?: string;
  orderId?: string;
}

export const CHECKOUT_STEPS = {
  DELIVERY_METHOD: 1,
  ADDRESS_PICKUP: 2,
  SUMMARY: 3,
  CONFIRMATION: 4,
} as const;

import { nigerianStates } from "@/lib/constants";
import { MapPin, Truck } from "lucide-react";
// src/types/checkout.ts
import { z } from "zod";

export const DELIVERY_METHODS = {
  SHIPPING: "shipping",
  PICKUP: "pickup",
} as const;

export const deliveryMethodSchema = z.object({
  deliveryMethod: z.enum([DELIVERY_METHODS.SHIPPING, DELIVERY_METHODS.PICKUP], {
    required_error: "Please select a delivery method.",
  }),
  name: z
    .string()
    .min(1, "Full name is required.")
    .max(100, "Name must be less than 100 characters.")
    .trim(),
  email: z
    .string()
    .min(1, "Email address is required.")
    .email("Please enter a valid email address.")
    .max(254, "Email address is too long.")
    .toLowerCase(),
  phone: z
    .string()
    .min(1, "Phone number is required.")
    .regex(
      /^(\+234|0)[789]\d{9}$/,
      "Please enter a valid Nigerian phone number."
    )
    .transform((val) => val.replace(/\s+/g, "")),
});

export type DeliveryMethodFormValues = z.infer<typeof deliveryMethodSchema>;
export type DeliveryMethod = DeliveryMethodFormValues["deliveryMethod"];

export const deliveryOptions = [
  {
    value: DELIVERY_METHODS.SHIPPING,
    icon: Truck,
    label: "Shipping",
    description: "Delivery to your address",
  },
  {
    value: DELIVERY_METHODS.PICKUP,
    icon: MapPin,
    label: "Pickup",
    description: "Collect from a location",
  },
] as const;

export interface DeliveryMethodStepProps {
  onNext: () => void;
  updateCheckoutData: (data: Partial<DeliveryMethodFormValues>) => void;
  initialDeliveryMethod?: DeliveryMethod | null;
  initialContactInfo?: Partial<ContactInfo>;
  isProcessing?: boolean;
}
export type CheckoutStep = (typeof CHECKOUT_STEPS)[keyof typeof CHECKOUT_STEPS];

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  businessHours?: string;
  phone?: string;
}

export const shippingAddressSchema = z.object({
  streetAddress: z
    .string()
    .min(1, "Street address is required")
    .max(200, "Address is too long (max 200 characters)"),
  city: z
    .string()
    .min(1, "City is required")
    .max(100, "City name is too long (max 100 characters)"),
  state: z.enum([...nigerianStates] as [string, ...string[]], {
    required_error: "State is required",
  }),
  country: z.literal("Nigeria"), // Fixed value for country
  postalCode: z.string().max(10, "Postal code is too long").optional(),
});

export type ShippingAddressFormValues = z.infer<typeof shippingAddressSchema>;
