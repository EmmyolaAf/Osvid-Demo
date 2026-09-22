// app/products/[categorySlug]/page.tsx
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaInstagram,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa";

import companyData from "@/data/company";
import CTASection from "@/components/reusables/sections/cta";
import { getWixStaticImageUrl } from "@/utils/wixImageUtils"; // Your Wix image utility
import ContentViewer from "@/components/ContentViwer";
import { getProductscategories } from "@/wix-api/products";
import { ProductCategory } from "@/types";
import ProductCategoryCard from "@/components/reusables/cards/ProductCategoryCard";
import { Button } from "@/components/ui/button";

// Generate dynamic metadata for each product category page
export async function generateMetadata({
  params,
}: ProductCategoryDetailPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const categories: ProductCategory[] = await getProductscategories(); // Using your function
  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    return {
      title: "Product Category Not Found",
      description: "The requested product category could not be found.",
    };
  }

  return {
    title: `${category.title} | OSVID CHEMICALS LTD. Products`,
    description: category.description
      ? category.description.substring(0, 160).replace(/<[^>]*>?/gm, "") + "..."
      : `Explore products in the ${category.title} category from OSVID CHEMICALS LTD.`,
    openGraph: {
      images: category.imageUrl
        ? [getWixStaticImageUrl(category.imageUrl) || ""]
        : [],
    },
  };
}

type ProductCategoryDetailPageProps = {
  params: Promise<{ categorySlug: string }>;
};

