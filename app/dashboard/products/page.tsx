"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProductsFromDb,
  saveProductToDb,
  updateProductStockInDb,
  deleteProductFromDb,
} from "@/lib/firebase/firestore";
import { Product } from "@/types/auth";
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
  DollarSign,
  Layers,
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
  const { role, isAdmin, isManager } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "out">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Industrial Chemicals",
    price: "",
    discountPrice: "",
    stockQuantity: "50",
    unit: "kg",
    description: "",
    imageUrl: "/images/placeholder.webp",
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      const list = await getProductsFromDb();
      setProducts(list);
    } catch (err) {
      console.error("Error loading products:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      category: "Industrial Chemicals",
      price: "",
      discountPrice: "",
      stockQuantity: "50",
      unit: "kg",
      description: "",
      imageUrl: "/images/placeholder.webp",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      category: p.category,
      price: p.price.toString(),
      discountPrice: p.discountPrice ? p.discountPrice.toString() : "",
      stockQuantity: p.stockQuantity.toString(),
      unit: p.unit || "kg",
      description: p.description || "",
      imageUrl: p.imageUrl || "/images/placeholder.webp",
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error("Please provide product name and price");
      return;
    }

    try {
      setSubmitting(true);
      await saveProductToDb({
        id: editingProduct?.id,
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : undefined,
        stockQuantity: parseInt(formData.stockQuantity) || 0,
        unit: formData.unit,
        description: formData.description,
        imageUrl: formData.imageUrl,
        isActive: true,
      });

      toast.success(editingProduct ? "Product updated!" : "Product added to catalog!");
      setIsModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStockChange = async (productId: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      await updateProductStockInDb(productId, newStock);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stockQuantity: newStock } : p))
      );
      toast.success("Stock updated!");
    } catch (err: any) {
      toast.error("Failed to update stock level");
    }
  };

  const handleDeleteProduct = async (productId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;

    try {
      await deleteProductFromDb(productId);
      toast.success("Product deleted successfully");
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err: any) {
      toast.error("Failed to delete product");
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterStock === "low") return p.stockQuantity > 0 && p.stockQuantity < 10;
    if (filterStock === "out") return p.stockQuantity <= 0;
    return true;
  });

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Package size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Product Inventory</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time chemical product catalog & stock replenishment
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={openAddModal}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-2 h-11"
          >
            <Plus size={18} />
            <span>Add New Product</span>
          </Button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search chemical name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Button
            size="sm"
            variant={filterStock === "all" ? "default" : "outline"}
            onClick={() => setFilterStock("all")}
            className={`text-xs rounded-xl ${filterStock === "all" ? "bg-slate-900 text-white" : ""}`}
          >
            All Products ({products.length})
          </Button>
          <Button
            size="sm"
            variant={filterStock === "low" ? "default" : "outline"}
            onClick={() => setFilterStock("low")}
            className={`text-xs rounded-xl ${filterStock === "low" ? "bg-amber-500 text-white" : "text-amber-600 border-amber-200"}`}
          >
            Low Stock (&lt;10)
          </Button>
          <Button
            size="sm"
            variant={filterStock === "out" ? "default" : "outline"}
            onClick={() => setFilterStock("out")}
            className={`text-xs rounded-xl ${filterStock === "out" ? "bg-red-600 text-white" : "text-red-600 border-red-200"}`}
          >
            Out of Stock
          </Button>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No products match</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Try adjusting your search terms or add a new chemical product to your catalog.
            </p>
            {isAdmin && (
              <Button onClick={openAddModal} variant="outline" className="text-xs font-semibold">
                <Plus size={14} className="mr-1.5" />
                Add Chemical Product
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <tr>
                  <th className="py-3.5 px-6">Product Details</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Unit Price</th>
                  <th className="py-3.5 px-6">Stock Level</th>
                  <th className="py-3.5 px-6">Quick Adjust (Manager)</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isLow = p.stockQuantity > 0 && p.stockQuantity < 10;
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
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
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-[11px] text-slate-400">Unit: {p.unit || "kg"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {p.category || "Chemical"}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-900">
                        {formatNaira(p.price)}
                        {p.discountPrice && (
                          <span className="block text-[11px] text-slate-400 line-through font-normal">
                            {formatNaira(p.discountPrice)}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                            <XCircle size={12} /> Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-700">
                            <AlertTriangle size={12} /> Low ({p.stockQuantity} {p.unit || "units"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle size={12} /> {p.stockQuantity} {p.unit || "units"}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {/* Quick adjustment buttons for operations managers */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleQuickStockChange(p.id, p.stockQuantity, -10)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-700"
                            title="Decrease by 10"
                          >
                            -10
                          </button>
                          <button
                            onClick={() => handleQuickStockChange(p.id, p.stockQuantity, -1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-700"
                            title="Decrease by 1"
                          >
                            -1
                          </button>
                          <span className="px-2 font-mono font-bold text-xs text-slate-900">
                            {p.stockQuantity}
                          </span>
                          <button
                            onClick={() => handleQuickStockChange(p.id, p.stockQuantity, 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-700"
                            title="Increase by 1"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleQuickStockChange(p.id, p.stockQuantity, 10)}
                            className="w-7 h-7 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 font-bold text-xs flex items-center justify-center text-orange-600"
                            title="Replenish +10"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(p)}
                                className="text-xs h-8 text-slate-600 hover:text-slate-900"
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="text-xs h-8 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </>
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

      {/* Add / Edit Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="text-orange-600 w-5 h-5" />
              {editingProduct ? "Edit Chemical Product" : "Add New Chemical Product"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure product details, initial stock quantity, and pricing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Product Name *</Label>
              <Input
                required
                placeholder="e.g. Industrial Sulfuric Acid 98%"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Category *</Label>
                <Input
                  required
                  placeholder="e.g. Industrial / Solvents"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">Measurement Unit</Label>
                <Input
                  placeholder="kg, Litres, Drums"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Price (NGN) *</Label>
                <Input
                  type="number"
                  required
                  placeholder="50000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">Initial Stock</Label>
                <Input
                  type="number"
                  required
                  placeholder="100"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Image URL</Label>
              <Input
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Product Description</Label>
              <textarea
                rows={3}
                placeholder="Chemical specifications, applications, safety details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/20"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
