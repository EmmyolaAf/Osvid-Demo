// app/(live)/products/[categorySlug]/page.tsx
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
import { AlertCircle } from "lucide-react";
import companyData from "@/data/company";
import CTASection from "@/components/reusables/sections/cta";
import { getProductCategories, getProducts } from "@/lib/firebase/storefront";
import { ProductCategory } from "@/types";
import ProductCategoryCard from "@/components/reusables/cards/ProductCategoryCard";
import ProductCard from "@/components/reusables/cards/ProductCard";
import { Button } from "@/components/ui/button";

interface ProductCategoryDetailPageProps {
  params: Promise<{ categorySlug: string }>;
}

export const revalidate = 60; // Dynamic short revalidation for category products freshness

export async function generateStaticParams() {
  try {
    const categoriesRes = await getProductCategories();
    if (!categoriesRes.success || !categoriesRes.data) return [];
    return categoriesRes.data.map((cat) => ({
      categorySlug: cat.slug || cat._id,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: ProductCategoryDetailPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const categoriesRes = await getProductCategories();
  const categories: ProductCategory[] = categoriesRes.success
    ? categoriesRes.data
    : [];
  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    return {
      title: "Product Category | OSVID CHEMICALS LTD.",
      description: "Explore industrial chemical formulations from OSVID CHEMICALS LTD.",
    };
  }

  return {
    title: `${category.title} | OSVID CHEMICALS LTD. Products`,
    description: category.description
      ? category.description.substring(0, 160).replace(/<[^>]*>?/gm, "") + "..."
      : `Explore products in the ${category.title} category from OSVID CHEMICALS LTD.`,
    openGraph: {
      images: category.imageUrl ? [category.imageUrl] : [],
    },
  };
}

export default async function ProductCategoryDetailPage({
  params,
}: ProductCategoryDetailPageProps) {
  const { categorySlug } = await params;

  // Fetch all product categories for sidebar navigation
  const categoriesRes = await getProductCategories();
  const allCategories: ProductCategory[] = categoriesRes.success
    ? categoriesRes.data
    : [];

  const currentCategory = allCategories.find((c) => c.slug === categorySlug);

  // If no explicit category record is found, attempt to fetch products with this category tag
  const categoryTitle = currentCategory?.title || categorySlug.replace(/-/g, " ");
  const productsRes = await getProducts(currentCategory?.title || categorySlug);
  const categoryProducts = productsRes.success ? productsRes.data : [];

  if (!currentCategory && categoryProducts.length === 0) {
    return notFound();
  }

  // Determine previous and next category for navigation
  const currentIndex = allCategories.findIndex((c) => c.slug === categorySlug);
  const prevCategory =
    currentIndex > 0 ? allCategories[currentIndex - 1] : null;
  const nextCategory =
    currentIndex >= 0 && currentIndex < allCategories.length - 1
      ? allCategories[currentIndex + 1]
      : null;

  const otherCategories = allCategories.filter((c) => c.slug !== categorySlug);
  const relatedCategories = otherCategories.slice(0, 3);

  const heroImageUrl =
    currentCategory?.imageUrl || "/images/bgs/default-category-hero.jpg";

  return (
    <main className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto flex flex-col md:flex-row py-8 md:py-12 gap-8 px-4 sm:px-6">
        {/* Left Sidebar (Categories Navigation) */}
        <aside className="w-full md:w-80 lg:w-96 p-6 h-max bg-white rounded-3xl border border-slate-200 shadow-sm flex-shrink-0">
          <nav className="mb-8">
            <h2 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-wider text-xs text-orange-600">
              Product Categories
            </h2>
            <ul className="space-y-1.5">
              {allCategories.map((sidebarCategory) => (
                <li key={sidebarCategory._id}>
                  <Link
                    href={`/products/${sidebarCategory.slug}`}
                    className={`block px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                      sidebarCategory.slug === categorySlug
                        ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                    }`}
                  >
                    {sidebarCategory.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Section */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 hidden md:block">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Need Technical Help?
            </h3>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <FaPhoneAlt className="text-orange-600" />
              <a
                href={`tel:${companyData.phone}`}
                className="text-slate-700 hover:text-orange-600 transition-colors font-medium"
              >
                {companyData.phone}
              </a>
            </div>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <FaEnvelope className="text-orange-600" />
              <a
                href={`mailto:${companyData.email}`}
                className="text-slate-700 hover:text-orange-600 transition-colors font-medium truncate"
              >
                {companyData.email}
              </a>
            </div>
            <p className="text-slate-500 text-[11px] mt-3">
              Contact our laboratory engineers for custom formulation batches.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-x-hidden space-y-10">
          {/* Hero Section */}
          <section className="relative h-72 md:h-96 rounded-3xl overflow-hidden flex items-center justify-center shadow-md">
            <Image
              src={heroImageUrl}
              alt={categoryTitle}
              fill
              sizes="(max-width: 768px) 100vw, 70vw"
              priority
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

            <div className="relative z-10 text-center px-4 md:px-12 max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full bg-orange-600/90 text-white text-xs font-bold uppercase tracking-wider mb-2">
                Chemical Category
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-md">
                {categoryTitle}
              </h1>
              {currentCategory?.description && (
                <p className="text-xs sm:text-sm text-slate-200 mt-2 line-clamp-2">
                  {currentCategory.description}
                </p>
              )}
            </div>
          </section>

          {/* Products in this category */}
          <section className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Products in {categoryTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  {categoryProducts.length} formulated chemical products available
                </p>
              </div>

              <Link href="/shop">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold text-slate-700"
                >
                  View All Products
                </Button>
              </Link>
            </div>

            {categoryProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  No products in this category yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Check out our general catalog or speak with a chemical specialist on WhatsApp.
                </p>
                <Link href="/shop">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold">
                    Browse All Chemicals
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryProducts.map((p, idx) => (
                  <ProductCard
                    key={p.id}
                    index={idx}
                    product={{
                      id: p.id,
                      name: p.name,
                      slug: p.slug,
                      price: p.price,
                      discountPrice: p.discountPrice,
                      image: p.imageUrl,
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Navigation Controls */}
          {allCategories.length > 1 && (
            <section className="flex justify-between items-center py-6 border-t border-slate-200">
              {prevCategory ? (
                <Link
                  href={`/products/${prevCategory.slug}`}
                  className="group flex items-center gap-2 text-orange-600 hover:text-orange-700 font-bold text-xs"
                >
                  <FaArrowLeft className="text-sm group-hover:-translate-x-1 transition-transform" />
                  <span>{prevCategory.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {nextCategory && (
                <Link
                  href={`/products/${nextCategory.slug}`}
                  className="group flex items-center gap-2 text-orange-600 hover:text-orange-700 font-bold text-xs ml-auto"
                >
                  <span>{nextCategory.title}</span>
                  <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </section>
          )}
        </div>
      </div>

      <CTASection />
    </main>
  );
}
