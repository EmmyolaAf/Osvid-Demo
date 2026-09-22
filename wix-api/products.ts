import { WIX_STORES_APP_ID } from "@/lib/constants";
import { WixClient } from "@/lib/wix-client.base";
import { wixClientServer } from "@/lib/wix-client.server";
import { ProductCategory } from "@/types";
import { cache } from "react";

export type ProductsSort = "last_updated" | "price_asc" | "price_desc";

interface QueryProductsFilter {
  q?: string;
  collectionIds?: string[] | string;
  sort?: ProductsSort;
  priceMin?: number;
  priceMax?: number;
  skip?: number;
  limit?: number;
}

export async function queryProducts(
  wixClient: WixClient,
  {
    q,
    collectionIds,
    sort = "last_updated",
    priceMin,
    priceMax,
    skip,
    limit,
  }: QueryProductsFilter
) {
  let query = wixClient.products.queryProducts();

  if (q) {
    query = query.startsWith("name", q);
  }

  const collectionIdsArray = collectionIds
    ? Array.isArray(collectionIds)
      ? collectionIds
      : [collectionIds]
    : [];

  if (collectionIdsArray.length > 0) {
    query = query.hasSome("collectionIds", collectionIdsArray);
  }

  switch (sort) {
    case "price_asc":
      query = query.ascending("price");
      break;
    case "price_desc":
      query = query.descending("price");
      break;
    case "last_updated":
      query = query.descending("lastUpdated");
      break;
  }

  if (priceMin) {
    query = query.ge("priceData.price", priceMin);
  }

  if (priceMax) {
    query = query.le("priceData.price", priceMax);
  }

  if (limit) query = query.limit(limit);
  if (skip) query = query.skip(skip);

  try {
    return await query.find();
  } catch (error) {
    return { items: [] } as any;
  }
}

export const getProductBySlug = cache(
  async (wixClient: WixClient, slug: string) => {
    const { items } = await wixClient.products
      .queryProducts()
      .eq("slug", slug)
      .limit(1)
      .find();

    const product = items[0];

    if (!product || !product.visible) {
      return null;
    }

    return product;
  }
);

export async function getProductById(wixClient: WixClient, productId: string) {
  const result = await wixClient.products.getProduct(productId);
  return result.product;
}

export async function getRelatedProducts(
  wixClient: WixClient,
  productId: string
) {
  const result = await wixClient.recommendations.getRecommendation(
    [
      {
        _id: "68ebce04-b96a-4c52-9329-08fc9d8c1253", // "From the same categories"
        appId: WIX_STORES_APP_ID,
      },
      {
        _id: "d5aac1e1-2e53-4d11-85f7-7172710b4783", // "Frequenly bought together"
        appId: WIX_STORES_APP_ID,
      },
    ],
    {
      items: [
        {
          appId: WIX_STORES_APP_ID,
          catalogItemId: productId,
        },
      ],
      minimumRecommendedItems: 3,
    }
  );

  const productIds = (result.recommendation?.items ?? [])
    .map((item) => item.catalogItemId)
    .filter((id) => id !== undefined);

  if (!productIds || !productIds.length) return [];

  const productsResult = await wixClient.products
    .queryProducts()
    .in("_id", productIds)
    .limit(4)
    .find();

  return productsResult.items;
}

export const getProductscategories = cache(
  async (): Promise<ProductCategory[]> => {
    try {
      const wixClient = await wixClientServer();
      // Assuming "products_categories" is your collection ID for product categories
      const res = await wixClient.items.query("products_categories").find();

      // Filter and map the items to the ProductCategory type
      // We only want categories that have a title, description, and a valid priority
      const categories: ProductCategory[] = res.items
        .filter(
          (item: any) =>
            typeof item.title === "string" &&
            typeof item.description === "string" &&
            typeof item.priority === "number" &&
            item.priority >= 0 // Assuming priority should be non-negative
        )
        .map((category: any) => ({
          _id: category._id,
          _owner: category._owner,
          _createdDate: category._createdDate,
          _updatedDate: category._updatedDate,
          priority: category.priority,
          title: category.title,
          slug: category.slug,
          imageUrl: category.imageUrl, // Map imageUrl
          description: category.description,
          products: category.products || [], // Default to empty array if no products
          content: category.content || undefined, // Map content
          // Map other fields as needed from your Wix data
        }));

      // Sort the filtered categories by their 'priority' in ascending order (first to last)
      categories.sort((a, b) => a.priority - b.priority);

      return categories;
    } catch (error) {
      console.error("Error fetching product categories:", error);
      // Return an empty array on error to prevent application crashes
      return [];
    }
  }
);
