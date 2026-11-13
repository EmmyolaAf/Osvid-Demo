import { Suspense } from "react";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import WhatsAppButton from "@/components/reusables/WhatsappButton";
import ReactQueryProvider from "../ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";

import "keen-slider/keen-slider.min.css";
import { CartDrawer } from "@/components/reusables/cart";
import VisualEditorToolbar from "@/components/editor/VisualEditorToolbar";
import SiteContentApplier from "@/components/editor/SiteContentApplier";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReactQueryProvider>
      <SiteContentApplier />
      <Header />
      {children}
      <Toaster richColors position="top-right" />
      <Footer />
      <CartDrawer />
      <Suspense fallback={null}>
        <VisualEditorToolbar />
      </Suspense>
      <WhatsAppButton />
    </ReactQueryProvider>
  );
}
