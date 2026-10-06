export type UserRole = "super_admin" | "admin" | "manager" | "user";

export interface ManagerPermissions {
  canManageProducts: boolean;
  canManageInventory: boolean;
  canManageOrders: boolean;
  canViewFinancials: boolean;
  canManageWebsite: boolean;
  canManageCustomers: boolean;
  canManageDiscounts: boolean;
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canManageProducts: false,
  canManageInventory: true,
  canManageOrders: true,
  canViewFinancials: false,
  canManageWebsite: false,
  canManageCustomers: true,
  canManageDiscounts: false,
};

/**
 * Normalizes manager permissions with backward compatibility for documents created before canManageInventory was separated.
 * If canManageInventory is undefined:
 * If the legacy document explicitly granted canManageProducts: true, we assume they had inventory authority too (fallback to true).
 * If neither is defined, fallback to DEFAULT_MANAGER_PERMISSIONS.
 */
export function normalizeManagerPermissions(
  perms?: Partial<ManagerPermissions> | null
): ManagerPermissions {
  if (!perms) {
    return { ...DEFAULT_MANAGER_PERMISSIONS };
  }

  const inventoryDefault =
    perms.canManageInventory !== undefined
      ? Boolean(perms.canManageInventory)
      : perms.canManageProducts !== undefined
      ? Boolean(perms.canManageProducts)
      : DEFAULT_MANAGER_PERMISSIONS.canManageInventory;

  return {
    canManageProducts: Boolean(
      perms.canManageProducts ?? DEFAULT_MANAGER_PERMISSIONS.canManageProducts
    ),
    canManageInventory: inventoryDefault,
    canManageOrders: Boolean(
      perms.canManageOrders ?? DEFAULT_MANAGER_PERMISSIONS.canManageOrders
    ),
    canViewFinancials: Boolean(
      perms.canViewFinancials ?? DEFAULT_MANAGER_PERMISSIONS.canViewFinancials
    ),
    canManageWebsite: Boolean(
      perms.canManageWebsite ?? DEFAULT_MANAGER_PERMISSIONS.canManageWebsite
    ),
    canManageCustomers: Boolean(
      perms.canManageCustomers ?? DEFAULT_MANAGER_PERMISSIONS.canManageCustomers
    ),
    canManageDiscounts: Boolean(
      perms.canManageDiscounts ?? DEFAULT_MANAGER_PERMISSIONS.canManageDiscounts
    ),
  };
}

export interface BusinessSubscription {
  id?: string;
  clientId?: string;
  businessName: string;
  adminEmail: string;
  adminUid?: string;
  isSuspended: boolean;
  suspendedReason?: string;
  hostingPlan: "standard" | "professional" | "enterprise";
  hostingExpiryDate: string;
  gracePeriodDays?: number;
  lastPaymentDate?: string;
  renewalAmountNgn: number;
  showWarning: boolean;
  warningNotice?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export type {
  ClientSubscription,
  RuntimeSubscriptionState,
  SubscriptionStatus,
} from "./subscription";
export type { AuditLogEntry, AuditLogCreateInput } from "./audit";

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
  reservedUsageCount?: number;
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

export interface OrderHistoryEvent {
  status: OrderStatus;
  updatedAt: string;
  updatedBy?: string;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  note?: string;
  eventType?: "status" | "tracking" | "note" | "fulfillment";
  trackingNumber?: string;
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
  discountAmount?: number;
  couponCode?: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paystackReference?: string;
  trackingNumber?: string;
  notes?: string;
  statusHistory?: OrderHistoryEvent[];
  refundStatus?: "pending" | "processing" | "processed" | "failed";
  refundReason?: string;
  refundReference?: string;
  refundRequestedAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  productCount?: number;
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
  reservedQuantity?: number;
  category: string;
  categorySlug?: string;
  imageUrl: string;
  galleryImages?: string[];
  unit?: string;
  sku?: string;
  isFeatured?: boolean;
  features?: string[];
  specifications?: Record<string, string>;
  suggestedProductIds?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

