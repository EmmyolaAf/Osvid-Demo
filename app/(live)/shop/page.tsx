import { Suspense } from "react";
import PageHeader from "@/components/reusables/PageHeader";
import { getProducts } from "@/lib/server/storefront";
import ShopClientPage from "./ShopClientPage";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    search?: string;
    category?: string;
  }>;
}

const PRODUCTS_PER_PAGE = 12;

export const dynamic = "force-static";

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  let s: { page?: string; sort?: string; search?: string; category?: string } = {
    page: "1",
    sort: "price",
    search: "",
    category: "",
  };

  try {
    if (searchParams) {
      s = (await searchParams) || {};
    }
  } catch {
    // Static generation fallback
  }

  const currentPage = parseInt(s.page || "1", 10);
  const sortOrder = s.sort || "price";
  const searchTerm = (s.search || "").toLowerCase().trim();
  const categoryFilter = s.category || "";

  // Fetch active products from Firestore (with resilient fallback to client hydration)
  const result = await getProducts(categoryFilter || undefined);
  let allProducts = result.success && Array.isArray(result.data) ? result.data : [];

  // Filter by search keyword
  if (searchTerm) {
    allProducts = allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm)
    );
  }

  // Sort products
  allProducts.sort((a, b) => {
    switch (sortOrder) {
      case "price":
        return (a.price || 0) - (b.price || 0);
      case "price-desc":
        return (b.price || 0) - (a.price || 0);
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "date":
      default:
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
    }
  });

  const totalProducts = allProducts.length;
  const skip = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = allProducts.slice(skip, skip + PRODUCTS_PER_PAGE);

  const productsData = paginatedProducts.map((p) => ({
    _id: p.id,
    name: p.name,
    price: p.price,
    discountPrice: p.discountPrice,
    image: p.imageUrl,
    slug: p.slug,
    category: p.category,
    categorySlug: p.categorySlug,
    pricingTierId: p.pricingTierId,
    pricingTierName: p.pricingTierName,
    pricingTiers: p.pricingTiers,
    stockQuantity: p.stockQuantity,
  }));

  return (
    <main>
      <PageHeader
        title="Chemical Catalog & Shop"
        description="Browse our high-performance industrial chemicals, adhesives, and surface solutions."
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "Shop",
            href: "/shop",
          },
        ]}
      />
      <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center p-8 text-sm text-slate-500">Loading catalog...</div>}>
        <ShopClientPage
          initialProducts={productsData}
          totalProducts={totalProducts}
          productsPerPage={PRODUCTS_PER_PAGE}
          currentPage={currentPage}
          currentSort={sortOrder}
          currentSearch={searchTerm}
        />
      </Suspense>
    </main>
  );
}
