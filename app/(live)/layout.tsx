import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import WhatsAppButton from "@/components/reusables/WhatsappButton";
import ReactQueryProvider from "../ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";

import "keen-slider/keen-slider.min.css";
import { CartProvider } from "@/providers/CartProvider";
import { CheckoutProvider } from "@/providers/CheckoutProvider";
import { CartDrawer } from "@/components/reusables/cart";
import VisualEditorToolbar from "@/components/editor/VisualEditorToolbar";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReactQueryProvider>
      <CartProvider>
        <CheckoutProvider>
          <Header />
          {children}
          <Toaster richColors position="top-right" />
          <Footer />
          <CartDrawer />
          <VisualEditorToolbar />
        </CheckoutProvider>
      </CartProvider>
      <WhatsAppButton />
    </ReactQueryProvider>
  );
}
