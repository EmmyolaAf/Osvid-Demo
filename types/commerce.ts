/**
 * Packet 4 & 4B: Authoritative Checkout, Sessions, Quotes & Commerce Types
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

export type PaymentInitializationStatus =
  | "uninitialized"
  | "initializing"
  | "initialized"
  | "failed"
  | "recovery_required";

export interface CheckoutSession {
  id: string;
  checkoutRequestId: string;
  requestFingerprint?: string;
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
  totalAmountKobo: number;
  couponId?: string;
  couponCode?: string;
  paystackReference?: string;
  paystackAccessCode?: string;
  paymentInitializationStatus?: PaymentInitializationStatus;
  paymentInitializationAttempt?: number;
  paymentInitializationClaimedAt?: any;
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
    totalAmountKobo: number;
    currency: "NGN";
  };
  reservationExpiresAtIso?: string;
  releaseToken?: string;
  error?: string;
}

export type ReceiptEmailStatus = "pending" | "sending" | "sent" | "failed";

export type RefundStatus =
  | "none"
  | "initiating"
  | "pending"
  | "processing"
  | "needs_attention"
  | "processed"
  | "failed";

export interface PaymentTransactionRecord {
  id: string; // paystackReference
  reference: string;
  checkoutSessionId: string;
  status: "finalized" | "anomaly_unfulfillable" | "failed" | "refunded";
  amount: number; // in Naira
  amountKobo: number;
  currency: "NGN";
  orderId?: string;
  customerEmail: string;
  paystackData?: any;
  receiptEmailSent?: boolean;
  receiptEmailStatus?: ReceiptEmailStatus;
  receiptEmailClaimedAt?: string;
  receiptEmailSentAt?: string;
  receiptEmailFailureReason?: string;
  anomalyReason?: string;
  needsRefund?: boolean;
  refundStatus?: RefundStatus;
  providerRefundId?: string;
  refundReference?: string;
  refundRequestedAt?: string;
  refundReason?: string;
  refundFailureReason?: string;
  refundedAtIso?: string;
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
