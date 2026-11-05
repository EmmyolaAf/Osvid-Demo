"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import ProductCard from "@/components/reusables/cards/ProductCard";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProductCardSkeleton from "@/components/reusables/skeletons/ProductCardSkeleton";
import { BulkDiscount } from "@/components/reusables/CompactBulkOrder";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface ProductItem {
  _id: string;
  name: string;
  price?: number;
  discountPrice?: number;
  image?: string;
  slug?: string;
  category?: string;
  categorySlug?: string;
  createdAt?: string;
  pricingTierId?: string;
  pricingTierName?: string;
  pricingTiers?: any[];
}

interface ShopClientPageProps {
  initialProducts: ProductItem[];
  totalProducts: number;
  productsPerPage: number;
  currentPage: number;
  currentSort: string;
  currentSearch: string;
}

export default function ShopClientPage({
  initialProducts,
  totalProducts: initialTotalProducts,
  productsPerPage,
  currentPage,
  currentSort,
  currentSearch,
}: ShopClientPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allProducts, setAllProducts] = useState<ProductItem[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [isPending, startTransition] = useTransition();

  // Real-time synchronization with Firestore products collection
  useEffect(() => {
    try {
      const q = query(collection(db, "products"), where("isActive", "==", true));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const liveItems: ProductItem[] = snapshot.docs.map((d) => {
              const data = d.data();
              return {
                _id: d.id,
                name: data.name || "",
                price: Number(data.price) || 0,
                discountPrice:
                  data.discountPrice !== undefined && data.discountPrice !== null
                    ? Number(data.discountPrice)
                    : undefined,
                image: data.imageUrl || "/images/placeholder.webp",
                slug: data.slug || d.id,
                category: data.category || "General",
                categorySlug:
                  data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-"),
                createdAt: data.createdAt,
                pricingTierId: data.pricingTierId,
                pricingTierName: data.pricingTierName,
                pricingTiers: data.pricingTiers,
              };
            });
            setAllProducts(liveItems);
          }
        },
        (err) => {
          console.warn("Firestore real-time products listener error:", err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not attach real-time products listener:", e);
    }
  }, []);

  // Update when initialProducts changes
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setAllProducts((prev) => {
        // Keep live updates if already received
        return prev.length >= initialProducts.length ? prev : initialProducts;
      });
    }
  }, [initialProducts]);

  // Debounce for search input
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery !== currentSearch) {
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          if (searchQuery) {
            params.set("search", searchQuery);
          } else {
            params.delete("search");
          }
          params.set("page", "1");
          router.push(`?${params.toString()}`);
        });
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, router, searchParams, currentSearch, startTransition]);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", newSort);
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) {
      return;
    }
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`?${params.toString()}`);
    });
  };

  // Filtered and sorted products derived from live allProducts
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    const categoryParam = searchParams.get("category");
    if (categoryParam && categoryParam !== "all") {
      const lowerCat = categoryParam.toLowerCase();
      list = list.filter(
        (p) =>
          p.category?.toLowerCase() === lowerCat ||
          p.categorySlug?.toLowerCase() === lowerCat
      );
    }

    const term = (searchQuery || "").toLowerCase().trim();
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term)
      );
    }

    switch (currentSort) {
      case "price":
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date":
      default:
        list.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
        break;
    }

    return list;
  }, [allProducts, searchParams, searchQuery, currentSort]);

  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));

  const paginatedProducts = useMemo(() => {
    const skip = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(skip, skip + productsPerPage);
  }, [filteredProducts, currentPage, productsPerPage]);

  const startIndex = totalProducts === 0 ? 0 : (currentPage - 1) * productsPerPage + 1;
  const endIndex = Math.min(currentPage * productsPerPage, totalProducts);

  const renderPaginationNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    pageNumbers.push(1);
    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);

    if (currentPage > 4 && totalPages > 5) {
      pageNumbers.push("...");
    }
    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }
    if (currentPage < totalPages - 3 && totalPages > 5) {
      if (!pageNumbers.includes("...")) {
        pageNumbers.push("...");
      }
    }
    if (totalPages > 1 && !pageNumbers.includes(totalPages)) {
      pageNumbers.push(totalPages);
    }
    return Array.from(new Set(pageNumbers));
  };

  return (
    <section className="container py-12">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Side Panel */}
        <aside className="w-full lg:w-1/4 p-4 border border-gray-200 rounded-lg shadow-sm lg:sticky lg:top-24 h-fit">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Shop Filters</h3>

          {/* Search Input */}
          <div className="mb-6">
            <label
              htmlFor="product-search"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Search Products
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <Input
                id="product-search"
                type="text"
                placeholder="Search by name..."
                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-osvid-blue focus:border-osvid-blue"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Sorting Dropdown */}
          <div className="mb-6">
            <label
              htmlFor="sort-order"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Sort By
            </label>
            <select
              id="sort-order"
              name="orderby"
              className="orderby w-full border border-gray-300 py-2 px-4 text-base text-gray-700 rounded-md focus:ring-osvid-blue focus:border-osvid-blue transition-colors duration-200"
              aria-label="Shop order"
              onChange={handleSortChange}
              value={currentSort}
              disabled={isPending}
            >
              <option value="date">Latest (Newest First)</option>
              <option value="price">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>

          <BulkDiscount percentage={10} minItems={5} />
        </aside>

        {/* Main Content Area */}
        <div className="w-full lg:w-3/4">
          {/* Results count header */}
          <div className="flex items-center justify-between gap-4 py-2 mb-8 border-b border-gray-200">
            <div className="font-semibold shrink-0 text-gray-600">
              Showing {startIndex} - {endIndex} of {totalProducts} results
            </div>
          </div>

          {/* Product Grid */}
          {paginatedProducts.length === 0 ? (
            <p className="text-center text-gray-600 text-lg py-10">
              No products available at the moment for your selected criteria.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {paginatedProducts.map((product, i) => (
                <ProductCard
                  key={product._id || i}
                  product={{
                    id: product._id,
                    name: product.name,
                    price: product.price ?? 0,
                    discountPrice: product.discountPrice,
                    slug: product.slug ?? "",
                    image: product.image ?? "",
                    pricingTierId: product.pricingTierId,
                    pricingTierName: product.pricingTierName,
                    pricingTiers: product.pricingTiers,
                  }}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-16 flex justify-center items-center space-x-2">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
              >
                Previous
              </Button>

              {renderPaginationNumbers().map((pageNumber, index) => (
                <React.Fragment key={index}>
                  {pageNumber === "..." ? (
                    <span className="px-3 py-2 text-gray-700">...</span>
                  ) : (
                    <Button
                      onClick={() => handlePageChange(pageNumber as number)}
                      disabled={isPending}
                      className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                        pageNumber === currentPage
                          ? "bg-osvid-blue text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  )}
                </React.Fragment>
              ))}

              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
