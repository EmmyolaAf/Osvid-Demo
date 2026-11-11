import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Product } from "@/types/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const PRODUCTS_FILE_PATH = path.join(process.cwd(), "data", "products.json");

function cleanObject<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

async function readProductsFile(): Promise<Product[]> {
  try {
    const data = await fs.readFile(PRODUCTS_FILE_PATH, "utf8");
    return JSON.parse(data) as Product[];
  } catch (err) {
    return [];
  }
}

async function writeProductsFile(products: Product[]): Promise<void> {
  try {
    const dir = path.dirname(PRODUCTS_FILE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not write backup data/products.json:", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authoritative: Fetch from Firestore
    const snap = await adminDb.collection("products").orderBy("createdAt", "desc").get();
    if (!snap.empty) {
      const firestoreProducts: Product[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          slug: data.slug || d.id,
          description: data.description || "",
          shortDescription: data.shortDescription || "",
          productType: data.productType || "simple",
          price: Number(data.price) || 0,
          discountPrice: data.discountPrice ? Number(data.discountPrice) : undefined,
          stockQuantity: Number(data.stockQuantity) || 0,
          reservedQuantity: Number(data.reservedQuantity) || 0,
          manageStock: data.manageStock !== false,
          stockStatus: data.stockStatus || "in_stock",
          category: data.category || "General",
          categorySlug: data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-"),
          imageUrl: data.imageUrl || "/images/placeholder.webp",
          galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
          unit: data.unit || "kg",
          sku: data.sku || "",
          isFeatured: Boolean(data.isFeatured),
          isActive: data.isActive !== false,
          features: Array.isArray(data.features) ? data.features : [],
          specifications: data.specifications || {},
          tags: Array.isArray(data.tags) ? data.tags : [],
          suggestedProductIds: Array.isArray(data.suggestedProductIds) ? data.suggestedProductIds : [],
          crossSellIds: Array.isArray(data.crossSellIds) ? data.crossSellIds : [],
          upsellIds: Array.isArray(data.upsellIds) ? data.upsellIds : [],
          pricingTierId: data.pricingTierId || undefined,
          pricingTierName: data.pricingTierName || undefined,
          pricingTiers: Array.isArray(data.pricingTiers) ? data.pricingTiers : undefined,
          volumeDiscountThreshold:
            data.volumeDiscountThreshold !== undefined ? Number(data.volumeDiscountThreshold) : undefined,
          volumeDiscountPercentage:
            data.volumeDiscountPercentage !== undefined ? Number(data.volumeDiscountPercentage) : undefined,
          volumeUnit: data.volumeUnit || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        } as Product;
      });

      // Passive backup sync to local file
      writeProductsFile(firestoreProducts).catch(() => {});
      return NextResponse.json({ success: true, products: firestoreProducts });
    }

    // Fallback to local file if Firestore returned 0 docs
    const products = await readProductsFile();
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    console.error("GET /api/admin/products error:", err);
    // Fallback to local file on transport error
    const products = await readProductsFile();
    return NextResponse.json({ success: true, products });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize caller
    const user = await requireAuthenticatedUser(req);
    if (!user.isSuperAdmin && !user.isAdmin && !user.permissions?.canManageProducts) {
      return NextResponse.json(
        { error: "Forbidden: You lack operational permission to manage products." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { product } = body;

    if (!product || !product.name || !product.name.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    const price = Number(product.price);
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Valid non-negative price is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug =
      product.slug ||
      product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const newProduct: Product = cleanObject({
      id,
      name: product.name.trim(),
      slug,
      description: product.description?.trim() || "",
      shortDescription: product.shortDescription?.trim() || "",
      productType: product.productType || "simple",
      price,
      discountPrice:
        product.discountPrice !== undefined && product.discountPrice !== null && !isNaN(Number(product.discountPrice))
          ? Number(product.discountPrice)
          : undefined,
      saleStartDate: product.saleStartDate || undefined,
      saleEndDate: product.saleEndDate || undefined,
      stockQuantity: Number(product.stockQuantity) || 0,
      reservedQuantity: Number(product.reservedQuantity) || 0,
      manageStock: product.manageStock !== false,
      stockStatus: product.stockStatus || "in_stock",
      allowBackorders: product.allowBackorders || "no",
      lowStockThreshold: product.lowStockThreshold !== undefined ? Number(product.lowStockThreshold) : 5,
      category: product.category?.trim() || "Industrial Chemicals",
      categorySlug:
        product.categorySlug ||
        product.category
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") ||
        "industrial-chemicals",
      imageUrl: product.imageUrl?.trim() || "/images/placeholder.webp",
      galleryImages: Array.isArray(product.galleryImages) && product.galleryImages.length > 0 ? product.galleryImages : [product.imageUrl || "/images/placeholder.webp"],
      unit: product.unit?.trim() || "kg",
      sku: product.sku?.trim() || `OSV-${Date.now().toString().slice(-6)}`,
      barcode: product.barcode?.trim() || undefined,
      weight: product.weight?.trim() || undefined,
      dimensions: product.dimensions?.trim() || undefined,
      isFeatured: Boolean(product.isFeatured),
      features: Array.isArray(product.features) ? product.features : [],
      specifications: product.specifications || {},
      tags: Array.isArray(product.tags) ? product.tags : [],
      suggestedProductIds: Array.isArray(product.suggestedProductIds) ? product.suggestedProductIds : [],
      crossSellIds: Array.isArray(product.crossSellIds) ? product.crossSellIds : [],
      upsellIds: Array.isArray(product.upsellIds) ? product.upsellIds : [],
      groupedProductIds: Array.isArray(product.groupedProductIds) ? product.groupedProductIds : [],
      attributes: Array.isArray(product.attributes) ? product.attributes : [],
      variations: Array.isArray(product.variations) ? product.variations : [],
      taxStatus: product.taxStatus || "taxable",
      taxClass: product.taxClass || "standard",
      averageRating: typeof product.averageRating === "number" ? product.averageRating : 5.0,
      reviewCount: typeof product.reviewCount === "number" ? product.reviewCount : 0,
      pricingTierId: product.pricingTierId || undefined,
      pricingTierName: product.pricingTierName || undefined,
      pricingTiers: Array.isArray(product.pricingTiers) ? product.pricingTiers : undefined,
      volumeDiscountThreshold:
        product.volumeDiscountThreshold !== undefined &&
        product.volumeDiscountThreshold !== null &&
        !isNaN(Number(product.volumeDiscountThreshold))
          ? Number(product.volumeDiscountThreshold)
          : undefined,
      volumeDiscountPercentage:
        product.volumeDiscountPercentage !== undefined &&
        product.volumeDiscountPercentage !== null &&
        !isNaN(Number(product.volumeDiscountPercentage))
          ? Number(product.volumeDiscountPercentage)
          : undefined,
      volumeUnit: product.volumeUnit?.trim() || undefined,
      isActive: product.isActive !== false,
      createdAt: product.createdAt || now,
      updatedAt: now,
    });

    // Authoritative write to Firestore - must succeed!
    await adminDb.collection("products").doc(id).set(newProduct, { merge: true });

    // Sync local backup file
    const products = await readProductsFile();
    const existingIndex = products.findIndex((p) => p.id === id);
    if (existingIndex >= 0) {
      products[existingIndex] = {
        ...products[existingIndex],
        ...newProduct,
        stockQuantity: product.omitStock ? products[existingIndex].stockQuantity : newProduct.stockQuantity,
        createdAt: products[existingIndex].createdAt || now,
        updatedAt: now,
      };
    } else {
      products.unshift(newProduct);
    }
    await writeProductsFile(products);

    return NextResponse.json({
      success: true,
      message: existingIndex >= 0 ? "Product updated successfully!" : "Product added to catalog successfully!",
      product: newProduct,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/products error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to commit product to database." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (!user.isSuperAdmin && !user.isAdmin && !user.permissions?.canManageProducts) {
      return NextResponse.json(
        { error: "Forbidden: You lack operational permission to delete products." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Authoritative deletion from Firestore
    await adminDb.collection("products").doc(id).delete();

    // Sync local backup file
    const products = await readProductsFile();
    const filtered = products.filter((p) => p.id !== id);
    await writeProductsFile(filtered);

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message || "Failed to delete product" }, { status: 500 });
  }
}
