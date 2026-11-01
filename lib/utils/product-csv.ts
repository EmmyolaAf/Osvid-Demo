import { Product, ProductType } from "@/types/auth";

export function exportProductsToCSV(products: Product[]): string {
  const headers = [
    "ID",
    "Name",
    "Slug",
    "Product Type",
    "Category",
    "Regular Price (NGN)",
    "Sale Price (NGN)",
    "Stock Quantity",
    "Stock Status",
    "SKU",
    "Barcode",
    "Unit",
    "Weight",
    "Status",
    "Variations Count",
    "Tags",
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = products.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.name),
    escapeCSV(p.slug),
    escapeCSV(p.productType || "simple"),
    escapeCSV(p.category || ""),
    escapeCSV(p.price),
    escapeCSV(p.discountPrice || ""),
    escapeCSV(p.stockQuantity ?? 0),
    escapeCSV(p.stockStatus || "in_stock"),
    escapeCSV(p.sku || ""),
    escapeCSV(p.barcode || ""),
    escapeCSV(p.unit || "kg"),
    escapeCSV(p.weight || ""),
    escapeCSV(p.isActive !== false ? "Active" : "Draft"),
    escapeCSV(p.variations?.length || 0),
    escapeCSV((p.tags || []).join("; ")),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function downloadCSV(csvContent: string, filename: string = "products-export.csv") {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseCSVToProducts(csvText: string): Partial<Product>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const priceIdx = headers.findIndex((h) => h.includes("price") && !h.includes("sale"));
  const salePriceIdx = headers.findIndex((h) => h.includes("sale"));
  const categoryIdx = headers.findIndex((h) => h.includes("category"));
  const skuIdx = headers.findIndex((h) => h.includes("sku"));
  const unitIdx = headers.findIndex((h) => h.includes("unit"));
  const typeIdx = headers.findIndex((h) => h.includes("type"));
  const stockIdx = headers.findIndex((h) => h.includes("stock"));

  const parsedProducts: Partial<Product>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple CSV row parser handling quotes
    const values: string[] = [];
    let insideQuote = false;
    let currentVal = "";

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' && c + 1 < rawLine.length && rawLine[c + 1] === '"') {
        currentVal += '"';
        c++;
      } else if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        values.push(currentVal.trim());
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    const name = nameIdx >= 0 ? values[nameIdx] : "";
    if (!name) continue;

    const rawPrice = priceIdx >= 0 ? parseFloat(values[priceIdx]) : 0;
    const price = !isNaN(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    const rawSale = salePriceIdx >= 0 ? parseFloat(values[salePriceIdx]) : NaN;
    const discountPrice = !isNaN(rawSale) && rawSale > 0 && rawSale < price ? rawSale : undefined;
    const category = categoryIdx >= 0 && values[categoryIdx] ? values[categoryIdx] : "Industrial Chemicals";
    const sku = skuIdx >= 0 && values[skuIdx] ? values[skuIdx] : `SKU-${Date.now().toString().slice(-6)}`;
    const unit = unitIdx >= 0 && values[unitIdx] ? values[unitIdx] : "kg";
    const productType: ProductType = typeIdx >= 0 && ["simple", "variable", "grouped"].includes(values[typeIdx]?.toLowerCase())
      ? (values[typeIdx].toLowerCase() as ProductType)
      : "simple";

    parsedProducts.push({
      name,
      price,
      discountPrice,
      category,
      sku,
      unit,
      productType,
      isActive: true,
      imageUrl: "/images/placeholder.webp",
      stockQuantity: 0,
    });
  }

  return parsedProducts;
}

