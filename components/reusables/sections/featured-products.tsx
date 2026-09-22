import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getWixServerClient } from "@/lib/wix-client.server";
import { getCollectionBySlug } from "@/wix-api/collections";
import { queryProducts } from "@/wix-api/products";
import ProductCard from "../cards/ProductCard";
import { delay } from "@/lib/utils";

export default async function FeaturedProducts() {
  await delay(1000); // Simulate loading delay
  // Get the Wix server client
  const wixClient = await getWixServerClient();

  const collection = await getCollectionBySlug(wixClient, "featured-products");
  if (!collection?._id) return null;

  // Query products in this collection
  const featuredProducts = await queryProducts(wixClient, {
    collectionIds: collection._id,
  });

  // Map Wix products to your local Product type, ensuring 'image' is present
  const products = (featuredProducts.items as any[]).map((product: any) => ({
    id: product._id || "", // Map _id to id for ProductCard compatibility
    slug: product?.slug ?? "",
    name: product?.name ?? "",
    price:
      typeof product?.price?.price === "number"
        ? product.price.price
        : undefined,
    discountPrice:
      typeof product?.price?.discountedPrice === "number"
        ? product.price.discountedPrice
        : undefined,
    image: product?.media?.mainMedia?.image?.url || "",
    variant: undefined, // or map if you have variant info
  }));

  if (!products?.length) return null;

  return (
    <section className="py-16 md:pt-24 bg-white">
      <div className="container text-center">
        <h2 className="text-sm md:text-base mb-8 font-semibold mx-auto uppercase w-max border-y py-1 text-osvid-orange border-osvid-orange tracking-wider">
          Featured Products
        </h2>
        <p className="text-gray-600 max-w-2xl text-xl mx-auto mb-12">
          We manufacture and supply a wide range of high-quality construction
          chemicals designed to meet your toughest challenges.
        </p>

        {/* Product Grid */}

        <div className="grid justify-between py-12 grid-cols-1 md:grid-cols-3 gap-x-8 md:gap-x-10 gap-y-12">
          {products.map((product, index) => (
            <ProductCard key={index} index={index} product={product} />
          ))}
        </div>

        <div className="mt-10">
          <Link href="/products">
            <Button className="bg-osvid-orange mt-8 mb-4 hover:bg-osvid-orange/80 text-white py-6 font-semibold font-clash-display px-8 text-base">
              Visit our products&nbsp; ➔
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
