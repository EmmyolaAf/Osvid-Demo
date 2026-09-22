import { env } from "@/env";
import { files } from "@wix/media";
import { createClient, ApiKeyStrategy, Tokens, OAuthStrategy } from "@wix/sdk";
import { cache } from "react";
import { WIX_SESSION_COOKIE } from "./constants";
import { products } from "@wix/stores";
import { items } from "@wix/data";
import { getWixClient } from "./wix-client.base";
import { cookies } from "next/headers";

export const wixClientServer = async () => {
  let refreshToken;

  try {
    const cookieStore = await cookies();
    refreshToken = JSON.parse(cookieStore.get("refreshToken")?.value || "{}");
  } catch (error) {
    // Static generation safe fallback
  }

  const wixClient = createClient({
    modules: { products, items },
    auth: OAuthStrategy({
      clientId: process.env.NEXT_PUBLIC_WIX_CLIENT_ID || "",
      tokens: {
        refreshToken,
        accessToken: {
          value: "",
          expiresAt: 0,
        },
      },
    }),
  });

  return wixClient;
};

export const getWixServerClient = cache(async () => {
  let tokens: Tokens | undefined;

  try {
    const cookieStore = await cookies();
    tokens = JSON.parse(cookieStore.get(WIX_SESSION_COOKIE)?.value || "{}");
  } catch (error) {
    // Static generation safe fallback
  }

  return getWixClient(tokens);
});

export const getWixAdminClient = cache(() => {
  const wixClient = createClient({
    modules: {
      files,
    },
    auth: ApiKeyStrategy({
      apiKey: env.WIX_API_KEY,
      siteId: env.NEXT_PUBLIC_WIX_SITE_ID,
    }),
  });

  return wixClient;
});

// --- NEW CLIENT FOR PUBLIC DATA QUERIES ---
export const getWixPublicDataClient = cache(() => {
  const wixClient = createClient({
    modules: {
      items,
      products,
    },
    auth: ApiKeyStrategy({
      apiKey: env.WIX_API_KEY, // Use your Wix API Key
      siteId: env.NEXT_PUBLIC_WIX_SITE_ID, // Use your Wix Site ID
    }),
  });
  return wixClient;
});
