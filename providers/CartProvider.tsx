"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { PricingTierItem } from "@/types/auth";
import { calculateEffectiveVariantPrice } from "@/lib/pricing/variant-pricing-engine";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

const LOCAL_STORAGE_KEY = "osvid_persistent_cart_v2";
const CART_META_KEY = "osvid_cart_meta_v2";
const LEGACY_STORAGE_KEYS = ["cart", "osvid_cart_items"];

// Standardized type definitions
type PriceData = {
  price: number;
  discountedPrice?: number;
  currency: string;
  formatted: {
    price: string;
    discountedPrice?: string;
  };
};

export type CartItem = {
  id: string;
  cartItemId: string;
  name: string;
  quantity: number;
  imageUrl: string;
  variant?: string;
  variationId?: string;
  variationAttributes?: Record<string, string>;
  sku?: string;
  priceData: PriceData;
  pricingTierId?: string;
  pricingTierName?: string;
  pricingTiers?: PricingTierItem[];
  capacity?: number;
  capacityUnit?: string;
  volumeDiscountThreshold?: number;
  volumeDiscountPercentage?: number;
  volumeUnit?: string;
  pointsPerUnit?: number;
  pointsThreshold?: number;
  pointsDiscountPercentage?: number;
  pointsEarned?: number;
  isPointsEligible?: boolean;
};

