// lib/types/order-types.ts
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  variant?: string;
  imageUrl?: string;
}

export interface CustomerInfo {
  name?: string;
  email: string;
  phone?: string;
}

export interface ShippingAddress {
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface OrderData {
  orderId: string;
  customerInfo: CustomerInfo;
  items: OrderItem[];
  currency: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  deliveryMethod: "shipping" | "pickup";
  shippingAddress?: ShippingAddress;
  pickupLocationId?: string;
}

export interface PaymentVerificationRequest {
  reference: string;
  email: string;
  orderData?: Partial<OrderData>;
}

export interface PaymentVerificationResponse {
  success: boolean;
  payment: boolean;
  emailSent: boolean;
  data?: {
    reference: string;
    amount: number;
    currency: string;
    customer?: any;
    orderId?: string;
  };
  error?: string;
  details?: string;
}
