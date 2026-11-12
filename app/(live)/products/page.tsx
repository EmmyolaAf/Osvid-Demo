// src/app/(live)/products/page.tsx
import PageHeader from "@/components/reusables/PageHeader";
import CTASection from "@/components/reusables/sections/cta";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";
import { getProductCategories, getProducts } from "@/lib/server/storefront";
import Image from "next/image";
import ProductsCatalogClient from "@/components/reusables/products/ProductsCatalogClient";

export const revalidate = 300;

export default async function ProductsCatalogPage() {
  const [productsRes, categoriesRes] = await Promise.all([
    getProducts(),
    getProductCategories(),
  ]);

  const products = productsRes.success ? productsRes.data : [];
  const categories = categoriesRes.success ? categoriesRes.data : [];

  return (
    <main>
      <PageHeader
        title="Industrial Chemical Formulations & Products"
        description="Explore our complete catalogue of certified industrial adhesives, epoxy floor resins, waterproofing membranes, and construction chemicals."
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "Products",
            href: "/products",
          },
        ]}
      />

      <section className="relative">
        <div className="absolute inset-0 z-0 opacity-15">
          <Image
            src="/images/bbb.jpg"
            alt="Chemical Solutions Background Pattern"
            fill
            sizes="100vw"
            className="object-cover w-full h-full"
          />
        </div>

        <div className="max-w-7xl mx-auto py-10 sm:py-12 px-3 sm:px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-sm md:text-base font-semibold uppercase w-max border-y py-1 px-4 mx-auto text-osvid-orange border-osvid-orange tracking-wider mb-4">
              Verified Nigerian Chemical Engineering
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              At OSVID CHEMICALS LTD., we formulate and distribute premium-grade
              construction chemicals, backed by professional laboratory quality control and
              field-tested Nigerian durability.
            </p>
          </div>

          <ProductsCatalogClient
            initialProducts={products}
            categories={categories}
          />
        </div>
      </section>

      <TrustBuildingSection />
      <CTASection />
    </main>
  );
}
