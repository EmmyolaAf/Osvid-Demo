// src/app/categories/page.tsx

import ProductCategoryCard from "@/components/reusables/cards/ProductCategoryCard";
import PageHeader from "@/components/reusables/PageHeader";
import CTASection from "@/components/reusables/sections/cta";
import TrustBuildingSection from "@/components/reusables/sections/TrustBuildingSection";

import { getProductscategories } from "@/wix-api/products";
import Image from "next/image";

export default async function ProductCategoriesPage() {
  const productCategories = await getProductscategories();

  return (
    <main>
      <PageHeader
        title="Top-Quality Products "
        description="Browse our collection, choose your quantity, and order today!"
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "Products",
            href: "/categories",
          },
        ]}
      />

      <section className="relative">
        {/* Background image - Keep if you want, but ensure it complements content */}
        <div className="absolute inset-0 z-0 opacity-20">
          <Image
            src="/images/bbb.jpg"
            alt="Services Background Pattern"
            fill
            sizes="100vw"
            className="object-cover w-full h-full"
          />
        </div>

        <div className="container mx-auto py-12 px-4 md:px-14">
          <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
            <h2 className="text-sm md:text-base font-semibold uppercase w-max border-y py-1 px-4 mx-auto text-osvid-orange border-osvid-orange tracking-wider mb-4">
              Our Products
            </h2>
            <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
              At OSVID LTD., we supply premium-grade construction chemicals,
              backed by professional quality control and years of field-tested
              reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {productCategories.map((category) => (
              <ProductCategoryCard key={category._id} category={category} />
            ))}
          </div>
        </div>
      </section>

      <TrustBuildingSection />

      <CTASection />
    </main>
  );
}
