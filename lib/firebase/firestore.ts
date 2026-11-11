import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./client";
import {
  UserProfile,
  UserRole,
  Order,
  Product,
  ProductCategory,
  OrderStatus,
  CustomerProfile,
  DiscountCode,
  ManagerPermissions,
  PricingTierGroup,
  PricingTierItem,
  ProductAttribute,
  ProductReview,
  TaxSettings,
  OrderNote,
  ProductVariation,
} from "@/types/auth";

/**
 * Recursively strips keys with undefined values to prevent Firestore setDoc/updateDoc
 * from throwing "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function cleanFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof data === "object" && !(data instanceof Date) && !(data instanceof Timestamp)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// ==========================================
// USER & RBAC PROFILE SERVICES
// ==========================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function saveUserProfile(profile: Partial<UserProfile> & { uid: string; email: string }): Promise<void> {
  try {
    const docRef = doc(db, "users", profile.uid);
    const existing = await getDoc(docRef);

    const p = profile as any;
    if (!existing.exists()) {
      // New Customer Account - strictly role 'user', no permissions
      const newProfile: Record<string, any> = {
        uid: profile.uid,
        email: profile.email.toLowerCase(),
        displayName: profile.displayName || profile.email.split("@")[0],
        phoneNumber: profile.phoneNumber || "",
        photoURL: profile.photoURL || "",
        role: "user",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (p.addresses) newProfile.addresses = p.addresses;
      if (p.shippingAddress) newProfile.shippingAddress = p.shippingAddress;
      if (p.billingAddress) newProfile.billingAddress = p.billingAddress;
      if (p.preferences) newProfile.preferences = p.preferences;
      await setDoc(docRef, newProfile);
    } else {
      // Update existing customer profile - field-level allowlist strictly protecting
      // server-owned and identity-managed fields (role, permissions, isActive, email, lastLoginAt, etc.)
      const allowedUpdates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      const p = profile as any;
      if (p.displayName !== undefined) allowedUpdates.displayName = p.displayName;
      if (p.firstName !== undefined) allowedUpdates.firstName = p.firstName;
      if (p.lastName !== undefined) allowedUpdates.lastName = p.lastName;
      if (p.fullName !== undefined) allowedUpdates.fullName = p.fullName;
      if (p.phoneNumber !== undefined) allowedUpdates.phoneNumber = p.phoneNumber;
      if (p.photoURL !== undefined) allowedUpdates.photoURL = p.photoURL;
      if (p.avatar !== undefined) allowedUpdates.avatar = p.avatar;
      if (p.addresses !== undefined) allowedUpdates.addresses = p.addresses;
      if (p.shippingAddress !== undefined) allowedUpdates.shippingAddress = p.shippingAddress;
      if (p.billingAddress !== undefined) allowedUpdates.billingAddress = p.billingAddress;
      if (p.preferences !== undefined) allowedUpdates.preferences = p.preferences;

      await updateDoc(docRef, allowedUpdates);
    }
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
}

export async function getUsersByRole(role: UserRole): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    console.error(`Error fetching users with role ${role}:`, error);
    return [];
  }
}

/**
 * Fetch all tenant administrators and operations managers (excluding the platform owner Super Admin)
 */
