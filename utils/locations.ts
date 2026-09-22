import { PickupLocation } from "@/types/checkout.type";

export const fetchPickupLocations = async (): Promise<PickupLocation[]> => {
  try {
    const response = await fetch("/api/pickup-locations");
    if (!response.ok) {
      throw new Error("Failed to fetch pickup locations");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pickup locations:", error);
    throw error;
  }
};
