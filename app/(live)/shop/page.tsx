// src/app/shop/page.tsx
import PageHeader from "@/components/reusables/PageHeader";
import { wixClientServer } from "@/lib/wix-client.server";
import ShopClientPage from "./ShopClientPage";

/* eslint-disable  @typescript-eslint/no-explicit-any */

// Define types for search parameters
interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    search?: string; // Added search param type
  }>;
}

const PRODUCTS_PER_PAGE = 12; // Define products per page

export const dynamic = "force-static";

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  let s: { page?: string; sort?: string; search?: string } = {
    page: "1",
    sort: "price",
    search: "",
  };
  try {
    if (searchParams) {
      s = (await searchParams) || {};
    }
  } catch {
    // Static generation fallback
  }

  const currentPage = parseInt(s.page || "1");
  const skip = (currentPage - 1) * PRODUCTS_PER_PAGE;
  // Default sort order changed to 'name' or 'price' based on preference, here using 'price'
  const sortOrder = s.sort || "price";
  const searchTerm = s.search || ""; // Get search term from URL

  const wixClient = await wixClientServer();

  let queryBuilder = wixClient.products
    .queryProducts()
    .limit(PRODUCTS_PER_PAGE)
    .skip(skip);

  // Add search filter if a search term is present
  if (searchTerm) {
    queryBuilder = queryBuilder.hasSome("name", [searchTerm]);
  }

  switch (sortOrder) {
    case "popularity":
      // No direct 'popularity' sort in Wix via given fields. Using 'lastUpdated' as a logical fallback.
      queryBuilder = queryBuilder.descending("lastUpdated");
      break;
    case "rating":
      // No direct 'rating' sort in Wix via given fields. Using 'lastUpdated' as a logical fallback.
      queryBuilder = queryBuilder.descending("lastUpdated");
      break;
    case "date": // Sort by latest (creation date) - using 'lastUpdated' as per valid fields
      queryBuilder = queryBuilder.descending("lastUpdated");
      break;
    case "price": // Sort by price: low to high - using 'price' as it's a valid field
      queryBuilder = queryBuilder.ascending("price");
      break;
    case "price-desc": // Sort by price: high to low - using 'price' as it's a valid field
      queryBuilder = queryBuilder.descending("price");
      break;
    case "name-asc": // New option: Sort by name A-Z
      queryBuilder = queryBuilder.ascending("name");
      break;
    case "name-desc": // New option: Sort by name Z-A
      queryBuilder = queryBuilder.descending("name");
      break;
    default:
      queryBuilder = queryBuilder.ascending("price"); // Default: price low to high
  }

  let productsData: any[] = [];
  let totalProducts = 0;

  try {
    const res = await queryBuilder.find(); // Execute the query
    productsData = res.items.map((item: any) => ({
      _id: item._id,
      name: item.name,
      price: item.priceData?.price,
      discountPrice: item.priceData?.discountedPrice,
      image: item.media?.mainMedia?.image?.url,
      slug: item.slug,
    }));
    totalProducts = res.totalCount || 0;

    console.log(productsData);
  } catch (error: any) {
    console.error("Failed to fetch products:", error);
    const errorMessage = "Failed to load products. Please try again later.";
    // More specific error handling if needed based on error.details

    return (
      <main>
        <PageHeader title="Shop" />
        <section className="container py-12">
          <p className="text-center text-red-600 text-lg">{errorMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Shop "
        description="Browse our collection, choose your quantity, and order today!"
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
      <ShopClientPage
        initialProducts={productsData}
        totalProducts={totalProducts}
        productsPerPage={PRODUCTS_PER_PAGE}
        currentPage={currentPage}
        currentSort={sortOrder}
        currentSearch={searchTerm} // Pass search term to client component
      />
    </main>
  );
}
