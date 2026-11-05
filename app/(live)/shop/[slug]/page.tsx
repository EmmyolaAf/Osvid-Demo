// src/app/(live)/shop/[slug]/page.tsx
import { Metadata } from "next";
import { getProductBySlug } from "@/lib/server/storefront";
import ProductDetailsView from "./ProductDetailsView";

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductBySlug(slug);

  if (!result.success || !result.data) {
    return {
      title: "Product Catalog | OSVID Chemicals",
    };
  }

  const product = result.data;
  const description = product.description
    ? product.description.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 160)
    : `High-grade ${product.name} industrial chemical formulation by OSVID Chemicals.`;

  return {
    title: `${product.name} | OSVID Chemicals Ltd`,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.imageUrl ? [{ url: product.imageUrl }] : [],
    },
  };
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { slug } = await params;
  let initialProduct = null;
  try {
    const result = await getProductBySlug(slug);
    if (result.success && result.data) {
      initialProduct = result.data;
    }
  } catch {
    // Client view fallback handles dynamic resolution from Firestore
  }

  return <ProductDetailsView initialProduct={initialProduct} slug={slug} />;
}
