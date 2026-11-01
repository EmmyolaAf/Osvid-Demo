"use client";

import React, { useState } from "react";
import {
  Product,
  ProductCategory,
  PricingTierGroup,
  ProductType,
  ProductAttribute,
  ProductVariation,
} from "@/types/auth";
import {
  Package,
  Layers,
  Tag,
  DollarSign,
  Boxes,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Calendar,
  Lock,
  Sparkles,
  Check,
  X,
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
import {
  uploadCatalogueImage,
  validateMediaFile,
  isOwnedStorageUrl,
} from "@/lib/firebase/storage";
import { toast } from "sonner";
import formatCurrency from "@/helpers/formatCurrency";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
  editingProduct: Product | null;
  categories: ProductCategory[];
  pricingTierGroups: PricingTierGroup[];
  allProducts: Product[];
  canManageInventory: boolean;
  submitting: boolean;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSave,
  editingProduct,
  categories,
  pricingTierGroups,
  allProducts,
  canManageInventory,
  submitting,
}: ProductFormModalProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "pricing" | "inventory" | "variations" | "grouped" | "media" | "linked"
  >("general");

  // Form State
  const [name, setName] = useState(editingProduct?.name || "");
  const [slug, setSlug] = useState(editingProduct?.slug || "");
  const [productType, setProductType] = useState<ProductType>(editingProduct?.productType || "simple");
  const [category, setCategory] = useState(
    editingProduct?.category || (categories[0]?.name || "Industrial Chemicals")
  );
  const [unit, setUnit] = useState(editingProduct?.unit || "kg");
  const [sku, setSku] = useState(editingProduct?.sku || `SKU-${Date.now().toString().slice(-6)}`);
  const [barcode, setBarcode] = useState(editingProduct?.barcode || "");
  const [weight, setWeight] = useState(editingProduct?.weight || "");
  const [dimensions, setDimensions] = useState(editingProduct?.dimensions || "");

  // Pricing
  const [price, setPrice] = useState(editingProduct ? editingProduct.price.toString() : "");
  const [discountPrice, setDiscountPrice] = useState(
    editingProduct?.discountPrice ? editingProduct.discountPrice.toString() : ""
  );
  const [saleStartDate, setSaleStartDate] = useState(editingProduct?.saleStartDate || "");
  const [saleEndDate, setSaleEndDate] = useState(editingProduct?.saleEndDate || "");
  const [pricingTierId, setPricingTierId] = useState(editingProduct?.pricingTierId || "");
  const [taxStatus, setTaxStatus] = useState(editingProduct?.taxStatus || "taxable");
  const [taxClass, setTaxClass] = useState(editingProduct?.taxClass || "standard");

  // Stock
  const [stockQuantity, setStockQuantity] = useState(
    editingProduct ? (editingProduct.stockQuantity ?? 0).toString() : "50"
  );
  const [manageStock, setManageStock] = useState(editingProduct?.manageStock !== false);
  const [stockStatus, setStockStatus] = useState<"in_stock" | "out_of_stock" | "on_backorder">(
    editingProduct?.stockStatus || "in_stock"
  );
  const [allowBackorders, setAllowBackorders] = useState<"no" | "notify" | "yes">(
    editingProduct?.allowBackorders || "no"
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    (editingProduct?.lowStockThreshold ?? 5).toString()
  );

  // Content
  const [shortDescription, setShortDescription] = useState(editingProduct?.shortDescription || "");
  const [description, setDescription] = useState(editingProduct?.description || "");
  const [featuresText, setFeaturesText] = useState(
    Array.isArray(editingProduct?.features) ? editingProduct.features.join("\n") : ""
  );
  const [tagsText, setTagsText] = useState(
    Array.isArray(editingProduct?.tags) ? editingProduct.tags.join(", ") : ""
  );

  // Media
  const [imageUrl, setImageUrl] = useState(editingProduct?.imageUrl || "/images/placeholder.webp");
  const [galleryImages, setGalleryImages] = useState<string[]>(
    Array.isArray(editingProduct?.galleryImages) ? editingProduct.galleryImages : []
  );
  const [imageUploading, setImageUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Variations & Attributes
  const [attributes, setAttributes] = useState<ProductAttribute[]>(
    Array.isArray(editingProduct?.attributes) ? editingProduct.attributes : []
  );
  const [variations, setVariations] = useState<ProductVariation[]>(
    Array.isArray(editingProduct?.variations) ? editingProduct.variations : []
  );

  // Linked Products
  const [suggestedProductIds, setSuggestedProductIds] = useState<string[]>(
    Array.isArray(editingProduct?.suggestedProductIds) ? editingProduct.suggestedProductIds : []
  );
  const [crossSellIds, setCrossSellIds] = useState<string[]>(
    Array.isArray(editingProduct?.crossSellIds) ? editingProduct.crossSellIds : []
  );
  const [upsellIds, setUpsellIds] = useState<string[]>(
    Array.isArray(editingProduct?.upsellIds) ? editingProduct.upsellIds : []
  );
  const [groupedProductIds, setGroupedProductIds] = useState<string[]>(
    Array.isArray(editingProduct?.groupedProductIds) ? editingProduct.groupedProductIds : []
  );

  // New attribute state helper
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValues, setNewAttrValues] = useState("");

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) {
      toast.error("Please provide an attribute name (e.g. Weight or Grade).");
      return;
    }
    const valuesArray = newAttrValues
      .split(/[,|\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (valuesArray.length === 0) {
      toast.error("Please provide at least one attribute value.");
      return;
    }

    const newAttr: ProductAttribute = {
      id: `attr_${Date.now()}`,
      name: newAttrName.trim(),
      values: valuesArray,
      visibleOnProductPage: true,
      usedForVariations: true,
    };

    setAttributes([...attributes, newAttr]);
    setNewAttrName("");
    setNewAttrValues("");
    toast.success(`Attribute "${newAttr.name}" added.`);
  };

  const handleRemoveAttribute = (id: string) => {
    setAttributes(attributes.filter((a) => a.id !== id));
  };

  // Add individual variation
  const handleAddVariation = () => {
    const varId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newVar: ProductVariation = {
      id: varId,
      sku: `${sku || "SKU"}-V${variations.length + 1}`,
      price: parseFloat(price) || 0,
      regularPrice: parseFloat(price) || 0,
      stockQuantity: 50,
      stockStatus: "in_stock",
      manageStock: true,
      attributes: {},
      isActive: true,
    };
    setVariations([...variations, newVar]);
  };

  const handleUpdateVariation = (index: number, field: keyof ProductVariation, value: any) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    setVariations(updated);
  };

  const handleRemoveVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  // Image upload handlers
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateMediaFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid file format or size.");
      return;
    }

    try {
      setImageUploading(true);
      const res = await uploadCatalogueImage(file, "products");
      if (!res.success || !res.downloadUrl) {
        toast.error(res.error || "Failed to upload image.");
        return;
      }
      setImageUrl(res.downloadUrl);
      toast.success("Main product image uploaded to cloud storage!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setGalleryUploading(true);
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateMediaFile(file);
        if (validation.valid) {
          const res = await uploadCatalogueImage(file, "products");
          if (res.success && res.downloadUrl) {
            newUrls.push(res.downloadUrl);
          }
        }
      }

      if (newUrls.length > 0) {
        setGalleryImages([...galleryImages, ...newUrls]);
        toast.success(`Uploaded ${newUrls.length} gallery image(s) to cloud storage!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload gallery images.");
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleRemoveGalleryImage = (idx: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid regular price.");
      return;
    }

    const featuresArray = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const tagsArray = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const selectedGroup = pricingTierGroups.find((g) => g.id === pricingTierId);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      productType,
      category: category.trim(),
      unit: unit.trim() || "kg",
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      weight: weight.trim() || undefined,
      dimensions: dimensions.trim() || undefined,
      price: numPrice,
      discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      saleStartDate: saleStartDate || undefined,
      saleEndDate: saleEndDate || undefined,
      pricingTierId: selectedGroup ? selectedGroup.id : undefined,
      pricingTierName: selectedGroup ? selectedGroup.name : undefined,
      pricingTiers: selectedGroup ? selectedGroup.tiers : undefined,
      taxStatus,
      taxClass,
      stockQuantity: parseInt(stockQuantity, 10) || 0,
      manageStock,
      stockStatus,
      allowBackorders,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim(),
      features: featuresArray,
      tags: tagsArray,
      imageUrl: imageUrl.trim() || "/images/placeholder.webp",
      galleryImages,
      attributes,
      variations,
      groupedProductIds,
      upsellIds,
      crossSellIds,
      suggestedProductIds,
    };

    await onSave(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white rounded-2xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="text-orange-600 w-5 h-5" />
              <DialogTitle className="text-xl font-bold text-slate-900">
                {editingProduct ? "Edit Chemical Product" : "Add New Chemical Product"}
              </DialogTitle>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 uppercase tracking-wider">
              {productType} product
            </span>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Configure product specifications, variations, regular/sale pricing, and cloud storage assets.
          </DialogDescription>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pt-4 scrollbar-hide text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "general"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Package size={14} /> General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pricing")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "pricing"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <DollarSign size={14} /> Pricing &amp; Tax
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "inventory"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Boxes size={14} /> Inventory
            </button>
            {productType === "variable" && (
              <button
                type="button"
                onClick={() => setActiveTab("variations")}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === "variations"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Layers size={14} /> Variations ({variations.length})
              </button>
            )}
            {productType === "grouped" && (
              <button
                type="button"
                onClick={() => setActiveTab("grouped")}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === "grouped"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Package size={14} /> Grouped Products ({groupedProductIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "media"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ImageIcon size={14} /> Media ({galleryImages.length + 1})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("linked")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "linked"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <LinkIcon size={14} /> Linked Products
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Product Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Industrial Sulfuric Acid 98%"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Product Type *</Label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="simple">Simple Product</option>
                    <option value="variable">Variable Product (Variations)</option>
                    <option value="grouped">Grouped Product (Bundle)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Product Category *</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Measurement Unit</Label>
                  <Input
                    placeholder="kg, Litres, Drums, Bags"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Short Summary Description</Label>
                <Input
                  placeholder="Quick 1-sentence synopsis displayed near price on storefront..."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Full Product Description</Label>
                <textarea
                  rows={4}
                  placeholder="Detailed chemical formulation, industrial grades, compliance certifications, handling instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Key Features (1 per line)</Label>
                  <textarea
                    rows={3}
                    placeholder="99.5% Purity Grade&#10;Corrosion Resistant&#10;ISO 9001 Certified"
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Product Tags (comma separated)</Label>
                  <textarea
                    rows={3}
                    placeholder="skincare, industrial, solvent, raw-materials"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & TAX */}
          {activeTab === "pricing" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Regular Price (NGN) *</Label>
                  <Input
                    type="number"
                    required
                    min={0}
                    placeholder="50000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Standard selling price without discounts</p>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Sale Promo Price (NGN)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Optional sale price"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm text-orange-600 font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Must be lower than regular price</p>
                </div>
              </div>

              {/* Scheduled Sale Dates */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar size={14} className="text-orange-600" />
                  Scheduled Sale Duration (Optional)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-500">Sale Start Date</Label>
                    <Input
                      type="date"
                      value={saleStartDate}
                      onChange={(e) => setSaleStartDate(e.target.value)}
                      className="mt-1 h-9 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Sale End Date</Label>
                    <Input
                      type="date"
                      value={saleEndDate}
                      onChange={(e) => setSaleEndDate(e.target.value)}
                      className="mt-1 h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  If set, the sale price will only automatically activate between these dates.
                </p>
              </div>

              {/* Quantity / Wholesale Pricing Tier Selection */}
              <div className="bg-orange-50/50 border border-orange-200/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag size={14} className="text-orange-600" />
                    Quantity / Wholesale Pricing Tier
                  </Label>
                  {pricingTierId && (
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                      Tier Attached
                    </span>
                  )}
                </div>
                <select
                  value={pricingTierId}
                  onChange={(e) => setPricingTierId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                >
                  <option value="">No Quantity Tier (Standard Price Only)</option>
                  {pricingTierGroups
                    .filter((g) => g.isActive)
                    .map((group) => {
                      const breakdown = (group.tiers || [])
                        .map((t) => `${t.minQuantity}+ (${t.discountPercentage}%)`)
                        .join(", ");
                      return (
                        <option key={group.id} value={group.id}>
                          {group.name} {breakdown ? `— [${breakdown}]` : ""}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Tax & VAT Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Tax Status</Label>
                  <select
                    value={taxStatus}
                    onChange={(e) => setTaxStatus(e.target.value as any)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="taxable">Taxable (Standard VAT)</option>
                    <option value="shipping_only">Shipping Only</option>
                    <option value="none">Tax Exempt / None</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Tax Class</Label>
                  <select
                    value={taxClass}
                    onChange={(e) => setTaxClass(e.target.value as any)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="standard">Standard Rate (7.5%)</option>
                    <option value="reduced">Reduced Rate (0%)</option>
                    <option value="zero">Zero Rate</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === "inventory" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">SKU Code *</Label>
                  <Input
                    required
                    placeholder="SKU-88210"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Barcode / EAN (Optional)</Label>
                  <Input
                    placeholder="9780201379624"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm font-mono"
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
                    value={
                      editingProduct
                        ? (editingProduct.stockQuantity ?? 0).toString()
                        : (canManageInventory ? stockQuantity : "0")
                    }
                    disabled={Boolean(editingProduct) || !canManageInventory}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className={`mt-1 h-10 rounded-xl text-sm ${
                      editingProduct || !canManageInventory ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Stock Status</Label>
                  <select
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value as any)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="on_backorder">On Backorder</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Allow Backorders?</Label>
                  <select
                    value={allowBackorders}
                    onChange={(e) => setAllowBackorders(e.target.value as any)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="no">Do not allow</option>
                    <option value="notify">Allow, but notify customer</option>
                    <option value="yes">Allow backorders</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Low Stock Alert Threshold</Label>
                  <Input
                    type="number"
                    min={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Product Weight (e.g. 25kg, 500g)</Label>
                  <Input
                    placeholder="25kg"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">Dimensions (L &times; W &times; H)</Label>
                  <Input
                    placeholder="40 x 30 x 20 cm"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VARIATIONS & ATTRIBUTES */}
          {activeTab === "variations" && productType === "variable" && (
            <div className="space-y-5">
              {/* Attributes Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-orange-600" />
                    Product Attributes (e.g. Weight, Size, Grade)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {attributes.length} configured
                  </span>
                </div>

                {attributes.length > 0 && (
                  <div className="space-y-2">
                    {attributes.map((attr) => (
                      <div
                        key={attr.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs"
                      >
                        <div>
                          <strong className="text-slate-900">{attr.name}:</strong>{" "}
                          <span className="text-slate-600">{attr.values.join(", ")}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttribute(attr.id)}
                          className="h-7 text-rose-600 hover:bg-rose-50 p-1 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Attribute Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <Input
                    placeholder="Attribute name (e.g. Weight)"
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                  <Input
                    placeholder="Values: 100g, 250g, 1kg, 5kg"
                    value={newAttrValues}
                    onChange={(e) => setNewAttrValues(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={handleAddAttribute}
                    className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1"
                  >
                    <Plus size={13} /> Add Attribute
                  </Button>
                </div>
              </div>

              {/* Variations Manager */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Configured Variations</h4>
                    <p className="text-[11px] text-slate-500">
                      Each variation can have its own price, SKU, stock quantity, and attribute options.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddVariation}
                    className="h-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1.5"
                  >
                    <Plus size={13} /> Add Variation
                  </Button>
                </div>

                {variations.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-xs text-slate-400">
                    No variations added yet. Click &quot;Add Variation&quot; above to create price/size options.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {variations.map((v, idx) => (
                      <div
                        key={v.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-orange-950 font-mono">
                            Variation #{idx + 1} ({v.sku})
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveVariation(idx)}
                            className="h-7 text-rose-600 hover:bg-rose-50 rounded-lg p-1"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">SKU</Label>
                            <Input
                              value={v.sku}
                              onChange={(e) => handleUpdateVariation(idx, "sku", e.target.value)}
                              className="h-8 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">Regular Price (NGN)</Label>
                            <Input
                              type="number"
                              value={v.regularPrice}
                              onChange={(e) =>
                                handleUpdateVariation(idx, "regularPrice", parseFloat(e.target.value) || 0)
                              }
                              className="h-8 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">Sale Price (NGN)</Label>
                            <Input
                              type="number"
                              placeholder="Optional"
                              value={v.salePrice || ""}
                              onChange={(e) =>
                                handleUpdateVariation(
                                  idx,
                                  "salePrice",
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">Stock Qty</Label>
                            <Input
                              type="number"
                              value={v.stockQuantity}
                              onChange={(e) =>
                                handleUpdateVariation(idx, "stockQuantity", parseInt(e.target.value, 10) || 0)
                              }
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        {/* Attribute Selectors for Variation */}
                        {attributes.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                            {attributes.map((attr) => (
                              <div key={attr.id}>
                                <Label className="text-[10px] font-bold text-slate-500">{attr.name}</Label>
                                <select
                                  value={v.attributes?.[attr.name] || ""}
                                  onChange={(e) => {
                                    const newAttrs = { ...v.attributes, [attr.name]: e.target.value };
                                    handleUpdateVariation(idx, "attributes", newAttrs);
                                  }}
                                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                                >
                                  <option value="">Any {attr.name}</option>
                                  {attr.values.map((val) => (
                                    <option key={val} value={val}>
                                      {val}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: GROUPED PRODUCTS */}
          {activeTab === "grouped" && productType === "grouped" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-slate-800">
                  Select Child Products to Group
                </Label>
                <p className="text-[11px] text-slate-400">
                  Customers can purchase any or all items in this bundle directly from this product page.
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-2 space-y-1 bg-slate-50/50">
                {allProducts
                  .filter((p) => p.id !== editingProduct?.id)
                  .map((p) => {
                    const isSelected = groupedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isSelected) {
                            setGroupedProductIds(groupedProductIds.filter((id) => id !== p.id));
                          } else {
                            setGroupedProductIds([...groupedProductIds, p.id]);
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                          isSelected
                            ? "bg-orange-50 border border-orange-200 text-orange-950 font-bold"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-orange-600 focus:ring-0"
                          />
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {formatCurrency("NGN", p.price)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 6: MEDIA & GALLERY */}
          {activeTab === "media" && (
            <div className="space-y-5">
              {/* Main Image */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <Label className="text-xs font-bold text-slate-800">Main Featured Image *</Label>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Main Preview"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-200 bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/placeholder.webp";
                    }}
                  />
                  <div className="flex-1 space-y-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold">
                      {imageUploading ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={13} /> Upload Cloud Image
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={imageUploading}
                        onChange={handleMainImageUpload}
                        className="hidden"
                      />
                    </label>
                    <Input
                      placeholder="Or paste image URL"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="h-8 text-xs font-mono rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Gallery Images */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800">
                    Product Gallery Images ({galleryImages.length})
                  </Label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold">
                    {galleryUploading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Add Gallery Photos
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      disabled={galleryUploading}
                      onChange={handleGalleryImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {galleryImages.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No additional gallery images uploaded. Click &quot;Add Gallery Photos&quot; to upload multiple views.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                    {galleryImages.map((gUrl, gIdx) => (
                      <div
                        key={gIdx}
                        className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gUrl}
                          alt={`Gallery ${gIdx}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(gIdx)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-md bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: LINKED PRODUCTS */}
          {activeTab === "linked" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <LinkIcon size={14} className="text-orange-600" />
                  Upsells (Recommended Upgrades)
                </Label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Products recommended instead of the currently viewed product (e.g. premium grade).
                </p>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                  {allProducts
                    .filter((p) => p.id !== editingProduct?.id)
                    .map((p) => {
                      const isSelected = upsellIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setUpsellIds(
                              isSelected ? upsellIds.filter((id) => id !== p.id) : [...upsellIds, p.id]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs ${
                            isSelected
                              ? "bg-orange-50 border border-orange-200 font-bold text-orange-950"
                              : "bg-white border border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatCurrency("NGN", p.price)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <LinkIcon size={14} className="text-orange-600" />
                  Cross-sells (Promoted in Cart)
                </Label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Complimentary items promoted when a customer views their cart drawer.
                </p>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                  {allProducts
                    .filter((p) => p.id !== editingProduct?.id)
                    .map((p) => {
                      const isSelected = crossSellIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setCrossSellIds(
                              isSelected ? crossSellIds.filter((id) => id !== p.id) : [...crossSellIds, p.id]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs ${
                            isSelected
                              ? "bg-orange-50 border border-orange-200 font-bold text-orange-950"
                              : "bg-white border border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatCurrency("NGN", p.price)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">
              * Database persistence guaranteed to Firestore
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-5"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin mr-1.5" /> Saving...
                  </>
                ) : editingProduct ? (
                  "Update Product"
                ) : (
                  "Create Product"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
