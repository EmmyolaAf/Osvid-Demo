// src/app/(live)/shop/[slug]/page.tsx
import { Metadata } from "next";
import { getProductBySlug } from "@/lib/firebase/storefront";
import ProductDetailsClient from "./client";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";
import CTASection from "@/components/reusables/sections/cta";
import PageHeader from "@/components/reusables/PageHeader";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      title: "Product Not Found | OSVID Chemicals",
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
  const result = await getProductBySlug(slug);

  if (!result.success || !result.data) {
    return (
      <main className="min-h-[70vh]">
        <PageHeader
          title="Product Not Found"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: "Not Found", href: "#" },
          ]}
        />
        <section className="container mx-auto py-16 px-4">
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Product Not Found
            </h2>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              The chemical or material product you are looking for does not exist or may have been updated.
            </p>
            <Link href="/shop">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Product Catalog
              </Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const product = result.data;

  return (
    <main>
      <PageHeader
        title={product.name}
        description={product.category ? `Category: ${product.category}` : "Technical Chemical Formulation"}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: product.name, href: `/shop/${product.slug}` },
        ]}
      />

      <section className="container mx-auto py-10 px-4 sm:px-6">
        <ProductDetailsClient product={product} />
      </section>

      <TrustBuildingSection />
      <CTASection />
    </main>
  );
}
