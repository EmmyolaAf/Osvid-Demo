"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/client";
import {
  getProductsFromDb,
  saveProductToDb,
  updateProductStockInDb,
  adjustProductStockViaApi,
  deleteProductFromDb,
  getCategoriesFromDb,
  saveCategoryToDb,
  deleteCategoryFromDb,
} from "@/lib/firebase/firestore";
import { Product, ProductCategory, normalizeManagerPermissions } from "@/types/auth";
import { InventoryMovement, InventoryMovementType } from "@/types/inventory";
import {
  Package,
  Plus,
  Trash2,
  Edit,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  FolderTree,
  Tag,
  Link as LinkIcon,
  X,
  Sparkles,
  Layers,
  ArrowUpDown,
  Filter,
  Lock,
  History,
  SlidersHorizontal,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Image from "next/image";

export default function ProductsManagementPage() {
  const { isAdmin, isSuperAdmin, userProfile } = useAuth();
  const perms = userProfile?.permissions ? normalizeManagerPermissions(userProfile.permissions) : undefined;
  const canManageProducts = isSuperAdmin || isAdmin || Boolean(perms?.canManageProducts);
  const canManageInventory = isSuperAdmin || isAdmin || Boolean(perms?.canManageInventory);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");

  // Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "out">("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: "",
    discountPrice: "",
    stockQuantity: "50",
    unit: "kg",
    sku: "",
    imageUrl: "/images/placeholder.webp",
    description: "",
    featuresText: "",
    suggestedProductIds: [] as string[],
  });

  // Dedicated Adjust Stock Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryMovementType>("restock");
  const [adjustUnits, setAdjustUnits] = useState("10");
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Inventory Ledger / Movement History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyMovements, setHistoryMovements] = useState<InventoryMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
  });

  // Load All Data Directly from Firestore
  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedProducts, fetchedCategories] = await Promise.all([
        getProductsFromDb(),
        getCategoriesFromDb(),
      ]);

      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
    } catch (err: any) {
      console.error("Error loading products/categories:", err);
      toast.error(err?.message || "Failed to load catalog from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format Currency
  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // ==========================================
  // PRODUCT HANDLERS
  // ==========================================

  const openAddProductModal = () => {
    setEditingProduct(null);
    const defaultCat = categories.length > 0 ? categories[0].name : "Industrial Chemicals";
    setProductForm({
      name: "",
      category: defaultCat,
      price: "",
      discountPrice: "",
      stockQuantity: canManageInventory ? "50" : "0",
      unit: "kg",
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      imageUrl: "/images/placeholder.webp",
      description: "",
      featuresText: "",
      suggestedProductIds: [],
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category || (categories[0]?.name || "Industrial Chemicals"),
      price: p.price.toString(),
      discountPrice: p.discountPrice ? p.discountPrice.toString() : "",
      stockQuantity: (p.stockQuantity ?? 0).toString(),
      unit: p.unit || "kg",
      sku: p.sku || "",
      imageUrl: p.imageUrl || "/images/placeholder.webp",
      description: p.description || "",
      featuresText: Array.isArray(p.features) ? p.features.join("\n") : "",
      suggestedProductIds: Array.isArray(p.suggestedProductIds) ? p.suggestedProductIds : [],
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast.error("Please provide a product name.");
      return;
    }
    const numPrice = parseFloat(productForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid product price.");
      return;
    }

    try {
      setSubmittingProduct(true);
      const featuresArray = productForm.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const isEditing = Boolean(editingProduct?.id);
      const initialStock = canManageInventory ? (parseInt(productForm.stockQuantity, 10) || 0) : 0;

      const result = await saveProductToDb(
        {
          id: editingProduct?.id,
          name: productForm.name.trim(),
          category: productForm.category.trim(),
          price: numPrice,
          discountPrice: productForm.discountPrice ? parseFloat(productForm.discountPrice) : undefined,
          stockQuantity: 0,
          unit: productForm.unit.trim() || "kg",
          sku: productForm.sku.trim(),
          imageUrl: productForm.imageUrl.trim() || "/images/placeholder.webp",
          description: productForm.description.trim(),
          features: featuresArray,
          suggestedProductIds: productForm.suggestedProductIds,
          isActive: true,
        },
        { omitStock: isEditing }
      );

      if (!result.success) {
        toast.error(result.error || "Failed to save product document in Firestore.");
        return;
      }

      if (!isEditing && initialStock > 0 && canManageInventory && result.data?.id) {
        const prodId = result.data.id;
        const adjResult = await adjustProductStockViaApi(
          prodId,
          initialStock,
          "initial_stock",
          "Initial product stock recorded upon creation"
        );
        if (!adjResult.success) {
          toast.warning(
            `Product created with stock 0, but initial stock ledger entry failed: ${adjResult.error}. Please adjust stock using the inventory controls.`
          );
        }
      }

      toast.success(
        editingProduct
          ? `Product "${result.data?.name}" updated successfully in database!`
          : `Product "${result.data?.name}" added to live catalog!`
      );
      setIsProductModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "An unexpected database error occurred.");
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleQuickStockChange = async (productId: string, currentStock: number, delta: number) => {
    if (currentStock + delta < 0) {
      toast.error(`Cannot reduce stock below 0. Current stock is ${currentStock}.`);
      return;
    }
    try {
      const result = await adjustProductStockViaApi(
        productId,
        delta,
        "manual_adjustment",
        "Quick adjustment from Products & Stock dashboard"
      );
      if (!result.success) {
        toast.error(result.error || "Failed to update stock via inventory ledger.");
        return;
      }
      const newStock = result.data?.newStock ?? (currentStock + delta);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stockQuantity: newStock } : p))
      );
      toast.success(`Stock level adjusted to ${newStock}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stock quantity.");
    }
  };

  const openAdjustStockModal = (product: Product) => {
    setAdjustProduct(product);
    setAdjustType("restock");
    setAdjustUnits("10");
    setAdjustReason("");
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;
    const units = parseInt(adjustUnits, 10);
    if (isNaN(units) || units <= 0) {
      toast.error("Please enter a valid positive quantity.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Please provide a note or reason for this stock adjustment.");
      return;
    }

    let delta = units;
    if (adjustType === "damaged") {
      delta = -units;
    }

    if (adjustProduct.stockQuantity + delta < 0) {
      toast.error(`Adjustment would result in negative stock. Current stock is ${adjustProduct.stockQuantity}.`);
      return;
    }

    try {
      setSubmittingAdjust(true);
      const result = await adjustProductStockViaApi(
        adjustProduct.id,
        delta,
        adjustType,
        adjustReason.trim()
      );
      if (!result.success) {
        toast.error(result.error || "Failed to adjust stock.");
        return;
      }

      const updatedStock = result.data?.newStock ?? (adjustProduct.stockQuantity + delta);
      setProducts((prev) =>
        prev.map((p) => (p.id === adjustProduct.id ? { ...p, stockQuantity: updatedStock } : p))
      );
      toast.success(`Inventory adjusted to ${updatedStock} (${adjustType}).`);
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to adjust stock.");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const openHistoryModal = async (productId?: string) => {
    setHistoryProductId(productId || null);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required to view inventory history.");
        return;
      }
      const url = `/api/admin/inventory/history?limit=50${productId ? `&productId=${productId}` : ""}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to load inventory history.");
        return;
      }
      setHistoryMovements(data.movements || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch inventory ledger records.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteProduct = async (productId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from Firestore? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteProductFromDb(productId);
      if (!result.success) {
        toast.error(result.error || "Failed to delete product from database.");
        return;
      }
      toast.success(`Product "${name}" deleted from database.`);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete product.");
    }
  };

  const toggleSuggestedProduct = (targetId: string) => {
    setProductForm((prev) => {
      const exists = prev.suggestedProductIds.includes(targetId);
      const updated = exists
        ? prev.suggestedProductIds.filter((id) => id !== targetId)
        : [...prev.suggestedProductIds, targetId];
      return { ...prev, suggestedProductIds: updated };
    });
  };

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      imageUrl: "",
    });
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || "",
      imageUrl: cat.imageUrl || "",
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Please enter a category name.");
      return;
    }

    try {
      setSubmittingCategory(true);
      const result = await saveCategoryToDb({
        id: editingCategory?.id,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        imageUrl: categoryForm.imageUrl.trim(),
        isActive: true,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to save category to database.");
        return;
      }

      toast.success(
        editingCategory
          ? `Category "${result.data?.name}" updated!`
          : `New category "${result.data?.name}" created in Firestore!`
      );
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to commit category.");
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`Delete category "${catName}"? This will not delete associated products.`)) {
      return;
    }

    try {
      const result = await deleteCategoryFromDb(catId);
      if (!result.success) {
        toast.error(result.error || "Failed to delete category.");
        return;
      }
      toast.success(`Category "${catName}" deleted from database.`);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete category.");
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategoryFilter !== "all" && p.category !== selectedCategoryFilter) {
      return false;
    }

    if (filterStock === "low") return p.stockQuantity > 0 && p.stockQuantity < 10;
    if (filterStock === "out") return p.stockQuantity <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Package size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Inventory &amp; Products</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Direct Firestore database management for chemical catalog, categories &amp; cross-sells
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab("products")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "products"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Products ({products.length})
            </button>
            {canManageProducts && (
              <button
                onClick={() => setActiveTab("categories")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "categories"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Categories ({categories.length})
              </button>
            )}
          </div>

          {canManageInventory && activeTab === "products" && (
            <Button
              variant="outline"
              onClick={() => openHistoryModal()}
              className="border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 h-10 px-3.5 text-xs shadow-sm"
            >
              <History size={15} className="text-orange-600" />
              <span>Stock Ledger</span>
            </Button>
          )}

          {canManageProducts && (
            activeTab === "products" ? (
              <Button
                onClick={openAddProductModal}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>Add Product</span>
              </Button>
            ) : (
              <Button
                onClick={openAddCategoryModal}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-2 h-10 px-4 text-xs"
              >
                <Plus size={16} />
                <span>New Category</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PRODUCTS INVENTORY */}
      {/* ======================================================== */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by chemical name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-orange-500"
                />
              </div>

              {/* Category Filter Dropdown */}
              {categories.length > 0 && (
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-orange-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Stock Level Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Button
                size="sm"
                variant={filterStock === "all" ? "default" : "outline"}
                onClick={() => setFilterStock("all")}
                className={`text-xs rounded-xl h-8 px-3 ${
                  filterStock === "all" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                All ({products.length})
              </Button>
              <Button
                size="sm"
                variant={filterStock === "low" ? "default" : "outline"}
                onClick={() => setFilterStock("low")}
                className={`text-xs rounded-xl h-8 px-3 ${
                  filterStock === "low"
                    ? "bg-amber-500 text-white"
                    : "text-amber-700 border-amber-200 bg-amber-50"
                }`}
              >
                Low Stock (&lt;10)
              </Button>
              <Button
                size="sm"
                variant={filterStock === "out" ? "default" : "outline"}
                onClick={() => setFilterStock("out")}
                className={`text-xs rounded-xl h-8 px-3 ${
                  filterStock === "out"
                    ? "bg-red-600 text-white"
                    : "text-red-700 border-red-200 bg-red-50"
                }`}
              >
                Out of Stock
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Fetching catalog from Firestore...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center px-4">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No products match your criteria</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add chemical items to your database or clear current search filters.
                </p>
                <Button
                  onClick={openAddProductModal}
                  variant="outline"
                  className="text-xs font-semibold rounded-xl"
                >
                  <Plus size={14} className="mr-1.5" />
                  Add First Product
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                    <tr>
                      <th className="py-3.5 px-5">Product</th>
                      <th className="py-3.5 px-5">Category</th>
                      <th className="py-3.5 px-5">Price (NGN)</th>
                      <th className="py-3.5 px-5">Stock Level</th>
                      <th className="py-3.5 px-5">Cross-Sells</th>
                      <th className="py-3.5 px-5">Quick Adjust</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => {
                      const isLow = p.stockQuantity > 0 && p.stockQuantity < 10;
                      const isOut = p.stockQuantity <= 0;
                      const crossSellCount = Array.isArray(p.suggestedProductIds)
                        ? p.suggestedProductIds.length
                        : 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                                {p.imageUrl && p.imageUrl.startsWith("http") ? (
                                  <Image
                                    src={p.imageUrl}
                                    alt={p.name}
                                    width={44}
                                    height={44}
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <Package size={20} className="text-slate-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-xs sm:text-sm">{p.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {p.sku || "No SKU"} • {p.unit || "kg"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-5">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                              {p.category || "General"}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 font-bold text-slate-900 text-xs sm:text-sm">
                            {formatNaira(p.price)}
                            {p.discountPrice && (
                              <span className="block text-[10px] text-slate-400 line-through font-normal">
                                {formatNaira(p.discountPrice)}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-5">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                                <XCircle size={12} /> Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-700">
                                <AlertTriangle size={12} /> Low ({p.stockQuantity} {p.unit})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle size={12} /> {p.stockQuantity} {p.unit}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-5">
                            {crossSellCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <LinkIcon size={11} /> {crossSellCount} linked
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-normal">None</span>
                            )}
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => canManageInventory && handleQuickStockChange(p.id, p.stockQuantity, -10)}
                                disabled={!canManageInventory}
                                className={`w-6 h-6 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center justify-center transition-colors ${
                                  canManageInventory
                                    ? "hover:bg-slate-100 text-slate-600"
                                    : "opacity-40 cursor-not-allowed text-slate-400"
                                }`}
                                title={canManageInventory ? "Decrease by 10" : "Requires Inventory Management permission"}
                              >
                                -10
                              </button>
                              <button
                                onClick={() => canManageInventory && handleQuickStockChange(p.id, p.stockQuantity, -1)}
                                disabled={!canManageInventory}
                                className={`w-6 h-6 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center justify-center transition-colors ${
                                  canManageInventory
                                    ? "hover:bg-slate-100 text-slate-600"
                                    : "opacity-40 cursor-not-allowed text-slate-400"
                                }`}
                                title={canManageInventory ? "Decrease by 1" : "Requires Inventory Management permission"}
                              >
                                -1
                              </button>
                              <span className="px-1.5 font-mono font-bold text-xs text-slate-800">
                                {p.stockQuantity}
                              </span>
                              <button
                                onClick={() => canManageInventory && handleQuickStockChange(p.id, p.stockQuantity, 1)}
                                disabled={!canManageInventory}
                                className={`w-6 h-6 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center justify-center transition-colors ${
                                  canManageInventory
                                    ? "hover:bg-slate-100 text-slate-600"
                                    : "opacity-40 cursor-not-allowed text-slate-400"
                                }`}
                                title={canManageInventory ? "Increase by 1" : "Requires Inventory Management permission"}
                              >
                                +1
                              </button>
                              <button
                                onClick={() => canManageInventory && handleQuickStockChange(p.id, p.stockQuantity, 10)}
                                disabled={!canManageInventory}
                                className={`w-6 h-6 rounded-lg border text-[11px] font-bold flex items-center justify-center transition-colors ${
                                  canManageInventory
                                    ? "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600"
                                    : "border-slate-200 opacity-40 cursor-not-allowed text-slate-400"
                                }`}
                                title={canManageInventory ? "Add 10" : "Requires Inventory Management permission"}
                              >
                                +10
                              </button>
                              {canManageInventory && (
                                <button
                                  onClick={() => openAdjustStockModal(p)}
                                  className="ml-1.5 px-2 h-6 rounded-lg border border-slate-300 hover:border-orange-300 hover:bg-orange-50 text-[11px] font-semibold text-slate-700 hover:text-orange-700 flex items-center gap-1 transition-colors"
                                  title="Deliberate stock adjustment (Restock, Correction, Damaged)"
                                >
                                  <SlidersHorizontal size={11} />
                                  <span>Adjust</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canManageInventory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openHistoryModal(p.id)}
                                  className="text-xs h-8 w-8 p-0 text-slate-500 hover:text-orange-600 rounded-lg"
                                  title={`View Stock History for ${p.name}`}
                                >
                                  <History size={14} />
                                </Button>
                              )}
                              {canManageProducts ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditProductModal(p)}
                                    className="text-xs h-8 w-8 p-0 text-slate-600 hover:text-slate-900 rounded-lg"
                                    title="Edit Product"
                                  >
                                    <Edit size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteProduct(p.id, p.name)}
                                    className="text-xs h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Delete Product"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium italic">
                                  Stock Only
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CATEGORY MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-6">
                <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No categories created</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add chemical categories to organize products in the catalog and storefront.
                </p>
                <Button
                  onClick={openAddCategoryModal}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl"
                >
                  <Plus size={14} className="mr-1.5" />
                  Create Category
                </Button>
              </div>
            ) : (
              categories.map((c) => {
                const count = products.filter((p) => p.category === c.name).length;
                return (
                  <div
                    key={c.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center font-bold text-sm">
                            <Tag size={16} />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{c.name}</h3>
                            <p className="text-[11px] text-slate-400 font-mono">/{c.slug}</p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {count} {count === 1 ? "product" : "products"}
                        </span>
                      </div>

                      {c.description && (
                        <p className="text-xs text-slate-500 mt-3 line-clamp-2">{c.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditCategoryModal(c)}
                        className="text-xs h-8 rounded-lg"
                      >
                        <Edit size={13} className="mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(c.id, c.name)}
                        className="text-xs h-8 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRODUCT ADD / EDIT MODAL */}
      {/* ======================================================== */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="text-orange-600 w-5 h-5" />
              {editingProduct ? "Edit Chemical Product" : "Add New Chemical Product"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Directly saves to Firestore <span className="font-mono font-bold">products</span> collection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Product Name *</Label>
              <Input
                required
                placeholder="e.g. Industrial Sulfuric Acid 98%"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="mt-1 h-10 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Category *</Label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  {categories.length === 0 && (
                    <option value="Industrial Chemicals">Industrial Chemicals</option>
                  )}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Measurement Unit</Label>
                <Input
                  placeholder="kg, Litres, Drums, Bags"
                  value={productForm.unit}
                  onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">SKU Code</Label>
                <Input
                  placeholder="SKU-88210"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Unit Price (NGN) *</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  placeholder="50000"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Discounted Price (NGN)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Optional promo price"
                  value={productForm.discountPrice}
                  onChange={(e) => setProductForm({ ...productForm, discountPrice: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">
                  {editingProduct ? "Current Stock Units (Read-only)" : "Initial Stock Units *"}
                </Label>
                <Input
                  type="number"
                  required
                  min={0}
                  placeholder={canManageInventory ? "50" : "0"}
                  value={
                    editingProduct
                      ? (editingProduct.stockQuantity ?? 0).toString()
                      : (canManageInventory ? productForm.stockQuantity : "0")
                  }
                  disabled={Boolean(editingProduct) || !canManageInventory}
                  onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                  className={`mt-1 h-10 rounded-xl text-sm ${
                    editingProduct || !canManageInventory
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : ""
                  }`}
                />
                {editingProduct ? (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <Lock size={12} /> Stock is read-only in product editing. Use Adjust Stock / quick controls to record ledger movements.
                  </p>
                ) : !canManageInventory ? (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <Lock size={12} /> Stock initialization requires Inventory authority. Product will be created with stock 0.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                    Initial stock will be recorded in the immutable inventory ledger upon creation.
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Image URL</Label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={productForm.imageUrl}
                onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                className="mt-1 h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Product Description</Label>
              <textarea
                rows={3}
                placeholder="Industrial chemical specifications, grade, and handling instructions..."
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Key Features (1 per line)</Label>
              <textarea
                rows={2}
                placeholder="99.5% Purity Grade&#10;Corrosion Resistant Formulation&#10;ISO 9001 Certified Quality"
                value={productForm.featuresText}
                onChange={(e) => setProductForm({ ...productForm, featuresText: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
              />
            </div>

            {/* Suggested / Cross-Sell Products Multi-Selector */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <LinkIcon size={14} className="text-orange-600" />
                    Suggested &amp; Cross-Sell Products
                  </Label>
                  <p className="text-[11px] text-slate-400">
                    Select related chemical items to recommend on this product&apos;s detail page
                  </p>
                </div>
                <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                  {productForm.suggestedProductIds.length} selected
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50/50">
                {products
                  .filter((p) => p.id !== editingProduct?.id)
                  .map((p) => {
                    const isSelected = productForm.suggestedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSuggestedProduct(p.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                          isSelected
                            ? "bg-orange-50 border border-orange-200 text-orange-950 font-bold"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded text-orange-600 focus:ring-0"
                          />
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatNaira(p.price)}
                        </span>
                      </div>
                    );
                  })}
                {products.filter((p) => p.id !== editingProduct?.id).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    No other products available in catalog to link.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProductModalOpen(false)}
                disabled={submittingProduct}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingProduct}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 px-5"
              >
                {submittingProduct ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingProduct ? (
                  "Update Product"
                ) : (
                  "Create Product"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* CATEGORY ADD / EDIT MODAL */}
      {/* ======================================================== */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="text-orange-600 w-5 h-5" />
              {editingCategory ? "Edit Category" : "Add Chemical Category"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Saves category to Firestore <span className="font-mono font-bold">categories</span> collection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Category Name *</Label>
              <Input
                required
                placeholder="e.g. Industrial Adhesives &amp; Sealants"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="mt-1 h-10 rounded-xl text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Description</Label>
              <textarea
                rows={3}
                placeholder="Scope of chemicals, solvent specifications, and application sectors..."
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Category Image URL</Label>
              <Input
                placeholder="https://..."
                value={categoryForm.imageUrl}
                onChange={(e) => setCategoryForm({ ...categoryForm, imageUrl: e.target.value })}
                className="mt-1 h-10 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={submittingCategory}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingCategory}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20"
              >
                {submittingCategory ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingCategory ? (
                  "Save Changes"
                ) : (
                  "Create Category"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 3: DELIBERATE ADJUST STOCK MODAL */}
      {/* ======================================================== */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6 sm:p-8">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-orange-600" />
              Adjust Inventory Stock
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Submit a recorded stock adjustment to the append-only inventory ledger.
            </DialogDescription>
          </DialogHeader>

          {adjustProduct && (
            <form onSubmit={handleSaveAdjustStock} className="space-y-4 pt-2">
              {/* Product Overview Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{adjustProduct.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {adjustProduct.sku || "No SKU"} • {adjustProduct.category}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Current Stock</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {adjustProduct.stockQuantity} {adjustProduct.unit || "units"}
                  </span>
                </div>
              </div>

              {/* Adjustment Type */}
              <div>
                <Label className="text-xs font-bold text-slate-700">Movement Type *</Label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryMovementType)}
                  className="mt-1 w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-orange-500 font-medium"
                >
                  <option value="restock">Restock (Adding units to warehouse)</option>
                  <option value="correction">Inventory Correction (Count reconciliation)</option>
                  <option value="damaged">Damaged Stock (Removing damaged units)</option>
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <Label className="text-xs font-bold text-slate-700">
                  {adjustType === "damaged" ? "Units Damaged (will be deducted) *" : "Units Count *"}
                </Label>
                <Input
                  type="number"
                  min={1}
                  required
                  placeholder="10"
                  value={adjustUnits}
                  onChange={(e) => setAdjustUnits(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-sm font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Resulting stock level:{" "}
                  <span className="font-bold text-slate-900">
                    {Math.max(
                      0,
                      adjustProduct.stockQuantity +
                        (adjustType === "damaged"
                          ? -(parseInt(adjustUnits, 10) || 0)
                          : parseInt(adjustUnits, 10) || 0)
                    )}{" "}
                    {adjustProduct.unit || "units"}
                  </span>
                </p>
              </div>

              {/* Reason / Note */}
              <div>
                <Label className="text-xs font-bold text-slate-700">Ledger Reason / Note *</Label>
                <textarea
                  rows={2}
                  required
                  placeholder={
                    adjustType === "restock"
                      ? "e.g. Received new shipment from supplier batch #829"
                      : adjustType === "damaged"
                      ? "e.g. Damaged during warehouse transport / broken seals"
                      : "e.g. Physical stock count reconciliation"
                  }
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={submittingAdjust}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAdjust}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20"
                >
                  {submittingAdjust ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Commit Stock Adjustment"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 4: INVENTORY HISTORY LEDGER MODAL */}
      {/* ======================================================== */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-3xl bg-white rounded-3xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <History size={20} className="text-orange-600" />
                Inventory Movement Ledger
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openHistoryModal(historyProductId || undefined)}
                disabled={loadingHistory}
                className="text-xs h-8 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <RefreshCw size={13} className={`mr-1 ${loadingHistory ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {historyProductId
                ? `Immutable movement ledger for: ${products.find((p) => p.id === historyProductId)?.name || historyProductId}`
                : "Append-only movement ledger across all products (newest first)."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingHistory ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-7 h-7 text-orange-600 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Loading ledger movements...</p>
              </div>
            ) : historyMovements.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No inventory movements recorded yet.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[55vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Date / Time</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Delta</th>
                        <th className="py-2.5 px-3 text-right">Stock</th>
                        <th className="py-2.5 px-3">Staff Actor</th>
                        <th className="py-2.5 px-3">Note / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyMovements.map((m) => {
                        const isPositive = m.delta > 0;
                        const isNegative = m.delta < 0;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                              {new Date(m.createdAtIso).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900">{m.productName}</p>
                              {m.sku && <p className="text-[10px] font-mono text-slate-400">{m.sku}</p>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  m.type === "initial_stock" || m.type === "restock"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : m.type === "damaged"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : m.type === "sale"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {m.type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold">
                              <span
                                className={
                                  isPositive
                                    ? "text-emerald-600"
                                    : isNegative
                                    ? "text-red-600"
                                    : "text-slate-600"
                                }
                              >
                                {isPositive ? `+${m.delta}` : m.delta}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-slate-600 text-[11px] font-mono">
                              {m.previousStock} &rarr; <span className="font-bold text-slate-900">{m.newStock}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <p className="text-slate-800 font-medium text-[11px]">{m.actorEmail}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{m.actorRole}</p>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={m.reason}>
                              {m.reason || "—"}
                              {m.orderId && (
                                <span className="block text-[10px] font-mono text-slate-400">
                                  Order #{m.orderId.slice(0, 8)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
