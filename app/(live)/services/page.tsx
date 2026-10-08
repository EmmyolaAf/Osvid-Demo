// app/(live)/services/page.tsx
import React from "react";
import { getServices } from "@/lib/firebase/storefront";
import ServicesSection from "@/components/reusables/sections/services-section";
import CTASection from "@/components/reusables/sections/cta";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import PageHeader from "@/components/reusables/PageHeader";

export const revalidate = 3600; // 1-hour ISR for chemical services

export default async function ServicesPage() {
  const result = await getServices();
  const services = result.success ? result.data : [];

  return (
    <main>
      <PageHeader
        title="Industrial Application Services"
        description="Comprehensive surface preparation, epoxy flooring, industrial coating, and chemical treatment solutions."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Services", href: "/services" },
        ]}
      />

      {!result.success ? (
        <section className="container mx-auto py-16 px-4">
          <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center shadow-sm">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h2 className="text-base font-bold text-red-900 mb-1">
              Unable to Load Chemical Services
            </h2>
            <p className="text-xs text-red-700 mb-4">{result.error}</p>
            <Link href="/services">
              <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs">
                Retry
              </Button>
            </Link>
          </div>
        </section>
      ) : (
        <ServicesSection services={services} />
      )}

      {/* CTA Section */}
      <CTASection
        heading="Ready to Enhance Your Surfaces?"
        subheading="Whether it's for a commercial project or industrial facility, our chemical engineers are ready to deliver precision results."
      />
    </main>
  );
}
