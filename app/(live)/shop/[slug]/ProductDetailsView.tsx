"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Product } from "@/types/auth";
import PageHeader from "@/components/reusables/PageHeader";
import ProductDetailsClient from "./client";
import ProductReviewsSection from "@/components/reusables/reviews/ProductReviewsSection";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";
import CTASection from "@/components/reusables/sections/cta";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProductBySlug } from "@/lib/firebase/storefront";

interface ProductDetailsViewProps {
  initialProduct: Product | null;
  slug: string;
}

export default function ProductDetailsView({
  initialProduct,
  slug,
}: ProductDetailsViewProps) {
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState<boolean>(!initialProduct);

  useEffect(() => {
    if (!initialProduct && slug) {
      setLoading(true);
      getProductBySlug(slug)
        .then((res) => {
          if (res.success && res.data) {
            setProduct(res.data);
          } else {
            setProduct(null);
          }
        })
        .catch(() => {
          setProduct(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialProduct, slug]);

  if (loading) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-gray-800">Loading Product Details...</h2>
        <p className="text-xs text-gray-500 mt-1">Fetching latest specification from database</p>
      </main>
    );
  }

  if (!product) {
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

  return (
    <main>
      <PageHeader
        title={product.name}
        description={
          product.category ? `Category: ${product.category}` : "Technical Chemical Formulation"
        }
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: product.name, href: `/shop/${product.slug}` },
        ]}
      />

      <div className="bg-slate-50/60 py-10 sm:py-14">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <ProductDetailsClient product={product} />
          <div className="pt-8 border-t border-slate-200">
            <ProductReviewsSection productId={product.id} productName={product.name} />
          </div>
        </section>
      </div>

      <TrustBuildingSection />
      <CTASection />
    </main>
  );
}

