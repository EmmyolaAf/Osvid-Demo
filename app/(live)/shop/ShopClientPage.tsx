"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import ProductCard from "@/components/reusables/cards/ProductCard";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  Tag,
  ShieldCheck,
  Package,
  Layers,
  ArrowUpDown,
  FilterX,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getProductsFromDb } from "@/lib/firebase/firestore";
import CustomSelect, { CustomSelectOption } from "@/components/ui/custom-select";

const SHOP_SORT_OPTIONS: CustomSelectOption[] = [
  { value: "date", label: "Newest Arrivals" },
  { value: "price", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Alphabetical (A–Z)" },
  { value: "name-desc", label: "Alphabetical (Z–A)" },
];

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
  stockQuantity?: number;
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
  const [priceBracket, setPriceBracket] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Active category from URL search params
  const activeCategory = searchParams.get("category") || "all";

  // Real-time synchronization with Cloud Firestore products collection
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    // Initial direct fetch fallback if initialProducts was empty
    getProductsFromDb().then((fetched) => {
      if (fetched && fetched.length > 0) {
        setAllProducts((prev) => {
          const mapped: ProductItem[] = fetched.map((p) => ({
            _id: p.id,
            name: p.name,
            price: p.price,
            discountPrice: p.discountPrice,
            image: p.imageUrl || "/images/placeholder.webp",
            slug: p.slug,
            category: p.category,
            categorySlug: p.categorySlug,
            createdAt: p.createdAt,
            stockQuantity: p.stockQuantity,
            pricingTierId: p.pricingTierId,
            pricingTierName: p.pricingTierName,
            pricingTiers: p.pricingTiers,
          }));
          return prev.length >= mapped.length ? prev : mapped;
        });
      }
    });

    try {
      const colRef = collection(db, "products");
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const liveItems: ProductItem[] = snapshot.docs
              .filter((d) => d.data().isActive !== false)
              .map((d) => {
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
                  stockQuantity: Number(data.stockQuantity) || 0,
                  pricingTierId: data.pricingTierId,
                  pricingTierName: data.pricingTierName,
                  pricingTiers: data.pricingTiers,
                };
              });

            if (liveItems.length > 0) {
              setAllProducts(liveItems);
            }
          }
        },
        (err) => {
          console.warn("Firestore real-time products listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach real-time products listener:", e);
    }

    return () => unsubscribe();
  }, []);

  // Update when initialProducts changes
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setAllProducts((prev) => {
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
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, router, searchParams, currentSearch]);

  // Dynamically compute category counts from available products
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = { all: allProducts.length };
    allProducts.forEach((p) => {
      const cat = p.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allProducts]);

  const categoryList = useMemo(() => {
    const unique = Array.from(
      new Set(allProducts.map((p) => p.category).filter(Boolean) as string[])
    );
    return unique.sort();
  }, [allProducts]);

  const handleCategorySelect = (categoryName: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (categoryName === "all") {
        params.delete("category");
      } else {
        params.set("category", categoryName);
      }
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    });
  };

  const handleSortChange = (newSort: string) => {
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

  const handleClearFilters = () => {
    setSearchQuery("");
    setPriceBracket("all");
    setInStockOnly(false);
    startTransition(() => {
      router.push("/shop");
    });
  };

  // Filtered and sorted products derived from live allProducts
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // Category Filter
    if (activeCategory && activeCategory !== "all") {
      const lowerCat = activeCategory.toLowerCase();
      list = list.filter(
        (p) =>
          p.category?.toLowerCase() === lowerCat ||
          p.categorySlug?.toLowerCase() === lowerCat
      );
    }

    // Keyword Search
    const term = (searchQuery || "").toLowerCase().trim();
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term)
      );
    }

    // Price Bracket Filter
    if (priceBracket === "under-20k") {
      list = list.filter((p) => (p.price || 0) < 20000);
    } else if (priceBracket === "20k-50k") {
      list = list.filter((p) => (p.price || 0) >= 20000 && (p.price || 0) <= 50000);
    } else if (priceBracket === "above-50k") {
      list = list.filter((p) => (p.price || 0) > 50000);
    }

    // In Stock Only
    if (inStockOnly) {
      list = list.filter((p) => (p.stockQuantity ?? 1) > 0);
    }

    // Sorting
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
  }, [allProducts, activeCategory, searchQuery, priceBracket, inStockOnly, currentSort]);

  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));

  const paginatedProducts = useMemo(() => {
    const skip = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(skip, skip + productsPerPage);
  }, [filteredProducts, currentPage, productsPerPage]);

  const startIndex = totalProducts === 0 ? 0 : (currentPage - 1) * productsPerPage + 1;
  const endIndex = Math.min(currentPage * productsPerPage, totalProducts);

  const hasActiveFilters =
    activeCategory !== "all" ||
    Boolean(searchQuery) ||
    priceBracket !== "all" ||
    inStockOnly;

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
    <div className="bg-slate-50/60 min-h-screen py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Horizontal Category Carousel Navigation */}
        <div className="mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => handleCategorySelect("all")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                activeCategory === "all"
                  ? "bg-slate-900 text-white shadow-slate-900/20"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <Package size={13} />
              <span>All Products</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  activeCategory === "all"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {categoryStats["all"] || 0}
              </span>
            </button>

            {categoryList.map((cat) => {
              const isSelected =
                activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    isSelected
                      ? "bg-orange-600 text-white shadow-orange-600/20"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isSelected
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {categoryStats[cat] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout Grid: Sidebar Filters + Main Product Catalog */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Mobile Filter Button */}
          <div className="lg:hidden flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <Button
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              variant="outline"
              className="text-xs font-bold border-slate-200 gap-2 rounded-xl"
            >
              <SlidersHorizontal size={14} className="text-orange-600" />
              <span>{mobileFiltersOpen ? "Hide Filters" : "Filter Catalog"}</span>
            </Button>
            <span className="text-xs text-slate-500 font-medium">
              {totalProducts} products available
            </span>
          </div>

          {/* Desktop & Collapsible Mobile Sidebar */}
          <aside
            className={`lg:col-span-3 space-y-6 ${
              mobileFiltersOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-6 sticky top-24">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-orange-600" />
                  <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                    Filter Chemicals
                  </h3>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 transition-colors"
                  >
                    <FilterX size={12} />
                    Reset
                  </button>
                )}
              </div>

              {/* Keyword Search */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Product Search
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <Input
                    type="text"
                    placeholder="Search chemical name or code..."
                    className="pl-9 pr-8 h-10 rounded-xl text-xs bg-slate-50/70 border-slate-200 focus-visible:ring-orange-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Chemical Categories List */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Categories
                </label>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleCategorySelect("all")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      activeCategory === "all"
                        ? "bg-orange-50 text-orange-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>All Categories</span>
                    <span className="text-[11px] text-slate-400">
                      {categoryStats["all"] || 0}
                    </span>
                  </button>
                  {categoryList.map((cat) => {
                    const isSelected =
                      activeCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          isSelected
                            ? "bg-orange-50 text-orange-700 font-bold"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate pr-2">{cat}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {categoryStats[cat] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Range Presets */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Price Filter
                </label>
                <div className="space-y-1">
                  {[
                    { label: "All Prices", value: "all" },
                    { label: "Under ₦20,000", value: "under-20k" },
                    { label: "₦20,000 – ₦50,000", value: "20k-50k" },
                    { label: "Above ₦50,000", value: "above-50k" },
                  ].map((bracket) => (
                    <button
                      key={bracket.value}
                      type="button"
                      onClick={() => setPriceBracket(bracket.value)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        priceBracket === bracket.value
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{bracket.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability Toggle */}
              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-slate-800">
                    In-Stock Items Only
                  </span>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Wholesale Value Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-orange-950 font-black uppercase tracking-wider text-[11px]">
                  <Tag size={13} className="text-orange-600" />
                  <span>Wholesale Discount</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Automatic volume discount tiers apply when purchasing 5+ or 10+ units of industrial chemical formulations.
                </p>
                <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-orange-700">
                  <ShieldCheck size={13} />
                  <span>Standard Lab Formulations</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Product Catalog Area */}
          <main className="lg:col-span-9 space-y-6">
            {/* Catalog Action & Control Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Product Counter */}
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  Showing <strong className="text-slate-950 font-extrabold">{startIndex}–{endIndex}</strong> of{" "}
                  <strong className="text-slate-950 font-extrabold">{totalProducts}</strong> products
                </span>
                {isPending && (
                  <span className="text-xs text-orange-600 animate-pulse font-medium">
                    (Updating...)
                  </span>
                )}
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold shrink-0">
                  <ArrowUpDown size={14} className="text-slate-400" />
                  <span>Sort by:</span>
                </div>
                <div className="flex-1 sm:w-48">
                  <CustomSelect
                    value={currentSort}
                    onChange={handleSortChange}
                    options={SHOP_SORT_OPTIONS}
                    disabled={isPending}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Badges Row */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium mr-1">
                  Active filters:
                </span>
                {activeCategory !== "all" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                    Category: {activeCategory}
                    <button
                      onClick={() => handleCategorySelect("all")}
                      className="hover:text-orange-950 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Search: &ldquo;{searchQuery}&rdquo;
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:text-slate-950 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {priceBracket !== "all" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Price: {priceBracket}
                    <button
                      onClick={() => setPriceBracket("all")}
                      className="hover:text-slate-950 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    In-Stock Only
                    <button
                      onClick={() => setInStockOnly(false)}
                      className="hover:text-emerald-950 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-slate-500 hover:text-orange-600 font-bold underline ml-2"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Product Grid */}
            {paginatedProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-sm space-y-4">
                <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                  <Package size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    No Matching Chemical Products Found
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    We couldn&apos;t find any formulations matching your active filters. Try adjusting your search keyword or clearing filters.
                  </p>
                </div>
                <Button
                  onClick={handleClearFilters}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-10 px-6 gap-2"
                >
                  <FilterX size={14} />
                  Reset Catalog Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
                      category: product.category,
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
              <div className="pt-8 flex justify-center items-center gap-1.5">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isPending}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Previous
                </Button>

                {renderPaginationNumbers().map((pageNumber, index) => (
                  <React.Fragment key={index}>
                    {pageNumber === "..." ? (
                      <span className="px-2.5 text-xs text-slate-400 font-bold">
                        ...
                      </span>
                    ) : (
                      <Button
                        onClick={() => handlePageChange(pageNumber as number)}
                        disabled={isPending}
                        size="sm"
                        className={`h-9 w-9 rounded-xl text-xs font-bold transition-all ${
                          pageNumber === currentPage
                            ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                            : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
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
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Next
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