export async function getTenantAdministrators(authToken?: string): Promise<UserProfile[]> {
  const SUPER_ADMIN_EMAIL = "abolarinwaemmanuelfree@gmail.com";

  // 1. Try server-side consolidated discovery API
  if (typeof window !== "undefined") {
    try {
      const token = authToken || (await auth.currentUser?.getIdToken().catch(() => undefined));
      const res = await fetch(`/api/admin/list?t=${Date.now()}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.admins)) {
          return data.admins;
        }
      }
    } catch (apiErr) {
      console.warn("API admin list query failed:", apiErr);
    }
  }

  // FAIL-SAFE: If privileged API is unavailable or non-authenticated caller tries to read staff list,
  // NEVER fall back to exposing general customer profiles from the "users" collection.
  return [];
}

export async function getAllStaffMembers(): Promise<UserProfile[]> {
  try {
    const q = query(
      collection(db, "users"),
      where("role", "in", ["super_admin", "admin", "manager"])
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    console.error("Error fetching staff members:", error);
    return [];
  }
}

export async function updateUserRole(uid: string, newRole: UserRole): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication required to update user role. Direct client database writes are forbidden.");
  }
  const res = await fetch("/api/admin/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid, role: newRole }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update user role");
  }
}

export async function toggleUserStatus(uid: string, isActive: boolean): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication required to update user status. Direct client database writes are forbidden.");
  }
  const res = await fetch("/api/admin/toggle-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid, isActive }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update user status");
  }
}

export async function deleteUserRecord(uid: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication required to delete user account. Direct client database writes are forbidden.");
  }
  const res = await fetch("/api/admin/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete user account");
  }
}

// ==========================================
// ORDER MANAGEMENT SERVICES
// ==========================================

export async function createOrderInDb(orderData: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<string> {
  try {
    const orderRef = doc(collection(db, "orders"));
    const newOrder: Order = {
      ...orderData,
      id: orderRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: orderData.orderStatus,
          updatedAt: new Date().toISOString(),
          note: "Order created",
        },
      ],
    };
    await setDoc(orderRef, cleanFirestoreData(newOrder));
    return orderRef.id;
  } catch (error) {
    console.error("Error creating order in Firestore:", error);
    throw error;
  }
}

export async function getOrdersFromDb(statusFilter?: OrderStatus): Promise<Order[]> {
  try {
    let q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    if (statusFilter) {
      q = query(
        collection(db, "orders"),
        where("orderStatus", "==", statusFilter),
        orderBy("createdAt", "desc")
      );
    }
    const snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Orders query timed out")), 10000)
      ),
    ]);
    return snap.docs.map((d) => d.data() as Order);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export async function getUserOrdersFromDb(userId: string, email?: string): Promise<Order[]> {
  try {
    const ordersMap = new Map<string, Order>();

    // 1. Query by userId
    if (userId) {
      try {
        const qUser = query(
          collection(db, "orders"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        );
        const snapUser = await getDocs(qUser);
        snapUser.docs.forEach((d) => {
          ordersMap.set(d.id, d.data() as Order);
        });
      } catch (err) {
        console.warn("Could not query orders by userId:", err);
      }
    }

    // 2. Query by customerEmail (fallback/guest matching)
    if (email) {
      try {
        const qEmail = query(
          collection(db, "orders"),
          where("customerEmail", "==", email.toLowerCase()),
          orderBy("createdAt", "desc")
        );
        const snapEmail = await getDocs(qEmail);
        snapEmail.docs.forEach((d) => {
          ordersMap.set(d.id, d.data() as Order);
        });
      } catch (err) {
        console.warn("Could not query orders by customerEmail:", err);
      }
    }

    const ordersList = Array.from(ordersMap.values());
    ordersList.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return ordersList;
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return [];
  }
}

export async function updateOrderStatusInDb(
  orderId: string,
  newStatus?: OrderStatus,
  updatedBy?: string,
  note?: string,
  trackingNumber?: string
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication required to update order fulfillment status.");
  }

  const res = await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: newStatus,
      trackingNumber,
      note,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update order fulfillment status.");
  }
}

// ==========================================
// RESULT PATTERN & TIMEOUT HARNESS
// ==========================================

export interface MutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function withDbTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  errorMsg: string = "Database operation timed out. Please check your network connection."
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ==========================================
// CATEGORY MANAGEMENT SERVICES
// ==========================================

export async function getCategoriesFromDb(): Promise<ProductCategory[]> {
  try {
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ProductCategory[];
    }

    // Fallback: check product_categories collection
    const qAlt = query(collection(db, "product_categories"));
    const snapAlt = await getDocs(qAlt);
    if (!snapAlt.empty) {
      return snapAlt.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.title || data.name || d.id,
          slug: data.slug || d.id,
          description: data.description || "",
          imageUrl: data.imageUrl || "",
          isActive: data.isActive !== false,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        } as ProductCategory;
      });
    }

    return [];
  } catch (error) {
    console.error("Error fetching categories from Firestore:", error);
    return [];
  }
}

export async function saveCategoryToDb(
  categoryData: Partial<ProductCategory>
): Promise<MutationResult<ProductCategory>> {
  try {
    if (!categoryData.name || !categoryData.name.trim()) {
      return { success: false, error: "Category name is required." };
    }

    const categoryId =
      categoryData.id ||
      categoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") ||
      doc(collection(db, "categories")).id;

    const now = new Date().toISOString();
    const slug =
      categoryData.slug ||
      categoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const payload: ProductCategory = {
      id: categoryId,
      name: categoryData.name.trim(),
      slug,
      description: categoryData.description?.trim() || "",
      imageUrl: categoryData.imageUrl || "",
      isActive: categoryData.isActive !== false,
      productCount: categoryData.productCount || 0,
      createdAt: categoryData.createdAt || now,
      updatedAt: now,
    };

    const docRef = doc(db, "categories", categoryId);
    await withDbTimeout(
      setDoc(docRef, cleanFirestoreData(payload), { merge: true }),
      12000,
      "Failed to save category: Firestore write timed out."
    );

    // Sync to product_categories for storefront compatibility
    try {
      const altRef = doc(db, "product_categories", categoryId);
      await setDoc(
        altRef,
        {
          title: payload.name,
          slug: payload.slug,
          description: payload.description,
          imageUrl: payload.imageUrl,
          isActive: payload.isActive,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (syncErr) {
      console.warn("Product categories sync notice:", syncErr);
    }

    return { success: true, data: payload };
  } catch (error: any) {
    console.error("Error saving category in Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to save category document to Firestore.",
    };
  }
}

export async function deleteCategoryFromDb(categoryId: string): Promise<MutationResult> {
  try {
    if (!categoryId) {
      return { success: false, error: "Category ID is required for deletion." };
    }

    const docRef = doc(db, "categories", categoryId);
    await withDbTimeout(
      deleteDoc(docRef),
      10000,
      "Failed to delete category: Firestore delete timed out."
    );

    // Also attempt deletion from product_categories
    try {
      await deleteDoc(doc(db, "product_categories", categoryId));
    } catch (_) {}

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting category from Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete category from database.",
    };
  }
}

// ==========================================
// PRODUCT & INVENTORY MANAGEMENT
// ==========================================

export async function getProductsFromDb(): Promise<Product[]> {
  try {
    const q = query(collection(db, "products"));
    const snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Products query timed out")), 8000)
      ),
    ]);
    const products = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, "-") || d.id,
        description: data.description || "",
        shortDescription: data.shortDescription || "",
        productType: data.productType || "simple",
        price: Number(data.price) || 0,
        discountPrice: data.discountPrice !== undefined && data.discountPrice !== null ? Number(data.discountPrice) : undefined,
        stockQuantity: Number(data.stockQuantity) || 0,
        reservedQuantity: Number(data.reservedQuantity) || 0,
        manageStock: data.manageStock !== false,
        stockStatus: data.stockStatus || "in_stock",
        category: data.category || "General",
        categorySlug: data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-"),
        imageUrl: data.imageUrl || "/images/placeholder.webp",
        galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
        unit: data.unit || "kg",
        sku: data.sku || "",
        isFeatured: Boolean(data.isFeatured),
        features: Array.isArray(data.features) ? data.features : [],
        specifications: data.specifications || {},
        tags: Array.isArray(data.tags) ? data.tags : [],
        suggestedProductIds: Array.isArray(data.suggestedProductIds) ? data.suggestedProductIds : [],
        crossSellIds: Array.isArray(data.crossSellIds) ? data.crossSellIds : [],
        upsellIds: Array.isArray(data.upsellIds) ? data.upsellIds : [],
        pricingTierId: data.pricingTierId,
        pricingTierName: data.pricingTierName,
        pricingTiers: data.pricingTiers,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as Product;
    });

    products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return products;
  } catch (error) {
    console.warn("Direct Firestore products read failed/timed out, checking server products API:", error);
  }

  // Resilient fallback to /api/admin/products
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          return data.products;
        }
      }
    } catch (apiErr) {
      console.warn("Products API fallback fetch error:", apiErr);
    }
  }

  return [];
}

export async function saveProductToDb(
  productData: Partial<Product>,
  options?: { omitStock?: boolean }
): Promise<MutationResult<Product>> {
  try {
    if (!productData.name || !productData.name.trim()) {
      return { success: false, error: "Product name is required." };
    }
    if (productData.price === undefined || isNaN(Number(productData.price)) || Number(productData.price) < 0) {
      return { success: false, error: "A valid non-negative product price is required." };
    }

    // Attempt authoritative server API save first if token exists
    if (typeof window !== "undefined") {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          const res = await fetch("/api/admin/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              product: {
                ...productData,
                omitStock: options?.omitStock,
              },
            }),
          });

          if (res.ok) {
            const resData = await res.json();
            if (resData.success && resData.product) {
              return { success: true, data: resData.product };
            }
          }
        }
      } catch (apiErr) {
        console.warn("Server product save API unreachable, falling back to direct Firestore:", apiErr);
      }
    }

    const productId = productData.id || doc(collection(db, "products")).id;
    const isUpdate = Boolean(productData.id);
    const docRef = doc(db, "products", productId);
    const now = new Date().toISOString();

    const slug =
      productData.slug ||
      productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    if (isUpdate) {
      // In accordance with Packet 3 rules, client updates strictly omit stockQuantity
      const updatePayload: Record<string, any> = {
        name: productData.name.trim(),
        slug,
        description: productData.description?.trim() || "",
        shortDescription: productData.shortDescription?.trim() || "",
        productType: productData.productType || "simple",
        price: Number(productData.price),
        category: productData.category?.trim() || "Industrial Chemicals",
        categorySlug:
          productData.categorySlug ||
          productData.category
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") ||
          "industrial-chemicals",
        imageUrl: productData.imageUrl?.trim() || "/images/placeholder.webp",
        galleryImages: Array.isArray(productData.galleryImages) ? productData.galleryImages : [],
        unit: productData.unit?.trim() || "kg",
        sku: productData.sku?.trim() || "",
        barcode: productData.barcode?.trim() || undefined,
        weight: productData.weight?.trim() || undefined,
        dimensions: productData.dimensions?.trim() || undefined,
        isFeatured: Boolean(productData.isFeatured),
        features: Array.isArray(productData.features) ? productData.features : [],
        specifications: productData.specifications || {},
        tags: Array.isArray(productData.tags) ? productData.tags : [],
        suggestedProductIds: Array.isArray(productData.suggestedProductIds)
          ? productData.suggestedProductIds
          : [],
        crossSellIds: Array.isArray(productData.crossSellIds) ? productData.crossSellIds : [],
        upsellIds: Array.isArray(productData.upsellIds) ? productData.upsellIds : [],
        groupedProductIds: Array.isArray(productData.groupedProductIds) ? productData.groupedProductIds : [],
        attributes: Array.isArray(productData.attributes) ? productData.attributes : [],
        variations: Array.isArray(productData.variations) ? productData.variations : [],
        taxStatus: productData.taxStatus || "taxable",
        taxClass: productData.taxClass || "standard",
        saleStartDate: productData.saleStartDate || undefined,
        saleEndDate: productData.saleEndDate || undefined,
        pricingTierId: productData.pricingTierId || undefined,
        pricingTierName: productData.pricingTierName || undefined,
        pricingTiers: Array.isArray(productData.pricingTiers) ? productData.pricingTiers : undefined,
        volumeDiscountThreshold:
          productData.volumeDiscountThreshold !== undefined &&
          productData.volumeDiscountThreshold !== null &&
          !isNaN(Number(productData.volumeDiscountThreshold))
            ? Number(productData.volumeDiscountThreshold)
            : undefined,
        volumeDiscountPercentage:
          productData.volumeDiscountPercentage !== undefined &&
          productData.volumeDiscountPercentage !== null &&
          !isNaN(Number(productData.volumeDiscountPercentage))
            ? Number(productData.volumeDiscountPercentage)
            : undefined,
        volumeUnit: productData.volumeUnit?.trim() || undefined,
        manageStock: productData.manageStock !== false,
        stockStatus: productData.stockStatus || "in_stock",
        allowBackorders: productData.allowBackorders || "no",
        lowStockThreshold:
          productData.lowStockThreshold !== undefined ? Number(productData.lowStockThreshold) : 5,
        isActive: productData.isActive !== false,
        updatedAt: now,
      };
      const rawDiscount: any = productData.discountPrice;
      if (rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== "" && !isNaN(Number(rawDiscount))) {
        updatePayload.discountPrice = Number(rawDiscount);
      } else if (rawDiscount === null || rawDiscount === "" || rawDiscount === 0) {
        updatePayload.discountPrice = deleteField();
      }

      await withDbTimeout(
        updateDoc(docRef, cleanFirestoreData(updatePayload)),
        15000,
        "Failed to save product: Firestore operation timed out."
      );

      return {
        success: true,
        data: {
          id: productId,
          stockQuantity: productData.stockQuantity ?? 0,
          ...updatePayload,
        } as Product,
      };
    }

    // New products are always created with stockQuantity 0; initial positive stock is applied via inventory API
    const newProduct: any = {
      id: productId,
      name: productData.name.trim(),
      slug,
      description: productData.description?.trim() || "",
      shortDescription: productData.shortDescription?.trim() || "",
      productType: productData.productType || "simple",
      price: Number(productData.price),
      stockQuantity: 0,
      category: productData.category?.trim() || "Industrial Chemicals",
      categorySlug:
        productData.categorySlug ||
        productData.category
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") ||
        "industrial-chemicals",
      imageUrl: productData.imageUrl?.trim() || "/images/placeholder.webp",
      galleryImages: Array.isArray(productData.galleryImages) ? productData.galleryImages : [],
      unit: productData.unit?.trim() || "kg",
      sku: productData.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: productData.barcode?.trim() || undefined,
      weight: productData.weight?.trim() || undefined,
      dimensions: productData.dimensions?.trim() || undefined,
      isFeatured: Boolean(productData.isFeatured),
      features: Array.isArray(productData.features) ? productData.features : [],
      specifications: productData.specifications || {},
      tags: Array.isArray(productData.tags) ? productData.tags : [],
      suggestedProductIds: Array.isArray(productData.suggestedProductIds)
        ? productData.suggestedProductIds
        : [],
      crossSellIds: Array.isArray(productData.crossSellIds) ? productData.crossSellIds : [],
      upsellIds: Array.isArray(productData.upsellIds) ? productData.upsellIds : [],
      groupedProductIds: Array.isArray(productData.groupedProductIds) ? productData.groupedProductIds : [],
      attributes: Array.isArray(productData.attributes) ? productData.attributes : [],
      variations: Array.isArray(productData.variations) ? productData.variations : [],
      taxStatus: productData.taxStatus || "taxable",
      taxClass: productData.taxClass || "standard",
      saleStartDate: productData.saleStartDate || undefined,
      saleEndDate: productData.saleEndDate || undefined,
      pricingTierId: productData.pricingTierId || undefined,
      pricingTierName: productData.pricingTierName || undefined,
      pricingTiers: Array.isArray(productData.pricingTiers) ? productData.pricingTiers : undefined,
      volumeDiscountThreshold:
        productData.volumeDiscountThreshold !== undefined &&
        productData.volumeDiscountThreshold !== null &&
        !isNaN(Number(productData.volumeDiscountThreshold))
          ? Number(productData.volumeDiscountThreshold)
          : undefined,
      volumeDiscountPercentage:
        productData.volumeDiscountPercentage !== undefined &&
        productData.volumeDiscountPercentage !== null &&
        !isNaN(Number(productData.volumeDiscountPercentage))
          ? Number(productData.volumeDiscountPercentage)
          : undefined,
      volumeUnit: productData.volumeUnit?.trim() || undefined,
      manageStock: productData.manageStock !== false,
      stockStatus: productData.stockStatus || "in_stock",
      allowBackorders: productData.allowBackorders || "no",
      lowStockThreshold:
        productData.lowStockThreshold !== undefined ? Number(productData.lowStockThreshold) : 5,
      isActive: productData.isActive !== false,
      createdAt: productData.createdAt || now,
      updatedAt: now,
    };

    if (productData.discountPrice !== undefined && productData.discountPrice !== null && !isNaN(Number(productData.discountPrice))) {
      newProduct.discountPrice = Number(productData.discountPrice);
    }

    const cleanedProduct = cleanFirestoreData(newProduct);

    await withDbTimeout(
      setDoc(docRef, cleanedProduct, { merge: true }),
      15000,
      "Failed to save product: Firestore operation timed out."
    );

    return { success: true, data: cleanedProduct as Product };
  } catch (error: any) {
    console.error("Error saving product to Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to commit product to database.",
    };
  }
}

export async function adjustProductStockViaApi(
  productId: string,
  delta: number,
  type: string = "manual_adjustment",
  reason?: string,
  requestId?: string
): Promise<MutationResult<{ previousStock: number; newStock: number; movementId: string; replayed?: boolean }>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      return { success: false, error: "Authentication required to adjust inventory." };
    }

    const opId =
      requestId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `adj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    const res = await fetch("/api/admin/inventory/adjust", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId,
        delta,
        type,
        reason,
        requestId: opId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to adjust product inventory." };
    }

    return {
      success: true,
      data: {
        previousStock: data.previousStock,
        newStock: data.newStock,
        movementId: data.movementId,
        replayed: Boolean(data.replayed),
      },
    };
  } catch (error: any) {
    console.error("Error adjusting product stock via API:", error);
    return {
      success: false,
      error: error?.message || "Failed to adjust product inventory.",
    };
  }
}

export async function updateProductStockInDb(
  productId: string,
  newStock: number
): Promise<MutationResult<{ previousStock: number; newStock: number; movementId: string }>> {
  try {
    if (!productId) return { success: false, error: "Product ID is required." };
    const docRef = doc(db, "products", productId);
    const snap = await getDoc(docRef);
    const currentStock = snap.exists() ? (Number(snap.data()?.stockQuantity) || 0) : 0;
    const delta = newStock - currentStock;
    if (delta === 0) {
      return {
        success: true,
        data: { previousStock: currentStock, newStock: currentStock, movementId: "no-change" },
      };
    }
    return await adjustProductStockViaApi(
      productId,
      delta,
      "manual_adjustment",
      "Manual stock adjustment from products dashboard"
    );
  } catch (error: any) {
    console.error("Error updating product stock:", error);
    return {
      success: false,
      error: error?.message || "Failed to update stock quantity in database.",
    };
  }
}

export async function deleteProductFromDb(productId: string): Promise<MutationResult> {
  try {
    if (!productId) return { success: false, error: "Product ID is required." };
    const docRef = doc(db, "products", productId);

    await withDbTimeout(
      deleteDoc(docRef),
      10000,
      "Failed to delete product: Firestore operation timed out."
    );

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting product from Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to remove product from database.",
    };
  }
}

// ==========================================
// DASHBOARD METRICS & STATS
// ==========================================

export async function getDashboardStats() {
  try {
    const fetchPromise = Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "products")),
      getDocs(query(collection(db, "users"), where("role", "==", "manager"))),
    ]);

    const [ordersSnap, productsSnap, managersSnap] = await Promise.race([
      fetchPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Dashboard stats read timed out")), 10000)
      ),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data() as Order);
    const products = productsSnap.docs.map((d) => d.data() as Product);

    const totalRevenue = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const pendingOrders = orders.filter((o) => o.orderStatus === "pending" || o.orderStatus === "processing").length;
    const lowStockProducts = products.filter((p) => p.stockQuantity < 10).length;

    return {
      totalOrders: orders.length,
      pendingOrders,
      totalRevenue,
      totalProducts: products.length,
      lowStockProducts,
      totalManagers: managersSnap.size,
    };
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    return {
      totalOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      totalProducts: 0,
      lowStockProducts: 0,
      totalManagers: 0,
    };
  }
}

