"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import ProductCard from "@/components/reusables/cards/ProductCard";
import ProductCategoryCard from "@/components/reusables/cards/ProductCategoryCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Package,
  Layers,
  ArrowUpDown,
  FilterX,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getProductsFromDb } from "@/lib/firebase/firestore";
import CustomSelect, { CustomSelectOption } from "@/components/ui/custom-select";
import type { Product, ProductCategory } from "@/types";

const SORT_OPTIONS: CustomSelectOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Alphabetical (A–Z)" },
];

interface ProductsCatalogClientProps {
  initialProducts: any[];
  categories: any[];
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "concrete-admixtures": ["concrete", "admixture", "construction", "cement", "plastcrete"],
  "construction-chemicals": ["concrete", "admixture", "construction", "chemical"],
  "waterproofing-sealants": ["waterproof", "sealant", "aquablock", "membrane"],
  "epoxy-resins": ["epoxy", "resin", "floor", "3d", "epoxshield"],
  "grout-tile-care": ["tile", "grout", "adhesive"],
  "tile-adhesives": ["tile", "grout", "adhesive"],
  "industrial-adhesives": ["adhesive", "glue", "bond"],
  "industrial-chemicals": ["chemical", "solvent", "raw"],
};

function matchesCategory(productCategory: string = "", target: string = ""): boolean {
  if (!target || target === "all") return true;
  const pCat = productCategory.toLowerCase().trim();
  const tgt = target.toLowerCase().trim().replace(/-/g, " ");
  const tgtSlug = target.toLowerCase().trim().replace(/\s+/g, "-");

  if (pCat === tgt || pCat.replace(/-/g, " ") === tgt) return true;

  const synonyms = CATEGORY_SYNONYMS[tgtSlug] || [];
  for (const syn of synonyms) {
    if (pCat.includes(syn)) return true;
  }

  const keywords = tgt.split(/[\s&/,-]+/).filter((w) => w.length > 3);
  for (const kw of keywords) {
    if (pCat.includes(kw)) return true;
  }

  return false;
}

export default function ProductsCatalogClient({
  initialProducts,
  categories,
}: ProductsCatalogClientProps) {
  const [products, setProducts] = useState<any[]>(initialProducts || []);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Real-time synchronization with Firestore products collection
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    try {
      const colRef = collection(db, "products");
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const live: any[] = snapshot.docs
              .filter((d) => d.data().isActive !== false)
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  _id: d.id,
                  name: data.name || "",
                  slug: data.slug || d.id,
                  description: data.description || "",
                  price: Number(data.price) || 0,
                  discountPrice:
                    data.discountPrice !== undefined && data.discountPrice !== null
                      ? Number(data.discountPrice)
                      : undefined,
                  image: data.imageUrl || "/images/placeholder.webp",
                  imageUrl: data.imageUrl || "/images/placeholder.webp",
                  category: data.category || "General",
                  categorySlug:
                    data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-"),
                  createdAt: data.createdAt,
                  stockQuantity: Number(data.stockQuantity) || 0,
                  isFeatured: Boolean(data.isFeatured),
                  pricingTierId: data.pricingTierId,
                  pricingTierName: data.pricingTierName,
                  pricingTiers: data.pricingTiers,
                };
              });

            if (live.length > 0) {
              setProducts(live);
            }
          }
        },
        (err) => {
          console.warn("Real-time products onSnapshot subscription error:", err);
          // Fallback to direct client fetch
          getProductsFromDb().then((fetched) => {
            if (fetched && fetched.length > 0) {
              setProducts(fetched);
            }
          });
        }
      );
    } catch (e) {
      console.warn("Could not attach real-time products listener:", e);
    }

    return () => unsubscribe();
  }, []);

  // Compute available categories dynamically
  const availableCategories = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      { id: "all", label: "All Formulations", count: products.length },
    ];

    const catMap = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category || "General";
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });

    catMap.forEach((count, cat) => {
      list.push({ id: cat, label: cat, count });
    });

    return list;
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    if (selectedCategory && selectedCategory !== "all") {
      list = list.filter((p) => matchesCategory(p.category, selectedCategory));
    }

    // Search query filter
    const term = searchQuery.toLowerCase().trim();
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term)
      );
    }

    // Sort order
    switch (sortOrder) {
      case "price-asc":
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        break;
    }

    return list;
  }, [products, selectedCategory, searchQuery, sortOrder]);

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setSortOrder("newest");
  };

  return (
    <div className="space-y-12">
      {/* Category Pills Header Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Chemical Formulations &amp; Products
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Showing {filteredProducts.length} certified industrial chemical product(s) available in Nigeria
            </p>
          </div>

          {/* Quick Search & Sort Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                placeholder="Search formulations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 rounded-xl text-xs bg-white border-slate-200"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-44">
              <CustomSelect
                value={sortOrder}
                onChange={setSortOrder}
                options={SORT_OPTIONS}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Category Pills Scroller */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pt-1">
          {availableCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20 scale-102"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 max-w-lg mx-auto shadow-sm space-y-4">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
            <Package size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              No matching products found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No chemical products matched your active filter or search term. Try resetting your filters to view all products.
            </p>
          </div>
          <Button
            onClick={handleClearFilters}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold gap-2"
          >
            <FilterX size={14} /> Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p, idx) => (
            <ProductCard
              key={p.id || p._id || idx}
              index={idx}
              product={{
                id: p.id || p._id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                discountPrice: p.discountPrice,
                image: p.imageUrl || p.image,
                category: p.category,
                pricingTierId: p.pricingTierId,
                pricingTierName: p.pricingTierName,
                pricingTiers: p.pricingTiers,
              }}
            />
          ))}
        </div>
      )}

      {/* Secondary Section: Chemical Formulation Categories Overview */}
      {categories && categories.length > 0 && (
        <div className="pt-12 border-t border-slate-200/80 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Explore Formulations by Chemical Category
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed technical specifications, application notes, and category overviews
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <ProductCategoryCard
                key={category._id || category.id}
                category={category}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

