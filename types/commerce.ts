/**
 * Packet 4: Authoritative Checkout, Sessions, Quotes & Commerce Types
 */

export interface ShippingAddress {
  fullName?: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  address?: string;
  city: string;
  state: string;
  country?: string;
  postalCode?: string;
  notes?: string;
}

export interface CartInputItem {
  productId: string;
  quantity: number;
}

export interface AuthoritativeQuoteItem {
  productId: string;
  name: string;
  sku: string;
  unit?: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CheckoutQuoteRequest {
  items: CartInputItem[];
  couponCode?: string;
  deliveryMethod?: "shipping" | "pickup";
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
}

export interface CheckoutQuoteResponse {
  success: boolean;
  items: AuthoritativeQuoteItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  totalAmountKobo: number;
  currency: "NGN";
  coupon?: {
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    description?: string;
  };
  error?: string;
}

export type CheckoutSessionStatus =
  | "active"
  | "finalized"
  | "released"
  | "expired"
  | "anomaly_unfulfillable";

export interface CheckoutSession {
  id: string;
  checkoutRequestId: string;
  status: CheckoutSessionStatus;
  currency: "NGN";
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  authenticatedUserId?: string;
  deliveryMethod: "shipping" | "pickup";
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
  items: AuthoritativeQuoteItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  couponId?: string;
  couponCode?: string;
  paystackReference?: string;
  paystackAccessCode?: string;
  reservationExpiresAt: any; // Firestore Timestamp
  reservationExpiresAtIso: string;
  reservationActive: boolean;
  releaseTokenHash?: string;
  orderId?: string;
  anomalyReason?: string;
  createdAt: any;
  createdAtIso: string;
  updatedAt: any;
  updatedAtIso: string;
  finalizedAtIso?: string;
  releasedAtIso?: string;
}

export interface PaymentInitializeRequest {
  checkoutRequestId: string;
  items: CartInputItem[];
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: "shipping" | "pickup";
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
  couponCode?: string;
}

export interface PaymentInitializeResponse {
  success: boolean;
  checkoutSessionId?: string;
  accessCode?: string;
  reference?: string;
  totals?: {
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    totalAmount: number;
    currency: "NGN";
  };
  reservationExpiresAtIso?: string;
  releaseToken?: string;
  error?: string;
}

export interface PaymentTransactionRecord {
  id: string; // paystackReference
  reference: string;
  checkoutSessionId: string;
  status: "finalized" | "anomaly_unfulfillable" | "failed";
  amount: number; // in Naira
  amountKobo: number;
  currency: "NGN";
  orderId?: string;
  customerEmail: string;
  paystackData?: any;
  receiptEmailSent?: boolean;
  anomalyReason?: string;
  needsRefund?: boolean;
  refunds?: Array<{
    refundReference: string;
    amount: number;
    reason: string;
    status: string;
    initiatedAtIso: string;
    processedAtIso?: string;
  }>;
  createdAt: any;
  createdAtIso: string;
  finalizedAtIso?: string;
}

export interface ClientPaymentVerificationRequest {
  reference: string;
  checkoutSessionId?: string;
  email?: string;
}

export interface ClientPaymentVerificationResponse {
  success: boolean;
  payment: boolean;
  emailSent: boolean;
  data?: {
    reference: string;
    amount: number;
    currency: "NGN";
    orderId: string;
    customerEmail?: string;
  };
  error?: string;
  anomaly?: boolean;
}