export default async function ProductCategoryDetailPage({
  params,
}: ProductCategoryDetailPageProps) {
  const { categorySlug } = await params;

  // Fetch all product categories for the sidebar
  const allCategories: ProductCategory[] = await getProductscategories(); // Using your function
  const currentCategory = allCategories.find((c) => c.slug === categorySlug);

  if (!currentCategory) return notFound();

  // Determine previous and next category for navigation
  const currentIndex = allCategories.findIndex((c) => c.slug === categorySlug);
  const prevCategory =
    currentIndex > 0 ? allCategories[currentIndex - 1] : null;
  const nextCategory =
    currentIndex < allCategories.length - 1
      ? allCategories[currentIndex + 1]
      : null;

  // Filter out the current category for "More Categories" section
  const otherCategories = allCategories.filter((c) => c.slug !== categorySlug);
  const relatedCategories = otherCategories.slice(0, 3); // Display up to 3 other categories

  // Fallback image if category.imageUrl is not provided
  const heroImageUrl =
    getWixStaticImageUrl(currentCategory.imageUrl) ||
    "/images/bgs/default-category-hero.jpg";

  return (
    <main className="min-h-screen">
      {/* Left Sidebar (Product Categories Navigation) */}

      <div className="container flex flex-col md:flex-row py-8 md:py-12 gap-8">
        <aside className="w-full md:w-80 lg:w-96 p-6 h-max bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0">
          <nav className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Product Categories
            </h2>
            <ul className="space-y-2">
              {allCategories.map((sidebarCategory) => (
                <li key={sidebarCategory._id}>
                  <Link
                    href={`/products/${sidebarCategory.slug}`}
                    className={`block p-3 rounded-lg font-medium transition-colors duration-200
                              ${
                                sidebarCategory.slug === categorySlug
                                  ? "bg-osvid-orange text-white"
                                  : "text-gray-700 hover:bg-osvid-orange hover:text-white"
                              }`}
                  >
                    {sidebarCategory.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Section (Reused) */}
          <div className="bg-white p-6 rounded-lg shadow-md hidden md:block">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Contact Us</h3>
            <div className="flex items-center gap-3 mb-2">
              <FaPhoneAlt className="text-osvid-orange text-lg" />
              <a
                href={`tel:${companyData.phone}`}
                className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
              >
                {companyData.phone}
              </a>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <FaEnvelope className="text-osvid-orange text-lg" />
              <a
                href={`mailto:${companyData.email}`}
                className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
              >
                {companyData.email}
              </a>
            </div>
            {companyData.socialMedia?.instagram && (
              <div className="flex items-center gap-3">
                <FaInstagram className="text-osvid-orange text-lg" />
                <a
                  href={`https://instagram.com/${companyData.socialMedia.instagram.replace(
                    "@",
                    ""
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                >
                  {companyData.socialMedia.instagram}
                </a>
              </div>
            )}
            <p className="text-gray-600 text-sm mt-4">
              Get in touch for expert advice and solutions.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-x-hidden">
          {/* Hero Section - Image with Overlay and Title */}
          <section className="relative h-96 md:h-[60vh] flex items-center justify-center overflow-hidden">
            <Image
              src={heroImageUrl}
              alt={currentCategory.title || "Product category background image"}
              fill
              sizes="100vw"
              priority
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent via-black/40" />

            <div className="relative z-10 text-center px-4 md:px-12 max-w-4xl">
              <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight drop-shadow-lg">
                {currentCategory.title}
              </h1>
            </div>
          </section>

          {/* Main Content Section */}
          <section className="container mx-auto px-4 md:px-14 py-16 space-y-12">
            {/* Category Content (using ContentViewer) */}
            {currentCategory.content &&
              (currentCategory?.content?.nodes?.length ?? 0) > 0 && (
                <article className="prose prose-lg mx-auto max-w-none text-gray-700">
                  <ContentViewer nodes={currentCategory.content.nodes || []} />
                </article>
              )}
            {/* Fallback if no rich content, display description */}
            {(!currentCategory.content ||
              currentCategory?.content?.nodes?.length === 0) &&
              currentCategory.description && (
                <article className="prose prose-lg mx-auto max-w-none text-gray-700">
                  <p>{currentCategory.description}</p>
                </article>
              )}

            <section className="py-12">
              <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-10">
                Products in {currentCategory.title}
              </h2>

              <Link href={"/shop"}>
                <Button className="text-base font-medium bg-osvid-orange">
                  Browse Products
                </Button>
              </Link>
            </section>

            {/* Expertise / Partnership Callout Section (Reused) */}
            <section className="bg-orange-50 p-8 md:p-12 rounded-xl shadow-lg space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold text-osvid-orange">
                Partner with OSVID CHEMICALS LTD. Today!
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Whether you need expert surface finishing, reliable bulk
                chemical supply, or technical guidance — OSVID CHEMICALS LTD. is
                ready to serve you with quality, commitment, and innovation.
              </p>
              <ul className="list-disc list-inside text-gray-800 space-y-2 pl-2 text-lg">
                <li>Quality Without Compromise</li>
                <li>Commitment to Excellence</li>
                <li>Innovation-Driven Solutions</li>
                <li>Expert Technical Consultation and Support</li>
                <li>Professional Workmanship & Top-Tier Finishing</li>
              </ul>

              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <FaPhoneAlt className="text-osvid-orange text-xl" />
                  <a
                    href={`tel:${companyData.phone}`}
                    className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                  >
                    {companyData.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <FaEnvelope className="text-osvid-orange text-xl" />
                  <a
                    href={`mailto:${companyData.email}`}
                    className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                  >
                    {companyData.email}
                  </a>
                </div>
                {companyData.socialMedia?.instagram && (
                  <div className="flex items-center gap-3">
                    <FaInstagram className="text-osvid-orange text-xl" />
                    <a
                      href={`https://instagram.com/${companyData.socialMedia.instagram.replace(
                        "@",
                        ""
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 hover:text-osvid-orange transition-colors duration-200"
                    >
                      {companyData.socialMedia.instagram}
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Next/Previous Category Navigation */}
            <section className="flex justify-between items-center py-8 border-t border-b border-gray-200">
              {prevCategory ? (
                <Link
                  href={`/products/${prevCategory.slug}`}
                  className="group flex items-center gap-2 text-osvid-orange hover:text-orange-700 transition-colors duration-200 font-semibold"
                >
                  <FaArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
                  {prevCategory.title}
                </Link>
              ) : (
                <div className="opacity-50 text-gray-500 flex items-center gap-2">
                  <FaArrowLeft className="text-lg" />
                  No Previous Category
                </div>
              )}

              {nextCategory ? (
                <Link
                  href={`/products/${nextCategory.slug}`}
                  className="group flex items-center gap-2 text-osvid-orange hover:text-orange-700 transition-colors duration-200 font-semibold ml-auto"
                >
                  {nextCategory.title}
                  <FaArrowRight className="text-lg group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <div className="opacity-50 text-gray-500 flex items-center gap-2 ml-auto">
                  No Next Category
                  <FaArrowRight className="text-lg" />
                </div>
              )}
            </section>
          </section>
        </div>
      </div>

      <div className="container">
        {/* More Categories Section (Related Categories) */}
        {relatedCategories.length > 0 && (
          <section className="py-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-10">
              Explore Other Categories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {relatedCategories.map((relatedCategory) => (
                <ProductCategoryCard
                  key={relatedCategory.slug}
                  category={relatedCategory}
                />
              ))}
            </div>
            {otherCategories.length > relatedCategories.length && (
              <div className="text-center mt-12">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full text-white bg-osvid-orange hover:bg-orange-700 transition-colors shadow-lg"
                >
                  View All Categories &rarr;
                </Link>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Reusable CTA Section */}
      <CTASection
        heading="Ready for Your Next Project?"
        subheading="Need a reliable surface expert or chemical supplier? Trust OSVID CHEMICALS LTD. — where quality meets craftsmanship."
      />
    </main>
  );
}
