import type { Metadata, Viewport } from "next";
import "./globals.css";

import { clashDisplay } from "@/fonts";
import companyData from "@/data/company";
import "keen-slider/keen-slider.min.css";
import InstantPreloader from "@/components/reusables/InstantPreloader";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: companyData.openGraph.title,
  description: companyData.description,
  keywords: companyData.keywords,
  openGraph: companyData.openGraph,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="scroll-smooth scroll-pt-20"
      suppressHydrationWarning
    >
      <body className={`${clashDisplay.variable} antialiased bg-white`}>
        <AuthProvider>
          <InstantPreloader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
