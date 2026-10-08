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

export const dynamic = "force-dynamic";

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

  // Fetch active products from Firestore
  const result = await getProducts(categoryFilter || undefined);

  if (!result.success) {
    return (
      <main className="min-h-[70vh]">
        <PageHeader
          title="Shop"
          description="Browse our collection of industrial chemicals and solutions."
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
          ]}
        />
        <section className="container mx-auto py-16 px-4">
          <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2">
              Unable to Load Chemical Catalog
            </h2>
            <p className="text-sm text-red-700 mb-6 leading-relaxed">
              {result.error ||
                "A network error occurred while retrieving products from the database."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/shop">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              </Link>
              <Link href="/">
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-800 hover:bg-red-100 rounded-xl text-sm"
                >
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  let allProducts = result.data || [];

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
