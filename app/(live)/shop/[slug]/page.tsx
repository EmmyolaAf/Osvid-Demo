// import { wixClient } from "@/lib/wixClient";

import { getWixServerClient } from "@/lib/wix-client.server";
import { getProductBySlug } from "@/wix-api/products";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductDetailsClient from "./client";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";
import CTASection from "@/components/reusables/sections/cta";

// Generate metadata dynamically based on the product data
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const wix = await getWixServerClient();
  const product = await getProductBySlug(wix, slug);

  if (!product) {
    return {
      title: "Product Not Found",
    };
  }

  const description = product.description
    ? product.description.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 160) // Basic HTML stripping and truncation
    : `Details and price for ${product.name}.`;

  const imageUrl = product.media?.mainMedia?.image?.url;
  const imageAlt = "PRODUCT IMAGE"; // Fallback alt text

  return {
    title: product.name, // Use the product name as the title
    description: description, // Use the product description (cleaned up)
    openGraph: {
      title: product.name || "Product Not Found", // Fallback title
      description: description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/products/${slug}`, // Full URL to the product page
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 800, // Provide dimensions if known for better performance
              height: 600,
              // Explicitly handle null: if imageAlt is null, use undefined
              alt: imageAlt === null ? undefined : imageAlt,
            },
          ]
        : [], // Provide an empty array if no image
      type: "article", // Or "product" if you have more specific schema
    },
    twitter: {
      card: "summary_large_image",
      title: product.name || "Product Not Found", // Fallback title
      description: description,
      images: imageUrl ? [imageUrl] : [], // Twitter images can be simpler string array
    },
  };
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const wix = await getWixServerClient();

  const product = await getProductBySlug(wix, slug);

  if (!product) {
    notFound(); // triggers 404 page
  }

  return (
    <main>
      <section className="container py-12">
        <ProductDetailsClient product={product} />;
      </section>

      <TrustBuildingSection />

      <CTASection />
    </main>
  );
}
