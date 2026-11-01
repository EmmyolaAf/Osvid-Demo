"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { PricingTierItem } from "@/types/auth";

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
};

export function getEffectiveCartItemPrice(item: CartItem): {
  unitPrice: number;
  baseUnitPrice: number;
  appliedTier?: PricingTierItem;
  discountPercentage: number;
} {
  const basePrice = item.priceData.discountedPrice ?? item.priceData.price;
  const tiers = Array.isArray(item.pricingTiers) ? item.pricingTiers : [];

  if (tiers.length === 0) {
    return {
      unitPrice: basePrice,
      baseUnitPrice: basePrice,
      discountPercentage: 0,
    };
  }

  const eligibleTiers = tiers.filter((t) => {
    if (typeof t.minQuantity === "number" && item.quantity < t.minQuantity) {
      return false;
    }
    if (typeof t.maxQuantity === "number" && t.maxQuantity > 0 && item.quantity > t.maxQuantity) {
      return false;
    }
    return true;
  });

  if (eligibleTiers.length === 0) {
    return {
      unitPrice: basePrice,
      baseUnitPrice: basePrice,
      discountPercentage: 0,
    };
  }

  const sorted = [...eligibleTiers].sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
  const bestTier = sorted[0];

  let unitPrice = basePrice;
  if (bestTier.discountPercentage && Number(bestTier.discountPercentage) > 0) {
    const pct = Math.min(100, Math.max(0, Number(bestTier.discountPercentage)));
    unitPrice = Math.round(basePrice * (1 - pct / 100));
  } else if (bestTier.unitPrice && Number(bestTier.unitPrice) > 0) {
    unitPrice = Number(bestTier.unitPrice);
  }

  return {
    unitPrice,
    baseUnitPrice: basePrice,
    appliedTier: bestTier,
    discountPercentage: bestTier.discountPercentage || 0,
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
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  isLoading: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cart from storage
  useEffect(() => {
    const loadCart = () => {
      try {
        const savedCart =
          typeof window !== "undefined"
            ? JSON.parse(sessionStorage.getItem("cart") || "[]")
            : [];
        setCart(savedCart);
      } catch (err) {
        setError("Failed to load cart data");
        console.error("Cart load error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, []);

  // Save cart to storage
  useEffect(() => {
    if (!isLoading) {
      try {
        sessionStorage.setItem("cart", JSON.stringify(cart));
      } catch (err) {
        setError("Failed to save cart data");
        console.error("Cart save error:", err);
      }
    }
  }, [cart, isLoading]);

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
            cartItemId: `${product.id}-${Date.now()}`,
            quantity,
          },
        ];
      });
    },
    []
  );

  // Other methods remain similar but with better error handling
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

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      sessionStorage.removeItem("cart");
    } catch (err) {
      setError("Failed to clear cart");
      console.error("Clear cart error:", err);
    }
  }, []);

  // Memoized calculations
  const { totalItems, subtotal } = useMemo(() => {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => {
      const { unitPrice } = getEffectiveCartItemPrice(item);
      return sum + unitPrice * item.quantity;
    }, 0);
    return { totalItems, subtotal };
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
        isCartOpen,
        openCart,
        closeCart,
        isLoading,
        error,
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
