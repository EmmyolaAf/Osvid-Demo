// src/components/shop/ShopClientPage.tsx
"use client";

import React, { useState, useEffect, useTransition } from "react";
import ProductCard from "@/components/reusables/cards/ProductCard";
import { Button } from "@/components/ui/button"; // Assuming Button component is available
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProductCardSkeleton from "@/components/reusables/skeletons/ProductCardSkeleton";
import { BulkDiscount } from "@/components/reusables/CompactBulkOrder";

interface ProductItem {
  _id: string;
  name: string;
  price?: number;
  discountPrice?: number;
  image?: string;
  slug?: string;
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
  totalProducts,
  productsPerPage,
  currentPage,
  currentSort,
  currentSearch,
}: ShopClientPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [isPending, startTransition] = useTransition();

  // Calculate total pages
  const totalPages = Math.ceil(totalProducts / productsPerPage);

  // Update products state when initialProducts from server changes (due to URL update)
  useEffect(() => {
    setProducts(initialProducts);
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
          params.set("page", "1"); // Reset to page 1 on search change
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
      params.set("page", "1"); // Reset to page 1 on sort change
      router.push(`?${params.toString()}`);
    });
  };

  // New: Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) {
      return; // Prevent navigating to invalid or current page
    }
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`?${params.toString()}`);
    });
  };

  const startIndex = (currentPage - 1) * productsPerPage + 1;
  const endIndex = Math.min(currentPage * productsPerPage, totalProducts);

  // Determine which page numbers to display
  const renderPaginationNumbers = () => {
    const pageNumbers = [];
    // Always show first page
    pageNumbers.push(1);

    // Determine a range around the current page
    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);

    if (currentPage > 4 && totalPages > 5) {
      // Show ellipsis if current page is far from start
      pageNumbers.push("...");
    }

    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }

    if (currentPage < totalPages - 3 && totalPages > 5) {
      // Show ellipsis if current page is far from end
      if (!pageNumbers.includes("...")) {
        // Avoid duplicate ellipses
        pageNumbers.push("...");
      }
    }

    // Always show last page if not already in range and total pages > 1
    if (totalPages > 1 && !pageNumbers.includes(totalPages)) {
      pageNumbers.push(totalPages);
    }

    // Filter out duplicates and ensure correct order for ellipses
    const uniquePageNumbers = Array.from(new Set(pageNumbers)); // Removes duplicates if e.g. 1 and ... overlap
    uniquePageNumbers.sort((a, b) => {
      if (a === "...") return 1; // Send "..." to end for sorting
      if (b === "...") return -1;
      return (a as number) - (b as number);
    });

    // Simple filter to ensure no adjacent ellipses
    const finalPageNumbers: (number | string)[] = [];
    for (let i = 0; i < uniquePageNumbers.length; i++) {
      if (
        uniquePageNumbers[i] === "..." &&
        uniquePageNumbers[i - 1] === "..."
      ) {
        continue;
      }
      finalPageNumbers.push(uniquePageNumbers[i]);
    }

    return finalPageNumbers;
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
              <option value="price">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="date">Latest (by Last Updated)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="popularity">Popularity (Placeholder)</option>
              <option value="rating">Average Rating (Placeholder)</option>
            </select>
          </div>

          {/* Other filters can go here */}

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
          {isPending && initialProducts.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
              {Array.from({ length: productsPerPage }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 && !isPending ? (
            <p className="text-center text-gray-600 text-lg py-10">
              No products available at the moment for your selected criteria.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {products.map((product, i) => (
                <ProductCard
                  key={i}
                  product={{
                    ...product,
                    id: product._id, // Map _id to id for ProductCard
                    price: product.price ?? 0, // Ensure price is always a number
                    slug: product.slug ?? "", // Ensure slug is always a string
                    image: product.image ?? "", // Ensure image is always a string
                  }}
                  index={i}
                />
              ))}
              {/* Skeletons for pending state when new products are loading on same page (e.g. from search/sort) */}
              {isPending &&
                initialProducts.length > 0 &&
                Array.from({ length: productsPerPage }).map((_, i) => (
                  <ProductCardSkeleton key={`skeleton-${i}`} />
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
