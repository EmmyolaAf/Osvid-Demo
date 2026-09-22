import { getWixPublicDataClient } from "@/lib/wix-client.server";
import { cache } from "react";

// Inside wix-client.services.ts
export const getServices = cache(async () => {
  try {
    const wixClient = getWixPublicDataClient();
    const res = await wixClient.items
      .query("Services")
      .limit(100)
      .ascending("createdAt")
      .find();
    if (res.items && res.items.length > 0) {
      return res.items
        .map((service) => ({
          _id: service._id,
          title: service.title,
          slug: service.slug,
          description: service.description,
          image: service.image1,
          createdAt: service.createdAt,
          priority: service.priority,
        }))
        .sort((a, b) => a.priority - b.priority);
    }
  } catch (e) {
    // Return local fallback on error
  }
  return (await import("@/data/services")).default.map((s) => ({
    _id: String(s.id),
    title: s.title,
    slug: s.slug,
    description: s.description,
    image: s.image,
    createdAt: new Date().toISOString(),
    priority: s.id,
  }));
});
