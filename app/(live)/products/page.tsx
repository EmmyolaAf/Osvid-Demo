// src/app/(live)/products/page.tsx
import ProductCategoryCard from "@/components/reusables/cards/ProductCategoryCard";
import PageHeader from "@/components/reusables/PageHeader";
import CTASection from "@/components/reusables/sections/cta";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";
import { getProductCategories } from "@/lib/server/storefront";
import Image from "next/image";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage() {
  const result = await getProductCategories();

  return (
    <main>
      <PageHeader
        title="Top-Quality Chemical Categories"
        description="Browse our specialized formulations, surface treatment chemicals, and industrial adhesives."
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "Categories",
            href: "/products",
          },
        ]}
      />

      <section className="relative">
        <div className="absolute inset-0 z-0 opacity-20">
          <Image
            src="/images/bbb.jpg"
            alt="Chemical Solutions Background Pattern"
            fill
            sizes="100vw"
            className="object-cover w-full h-full"
          />
        </div>

        <div className="container mx-auto py-12 px-4 md:px-14 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
            <h2 className="text-sm md:text-base font-semibold uppercase w-max border-y py-1 px-4 mx-auto text-osvid-orange border-osvid-orange tracking-wider mb-4">
              Our Formulations & Products
            </h2>
            <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
              At OSVID CHEMICALS LTD., we formulate and distribute premium-grade
              construction chemicals, backed by professional laboratory quality control and
              field-tested Nigerian durability.
            </p>
          </div>

          {!result.success ? (
            <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center shadow-sm my-8">
              <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-red-900 mb-1">
                Unable to Load Product Categories
              </h3>
              <p className="text-xs text-red-700 mb-4">{result.error}</p>
              <Link href="/products">
                <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </Link>
            </div>
          ) : result.data.length === 0 ? (
            <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 p-8 max-w-lg mx-auto shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                No Categories Configured Yet
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Explore our full catalog directly in the shop while categories are being indexed.
              </p>
              <Link href="/shop">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold">
                  Browse All Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {result.data.map((category) => (
                <ProductCategoryCard key={category._id} category={category} />
              ))}
            </div>
          )}
        </div>
      </section>

      <TrustBuildingSection />
      <CTASection />
    </main>
  );
}
