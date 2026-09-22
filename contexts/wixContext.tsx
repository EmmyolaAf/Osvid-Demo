"use client";

import { products } from "@wix/stores";
import { createClient, OAuthStrategy } from "@wix/sdk";
import Cookies from "js-cookie";
import { createContext, ReactNode } from "react";

const refreshToken = JSON.parse(Cookies.get("refreshToken") || "{}");

//To access the Wix APIs, create a client with the createClient() function imported from the @wix/sdk package.
const wixClient = createClient({
  modules: { products },
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

export type WixClient = typeof wixClient;

export const WixClientContext = createContext<WixClient>(wixClient);

export const WixClientContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <WixClientContext.Provider value={wixClient}>
      {children}
    </WixClientContext.Provider>
  );
};