// ==========================================
// MANAGER PROFILE & PERMISSIONS UPDATE
// ==========================================

export async function updateManagerProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication required to update manager profile. Direct database writes are forbidden.");
  }

  const res = await fetch("/api/admin/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid,
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      businessName: data.customTitle,
      permissions: data.permissions,
      role: "manager",
    }),
  });

  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(result.error || "Failed to update manager profile");
  }
}

// ==========================================
// CUSTOMER DIRECTORY SERVICES
// ==========================================

export async function getCustomersFromDb(): Promise<CustomerProfile[]> {
  try {
    const [usersSnap, ordersSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "user"))),
      getDocs(collection(db, "orders")),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data() as Order);

    // Also extract unique customers from orders in case they purchased as guest
    const customerMap = new Map<string, CustomerProfile>();

    usersSnap.docs.forEach((d) => {
      const u = d.data() as UserProfile;
      customerMap.set(u.email.toLowerCase(), {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || "Customer",
        phoneNumber: u.phoneNumber || "",
        totalOrders: 0,
        totalSpent: 0,
        status: u.isActive ? "active" : "inactive",
        createdAt: u.createdAt || new Date().toISOString(),
      });
    });

    orders.forEach((o) => {
      const email = (o.customerEmail || "").toLowerCase();
      if (!email) return;

      const existing = customerMap.get(email);
      const orderTotal = o.paymentStatus === "paid" ? o.totalAmount || 0 : 0;

      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += orderTotal;
        if (!existing.lastOrderDate || new Date(o.createdAt) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = o.createdAt;
        }
      } else {
        customerMap.set(email, {
          uid: o.userId || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          email: o.customerEmail,
          displayName: o.customerName || "Customer",
          phoneNumber: o.customerPhone || "",
          totalOrders: 1,
          totalSpent: orderTotal,
          lastOrderDate: o.createdAt,
          status: "active",
          createdAt: o.createdAt,
        });
      }
    });

    return Array.from(customerMap.values());
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

