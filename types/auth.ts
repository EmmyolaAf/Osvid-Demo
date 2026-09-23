export type UserRole = "super_admin" | "admin" | "manager" | "user";

export interface ManagerPermissions {
  canManageProducts: boolean;
  canManageOrders: boolean;
  canViewFinancials: boolean;
  canManageWebsite: boolean;
  canManageCustomers: boolean;
  canManageDiscounts: boolean;
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canManageProducts: true,
  canManageOrders: true,
  canViewFinancials: false,
  canManageWebsite: false,
  canManageCustomers: true,
  canManageDiscounts: false,
};

export interface BusinessSubscription {
  id?: string;
  businessName: string;
  adminEmail: string;
  adminUid?: string;
  isSuspended: boolean;
  suspendedReason?: string;
  hostingPlan: "standard" | "professional" | "enterprise";
  hostingExpiryDate: string;
  lastPaymentDate?: string;
  renewalAmountNgn: number;
  showWarning: boolean;
  warningNotice?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  customTitle?: string; // e.g. "Logistics Lead", "Operations Director"
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  permissions?: ManagerPermissions;
  isActive: boolean;
  createdBy?: string; // UID of admin who created the account (e.g. for managers)
  createdAt: string;
  lastLoginAt?: string;
}

export interface ManagerCreateInput {
  email: string;
  password?: string;
  displayName: string;
  customTitle?: string;
  phoneNumber?: string;
  permissions?: Partial<ManagerPermissions>;
}

export interface CustomerProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxUsageLimit?: number;
  usageCount: number;
  isActive: boolean;
  expiryDate?: string;
  createdAt: string;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  unit?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: "pickup" | "delivery";
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paystackReference?: string;
  trackingNumber?: string;
  notes?: string;
  statusHistory?: {
    status: OrderStatus;
    updatedAt: string;
    updatedBy?: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  category: string;
  imageUrl: string;
  galleryImages?: string[];
  unit?: string;
  sku?: string;
  isFeatured?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
