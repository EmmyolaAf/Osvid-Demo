import { WixClient } from "@/lib/wix-client.base";

export async function getCompanyData(wixClient: WixClient, itemId: string) {
  const result = await wixClient.ItemsSDK.get("companyData", itemId);
  return result; // The full item object
}
