import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getFeaturedProducts, getProducts } from "@/lib/server/storefront";
import ProductCard from "../cards/ProductCard";

export default async function FeaturedProducts() {
  const result = await getFeaturedProducts(6);
  let products = result.success ? result.data : [];

  // If no products marked as featured, fallback to latest products
  if (products.length === 0) {
    const fallbackRes = await getProducts();
    if (fallbackRes.success) {
      products = fallbackRes.data.slice(0, 6);
    }
  }

  if (!products.length) return null;

  return (
    <section className="py-16 md:pt-24 bg-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-sm md:text-base mb-8 font-semibold mx-auto uppercase w-max border-y py-1 text-osvid-orange border-osvid-orange tracking-wider">
          Featured Products
        </h2>
        <p className="text-gray-600 max-w-2xl text-lg sm:text-xl mx-auto mb-12">
          We manufacture and supply a wide range of high-quality construction
          chemicals designed to meet your toughest challenges.
        </p>

        {/* Product Grid */}
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
              }}
            />
          ))}
        </div>

        <div className="mt-8">
          <Link href="/shop">
            <Button className="bg-osvid-orange hover:bg-orange-700 text-white py-6 font-semibold px-8 text-sm sm:text-base rounded-2xl shadow-lg shadow-orange-600/20">
              Explore All Chemicals ➔
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
