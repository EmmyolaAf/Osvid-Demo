"use client";

import React, { useState, useEffect } from "react";
import ProductCard from "../cards/ProductCard";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Product } from "@/types/auth";

interface FeaturedProductsClientProps {
  initialProducts: Product[];
}

export default function FeaturedProductsClient({
  initialProducts,
}: FeaturedProductsClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    try {
      const q = query(collection(db, "products"), where("isActive", "==", true));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const allActive: Product[] = snapshot.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name || "",
                slug: data.slug || d.id,
                description: data.description || "",
                price: Number(data.price) || 0,
                discountPrice:
                  data.discountPrice !== undefined && data.discountPrice !== null
                    ? Number(data.discountPrice)
                    : undefined,
                stockQuantity: Number(data.stockQuantity) || 0,
                category: data.category || "General",
                imageUrl: data.imageUrl || "/images/placeholder.webp",
                isFeatured: Boolean(data.isFeatured),
                isActive: data.isActive !== false,
                pricingTierId: data.pricingTierId,
                pricingTierName: data.pricingTierName,
                pricingTiers: data.pricingTiers,
                createdAt: data.createdAt,
              } as Product;
            });

            // Priority: Featured products first, fallback to latest products
            const featured = allActive.filter((p) => p.isFeatured);
            const displayProducts = (featured.length > 0 ? featured : allActive).slice(0, 6);
            setProducts(displayProducts);
          }
        },
        (err) => {
          console.warn("Featured products live subscription error:", err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not attach featured products listener:", e);
    }
  }, []);

  if (!products.length) return null;

  return (
    <div className="grid justify-between py-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      {products.map((product, index) => (
        <ProductCard
          key={product.id || index}
          index={index}
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            discountPrice: product.discountPrice,
            image: product.imageUrl,
            pricingTierId: product.pricingTierId,
            pricingTierName: product.pricingTierName,
            pricingTiers: product.pricingTiers,
          }}
        />
      ))}
    </div>
  );
}