// ==========================================
// DISCOUNT & PROMOTION SERVICES
// ==========================================

export async function getDiscountsFromDb(): Promise<DiscountCode[]> {
  try {
    const q = query(collection(db, "discounts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        code: (data.code || "").toUpperCase(),
        description: data.description || "",
        discountType: data.discountType || "percentage",
        discountValue: Number(data.discountValue) || 0,
        minOrderAmount: data.minOrderAmount !== undefined ? Number(data.minOrderAmount) : undefined,
        maxUsageLimit: data.maxUsageLimit !== undefined ? Number(data.maxUsageLimit) : undefined,
        usageCount: Number(data.usageCount) || 0,
        isActive: data.isActive !== false,
        expiryDate: data.expiryDate || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      } as DiscountCode;
    });
  } catch (error) {
    console.error("Error fetching discounts from Firestore:", error);
    return [];
  }
}

export async function saveDiscountInDb(
  discount: DiscountCode
): Promise<MutationResult<DiscountCode>> {
  try {
    if (!discount.code || !discount.code.trim()) {
      return { success: false, error: "Coupon code string is required." };
    }
    if (isNaN(Number(discount.discountValue)) || Number(discount.discountValue) <= 0) {
      return { success: false, error: "Discount value must be greater than zero." };
    }
    if (discount.discountType === "percentage" && Number(discount.discountValue) > 100) {
      return { success: false, error: "Percentage discount cannot exceed 100%." };
    }

    const docId =
      discount.id ||
      `disc_${discount.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")}_${Date.now()}`;

    const payload: any = {
      id: docId,
      code: discount.code.trim().toUpperCase(),
      description: discount.description?.trim() || "",
      discountType: discount.discountType || "percentage",
      discountValue: Number(discount.discountValue),
      usageCount: Number(discount.usageCount) || 0,
      isActive: discount.isActive !== false,
      createdAt: discount.createdAt || new Date().toISOString(),
    };

    if (discount.minOrderAmount !== undefined && discount.minOrderAmount !== null && !isNaN(Number(discount.minOrderAmount))) {
      payload.minOrderAmount = Number(discount.minOrderAmount);
    }
    if (discount.maxUsageLimit !== undefined && discount.maxUsageLimit !== null && !isNaN(Number(discount.maxUsageLimit))) {
      payload.maxUsageLimit = Number(discount.maxUsageLimit);
    }
    if (discount.expiryDate) {
      payload.expiryDate = discount.expiryDate;
    }

    const docRef = doc(db, "discounts", docId);
    const cleanedPayload = cleanFirestoreData(payload);
    await withDbTimeout(
      setDoc(docRef, cleanedPayload, { merge: true }),
      12000,
      "Failed to save discount: Firestore operation timed out."
    );

    return { success: true, data: cleanedPayload as DiscountCode };
  } catch (error: any) {
    console.error("Error saving discount to Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to save discount coupon in database.",
    };
  }
}

