"use client";

import React, { useState } from "react";
import {
  Product,
  ProductCategory,
  PricingTierGroup,
  PricingTierItem,
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
  Gauge,
  Percent,
  Wand2,
  Flame,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
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
import { savePricingTierInDb } from "@/lib/firebase/firestore";
import { generateCartesianCombinations } from "@/lib/pricing/variant-pricing-engine";
import { VariantDiscountDrawer } from "./VariantDiscountDrawer";
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

  // Pricing & Discounts
  const [price, setPrice] = useState(editingProduct ? editingProduct.price.toString() : "");
  const [discountPrice, setDiscountPrice] = useState(
    editingProduct?.discountPrice ? editingProduct.discountPrice.toString() : ""
  );
  const [saleStartDate, setSaleStartDate] = useState(editingProduct?.saleStartDate || "");
  const [saleEndDate, setSaleEndDate] = useState(editingProduct?.saleEndDate || "");
  const [pricingTierId, setPricingTierId] = useState(editingProduct?.pricingTierId || "");
  const [discountMode, setDiscountMode] = useState<"existing" | "custom" | "none">(
    editingProduct?.pricingTierId
      ? "existing"
      : editingProduct?.pricingTiers && editingProduct.pricingTiers.length > 0
      ? "custom"
      : "existing"
  );
  const [customTierName, setCustomTierName] = useState(
    editingProduct?.pricingTierName || "Volume Quantity Discount"
  );
  const [customTiers, setCustomTiers] = useState<PricingTierItem[]>(
    editingProduct?.pricingTiers && editingProduct.pricingTiers.length > 0
      ? editingProduct.pricingTiers
      : [
          { minQuantity: 5, discountPercentage: 5 },
          { minQuantity: 10, discountPercentage: 10 },
        ]
  );
  const [volumeDiscountThreshold, setVolumeDiscountThreshold] = useState(
    editingProduct?.volumeDiscountThreshold !== undefined
      ? editingProduct.volumeDiscountThreshold.toString()
      : ""
  );
  const [volumeDiscountPercentage, setVolumeDiscountPercentage] = useState(
    editingProduct?.volumeDiscountPercentage !== undefined
      ? editingProduct.volumeDiscountPercentage.toString()
      : ""
  );
  const [volumeUnit, setVolumeUnit] = useState(
    editingProduct?.volumeUnit || editingProduct?.unit || "Liters"
  );
  const [isSavingCustomTierToGlobal, setIsSavingCustomTierToGlobal] = useState(false);
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

  // Combinatorial & Drawer state
  const [combinatorialMode, setCombinatorialMode] = useState<"cartesian" | "manual">("cartesian");
  const [drawerVariantIndex, setDrawerVariantIndex] = useState<number | null>(null);

  // Bulk fill inputs state
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const [bulkCapacity, setBulkCapacity] = useState("");

  const handleGenerateCartesianMatrix = () => {
    const validAttrs = attributes.filter(
      (a) => a.name.trim().length > 0 && Array.isArray(a.values) && a.values.length > 0
    );

    if (validAttrs.length === 0) {
      toast.error("Please configure at least one attribute with values before generating permutations.");
      return;
    }

    try {
      const combos = generateCartesianCombinations(validAttrs, 300);
      if (combos.length === 0) {
        toast.info("No combinations could be produced from current attributes.");
        return;
      }

      const productSlugPart = (slug || name || "SKU")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 15);

      const parsedBasePrice = parseFloat(price) || 0;
      const parsedStock = parseInt(stockQuantity, 10) || 50;

      const generated: ProductVariation[] = combos.map((combo, idx) => {
        // Find existing match to preserve customized prices/tiers
        const existing = variations.find((v) => {
          const vAttrs = v.attributes || {};
          return Object.entries(combo.attributes).every(([k, val]) => vAttrs[k] === val);
        });

        if (existing) {
          return existing;
        }

        const skuSuffix = Object.values(combo.attributes)
          .map((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))
          .join("-");

        const varSku = `${productSlugPart.toUpperCase()}-${skuSuffix || idx + 1}`;

        // Smart capacity detection (e.g. "4L Canister" -> 4, "120L Drum" -> 120)
        let detectedCapacity = 1;
        for (const val of Object.values(combo.attributes)) {
          const match = val.match(/(\d+(\.\d+)?)\s*(l|liter|litres|kg|g|ml)/i);
          if (match) {
            detectedCapacity = parseFloat(match[1]);
            break;
          }
        }

        return {
          id: `var_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          sku: varSku,
          price: parsedBasePrice,
          regularPrice: parsedBasePrice,
          priceOverride: parsedBasePrice > 0 ? parsedBasePrice : undefined,
          stockQuantity: parsedStock,
          stockStatus: "in_stock",
          manageStock: true,
          capacity: detectedCapacity,
          capacityUnit: volumeUnit || unit || "Liters",
          attributes: combo.attributes,
          isActive: true,
        };
      });

      setVariations(generated);
      toast.success(
        `Generated ${generated.length} permutation ${generated.length === 1 ? "variant" : "variants"}!`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate combinations.");
    }
  };

  const handleApplyBulkPrice = () => {
    const p = parseFloat(bulkPrice);
    if (isNaN(p) || p < 0) {
      toast.error("Please enter a valid price amount.");
      return;
    }
    setVariations(
      variations.map((v) => ({
        ...v,
        price: p,
        regularPrice: p,
        priceOverride: p,
      }))
    );
    toast.success(`Applied ₦${p.toLocaleString()} regular price to all ${variations.length} variants.`);
    setBulkPrice("");
  };

  const handleApplyBulkStock = () => {
    const s = parseInt(bulkStock, 10);
    if (isNaN(s) || s < 0) {
      toast.error("Please enter a valid stock quantity.");
      return;
    }
    setVariations(
      variations.map((v) => ({
        ...v,
        stockQuantity: s,
        stockStatus: s > 0 ? "in_stock" : "out_of_stock",
      }))
    );
    toast.success(`Applied stock quantity of ${s} to all ${variations.length} variants.`);
    setBulkStock("");
  };

  const handleApplyBulkCost = () => {
    const c = parseFloat(bulkCost);
    if (isNaN(c) || c < 0) {
      toast.error("Please enter a valid cost amount.");
      return;
    }
    setVariations(
      variations.map((v) => ({
        ...v,
        costPrice: c,
      }))
    );
    toast.success(`Applied cost price of ₦${c.toLocaleString()} to all ${variations.length} variants.`);
    setBulkCost("");
  };

  const handleApplyBulkCapacity = () => {
    const cap = parseFloat(bulkCapacity);
    if (isNaN(cap) || cap <= 0) {
      toast.error("Please enter a valid capacity amount.");
      return;
    }
    setVariations(
      variations.map((v) => ({
        ...v,
        capacity: cap,
      }))
    );
    toast.success(`Applied capacity of ${cap} ${volumeUnit || "L"} to all ${variations.length} variants.`);
    setBulkCapacity("");
  };

  const handleClearAllVariations = () => {
    if (confirm("Are you sure you want to remove all configured variations?")) {
      setVariations([]);
      toast.info("All variations cleared.");
    }
  };

  // Custom Live Pricing Tiers Helpers
  const handleAddCustomTier = () => {
    const lastTier = customTiers[customTiers.length - 1];
    const nextMin = lastTier ? lastTier.minQuantity + 5 : 5;
    const nextPct = lastTier ? Math.min(100, lastTier.discountPercentage + 5) : 5;
    setCustomTiers([...customTiers, { minQuantity: nextMin, discountPercentage: nextPct }]);
  };

  const handleRemoveCustomTier = (idx: number) => {
    if (customTiers.length <= 1) {
      toast.warning("At least one tier bracket is required in custom mode.");
      return;
    }
    setCustomTiers(customTiers.filter((_, i) => i !== idx));
  };

  const handleUpdateCustomTier = (idx: number, field: keyof PricingTierItem, val: any) => {
    const copy = [...customTiers];
    copy[idx] = { ...copy[idx], [field]: Number(val) || 0 };
    setCustomTiers(copy);
  };

  const handleSaveCustomTierGlobally = async () => {
    if (!customTierName.trim()) {
      toast.error("Please provide a name for this pricing scheme.");
      return;
    }
    try {
      setIsSavingCustomTierToGlobal(true);
      const res = await savePricingTierInDb({
        name: customTierName.trim(),
        description: `Created from product "${name || "Catalogue Product"}"`,
        tiers: customTiers,
        isActive: true,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save discount scheme.");
        return;
      }
      toast.success(`Pricing scheme "${customTierName}" saved to global Discounts library!`);
      if (res.data?.id) {
        setPricingTierId(res.data.id);
        setDiscountMode("existing");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save pricing tier to database.");
    } finally {
      setIsSavingCustomTierToGlobal(false);
    }
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
      capacity: 1,
      capacityUnit: volumeUnit || unit || "Liters",
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

    let tierId: string | undefined = undefined;
    let tierName: string | undefined = undefined;
    let tiersToSave: PricingTierItem[] | undefined = undefined;

    if (discountMode === "existing" && pricingTierId) {
      const selectedGroup = pricingTierGroups.find((g) => g.id === pricingTierId);
      if (selectedGroup) {
        tierId = selectedGroup.id;
        tierName = selectedGroup.name;
        tiersToSave = selectedGroup.tiers;
      }
    } else if (discountMode === "custom") {
      const validCustom = customTiers.filter((t) => t.minQuantity > 0 && t.discountPercentage > 0);
      if (validCustom.length > 0) {
        tierName = customTierName.trim() || "Custom Product Tiers";
        tiersToSave = validCustom;
      }
    }

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
      pricingTierId: tierId,
      pricingTierName: tierName,
      pricingTiers: tiersToSave,
      volumeDiscountThreshold:
        volumeDiscountThreshold !== "" && !isNaN(Number(volumeDiscountThreshold))
          ? Number(volumeDiscountThreshold)
          : undefined,
      volumeDiscountPercentage:
        volumeDiscountPercentage !== "" && !isNaN(Number(volumeDiscountPercentage))
          ? Number(volumeDiscountPercentage)
          : undefined,
      volumeUnit: volumeUnit.trim() || undefined,
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
      variations: variations.map((v) => ({
        id: v.id,
        sku: v.sku?.trim() || "",
        price: Number(v.priceOverride || v.regularPrice || v.price || numPrice),
        regularPrice: Number(v.regularPrice || v.priceOverride || v.price || numPrice),
        priceOverride:
          v.priceOverride !== undefined && !isNaN(Number(v.priceOverride))
            ? Number(v.priceOverride)
            : undefined,
        costPrice:
          v.costPrice !== undefined && !isNaN(Number(v.costPrice)) ? Number(v.costPrice) : undefined,
        minPriceFloor:
          v.minPriceFloor !== undefined && !isNaN(Number(v.minPriceFloor))
            ? Number(v.minPriceFloor)
            : undefined,
        stockQuantity: parseInt(String(v.stockQuantity), 10) || 0,
        stockStatus: v.stockStatus || "in_stock",
        manageStock: v.manageStock !== false,
        weight: v.weight?.trim() || undefined,
        weightKg:
          v.weightKg !== undefined && !isNaN(Number(v.weightKg)) ? Number(v.weightKg) : undefined,
        imageUrl: v.imageUrl?.trim() || undefined,
        attributes: v.attributes || {},
        isActive: v.isActive !== false,
        capacity:
          v.capacity !== undefined && !isNaN(Number(v.capacity)) ? Number(v.capacity) : undefined,
        capacityUnit: v.capacityUnit?.trim() || volumeUnit || unit || "Liters",
        pricingTierId: v.pricingTierId || undefined,
        pricingTierName: v.pricingTierName || undefined,
        pricingTiers: v.pricingTiers && v.pricingTiers.length > 0 ? v.pricingTiers : undefined,
        discountType: v.discountType || undefined,
        discountValue:
          v.discountValue !== undefined && !isNaN(Number(v.discountValue))
            ? Number(v.discountValue)
            : undefined,
        badgeText: v.badgeText?.trim() || undefined,
        startsAt: v.startsAt || undefined,
        endsAt: v.endsAt || undefined,
        isFlashSaleActive: Boolean(v.isFlashSaleActive),
      })),
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

              {/* Bulk & Volume Discounting Strategy */}
              <div className="bg-orange-50/50 border border-orange-200/80 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-100 pb-3">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag size={14} className="text-orange-600" />
                      Bulk &amp; Tiered Discounting Strategy
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Select a reusable scheme from the Discounts screen or build custom tiers live right here.
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="inline-flex rounded-xl bg-orange-100/70 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDiscountMode("existing")}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        discountMode === "existing"
                          ? "bg-white text-orange-900 shadow-xs font-bold"
                          : "text-orange-700 hover:text-orange-950"
                      }`}
                    >
                      Select Scheme
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountMode("custom")}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        discountMode === "custom"
                          ? "bg-white text-orange-900 shadow-xs font-bold"
                          : "text-orange-700 hover:text-orange-950"
                      }`}
                    >
                      Custom Live Tiers
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountMode("none");
                        setPricingTierId("");
                      }}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        discountMode === "none"
                          ? "bg-white text-orange-900 shadow-xs font-bold"
                          : "text-orange-700 hover:text-orange-950"
                      }`}
                    >
                      No Tiers
                    </button>
                  </div>
                </div>

                {/* MODE 1: SELECT EXISTING SCHEME */}
                {discountMode === "existing" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-slate-700">
                        Select Pricing Tier Scheme (From Discounts Screen)
                      </Label>
                      {pricingTierId && (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                          Scheme Linked
                        </span>
                      )}
                    </div>
                    <select
                      value={pricingTierId}
                      onChange={(e) => setPricingTierId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                    >
                      <option value="">Choose a pre-configured scheme...</option>
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
                    <p className="text-[10px] text-slate-400">
                      Need new global tier templates? You can manage them in Dashboard &gt; Discounts &gt; Pricing Tiers.
                    </p>
                  </div>
                )}

                {/* MODE 2: CUSTOM LIVE TIERS BUILDER */}
                {discountMode === "custom" && (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-orange-200/60 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1">
                        <Label className="text-[11px] font-bold text-slate-700">Custom Scheme Name</Label>
                        <Input
                          value={customTierName}
                          onChange={(e) => setCustomTierName(e.target.value)}
                          placeholder="e.g. Chemical Volume Discount"
                          className="mt-1 h-8 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSaveCustomTierGlobally}
                          disabled={isSavingCustomTierToGlobal}
                          className="h-8 text-xs font-semibold gap-1 text-orange-700 hover:bg-orange-50"
                        >
                          <Sparkles size={12} className="text-orange-500" />
                          {isSavingCustomTierToGlobal ? "Saving..." : "Save to Global Schemes"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddCustomTier}
                          className="h-8 text-xs font-bold gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Plus size={12} /> Add Tier Bracket
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {customTiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-orange-50/40 border border-orange-100 text-xs"
                        >
                          <div className="flex-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Min Quantity ({unit || "units"})
                            </Label>
                            <Input
                              type="number"
                              min="2"
                              value={tier.minQuantity}
                              onChange={(e) => handleUpdateCustomTier(idx, "minQuantity", e.target.value)}
                              className="h-8 rounded-lg text-xs font-bold"
                            />
                          </div>

                          <div className="flex-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Discount Percentage (%)
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              max="95"
                              value={tier.discountPercentage}
                              onChange={(e) =>
                                handleUpdateCustomTier(idx, "discountPercentage", e.target.value)
                              }
                              className="h-8 rounded-lg text-xs font-bold text-orange-600"
                            />
                          </div>

                          <div className="flex-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Override Unit Price (Optional NGN)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Auto calculated"
                              value={tier.unitPrice || ""}
                              onChange={(e) =>
                                handleUpdateCustomTier(
                                  idx,
                                  "unitPrice",
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCustomTier(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 pt-4"
                            title="Remove tier bracket"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VOLUME EQUIVALENT WHOLESALE THRESHOLD */}
                <div className="pt-2 border-t border-orange-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Gauge size={14} className="text-orange-600" />
                      Cumulative Volume Wholesale Threshold (Cross-Variant)
                    </Label>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Wholesale Stacking
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    Set a cumulative volume trigger (e.g. 120 Liters). If a customer purchases smaller container sizes that combine to meet this threshold (e.g. 30 × 4L = 120L) or buys a large unit (e.g. 1 × 120L drum), the wholesale discount automatically activates for all items!
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] font-bold text-slate-700">Volume Threshold</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 120"
                        value={volumeDiscountThreshold}
                        onChange={(e) => setVolumeDiscountThreshold(e.target.value)}
                        className="mt-1 h-9 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-slate-700">Wholesale Discount (%)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        placeholder="e.g. 10"
                        value={volumeDiscountPercentage}
                        onChange={(e) => setVolumeDiscountPercentage(e.target.value)}
                        className="mt-1 h-9 rounded-xl text-xs font-bold text-orange-600"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-slate-700">Volume Unit</Label>
                      <Input
                        placeholder="Liters, kg, Gallons"
                        value={volumeUnit}
                        onChange={(e) => setVolumeUnit(e.target.value)}
                        className="mt-1 h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {volumeDiscountThreshold && volumeDiscountPercentage && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs flex items-center gap-2">
                      <Sparkles size={14} className="text-emerald-600 shrink-0" />
                      <span>
                        <strong>Wholesale Rule Active:</strong> Any cart combination reaching{" "}
                        <strong>
                          {volumeDiscountThreshold} {volumeUnit || "Liters"}
                        </strong>{" "}
                        will receive a <strong>{volumeDiscountPercentage}% bulk discount</strong> automatically.
                      </span>
                    </div>
                  )}
                </div>
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

          {/* TAB 4: VARIATIONS & ATTRIBUTES (COMBINATORIAL CREATION WIZARD) */}
          {activeTab === "variations" && productType === "variable" && (
            <div className="space-y-6">
              {/* 1. ATTRIBUTE GROUPS & OPTIONS BUILDER */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Layers size={14} className="text-orange-600" />
                      1. Multi-Attribute Dimensions &amp; Option Builder
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Define dimensions (e.g. Size, Packaging, Grade, Flavor) and their respective option values.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
                      {attributes.length} {attributes.length === 1 ? "Dimension" : "Dimensions"}
                    </span>
                    {attributes.length > 0 && (
                      <span className="text-[11px] font-mono font-bold text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-full">
                        {attributes.reduce((acc, a) => acc * Math.max(1, a.values.length), 1)} Permutations
                      </span>
                    )}
                  </div>
                </div>

                {/* Configured Attributes List */}
                {attributes.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {attributes.map((attr) => (
                      <div
                        key={attr.id}
                        className="p-3 rounded-xl bg-white border border-slate-200/90 text-xs shadow-2xs flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                            {attr.name}
                          </strong>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttribute(attr.id)}
                            className="h-6 w-6 text-rose-600 hover:bg-rose-50 p-0 rounded-md"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {attr.values.map((val) => (
                            <span
                              key={val}
                              className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-[10px]"
                            >
                              {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Attribute Dimension Row */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Add New Attribute Group
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Dimension name (e.g. Packaging, Size, Color)"
                      value={newAttrName}
                      onChange={(e) => setNewAttrName(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                    <Input
                      placeholder="Values comma separated: 4L Canister, 20L Jerrycan, 120L Drum"
                      value={newAttrValues}
                      onChange={(e) => setNewAttrValues(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                    <Button
                      type="button"
                      onClick={handleAddAttribute}
                      className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1 shadow-xs"
                    >
                      <Plus size={13} /> Add Dimension
                    </Button>
                  </div>
                </div>

                {/* Mode Selector & Cartesian Generation Trigger */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCombinatorialMode("cartesian")}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                        combinatorialMode === "cartesian"
                          ? "bg-orange-600 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      Cartesian Permutations (Combined Matrix)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCombinatorialMode("manual")}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                        combinatorialMode === "manual"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      Manual / Single Option Mode
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {combinatorialMode === "cartesian" ? (
                      <Button
                        type="button"
                        onClick={handleGenerateCartesianMatrix}
                        className="h-9 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                      >
                        <Wand2 size={13} /> Generate Cartesian Matrix Permutations
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleAddVariation}
                        className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 shadow-sm"
                      >
                        <Plus size={13} /> Add Single SKU
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. BULK FILL ACTIONS TOOLBAR */}
              {variations.length > 0 && (
                <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                      <SlidersHorizontal size={12} />
                      Bulk Matrix Fill Actions ({variations.length} SKUs configured)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllVariations}
                      className="h-6 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 p-1 rounded-md"
                    >
                      Clear All Matrix Rows
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    {/* Bulk Price */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Regular ₦"
                        value={bulkPrice}
                        onChange={(e) => setBulkPrice(e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyBulkPrice}
                        className="h-8 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold px-2 rounded-lg shrink-0"
                      >
                        Set Price
                      </Button>
                    </div>

                    {/* Bulk Stock */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Stock Qty"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyBulkStock}
                        className="h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[10px] font-bold px-2 rounded-lg shrink-0"
                      >
                        Set Stock
                      </Button>
                    </div>

                    {/* Bulk Cost */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Cost ₦"
                        value={bulkCost}
                        onChange={(e) => setBulkCost(e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyBulkCost}
                        className="h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[10px] font-bold px-2 rounded-lg shrink-0"
                      >
                        Set Cost
                      </Button>
                    </div>

                    {/* Bulk Capacity */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Cap (L/kg)"
                        value={bulkCapacity}
                        onChange={(e) => setBulkCapacity(e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyBulkCapacity}
                        className="h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[10px] font-bold px-2 rounded-lg shrink-0"
                      >
                        Set Cap
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CARTESIAN MATRIX TABLE UI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Variant SKUs &amp; Independent Discount Matrices
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Each SKU possesses its own pricing, stock, volume ladders, flash deals, and cost floors.
                    </p>
                  </div>
                  {variations.length > 0 && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                      {variations.length} Active SKUs
                    </span>
                  )}
                </div>

                {variations.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
                    <p className="font-semibold text-slate-600">No variant SKUs generated yet.</p>
                    <p className="text-[11px]">
                      Add attribute dimensions above and click &quot;Generate Cartesian Matrix Permutations&quot; to populate your SKU catalog.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          <tr>
                            <th className="py-3 px-3">Variant Dimensions</th>
                            <th className="py-3 px-3">SKU Code</th>
                            <th className="py-3 px-3">Regular (₦)</th>
                            <th className="py-3 px-3">Cost (₦)</th>
                            <th className="py-3 px-3">Stock</th>
                            <th className="py-3 px-3">Capacity</th>
                            <th className="py-3 px-3">Volume Tiers &amp; Sales</th>
                            <th className="py-3 px-3 text-center">Status</th>
                            <th className="py-3 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {variations.map((v, idx) => {
                            const hasTiers = Array.isArray(v.pricingTiers) && v.pricingTiers.length > 0;
                            const hasFlash = Boolean(v.isFlashSaleActive && v.discountValue);
                            const hasFloor = Boolean(v.minPriceFloor && v.minPriceFloor > 0);

                            return (
                              <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                                {/* Dimensions Badges */}
                                <td className="py-2.5 px-3 min-w-[140px]">
                                  {Object.keys(v.attributes || {}).length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(v.attributes).map(([k, val]) => (
                                        <span
                                          key={k}
                                          className="text-[10px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80"
                                        >
                                          {val}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Default</span>
                                  )}
                                </td>

                                {/* SKU Input */}
                                <td className="py-2.5 px-3 min-w-[130px]">
                                  <Input
                                    value={v.sku}
                                    onChange={(e) => handleUpdateVariation(idx, "sku", e.target.value)}
                                    className="h-8 text-xs font-mono font-bold rounded-lg"
                                  />
                                </td>

                                {/* Regular Price Override */}
                                <td className="py-2.5 px-3 min-w-[100px]">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={v.regularPrice !== undefined ? v.regularPrice : v.price}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      handleUpdateVariation(idx, "regularPrice", val);
                                      handleUpdateVariation(idx, "price", val);
                                      handleUpdateVariation(idx, "priceOverride", val);
                                    }}
                                    className="h-8 text-xs font-bold text-slate-900 rounded-lg text-right"
                                  />
                                </td>

                                {/* Cost Price */}
                                <td className="py-2.5 px-3 min-w-[90px]">
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Cost"
                                    value={v.costPrice !== undefined ? v.costPrice : ""}
                                    onChange={(e) =>
                                      handleUpdateVariation(
                                        idx,
                                        "costPrice",
                                        e.target.value ? parseFloat(e.target.value) : undefined
                                      )
                                    }
                                    className="h-8 text-xs font-mono rounded-lg text-right"
                                  />
                                </td>

                                {/* Stock Quantity */}
                                <td className="py-2.5 px-3 min-w-[80px]">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={v.stockQuantity}
                                    onChange={(e) =>
                                      handleUpdateVariation(
                                        idx,
                                        "stockQuantity",
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    className="h-8 text-xs rounded-lg text-center font-bold"
                                  />
                                </td>

                                {/* Capacity / Unit */}
                                <td className="py-2.5 px-3 min-w-[90px]">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="0.1"
                                      step="any"
                                      value={v.capacity !== undefined ? v.capacity : 1}
                                      onChange={(e) =>
                                        handleUpdateVariation(
                                          idx,
                                          "capacity",
                                          e.target.value ? parseFloat(e.target.value) : 1
                                        )
                                      }
                                      className="h-8 w-14 text-xs rounded-lg text-center font-mono font-bold"
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                                      {v.capacityUnit || volumeUnit || "L"}
                                    </span>
                                  </div>
                                </td>

                                {/* Per-Variant Discount Trigger Button */}
                                <td className="py-2.5 px-3 min-w-[170px]">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDrawerVariantIndex(idx)}
                                    className={`h-8 rounded-xl text-[11px] font-bold gap-1 px-2.5 transition-all shadow-2xs ${
                                      hasTiers || hasFlash || hasFloor
                                        ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                                        : "hover:border-slate-300 text-slate-700"
                                    }`}
                                  >
                                    <Tag size={12} className={hasTiers || hasFlash ? "text-orange-600" : "text-slate-400"} />
                                    <span>
                                      {hasTiers
                                        ? `🪜 ${v.pricingTiers?.length} Tiers`
                                        : hasFlash
                                        ? `🔥 ${v.discountValue}% Sale`
                                        : "+ Configure Discounts"}
                                    </span>
                                    {hasFloor && (
                                      <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-mono ml-0.5">
                                        Floor
                                      </span>
                                    )}
                                  </Button>
                                </td>

                                {/* Active Status */}
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={v.isActive !== false}
                                    onChange={(e) =>
                                      handleUpdateVariation(idx, "isActive", e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
                                  />
                                </td>

                                {/* Remove Action */}
                                <td className="py-2.5 px-3 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveVariation(idx)}
                                    className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
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

        {/* PER-VARIANT DISCOUNT DRAWER DIALOG */}
        {drawerVariantIndex !== null && variations[drawerVariantIndex] && (
          <VariantDiscountDrawer
            isOpen={drawerVariantIndex !== null}
            onClose={() => setDrawerVariantIndex(null)}
            variant={variations[drawerVariantIndex]}
            variantIndex={drawerVariantIndex}
            baseProductPrice={parseFloat(price) || 0}
            onSaveVariantDiscount={(idx, updates) => {
              const copy = [...variations];
              copy[idx] = { ...copy[idx], ...updates };
              setVariations(copy);
              toast.success(
                `Discounting rules applied to SKU ${copy[idx].sku || `#${idx + 1}`}!`
              );
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
