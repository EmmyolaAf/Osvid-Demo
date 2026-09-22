import { wixClientServer } from "@/lib/wix-client.server";
import { cache } from "react";

// Inside wix-client.services.ts
export const getHeroData = cache(async () => {
  try {
    const wixClient = await wixClientServer();
    const res = await wixClient.items
      .query("HeroData")
      .limit(100)
      .ascending("createdAt")
      .find();
    return res.items.map((heroDataItem) => ({
      heading: heroDataItem.heading,
      subheading: heroDataItem.subheading,
      cta: heroDataItem.cta,
      imageUrl: heroDataItem.imageUrl,
      imageAlt: heroDataItem.imageAlt,
    }));
  } catch (error) {
    return [];
  }
});
