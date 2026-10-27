import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Product } from "@/types/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const PRODUCTS_FILE_PATH = path.join(process.cwd(), "data", "products.json");

async function readProductsFile(): Promise<Product[]> {
  try {
    const data = await fs.readFile(PRODUCTS_FILE_PATH, "utf8");
    return JSON.parse(data) as Product[];
  } catch (err) {
    console.warn("Could not read data/products.json, returning empty list:", err);
    return [];
  }
}

async function writeProductsFile(products: Product[]): Promise<void> {
  const dir = path.dirname(PRODUCTS_FILE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  try {
    const products = await readProductsFile();
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    console.error("GET /api/admin/products error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch products" }, { status: 500 });
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

    const products = await readProductsFile();
    const now = new Date().toISOString();
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug =
      product.slug ||
      product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const newProduct: Product = {
      id,
      name: product.name.trim(),
      slug,
      description: product.description?.trim() || "",
      price,
      discountPrice:
        product.discountPrice !== undefined && product.discountPrice !== null && !isNaN(Number(product.discountPrice))
          ? Number(product.discountPrice)
          : undefined,
      stockQuantity: Number(product.stockQuantity) || 0,
      reservedQuantity: Number(product.reservedQuantity) || 0,
      category: product.category?.trim() || "Industrial Chemicals",
      categorySlug:
        product.categorySlug ||
        product.category
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") ||
        "industrial-chemicals",
      imageUrl: product.imageUrl?.trim() || "/images/placeholder.webp",
      galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [product.imageUrl || "/images/placeholder.webp"],
      unit: product.unit?.trim() || "kg",
      sku: product.sku?.trim() || `OSV-${Date.now().toString().slice(-6)}`,
      isFeatured: Boolean(product.isFeatured),
      features: Array.isArray(product.features) ? product.features : [],
      specifications: product.specifications || {},
      suggestedProductIds: Array.isArray(product.suggestedProductIds) ? product.suggestedProductIds : [],
      isActive: product.isActive !== false,
      createdAt: product.createdAt || now,
      updatedAt: now,
    };

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

    // Persist to disk
    await writeProductsFile(products);

    // Dual-write to Firestore in background
    adminDb
      .collection("products")
      .doc(id)
      .set(newProduct, { merge: true })
      .catch((fsErr) => {
        console.warn("Firestore background product sync warning:", fsErr?.message || fsErr);
      });

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

    const products = await readProductsFile();
    const filtered = products.filter((p) => p.id !== id);
    await writeProductsFile(filtered);

    // Background Firestore deletion
    adminDb
      .collection("products")
      .doc(id)
      .delete()
      .catch((err) => {
        console.warn("Firestore product deletion warning:", err);
      });

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message || "Failed to delete product" }, { status: 500 });
  }
}