export async function deleteDiscountFromDb(id: string): Promise<MutationResult> {
  try {
    if (!id) return { success: false, error: "Discount ID is required for deletion." };
    const docRef = doc(db, "discounts", id);
    await withDbTimeout(
      deleteDoc(docRef),
      10000,
      "Failed to delete discount: Firestore operation timed out."
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting discount from Firestore:", error);
    return {
      success: false,
      error: error?.message || "Failed to remove discount from database.",
    };
  }
}


// ==========================================
// PRICING TIERS SERVICES
// ==========================================

export async function getPricingTiersFromDb(): Promise<PricingTierGroup[]> {
  try {
    const q = query(collection(db, "pricing_tiers"), orderBy("createdAt", "desc"));
    const snap = await withDbTimeout(getDocs(q), 8000, "Fetch pricing tiers timed out");
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "Bulk Tier",
        description: data.description || "",
        tiers: Array.isArray(data.tiers) ? data.tiers : [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt,
      } as PricingTierGroup;
    });
  } catch (error) {
    console.warn("Could not fetch pricing tiers from Firestore:", error);
    return [];
  }
}

export async function savePricingTierInDb(
  tier: Partial<PricingTierGroup> & { name: string; tiers: PricingTierItem[] }
): Promise<MutationResult<PricingTierGroup>> {
  try {
    if (!tier.name || !tier.name.trim()) {
      return { success: false, error: "Pricing tier group name is required." };
    }
    if (!Array.isArray(tier.tiers) || tier.tiers.length === 0) {
      return { success: false, error: "At least one quantity bracket is required." };
    }

    const docId = tier.id || `ptier_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payload: PricingTierGroup = {
      id: docId,
      name: tier.name.trim(),
      description: tier.description?.trim() || "",
      tiers: tier.tiers.map((t) => ({
        minQuantity: Number(t.minQuantity) || 1,
        maxQuantity: t.maxQuantity !== undefined && t.maxQuantity !== null && !isNaN(Number(t.maxQuantity)) ? Number(t.maxQuantity) : undefined,
        discountPercentage: Number(t.discountPercentage) || 0,
        unitPrice: t.unitPrice !== undefined ? Number(t.unitPrice) : undefined,
      })),
      isActive: tier.isActive !== false,
      createdAt: tier.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(db, "pricing_tiers", docId);
    await withDbTimeout(
      setDoc(docRef, cleanFirestoreData(payload), { merge: true }),
      10000,
      "Failed to save pricing tier: Firestore operation timed out."
    );

    return { success: true, data: payload };
  } catch (error: any) {
    console.error("Error saving pricing tier to Firestore:", error);
    return { success: false, error: error?.message || "Failed to commit pricing tier." };
  }
}

export async function deletePricingTierFromDb(id: string): Promise<MutationResult> {
  try {
    if (!id) return { success: false, error: "ID is required for deletion." };
    const docRef = doc(db, "pricing_tiers", id);
    await withDbTimeout(deleteDoc(docRef), 10000, "Failed to delete pricing tier: Timeout");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting pricing tier:", error);
    return { success: false, error: error?.message || "Failed to remove pricing tier." };
  }
}

export async function toggleDiscountStatusInDb(id: string, isActive: boolean): Promise<MutationResult> {
  try {
    if (!id) return { success: false, error: "Discount ID is required." };
    const docRef = doc(db, "discounts", id);
    await withDbTimeout(
      updateDoc(docRef, { isActive }),
      8000,
      "Failed to update discount status: Timeout"
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling discount status:", error);
    return { success: false, error: error?.message || "Failed to toggle discount." };
  }
}

export interface DiscountValidationResult {
  success: boolean;
  valid: boolean;
  discount?: DiscountCode;
  discountAmount: number;
  finalTotal: number;
  error?: string;
}

/**
 * Live validation engine evaluating coupon records in Firestore against current order subtotal
 */
export async function validateDiscountCode(
  rawCode: string,
  cartSubtotal: number
): Promise<DiscountValidationResult> {
  try {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return {
        success: false,
        valid: false,
        discountAmount: 0,
        finalTotal: cartSubtotal,
        error: "Please enter a coupon code.",
      };
    }

    const q = query(
      collection(db, "discounts"),
      where("code", "==", code),
      limit(1)
    );
    const snap = await withDbTimeout(
      getDocs(q),
      8000,
      "Timeout verifying coupon against database."
    );

    if (snap.empty) {
      return {
        success: false,
        valid: false,
        discountAmount: 0,
        finalTotal: cartSubtotal,
        error: `Coupon code "${code}" is invalid or does not exist.`,
      };
    }

    const discount = { id: snap.docs[0].id, ...snap.docs[0].data() } as DiscountCode;

    if (!discount.isActive) {
      return {
        success: false,
        valid: false,
        discountAmount: 0,
        finalTotal: cartSubtotal,
        error: `Coupon code "${code}" has been deactivated.`,
      };
    }

    if (discount.expiryDate) {
      const expiry = new Date(discount.expiryDate);
      if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        return {
          success: false,
          valid: false,
          discountAmount: 0,
          finalTotal: cartSubtotal,
          error: `Coupon code "${code}" expired on ${expiry.toLocaleDateString()}.`,
        };
      }
    }

    if (discount.maxUsageLimit && (discount.usageCount || 0) >= discount.maxUsageLimit) {
      return {
        success: false,
        valid: false,
        discountAmount: 0,
        finalTotal: cartSubtotal,
        error: `Coupon code "${code}" has reached its maximum usage redemption limit.`,
      };
    }

    if (discount.minOrderAmount && cartSubtotal < discount.minOrderAmount) {
      return {
        success: false,
        valid: false,
        discountAmount: 0,
        finalTotal: cartSubtotal,
        error: `Coupon requires a minimum order subtotal of ₦${discount.minOrderAmount.toLocaleString()}.`,
      };
    }

    let calculatedDiscount = 0;
    if (discount.discountType === "percentage") {
      calculatedDiscount = Math.round((cartSubtotal * discount.discountValue) / 100);
    } else {
      calculatedDiscount = Math.min(discount.discountValue, cartSubtotal);
    }

    const finalTotal = Math.max(0, cartSubtotal - calculatedDiscount);

    return {
      success: true,
      valid: true,
      discount,
      discountAmount: calculatedDiscount,
      finalTotal,
    };
  } catch (error: any) {
    console.error("Error validating discount code:", error);
    return {
      success: false,
      valid: false,
      discountAmount: 0,
      finalTotal: cartSubtotal,
      error: error?.message || "Failed to validate coupon with server.",
    };
  }
}

/**
 * @deprecated Removed as source of truth in Packet 4.
 * Discount usage is now incremented atomically server-side during payment finalization.
 */
export async function incrementDiscountUsage(_code: string): Promise<void> {
  // No-op on client: Server payment finalizer atomically increments usageCount in Firestore Admin SDK.
}

// ==========================================
// EXECUTIVE GOVERNANCE STATS (SUPER ADMIN)
// ==========================================

export async function getExecutiveGovernanceStats() {
  try {
    const fetchPromise = Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "users")),
    ]);

    const [ordersSnap, productsSnap, usersSnap] = await Promise.race([
      fetchPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Executive governance stats read timed out")), 10000)
      ),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data() as Order);
    const users = usersSnap.docs.map((d) => d.data() as UserProfile);

    const grossRevenue = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const adminsCount = users.filter((u) => u.role === "admin" || u.role === "super_admin").length;
    const managersCount = users.filter((u) => u.role === "manager").length;
    const totalCustomers = users.filter((u) => u.role === "user").length;

    return {
      grossRevenue,
      totalOrders: orders.length,
      paidOrders: orders.filter((o) => o.paymentStatus === "paid").length,
      totalProducts: productsSnap.size,
      activeAdmins: adminsCount,
      activeManagers: managersCount,
      totalCustomers,
      systemStatus: "Operational",
      databaseStatus: "Connected (Firestore Cloud)",
      clientId: "osvid",
    };
  } catch (error) {
    console.error("Error calculating executive stats:", error);
    return {
      grossRevenue: 0,
      totalOrders: 0,
      paidOrders: 0,
      totalProducts: 0,
      activeAdmins: 1,
      activeManagers: 0,
      totalCustomers: 0,
      systemStatus: "Degraded",
      databaseStatus: "Error connecting to Firestore",
      clientId: "osvid",
    };
  }
}

// ==========================================
// WOOCOMMERCE-STYLE ADVANCED PRODUCT OPERATIONS
// ==========================================

export async function duplicateProductInDb(productId: string): Promise<MutationResult<Product>> {
  try {
    const origRef = doc(db, "products", productId);
    const snap = await getDoc(origRef);
    if (!snap.exists()) {
      return { success: false, error: "Original product not found." };
    }
    const orig = snap.data() as Product;
    const newId = doc(collection(db, "products")).id;
    const now = new Date().toISOString();
    const newSlug = `${orig.slug}-copy-${Date.now().toString().slice(-4)}`;
    const newSku = orig.sku ? `${orig.sku}-COPY` : `SKU-${Date.now().toString().slice(-6)}`;

    const duplicateData: Product = {
      ...orig,
      id: newId,
      name: `${orig.name} (Copy)`,
      slug: newSlug,
      sku: newSku,
      stockQuantity: 0, // Duplicate starts with 0 stock per safe ledger rules
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "products", newId), cleanFirestoreData(duplicateData));
    return { success: true, data: duplicateData };
  } catch (err: any) {
    console.error("Duplicate product error:", err);
    return { success: false, error: err?.message || "Failed to duplicate product." };
  }
}

export async function bulkUpdateProductsInDb(
  productIds: string[],
  updates: Partial<Product>
): Promise<MutationResult> {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const id of productIds) {
      const pRef = doc(db, "products", id);
      batch.update(pRef, cleanFirestoreData({ ...updates, updatedAt: now }));
    }
    await batch.commit();
    return { success: true };
  } catch (err: any) {
    console.error("Bulk update products error:", err);
    return { success: false, error: err?.message || "Failed to bulk update products." };
  }
}

export async function bulkDeleteProductsInDb(productIds: string[]): Promise<MutationResult> {
  try {
    const batch = writeBatch(db);
    for (const id of productIds) {
      const pRef = doc(db, "products", id);
      batch.delete(pRef);
    }
    await batch.commit();
    return { success: true };
  } catch (err: any) {
    console.error("Bulk delete products error:", err);
    return { success: false, error: err?.message || "Failed to bulk delete products." };
  }
}

// ==========================================
// PRODUCT ATTRIBUTES
// ==========================================

export async function getProductAttributesFromDb(): Promise<ProductAttribute[]> {
  try {
    const snap = await getDocs(collection(db, "product_attributes"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductAttribute));
  } catch (err) {
    console.warn("Could not fetch product attributes:", err);
    return [];
  }
}

export async function saveProductAttributeInDb(
  attr: Partial<ProductAttribute>
): Promise<MutationResult<ProductAttribute>> {
  try {
    const id = attr.id || doc(collection(db, "product_attributes")).id;
    const docRef = doc(db, "product_attributes", id);
    const payload = cleanFirestoreData({
      id,
      name: attr.name?.trim() || "",
      values: Array.isArray(attr.values) ? attr.values.map((v: string) => v.trim()).filter(Boolean) : [],
      visibleOnProductPage: attr.visibleOnProductPage !== false,
      usedForVariations: attr.usedForVariations !== false,
    });
    await setDoc(docRef, payload, { merge: true });
    return { success: true, data: payload as ProductAttribute };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save product attribute." };
  }
}

export async function deleteProductAttributeInDb(id: string): Promise<MutationResult> {
  try {
    await deleteDoc(doc(db, "product_attributes", id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete attribute." };
  }
}

// ==========================================
// PRODUCT REVIEWS & RATINGS
// ==========================================

export async function getProductReviewsFromDb(
  productId?: string,
  statusFilter?: string
): Promise<ProductReview[]> {
  try {
    let q: any = collection(db, "product_reviews");
    if (productId && statusFilter && statusFilter !== "all") {
      q = query(q, where("productId", "==", productId), where("status", "==", statusFilter));
    } else if (productId) {
      q = query(q, where("productId", "==", productId));
    } else if (statusFilter && statusFilter !== "all") {
      q = query(q, where("status", "==", statusFilter));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) } as ProductReview));
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.warn("Error fetching reviews:", err);
    return [];
  }
}

export async function submitProductReviewInDb(
  reviewData: Omit<ProductReview, "id" | "createdAt" | "status">
): Promise<MutationResult<ProductReview>> {
  try {
    const reviewId = doc(collection(db, "product_reviews")).id;
    const now = new Date().toISOString();
    const payload: ProductReview = {
      ...reviewData,
      id: reviewId,
      status: "pending",
      createdAt: now,
    };
    await setDoc(doc(db, "product_reviews", reviewId), cleanFirestoreData(payload));
    return { success: true, data: payload };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit review." };
  }
}

export async function updateReviewStatusInDb(
  reviewId: string,
  status: "pending" | "approved" | "rejected",
  productId?: string
): Promise<MutationResult> {
  try {
    const ref = doc(db, "product_reviews", reviewId);
    await updateDoc(ref, { status, updatedAt: new Date().toISOString() });

    // If approved and productId provided, recalculate product rating average
    if (status === "approved" && productId) {
      const approvedReviews = await getProductReviewsFromDb(productId, "approved");
      if (approvedReviews.length > 0) {
        const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
        const avg = parseFloat((sum / approvedReviews.length).toFixed(1));
        const pRef = doc(db, "products", productId);
        await updateDoc(pRef, { averageRating: avg, reviewCount: approvedReviews.length });
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update review status." };
  }
}

export async function deleteReviewFromDb(reviewId: string): Promise<MutationResult> {
  try {
    await deleteDoc(doc(db, "product_reviews", reviewId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete review." };
  }
}

// ==========================================
// TAX SETTINGS
// ==========================================

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  enableTax: true,
  pricesIncludeTax: false,
  taxRatePercent: 7.5, // Nigeria Standard VAT
  taxShipping: false,
  displayPricesInShop: "exclusive",
  displayPricesInCart: "exclusive",
  updatedAt: new Date().toISOString(),
};

export async function getTaxSettingsFromDb(): Promise<TaxSettings> {
  try {
    const snap = await getDoc(doc(db, "tax_settings", "general"));
    if (snap.exists()) {
      return { ...DEFAULT_TAX_SETTINGS, ...snap.data() } as TaxSettings;
    }
  } catch (err) {
    console.warn("Could not load tax settings from database, using defaults:", err);
  }
  return DEFAULT_TAX_SETTINGS;
}

export async function saveTaxSettingsInDb(settings: Partial<TaxSettings>): Promise<MutationResult<TaxSettings>> {
  try {
    const now = new Date().toISOString();
    const payload: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      ...settings,
      updatedAt: now,
    };
    await setDoc(doc(db, "tax_settings", "general"), cleanFirestoreData(payload), { merge: true });
    return { success: true, data: payload };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save tax settings." };
  }
}

// ==========================================
// ORDER NOTES & MANUAL ORDER CREATION
// ==========================================

export async function getOrderNotesFromDb(orderId: string): Promise<OrderNote[]> {
  try {
    const q = query(collection(db, "order_notes"), where("orderId", "==", orderId));
    const snap = await getDocs(q);
    const notes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderNote));
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return notes;
  } catch (err) {
    console.warn("Could not fetch order notes:", err);
    return [];
  }
}

export async function addOrderNoteInDb(
  orderId: string,
  content: string,
  isCustomerVisible: boolean,
  authorName: string = "Staff Administrator"
): Promise<MutationResult<OrderNote>> {
  try {
    const noteId = doc(collection(db, "order_notes")).id;
    const now = new Date().toISOString();
    const noteData: OrderNote = {
      id: noteId,
      orderId,
      content: content.trim(),
      authorName,
      isCustomerVisible,
      createdAt: now,
    };
    await setDoc(doc(db, "order_notes", noteId), cleanFirestoreData(noteData));
    return { success: true, data: noteData };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to add order note." };
  }
}

export async function createManualOrderInDb(
  orderInput: Omit<Order, "id" | "createdAt" | "updatedAt">
): Promise<MutationResult<Order>> {
  try {
    const orderId = doc(collection(db, "orders")).id;
    const now = new Date().toISOString();
    const orderNumber = `OSV-ORD-${Date.now().toString().slice(-6)}`;

    const fullOrder: Order = {
      ...orderInput,
      id: orderId,
      orderNumber: orderInput.orderNumber || orderNumber,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: orderInput.orderStatus || "processing",
          updatedAt: now,
          note: "Order created manually by administrator.",
        },
      ],
    };

    await setDoc(doc(db, "orders", orderId), cleanFirestoreData(fullOrder));
    return { success: true, data: fullOrder };
  } catch (err: any) {
    console.error("Create manual order error:", err);
    return { success: false, error: err?.message || "Failed to create manual order." };
  }
}
