import { getWixPublicDataClient } from "@/lib/wix-client.server";
import { cache } from "react";

export const getTeam = cache(async () => {
  try {
    const wixClient = getWixPublicDataClient();
    const res = await wixClient.items
      .query("teams")
      .limit(10)
      .ascending("createdAt")
      .find();
    return res.items.map((team) => ({
      _id: team._id,
      name: team.name,
      role: team.role,
      imageUrl: team.imageUrl,
    }));
  } catch (error) {
    return [];
  }
});
