import { Product } from "@/types";
import { wixClientServer } from "./wix-client.server";
/* eslint-disable @typescript-eslint/no-explicit-any */

// src/lib/fetchers.ts
export const fetchProducts = async (
  page: number = 1,
  limit: number = 9
): Promise<Product[]> => {
  const wixClient = await wixClientServer();
  const res = await wixClient.products
    .queryProducts()
    .skip((page - 1) * limit)
    .limit(limit)
    .find();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.items.map((item: any) => {
    let imageUrl = item.media?.mainMedia?.image?.url;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://static.wixstatic.com/${imageUrl}`;
    } else if (imageUrl && !imageUrl.includes("static.wixstatic.com")) {
      imageUrl = `https://static.wixstatic.com/${imageUrl.split("/").pop()}`;
    }

    return {
      _id: item._id,
      name: item.name,
      description: item.description?.plainText,
      price: item.priceData?.price,
      image: imageUrl,
      imageWidth: item.media?.mainMedia?.image?.width,
      imageHeight: item.media?.mainMedia?.image?.height,
      cartItemId: item.cartItemId ?? "", // or generate a default value if needed
      slug: item.slug ?? "", // or generate from name if needed
      quantity: item.quantity ?? 1, // default to 1 if not present
    };
  });
};
