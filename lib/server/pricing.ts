import { adminDb } from "@/lib/firebase/admin";
import {
  AuthoritativeQuoteItem,
  CartInputItem,
  CheckoutQuoteResponse,
} from "@/types/commerce";
import { DiscountCode } from "@/types/auth";

export class CommerceValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "CommerceValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Validates cart items and canonicalizes duplicate product entries by summing quantities.
 */
export function canonicalizeCartItems(rawItems: any): CartInputItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new CommerceValidationError("Cart items must be a non-empty array.", 400);
  }

  if (rawItems.length > 100) {
    throw new CommerceValidationError("Exceeded maximum allowable cart items limit.", 400);
  }

  const aggregated = new Map<string, number>();

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (!item || typeof item !== "object") {
      throw new CommerceValidationError(`Invalid cart item at index ${i}.`, 400);
    }

    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    if (!productId || productId.length > 128) {
      throw new CommerceValidationError(
        `Invalid product ID at index ${i}. Must be a non-empty string.`,
        400
      );
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new CommerceValidationError(
        `Item quantity for product "${productId}" must be a positive integer.`,
        400
      );
    }

    if (qty > 1000) {
      throw new CommerceValidationError(
        `Item quantity for product "${productId}" exceeds maximum single-order limit of 1,000 units.`,
        400
      );
    }

    const current = aggregated.get(productId) || 0;
    const nextTotal = current + qty;
    if (nextTotal > 1000) {
      throw new CommerceValidationError(
        `Combined quantity for product "${productId}" exceeds maximum single-order limit of 1,000 units.`,
        400
      );
    }
    aggregated.set(productId, nextTotal);
  }

  return Array.from(aggregated.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export interface AuthoritativePricingResult {
  items: AuthoritativeQuoteItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  totalAmountKobo: number;
  currency: "NGN";
  coupon?: {
    id: string;
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    description?: string;
  };
  productSnapshots: Map<string, FirebaseFirestore.DocumentSnapshot>;
  discountSnapshot?: FirebaseFirestore.DocumentSnapshot;
}

/**
 * Calculates authoritative quote using server-side Firestore records.
 * Completely ignores browser-submitted prices, names, and totals.
 */
export async function calculateAuthoritativeQuote(params: {
  rawItems: any;
  couponCode?: string;
  deliveryMethod?: "shipping" | "pickup";
  shippingAddress?: any;
  pickupLocationId?: string;
  transaction?: FirebaseFirestore.Transaction;
}): Promise<AuthoritativePricingResult> {
  const canonicalItems = canonicalizeCartItems(params.rawItems);
  const productSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  const pricedItems: AuthoritativeQuoteItem[] = [];

  // 1. Fetch authoritative product snapshots
  for (const item of canonicalItems) {
    const productRef = adminDb.collection("products").doc(item.productId);
    const snap = params.transaction
      ? await params.transaction.get(productRef)
      : await productRef.get();

    if (!snap.exists) {
      throw new CommerceValidationError(
        `Product with ID "${item.productId}" does not exist in store catalogue.`,
        404
      );
    }

    const data = snap.data() || {};

    if (data.isActive === false) {
      throw new CommerceValidationError(
        `Product "${data.name || item.productId}" is currently inactive and cannot be purchased.`,
        400
      );
    }

    const basePrice = Number(data.price);
    if (isNaN(basePrice) || basePrice < 0) {
      throw new CommerceValidationError(
        `Authoritative product "${data.name || item.productId}" has an invalid price configuration.`,
        500
      );
    }

    // Authoritative discounted price semantics
    const hasDiscount =
      data.discountPrice !== undefined &&
      Number(data.discountPrice) > 0 &&
      Number(data.discountPrice) < basePrice;

    const unitPrice = hasDiscount ? Number(data.discountPrice) : basePrice;
    const lineTotal = unitPrice * item.quantity;

    productSnapshots.set(item.productId, snap);
    pricedItems.push({
      productId: item.productId,
      name: data.name || "Product",
      sku: data.sku || "",
      unit: data.unit || "unit",
      imageUrl: data.imageUrl || "",
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    });
  }

  // 2. Authoritative subtotal
  const subtotal = pricedItems.reduce((acc, it) => acc + it.lineTotal, 0);

  // 3. Shipping fee calculation
  const shippingFee = params.deliveryMethod === "pickup" ? 0 : 0; // Configurable per store delivery rules

  // 4. Authoritative coupon validation
  let discountAmount = 0;
  let couponInfo: AuthoritativePricingResult["coupon"] = undefined;
  let discountSnapshot: FirebaseFirestore.DocumentSnapshot | undefined = undefined;

  const rawCouponCode = params.couponCode ? params.couponCode.trim().toUpperCase() : "";
  if (rawCouponCode) {
    let discountDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (params.transaction) {
      // Transactions require direct doc get; query the collection first if doc ID unknown, or query before
      const qSnap = await adminDb
        .collection("discounts")
        .where("code", "==", rawCouponCode)
        .limit(1)
        .get();

      if (!qSnap.empty) {
        const docRef = adminDb.collection("discounts").doc(qSnap.docs[0].id);
        discountDoc = await params.transaction.get(docRef);
      }
    } else {
      const qSnap = await adminDb
        .collection("discounts")
        .where("code", "==", rawCouponCode)
        .limit(1)
        .get();

      if (!qSnap.empty) {
        discountDoc = qSnap.docs[0];
      }
    }

    if (!discountDoc || !discountDoc.exists) {
      throw new CommerceValidationError(
        `Coupon code "${rawCouponCode}" is invalid or does not exist.`,
        400
      );
    }

    discountSnapshot = discountDoc;
    const discData = (discountDoc.data() || {}) as DiscountCode;

    if (!discData.isActive) {
      throw new CommerceValidationError(
        `Coupon code "${rawCouponCode}" has been deactivated.`,
        400
      );
    }

    if (discData.expiryDate) {
      const expiry = new Date(discData.expiryDate);
      if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        throw new CommerceValidationError(
          `Coupon code "${rawCouponCode}" expired on ${expiry.toLocaleDateString()}.`,
          400
        );
      }
    }

    if (discData.minOrderAmount && subtotal < discData.minOrderAmount) {
      throw new CommerceValidationError(
        `Coupon "${rawCouponCode}" requires a minimum order subtotal of ₦${discData.minOrderAmount.toLocaleString()}.`,
        400
      );
    }

    // Reservation-safe available usage check
    const currentTotalUsage =
      (discData.usageCount || 0) + (discData.reservedUsageCount || 0);

    if (discData.maxUsageLimit && currentTotalUsage >= discData.maxUsageLimit) {
      throw new CommerceValidationError(
        `Coupon code "${rawCouponCode}" has reached its maximum redemption limit.`,
        400
      );
    }

    if (discData.discountType === "percentage") {
      const percentage = Math.min(100, Math.max(0, discData.discountValue));
      discountAmount = Math.round((subtotal * percentage) / 100);
    } else {
      discountAmount = Math.min(discData.discountValue, subtotal);
    }

    discountAmount = Math.min(discountAmount, subtotal);

    couponInfo = {
      id: discountDoc.id,
      code: discData.code,
      discountType: discData.discountType,
      discountValue: discData.discountValue,
      description: discData.description,
    };
  }

  const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);
  const totalAmountKobo = Math.round(totalAmount * 100);

  return {
    items: pricedItems,
    subtotal,
    shippingFee,
    discountAmount,
    totalAmount,
    totalAmountKobo,
    currency: "NGN",
    coupon: couponInfo,
    productSnapshots,
    discountSnapshot,
  };
}
