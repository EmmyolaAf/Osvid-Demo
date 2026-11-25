"use client";

import React, { useState } from "react";
import {
  Product,
  ProductCategory,
  PricingTierGroup,
  ProductType,
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
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  HelpCircle,
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
import { uploadCatalogueImage, validateMediaFile } from "@/lib/firebase/storage";
import { toast } from "sonner";
import formatCurrency from "@/helpers/formatCurrency";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
  editingProduct: Product | null;
  categories: ProductCategory[];
  pricingTierGroups?: PricingTierGroup[];
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
  allProducts,
  canManageInventory,
  submitting,
}: ProductFormModalProps) {
  // Step 1: General Info
  const [name, setName] = useState(editingProduct?.name || "");
  const [slug, setSlug] = useState(editingProduct?.slug || "");
  const [productType, setProductType] = useState<ProductType>(
    editingProduct?.productType || "simple"
  );
  const [category, setCategory] = useState(
    editingProduct?.category || (categories[0]?.name || "Industrial Chemicals")
  );
  const [unit, setUnit] = useState(editingProduct?.unit || "kg");
  const [sku, setSku] = useState(
    editingProduct?.sku || `SKU-${Date.now().toString().slice(-6)}`
  );
  const [barcode, setBarcode] = useState(editingProduct?.barcode || "");
  const [weight, setWeight] = useState(editingProduct?.weight || "");
  const [shortDescription, setShortDescription] = useState(
    editingProduct?.shortDescription || ""
  );
  const [description, setDescription] = useState(editingProduct?.description || "");

  // Key Features dynamic list
  const [features, setFeatures] = useState<string[]>(() => {
    if (Array.isArray(editingProduct?.features)) {
      return editingProduct.features.filter(Boolean);
    }
    return [];
  });
  const [newFeatureText, setNewFeatureText] = useState("");

  // Product Tags
  const [tagsText, setTagsText] = useState(
    Array.isArray(editingProduct?.tags) ? editingProduct.tags.join(", ") : ""
  );

  // Step 2: Variations (Only when productType === 'variable')
  const [variations, setVariations] = useState<ProductVariation[]>(() => {
    if (Array.isArray(editingProduct?.variations)) {
      return editingProduct.variations;
    }
    return [];
  });

  const [newVarName, setNewVarName] = useState("");
  const [newVarAttribute, setNewVarAttribute] = useState("");
  const [newVarDescription, setNewVarDescription] = useState("");
  const [newVarSku, setNewVarSku] = useState("");

  // Step 3: Pricing & Tax
  const [price, setPrice] = useState(
    editingProduct ? editingProduct.price.toString() : ""
  );
  const [discountPrice, setDiscountPrice] = useState(
    editingProduct?.discountPrice ? editingProduct.discountPrice.toString() : ""
  );
  const [taxStatus, setTaxStatus] = useState<"taxable" | "shipping_only" | "none">(
    editingProduct?.taxStatus || "taxable"
  );
  const [taxClass, setTaxClass] = useState<"standard" | "reduced" | "zero">(
    editingProduct?.taxClass || "standard"
  );

  // Commercial Points & Threshold Strategy (Simple Product)
  const [pointsPerUnit, setPointsPerUnit] = useState(
    editingProduct?.pointsPerUnit !== undefined && editingProduct.pointsPerUnit !== null
      ? editingProduct.pointsPerUnit.toString()
      : ""
  );
  const [pointsThreshold, setPointsThreshold] = useState(
    editingProduct?.pointsThreshold !== undefined && editingProduct.pointsThreshold !== null
      ? editingProduct.pointsThreshold.toString()
      : ""
  );
  const [pointsDiscountPercentage, setPointsDiscountPercentage] = useState(
    editingProduct?.pointsDiscountPercentage !== undefined &&
      editingProduct.pointsDiscountPercentage !== null
      ? editingProduct.pointsDiscountPercentage.toString()
      : ""
  );
  const [isPointsEligible, setIsPointsEligible] = useState(
    editingProduct?.isPointsEligible !== false
  );

  // Step 4: Inventory
  const [stockQuantity, setStockQuantity] = useState(
    editingProduct ? (editingProduct.stockQuantity ?? 0).toString() : "50"
  );
  const [manageStock, setManageStock] = useState(
    editingProduct?.manageStock !== false
  );
  const [stockStatus, setStockStatus] = useState<
    "in_stock" | "out_of_stock" | "on_backorder"
  >(editingProduct?.stockStatus || "in_stock");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    (editingProduct?.lowStockThreshold ?? 5).toString()
  );

  // Step 5: Media
  const [imageUrl, setImageUrl] = useState(
    editingProduct?.imageUrl || "/images/placeholder.webp"
  );
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>(
    Array.isArray(editingProduct?.galleryImages) ? editingProduct.galleryImages : []
  );
  const [manualGalleryUrl, setManualGalleryUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Step 6: Linked Products
  const [crossSellIds, setCrossSellIds] = useState<string[]>(
    Array.isArray(editingProduct?.crossSellIds) ? editingProduct.crossSellIds : []
  );
  const [upsellIds, setUpsellIds] = useState<string[]>(
    Array.isArray(editingProduct?.upsellIds) ? editingProduct.upsellIds : []
  );

  // Dynamic step navigation based on product type
  const isVariable = productType === "variable";

  const steps = isVariable
    ? [
        { id: "general", label: "1. General" },
        { id: "variations", label: "2. Variations" },
        { id: "pricing", label: "3. Pricing & Tax" },
        { id: "inventory", label: "4. Inventory" },
        { id: "media", label: "5. Media" },
        { id: "linked", label: "6. Linked Products" },
      ]
    : [
        { id: "general", label: "1. General" },
        { id: "pricing", label: "2. Pricing & Tax" },
        { id: "inventory", label: "3. Inventory" },
        { id: "media", label: "4. Media" },
        { id: "linked", label: "5. Linked Products" },
      ];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const activeStep = steps[currentStepIndex]?.id || "general";
  const isLastStep = currentStepIndex === steps.length - 1;

  // Key Features Handlers
  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setFeatures([...features, newFeatureText.trim()]);
    setNewFeatureText("");
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, idx) => idx !== index));
  };

  // Variations Handlers
  const handleAddVariation = () => {
    if (!newVarName.trim()) {
      toast.error("Please provide a name for this variation (e.g. '4 Liters Container').");
      return;
    }

    const attrMap: Record<string, string> = {};
    if (newVarAttribute.trim()) {
      if (newVarAttribute.includes(":")) {
        const [k, v] = newVarAttribute.split(":");
        attrMap[k.trim()] = v.trim();
      } else {
        attrMap["Specification"] = newVarAttribute.trim();
      }
    } else {
      attrMap["Variation"] = newVarName.trim();
    }

    const varId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const autoSku =
      newVarSku.trim() ||
      `${sku}-${newVarName.replace(/\s+/g, "-").toUpperCase()}`;

    const newVar: ProductVariation = {
      id: varId,
      sku: autoSku,
      name: newVarName.trim(),
      attributes: attrMap,
      price: parseFloat(price) || 0,
      stockQuantity: parseInt(stockQuantity, 10) || 50,
      stockStatus: "in_stock",
      manageStock: true,
      pointsPerUnit: pointsPerUnit ? parseFloat(pointsPerUnit) : 0.2,
      pointsThreshold: pointsThreshold ? parseFloat(pointsThreshold) : 10,
      pointsDiscountPercentage: pointsDiscountPercentage
        ? parseFloat(pointsDiscountPercentage)
        : 10,
      isPointsEligible: true,
      description: newVarDescription.trim() || undefined,
    };

    setVariations([...variations, newVar]);
    setNewVarName("");
    setNewVarAttribute("");
    setNewVarDescription("");
    setNewVarSku("");
    toast.success(`Variation "${newVar.name}" added! Configure its price in the next section.`);
  };

  const handleRemoveVariation = (id: string) => {
    setVariations(variations.filter((v) => v.id !== id));
  };

  const handleUpdateVariation = (
    id: string,
    field: keyof ProductVariation,
    value: any
  ) => {
    setVariations(
      variations.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  // Media Handlers (Option 1: Upload to Cloud, Option 2: Direct Link)
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);
      const res = await uploadCatalogueImage(file, "products");
      if (!res.success || !res.downloadUrl) {
        toast.error(res.error || "Failed to upload image. You can attach a link instead.");
        return;
      }
      setImageUrl(res.downloadUrl);
      toast.success("Main image uploaded successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Image upload encountered an error.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleSetManualImageUrl = () => {
    if (!manualImageUrl.trim()) {
      toast.error("Please enter a valid image URL.");
      return;
    }
    setImageUrl(manualImageUrl.trim());
    setManualImageUrl("");
    toast.success("Main image link attached!");
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setGalleryUploading(true);
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const res = await uploadCatalogueImage(files[i], "products");
        if (res.success && res.downloadUrl) {
          uploadedUrls.push(res.downloadUrl);
        }
      }
      if (uploadedUrls.length > 0) {
        setGalleryImages([...galleryImages, ...uploadedUrls]);
        toast.success(`Added ${uploadedUrls.length} gallery image(s)!`);
      } else {
        toast.error("Could not upload gallery images. Try attaching image links directly.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload gallery images.");
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleAddManualGalleryUrl = () => {
    if (!manualGalleryUrl.trim()) {
      toast.error("Please enter an image URL.");
      return;
    }
    setGalleryImages([...galleryImages, manualGalleryUrl.trim()]);
    setManualGalleryUrl("");
    toast.success("Gallery image link added!");
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, idx) => idx !== index));
  };

  // Step Validation & Navigation
  const handleNextStep = () => {
    if (activeStep === "general") {
      if (!name.trim()) {
        toast.error("Product name is required before proceeding.");
        return;
      }
    }

    if (activeStep === "variations") {
      if (isVariable && variations.length === 0) {
        toast.warning("Please add at least one variation, or switch product type to Simple.");
        return;
      }
    }

    if (activeStep === "pricing") {
      if (!isVariable) {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice < 0) {
          toast.error("Please enter a valid regular price for this product.");
          return;
        }
      } else {
        const unpriced = variations.some((v) => isNaN(Number(v.price)) || Number(v.price) <= 0);
        if (unpriced) {
          toast.warning("Some variations have a price of ₦0. You can still proceed or update their prices.");
        }
      }
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Final Submission on Last Step
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product name is required.");
      setCurrentStepIndex(0);
      return;
    }

    let primaryPrice = parseFloat(price);
    if (isVariable) {
      if (variations.length === 0) {
        toast.error("Variable products require at least one variation.");
        setCurrentStepIndex(1);
        return;
      }
      primaryPrice = Number(variations[0].price) || 0;
    } else {
      if (isNaN(primaryPrice) || primaryPrice < 0) {
        toast.error("Please enter a valid regular price.");
        setCurrentStepIndex(steps.findIndex((s) => s.id === "pricing"));
        return;
      }
    }

    const tagsArray = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      productType,
      category: category.trim(),
      unit: unit.trim() || "kg",
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      weight: weight.trim() || undefined,
      price: primaryPrice,
      discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      pointsPerUnit:
        pointsPerUnit !== "" && !isNaN(Number(pointsPerUnit))
          ? Number(pointsPerUnit)
          : undefined,
      pointsThreshold:
        pointsThreshold !== "" && !isNaN(Number(pointsThreshold))
          ? Number(pointsThreshold)
          : undefined,
      pointsDiscountPercentage:
        pointsDiscountPercentage !== "" && !isNaN(Number(pointsDiscountPercentage))
          ? Number(pointsDiscountPercentage)
          : undefined,
      isPointsEligible,
      taxStatus,
      taxClass,
      stockQuantity: isVariable
        ? variations.reduce((sum, v) => sum + (Number(v.stockQuantity) || 0), 0)
        : parseInt(stockQuantity, 10) || 0,
      manageStock,
      stockStatus,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim(),
      features,
      tags: tagsArray,
      imageUrl: imageUrl.trim() || "/images/placeholder.webp",
      galleryImages,
      variations: isVariable ? variations : undefined,
      crossSellIds,
      upsellIds,
    };

    try {
      await onSave(payload);
    } catch (err: any) {
      console.error("Error saving product:", err);
      toast.error(err?.message || "Failed to save product to database.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <Package size={20} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900">
                  {editingProduct ? `Edit: ${editingProduct.name}` : "Create New Product"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Follow the sections below to configure product specifications, variations, pricing, and media.
                </DialogDescription>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="flex items-center gap-1.5 pt-4 overflow-x-auto no-scrollbar">
            {steps.map((st, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isPassed = idx < currentStepIndex;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? "bg-slate-900 text-white shadow-sm"
                      : isPassed
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {isPassed ? <CheckCircle2 size={13} className="text-emerald-600" /> : null}
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* SECTION 1: GENERAL */}
          {activeStep === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Product Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingProduct) {
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")
                        );
                      }
                    }}
                    placeholder="e.g. Industrial Grade Hydrochloric Acid 33%"
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Product Type</Label>
                  <select
                    value={productType}
                    onChange={(e) => {
                      const nextType = e.target.value as ProductType;
                      setProductType(nextType);
                      // If moving to simple from variable, keep index safe
                      if (currentStepIndex > 4) setCurrentStepIndex(0);
                    }}
                    className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-bold text-slate-800 outline-none"
                  >
                    <option value="simple">Simple Product (Single Unit)</option>
                    <option value="variable">Variable Product (Multiple Sizes/Specs)</option>
                    <option value="grouped">Grouped Product</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Category</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-semibold text-slate-800 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {categories.length === 0 && (
                      <option value="Industrial Chemicals">Industrial Chemicals</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Measurement Unit</Label>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="kg, Liters, Drum, Carton"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Weight / Packaging Size</Label>
                  <Input
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 25kg, 200L, 1.5kg"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Short Summary</Label>
                <Input
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One sentence summary shown on product highlights and quotes..."
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Full Description</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Detailed chemical formulation, handling recommendations, purity, and applications..."
                  className="w-full rounded-2xl border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Dynamic Key Features List */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-orange-600" />
                    Key Features List ({features.length})
                  </Label>
                  <span className="text-[10px] text-slate-400">
                    Add bullet points highlighting purity, certifications, or performance.
                  </span>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="e.g. High assay purity 99.5% minimum"
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                  <Button
                    type="button"
                    onClick={handleAddFeature}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold px-3 h-9 shrink-0 gap-1"
                  >
                    <Plus size={14} /> Add Feature
                  </Button>
                </div>

                {features.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {features.map((feat, fIdx) => (
                      <li
                        key={fIdx}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/80 text-xs text-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {fIdx + 1}
                          </span>
                          <span>{feat}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(fIdx)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Product Tags */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Product Tags</Label>
                <Input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="e.g. Solvent, Industrial, Laboratory, Raw Material (comma-separated)"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          {/* SECTION 2: VARIATIONS (Only for Variable Products) */}
          {activeStep === "variations" && isVariable && (
            <div className="space-y-5">
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/70 flex items-start gap-3">
                <Layers className="text-indigo-600 mt-0.5 shrink-0" size={18} />
                <div className="text-xs text-indigo-950 space-y-0.5">
                  <p className="font-bold">Simple Variation Creation</p>
                  <p className="text-[11px] text-indigo-800">
                    Create distinct package sizes, container volumes, or chemical grades (e.g., 4L, 25kg, 200L).
                    You will configure specific prices and commercial points for each in the next section.
                  </p>
                </div>
              </div>

              {/* Add Variation Form */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <Label className="text-xs font-bold text-slate-800 block">Add New Variation</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                      Variation Name *
                    </Label>
                    <Input
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder="e.g. 4 Litres Plastic Container"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                      Attribute / Specification
                    </Label>
                    <Input
                      value={newVarAttribute}
                      onChange={(e) => setNewVarAttribute(e.target.value)}
                      placeholder="e.g. Volume: 4L or Packaging: Drum"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                      Short Description (Optional)
                    </Label>
                    <Input
                      value={newVarDescription}
                      onChange={(e) => setNewVarDescription(e.target.value)}
                      placeholder="e.g. Factory-sealed container for direct use"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                      SKU (Optional)
                    </Label>
                    <Input
                      value={newVarSku}
                      onChange={(e) => setNewVarSku(e.target.value)}
                      placeholder="Auto-generated if left empty"
                      className="h-9 text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    onClick={handleAddVariation}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4 h-9 gap-1.5"
                  >
                    <Plus size={14} /> Add Variation
                  </Button>
                </div>
              </div>

              {/* Variations List */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 block">
                  Configured Variations ({variations.length})
                </Label>
                {variations.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
                    No variations added yet. Enter variation details above and click &quot;Add Variation&quot;.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                    {variations.map((v, idx) => (
                      <div
                        key={v.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">{v.name}</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {v.sku}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-[11px] text-slate-500 pl-7">{v.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariation(v.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove variation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: PRICING & TAX */}
          {activeStep === "pricing" && (
            <div className="space-y-6">
              {/* SIMPLE PRODUCT PRICING */}
              {!isVariable ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Regular Price (₦) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g. 45000"
                        className="h-10 text-xs rounded-xl font-bold font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">
                        Sale / Discounted Price (₦, Optional)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountPrice}
                        onChange={(e) => setDiscountPrice(e.target.value)}
                        placeholder="Optional promotional price"
                        className="h-10 text-xs rounded-xl font-mono text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Commercial Points Strategy */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-indigo-600" />
                        Commercial Points &amp; Automatic Discount Strategy
                      </Label>
                      <span className="text-[10px] font-bold text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                        Wholesale Qualification Engine
                      </span>
                    </div>

                    <p className="text-[11px] text-indigo-900/80">
                      Configure commercial resale point weight and automatic discount triggered when a customer&apos;s
                      accumulated qualifying point balance reaches this product&apos;s threshold.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <Label className="text-[11px] font-bold text-indigo-950 mb-1 block">
                          Points per Unit
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={pointsPerUnit}
                          onChange={(e) => setPointsPerUnit(e.target.value)}
                          placeholder="e.g. 0.2 or 3"
                          className="h-9 text-xs rounded-xl bg-white font-mono font-bold"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-bold text-indigo-950 mb-1 block">
                          Qualification Threshold (pts)
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={pointsThreshold}
                          onChange={(e) => setPointsThreshold(e.target.value)}
                          placeholder="e.g. 10"
                          className="h-9 text-xs rounded-xl bg-white font-mono font-bold"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-bold text-indigo-950 mb-1 block">
                          Discount Percentage (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={pointsDiscountPercentage}
                          onChange={(e) => setPointsDiscountPercentage(e.target.value)}
                          placeholder="e.g. 10"
                          className="h-9 text-xs rounded-xl bg-white font-mono font-bold text-emerald-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Tax Status</Label>
                      <select
                        value={taxStatus}
                        onChange={(e) =>
                          setTaxStatus(e.target.value as "taxable" | "shipping_only" | "none")
                        }
                        className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-semibold text-slate-800 outline-none"
                      >
                        <option value="taxable">Taxable (Standard VAT)</option>
                        <option value="none">Tax Exempt / None</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Tax Class</Label>
                      <select
                        value={taxClass}
                        onChange={(e) =>
                          setTaxClass(e.target.value as "standard" | "reduced" | "zero")
                        }
                        className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-semibold text-slate-800 outline-none"
                      >
                        <option value="standard">Standard (7.5%)</option>
                        <option value="zero-rate">Zero-rate (0%)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* VARIABLE PRODUCT PRICING */
                <div className="space-y-4">
                  <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-950">
                    <DollarSign size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Variation-Based Pricing &amp; Commercial Points</p>
                      <p className="text-[11px] text-amber-800">
                        Set the individual price, commercial points per unit, and qualification discount for each variation below.
                      </p>
                    </div>
                  </div>

                  {variations.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                      No variations defined. Go back to Step 2 (Variations) to add variations.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variations.map((v, idx) => (
                        <div
                          key={v.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-xs text-slate-900">{v.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">({v.sku})</span>
                            </div>
                            <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {v.pointsPerUnit ?? 0.2} pts/unit
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Regular Price (₦) *
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.price}
                                onChange={(e) =>
                                  handleUpdateVariation(v.id, "price", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                                className="h-8 text-xs font-mono font-bold rounded-xl"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Sale Price (₦)
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.discountPrice ?? ""}
                                onChange={(e) =>
                                  handleUpdateVariation(
                                    v.id,
                                    "discountPrice",
                                    e.target.value ? parseFloat(e.target.value) : undefined
                                  )
                                }
                                placeholder="Optional"
                                className="h-8 text-xs font-mono text-emerald-700 rounded-xl"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] font-bold text-indigo-900 block mb-1">
                                Points / Unit
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={v.pointsPerUnit ?? ""}
                                onChange={(e) =>
                                  handleUpdateVariation(
                                    v.id,
                                    "pointsPerUnit",
                                    e.target.value ? parseFloat(e.target.value) : undefined
                                  )
                                }
                                placeholder="e.g. 0.2"
                                className="h-8 text-xs font-mono rounded-xl bg-indigo-50/50"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] font-bold text-indigo-900 block mb-1">
                                Threshold (pts)
                              </Label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                value={v.pointsThreshold ?? ""}
                                onChange={(e) =>
                                  handleUpdateVariation(
                                    v.id,
                                    "pointsThreshold",
                                    e.target.value ? parseFloat(e.target.value) : undefined
                                  )
                                }
                                placeholder="e.g. 10"
                                className="h-8 text-xs font-mono rounded-xl bg-indigo-50/50"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] font-bold text-indigo-900 block mb-1">
                                Discount (%)
                              </Label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={v.pointsDiscountPercentage ?? ""}
                                onChange={(e) =>
                                  handleUpdateVariation(
                                    v.id,
                                    "pointsDiscountPercentage",
                                    e.target.value ? parseFloat(e.target.value) : undefined
                                  )
                                }
                                placeholder="e.g. 10"
                                className="h-8 text-xs font-mono font-bold text-emerald-700 rounded-xl bg-indigo-50/50"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: INVENTORY */}
          {activeStep === "inventory" && (
            <div className="space-y-4">
              {!isVariable ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Stock Keeping Unit (SKU)</Label>
                    <Input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="e.g. CHE-HCL-001"
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Stock Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="h-10 text-xs rounded-xl font-bold font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Low Stock Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Stock Status</Label>
                    <select
                      value={stockStatus}
                      onChange={(e) =>
                        setStockStatus(e.target.value as "in_stock" | "out_of_stock" | "on_backorder")
                      }
                      className="w-full h-10 rounded-xl border border-slate-300 text-xs bg-white px-3 font-semibold text-slate-800 outline-none"
                    >
                      <option value="in_stock">In Stock</option>
                      <option value="out_of_stock">Out of Stock</option>
                      <option value="on_backorder">On Backorder</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Manage individual stock quantities and thresholds for each variation below:
                  </p>
                  {variations.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                      No variations added yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                      {variations.map((v, idx) => (
                        <div key={v.id} className="p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{v.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{v.sku}</span>
                          </div>

                          <div>
                            <Label className="text-[10px] font-bold text-slate-500 mb-1 block">
                              Stock Units
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={v.stockQuantity ?? 50}
                              onChange={(e) =>
                                handleUpdateVariation(v.id, "stockQuantity", parseInt(e.target.value, 10) || 0)
                              }
                              className="h-8 text-xs font-mono font-bold rounded-xl"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] font-bold text-slate-500 mb-1 block">
                              Low Threshold
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={v.lowStockThreshold ?? 5}
                              onChange={(e) =>
                                handleUpdateVariation(v.id, "lowStockThreshold", parseInt(e.target.value, 10) || 0)
                              }
                              className="h-8 text-xs font-mono rounded-xl"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] font-bold text-slate-500 mb-1 block">
                              Status
                            </Label>
                            <select
                              value={v.stockStatus || "in_stock"}
                              onChange={(e) =>
                                handleUpdateVariation(v.id, "stockStatus", e.target.value)
                              }
                              className="w-full h-8 rounded-xl border border-slate-300 text-xs bg-white px-2 font-semibold outline-none"
                            >
                              <option value="in_stock">In Stock</option>
                              <option value="out_of_stock">Out of Stock</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: MEDIA */}
          {activeStep === "media" && (
            <div className="space-y-6">
              {/* Main Feature Image */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 block">
                    Main Feature Image
                  </Label>
                  <span className="text-[10px] text-slate-400">
                    Upload directly or attach an external image link
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/placeholder.webp";
                      }}
                    />
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    {/* Option 1: Direct File Upload */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-600 block">
                        Option 1: Upload Image File to Cloud
                      </Label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs">
                          {imageUploading ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Upload size={13} />
                          )}
                          <span>{imageUploading ? "Uploading..." : "Browse Image"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleMainImageUpload}
                            disabled={imageUploading}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] text-slate-400">JPEG, PNG, WebP up to 5MB</span>
                      </div>
                    </div>

                    {/* Option 2: Attach Link / URL */}
                    <div className="space-y-1 pt-1">
                      <Label className="text-[11px] font-bold text-slate-600 block">
                        Option 2: Or Attach Image Link / URL
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={manualImageUrl}
                          onChange={(e) => setManualImageUrl(e.target.value)}
                          placeholder="https://... or /images/chemical.jpg"
                          className="h-9 text-xs rounded-xl"
                        />
                        <Button
                          type="button"
                          onClick={handleSetManualImageUrl}
                          className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shrink-0"
                        >
                          Attach Link
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Gallery Images */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 block">
                    Product Gallery ({galleryImages.length} images)
                  </Label>
                  <span className="text-[10px] text-slate-400">
                    Additional product views, packaging, or certificates
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Upload Gallery files */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600 block">
                      Upload Files to Gallery
                    </Label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-300">
                      {galleryUploading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      <span>{galleryUploading ? "Uploading..." : "Add Images from Device"}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleGalleryUpload}
                        disabled={galleryUploading}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Add Gallery URL */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600 block">
                      Or Attach Image Link
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={manualGalleryUrl}
                        onChange={(e) => setManualGalleryUrl(e.target.value)}
                        placeholder="https://... image link"
                        className="h-9 text-xs rounded-xl"
                      />
                      <Button
                        type="button"
                        onClick={handleAddManualGalleryUrl}
                        className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shrink-0"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2">
                    {galleryImages.map((gUrl, gIdx) => (
                      <div
                        key={gIdx}
                        className="relative w-full aspect-square rounded-xl border border-slate-200 overflow-hidden group bg-slate-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gUrl}
                          alt={`Gallery ${gIdx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/placeholder.webp";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(gIdx)}
                          className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-rose-600 hover:text-white rounded-lg shadow-xs transition-colors"
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

          {/* SECTION 6: LINKED PRODUCTS (Final Section) */}
          {activeStep === "linked" && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-950">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Final Step: Product Associations &amp; Cross-sells</p>
                  <p className="text-[11px] text-emerald-800">
                    Select complementary chemicals or upgrades recommended alongside this item.
                    Click &quot;{editingProduct ? "Update Product" : "Create Product"}&quot; below to save.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Upsells */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">
                    Upsells (Higher-grade Alternatives)
                  </Label>
                  <p className="text-[10px] text-slate-400">
                    Products recommended instead of this item (e.g. analytical grade vs technical grade).
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-1">
                    {allProducts
                      .filter((p) => p.id !== editingProduct?.id)
                      .map((p) => {
                        const isSelected = upsellIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setUpsellIds(
                                isSelected
                                  ? upsellIds.filter((id) => id !== p.id)
                                  : [...upsellIds, p.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs border transition-colors ${
                              isSelected
                                ? "bg-orange-50 border-orange-300 font-bold text-orange-950"
                                : "bg-slate-50/50 border-slate-200 hover:bg-slate-100 text-slate-700"
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

                {/* Cross-sells */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">
                    Cross-sells (Complementary Chemicals)
                  </Label>
                  <p className="text-[10px] text-slate-400">
                    Related materials promoted in the shopping cart alongside this purchase.
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-1">
                    {allProducts
                      .filter((p) => p.id !== editingProduct?.id)
                      .map((p) => {
                        const isSelected = crossSellIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setCrossSellIds(
                                isSelected
                                  ? crossSellIds.filter((id) => id !== p.id)
                                  : [...crossSellIds, p.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs border transition-colors ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-300 font-bold text-indigo-950"
                                : "bg-slate-50/50 border-slate-200 hover:bg-slate-100 text-slate-700"
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
            </div>
          )}

          {/* Stepper Footer Navigation */}
          <div className="flex items-center justify-between pt-5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="rounded-xl text-xs gap-1"
                >
                  <ArrowLeft size={13} /> Back
                </Button>
              )}

              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold px-5 gap-1.5"
                >
                  <span>Next: {steps[currentStepIndex + 1]?.label.replace(/^\d+\.\s*/, "")}</span>
                  <ArrowRight size={13} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold px-6 shadow-md shadow-orange-600/20"
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
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
