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
  customTitle?: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  permissions?: ManagerPermissions;
  isActive?: boolean;
  createdBy?: string;
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
  applicableProductIds?: string[];
  isActive: boolean;
  expiryDate?: string;
  createdAt: string;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed"
  | "shipped"
  | "delivered";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  unit?: string;
  variationId?: string;
  variationAttributes?: Record<string, string>;
  sku?: string;
  taxAmount?: number;
}

export interface ShippingAddress {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  streetAddress?: string;
  city: string;
  state: string;
  country?: string;
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
  customerPhone?: string;
  deliveryMethod: "pickup" | "delivery";
  shippingAddress?: ShippingAddress;
  billingAddress?: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  taxAmount?: number;
  taxRatePercent?: number;
  discountAmount?: number;
  couponCode?: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  orderStatus: OrderStatus;
  internalNotes?: string;
  paystackReference?: string;
  trackingNumber?: string;
  notes?: string;
  statusHistory?: OrderHistoryEvent[];
  refundStatus?: "none" | "initiating" | "pending" | "processing" | "needs_attention" | "processed" | "failed";
  refundReason?: string;
  refundReference?: string;
  providerRefundId?: string;
  refundFailureReason?: string;
  refundRequestedAt?: string;
  refundRequestedBy?: string;
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

export interface PricingTierItem {
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
  unitPrice?: number;
}

export interface PricingTierGroup {
  id: string;
  name: string;
  description?: string;
  tiers: PricingTierItem[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type ProductType = "simple" | "variable" | "grouped";

export interface ProductAttribute {
  id: string;
  name: string;
  values: string[];
  visibleOnProductPage?: boolean;
  usedForVariations?: boolean;
}

export interface ProductVariation {
  id: string;
  sku?: string;
  price: number;
  barcode?: string;
  regularPrice?: number;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  stockQuantity: number;
  stockStatus: "in_stock" | "out_of_stock" | "on_backorder" | "instock" | "outofstock";
  manageStock?: boolean;
  weight?: string;
  dimensions?: string;
  imageUrl?: string;
  attributes: Record<string, string>;
  isActive: boolean;
  minPurchaseQuantity?: number;
  maxPurchaseQuantity?: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  productName?: string;
  userId?: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  comment?: string;
  reviewText?: string;
  status: "pending" | "approved" | "rejected";
  isVerifiedPurchase?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderNote {
  id: string;
  orderId: string;
  content: string;
  authorName: string;
  isCustomerVisible: boolean;
  createdAt: string;
}

export interface TaxSettings {
  id?: string;
  enableTax: boolean;
  pricesIncludeTax: boolean;
  taxRatePercent: number;
  taxShipping: boolean;
  displayPricesInShop: "inclusive" | "exclusive";
  displayPricesInCart: "inclusive" | "exclusive";
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  productType?: ProductType;
  price: number;
  discountPrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  stockQuantity: number;
  reservedQuantity?: number;
  manageStock?: boolean;
  stockStatus?: "in_stock" | "out_of_stock" | "on_backorder";
  allowBackorders?: "no" | "notify" | "yes";
  lowStockThreshold?: number;
  category: string;
  categorySlug?: string;
  imageUrl: string;
  galleryImages?: string[];
  unit?: string;
  sku?: string;
  barcode?: string;
  weight?: string;
  dimensions?: string;
  isFeatured?: boolean;
  features?: string[];
  specifications?: Record<string, string>;
  tags?: string[];
  suggestedProductIds?: string[];
  crossSellIds?: string[];
  upsellIds?: string[];
  groupedProductIds?: string[];
  attributes?: ProductAttribute[];
  variations?: ProductVariation[];
  averageRating?: number;
  reviewCount?: number;
  taxStatus?: "taxable" | "shipping_only" | "none";
  taxClass?: "standard" | "reduced" | "zero";
  pricingTierId?: string;
  pricingTierName?: string;
  pricingTiers?: PricingTierItem[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
