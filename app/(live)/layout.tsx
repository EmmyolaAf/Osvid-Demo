import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import NextTopLoader from "nextjs-toploader";
import WhatsAppButton from "@/components/reusables/WhatsappButton";
import ReactQueryProvider from "../ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";

import "keen-slider/keen-slider.min.css";
import { CartProvider } from "@/providers/CartProvider";
import { CheckoutProvider } from "@/providers/CheckoutProvider";
import { CartDrawer } from "@/components/reusables/cart";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReactQueryProvider>
      <CartProvider>
        <CheckoutProvider>
          <NextTopLoader />
          <Header />
          {children}
          <Toaster richColors position="top-right" />
          <Footer />
          <CartDrawer />
        </CheckoutProvider>
      </CartProvider>
      <WhatsAppButton />
    </ReactQueryProvider>
  );
}