export function getEffectiveCartItemPrice(
  item: CartItem,
  allItems?: CartItem[]
): {
  unitPrice: number;
  baseUnitPrice: number;
  appliedTier?: PricingTierItem;
  discountPercentage: number;
  isVolumeDiscountApplied: boolean;
  isPointsDiscountApplied: boolean;
  appliedPointsDiscountPercentage?: number;
  qualifyingPointsThreshold?: number;
  pointsPerUnit: number;
  pointsEarned: number;
  cumulativeVolume: number;
  volumeThreshold?: number;
  volumeUnit?: string;
  discountReason?: string;
  savingsPerUnit: number;
} {
  const sameProductItems = (allItems && allItems.length > 0 ? allItems : [item]).filter(
    (i) => i.id === item.id
  );
  const cumulativeVolume = sameProductItems.reduce(
    (acc, i) => acc + Number(i.quantity) * (Number(i.capacity) || 0),
    0
  );

  const totalCartPoints = (allItems && allItems.length > 0 ? allItems : [item]).reduce(
    (acc, i) => acc + Number(i.quantity) * (Number(i.pointsPerUnit) || 0),
    0
  );

  const engineResult = calculateEffectiveVariantPrice({
    baseProductPrice: item.priceData.price,
    variant: {
      priceOverride: item.priceData.price,
      salePrice: item.priceData.discountedPrice,
      pricingTiers: item.pricingTiers,
      capacity: item.capacity,
      pointsPerUnit: item.pointsPerUnit,
      pointsThreshold: item.pointsThreshold,
      pointsDiscountPercentage: item.pointsDiscountPercentage,
      isPointsEligible: item.isPointsEligible,
    },
    quantity: item.quantity,
    cumulativeProductVolume: cumulativeVolume,
    volumeDiscountThreshold: item.volumeDiscountThreshold,
    volumeDiscountPercentage: item.volumeDiscountPercentage,
    pointsPerUnit: item.pointsPerUnit,
    pointsThreshold: item.pointsThreshold,
    pointsDiscountPercentage: item.pointsDiscountPercentage,
    accumulatedQualifyingPoints: totalCartPoints,
  });

  const volUnit = item.volumeUnit || item.capacityUnit || "Liters";

  let discountReason: string | undefined = undefined;
  if (engineResult.isPointsDiscountApplied) {
    discountReason = `Points Qualified (${engineResult.appliedPointsDiscountPercentage || item.pointsDiscountPercentage}% off)`;
  } else if (engineResult.isVolumeWholesaleApplied) {
    discountReason = `Volume Wholesale (${cumulativeVolume} ${volUnit} reached)`;
  } else if (engineResult.appliedFlashSale) {
    discountReason = engineResult.appliedFlashSale.badgeText || "Flash Deal";
  } else if (engineResult.appliedTier?.discountPercentage) {
    discountReason = `${engineResult.appliedTier.discountPercentage}% Tier Discount`;
  }

  return {
    unitPrice: engineResult.unitPrice,
    baseUnitPrice: engineResult.baseUnitPrice,
    appliedTier: engineResult.appliedTier,
    discountPercentage: engineResult.discountPercentage,
    isVolumeDiscountApplied: engineResult.isVolumeWholesaleApplied,
    isPointsDiscountApplied: engineResult.isPointsDiscountApplied,
    appliedPointsDiscountPercentage: engineResult.appliedPointsDiscountPercentage,
    qualifyingPointsThreshold: item.pointsThreshold,
    pointsPerUnit: Number(item.pointsPerUnit) || 0,
    pointsEarned: (Number(item.pointsPerUnit) || 0) * item.quantity,
    cumulativeVolume,
    volumeThreshold: item.volumeDiscountThreshold ? Number(item.volumeDiscountThreshold) : undefined,
    volumeUnit: volUnit,
    discountReason,
    savingsPerUnit: engineResult.savingsPerUnit,
  };
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (
    product: Omit<CartItem, "cartItemId" | "quantity">,
    quantity?: number
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  totalCartPoints: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  isLoading: boolean;
  error: string | null;
  cartCreatedAt: string | null;
  cartUpdatedAt: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartCreatedAt, setCartCreatedAt] = useState<string | null>(null);
  const [cartUpdatedAt, setCartUpdatedAt] = useState<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load from Persistent Local Storage (with Legacy Migration)
  useEffect(() => {
    const loadInitialCart = () => {
      try {
        if (typeof window === "undefined") return;

        let parsedItems: CartItem[] = [];

        // Try primary persistent storage
        const primaryRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (primaryRaw) {
          try {
            parsedItems = JSON.parse(primaryRaw);
          } catch (e) {
            console.warn("Could not parse primary persistent cart:", e);
          }
        }

        // Check legacy fallbacks if primary is empty
        if (!parsedItems || parsedItems.length === 0) {
          for (const key of LEGACY_STORAGE_KEYS) {
            const legacyVal = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (legacyVal) {
              try {
                const legItems = JSON.parse(legacyVal);
                if (Array.isArray(legItems) && legItems.length > 0) {
                  parsedItems = legItems;
                  // Migrate immediately to persistent key
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legItems));
                  break;
                }
              } catch {
                // Ignore parse errors on legacy keys
              }
            }
          }
        }

        // Load or initialize metadata
        let metaRaw = localStorage.getItem(CART_META_KEY);
        let meta = metaRaw ? JSON.parse(metaRaw) : null;
        if (!meta && parsedItems && parsedItems.length > 0) {
          meta = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(CART_META_KEY, JSON.stringify(meta));
        }

        if (meta) {
          setCartCreatedAt(meta.createdAt || null);
          setCartUpdatedAt(meta.updatedAt || null);
        }

        setCart(Array.isArray(parsedItems) ? parsedItems : []);
      } catch (err) {
        setError("Failed to load cart data");
        console.error("Cart load error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialCart();
  }, []);

  // 2. Synchronize with Firestore when user is logged in
  useEffect(() => {
    const currentUserId = user?.uid;
    if (!currentUserId || isLoading) return;

    let isMounted = true;
    async function syncCloudCart() {
      try {
        const cartDocRef = doc(collection(db, "user_carts"), currentUserId);
        const cartSnap = await getDoc(cartDocRef);

        if (!isMounted) return;

        if (cartSnap.exists()) {
          const cloudData = cartSnap.data();
          const cloudItems: CartItem[] = Array.isArray(cloudData?.items) ? cloudData.items : [];

          // Smart merge: combine local guest cart items with cloud items
          setCart((localCart) => {
            const mergedMap = new Map<string, CartItem>();

            // Add cloud items first
            cloudItems.forEach((ci) => {
              const key = `${ci.id}_${ci.variationId || ci.variant || "default"}`;
              mergedMap.set(key, ci);
            });

            // Merge local items
            localCart.forEach((li) => {
              const key = `${li.id}_${li.variationId || li.variant || "default"}`;
              const existing = mergedMap.get(key);
              if (existing) {
                // If in both, take higher quantity or latest
                mergedMap.set(key, {
                  ...existing,
                  quantity: Math.max(existing.quantity, li.quantity),
                });
              } else {
                mergedMap.set(key, li);
              }
            });

            const merged = Array.from(mergedMap.values());
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
              } catch {}
            }
            return merged;
          });
        } else if (cart.length > 0) {
          // Push initial local items to user's cloud cart
          await setDoc(cartDocRef, {
            items: cart,
            userId: currentUserId,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (cloudErr) {
        console.warn("Could not synchronize user cart with Firestore:", cloudErr);
      }
    }

    syncCloudCart();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, isLoading]);

  // 3. Save cart to persistent local storage on changes and debounced write to Cloud
  useEffect(() => {
    if (isLoading) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const now = new Date().toISOString();
    setCartUpdatedAt(now);

    // Persist to browser LocalStorage for both guests and signed-in users
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cart));
        sessionStorage.setItem("cart", JSON.stringify(cart)); // backwards compatibility

        const currentMetaRaw = localStorage.getItem(CART_META_KEY);
        const currentMeta = currentMetaRaw ? JSON.parse(currentMetaRaw) : {};
        const newMeta = {
          createdAt: currentMeta.createdAt || now,
          updatedAt: now,
          itemsCount: cart.length,
        };
        localStorage.setItem(CART_META_KEY, JSON.stringify(newMeta));
        if (!cartCreatedAt) setCartCreatedAt(newMeta.createdAt);
      }
    } catch (err) {
      console.error("Cart save error:", err);
    }

    // Debounced Firestore sync for authenticated users
    const currentUserId = user?.uid;
    if (currentUserId) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const cartDocRef = doc(collection(db, "user_carts"), currentUserId);
          if (cart.length === 0) {
            await deleteDoc(cartDocRef);
          } else {
            await setDoc(cartDocRef, {
              items: cart,
              userId: currentUserId,
              updatedAt: now,
            });
          }
        } catch (syncErr) {
          console.warn("Debounced cloud cart sync error:", syncErr);
        }
      }, 800);
    }
  }, [cart, isLoading, user?.uid]);

  const addToCart = useCallback(
    (
      product: Omit<CartItem, "cartItemId" | "quantity">,
      quantity: number = 1
    ) => {
      setCart((prevCart) => {
        const existingItem = prevCart.find(
          (item) => item.id === product.id && (product.variationId ? item.variationId === product.variationId : item.variant === product.variant)
        );

        if (existingItem) {
          return prevCart.map((item) =>
            item.id === product.id && (product.variationId ? item.variationId === product.variationId : item.variant === product.variant)
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        return [
          ...prevCart,
          {
            ...product,
            cartItemId: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            quantity,
          },
        ];
      });
    },
    []
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.cartItemId !== cartItemId)
    );
  }, []);

  const updateQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(cartItemId);
        return;
      }
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity } : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(async () => {
    setCart([]);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CART_META_KEY);
        sessionStorage.removeItem("cart");
        LEGACY_STORAGE_KEYS.forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
      }
      if (user?.uid) {
        await deleteDoc(doc(collection(db, "user_carts"), user.uid)).catch(() => {});
      }
    } catch (err) {
      setError("Failed to clear cart");
      console.error("Clear cart error:", err);
    }
  }, [user?.uid]);

  // Memoized calculations
  const { totalItems, subtotal, totalCartPoints } = useMemo(() => {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => {
      const { unitPrice } = getEffectiveCartItemPrice(item, cart);
      return sum + unitPrice * item.quantity;
    }, 0);
    const totalCartPoints = Math.round(
      cart.reduce((sum, item) => sum + (Number(item.pointsPerUnit) || 0) * item.quantity, 0) * 100
    ) / 100;
    return { totalItems, subtotal, totalCartPoints };
  }, [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        totalCartPoints,
        isCartOpen,
        openCart,
        closeCart,
        isLoading,
        error,
        cartCreatedAt,
        cartUpdatedAt,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
