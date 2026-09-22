import { getWixPublicDataClient } from "@/lib/wix-client.server";
import { getWixStaticImageUrl } from "@/utils/wixImageUtils";
import { cache } from "react";

// Inside wix-client.testimonial.ts
export const getTestimonials = cache(async () => {
  try {
    const wixClient = await getWixPublicDataClient();
    const res = await wixClient.items
      .query("testimonials")
      .limit(100)
      .ascending("createdAt")
      .find();
    if (res.items && res.items.length > 0) {
      return res.items.map((testimonial) => ({
        _id: testimonial._id,
        name: testimonial.name,
        role: testimonial.role,
        imageUrl: getWixStaticImageUrl(testimonial.imageUrl),
        content: testimonial.content,
        rating: testimonial.rating,
      }));
    }
  } catch (e) {
    // Return fallback
  }
  return (await import("@/data/testimonials")).default.map((t, idx) => ({
    _id: String(idx + 1),
    name: t.name,
    role: t.role,
    imageUrl: t.imageUrl,
    content: t.content,
    rating: t.rating,
  }));
});
