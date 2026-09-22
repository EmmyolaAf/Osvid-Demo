"use client";

import { WixClientContext } from "@/contexts/wixContext";
import { useContext } from "react";

export const useWixClient = () => {
  return useContext(WixClientContext);
};
