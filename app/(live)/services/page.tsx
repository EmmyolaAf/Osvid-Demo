// app/services/page.tsx
import React from "react";
import { getServices } from "@/wix-api/services";
import ServicesSection from "@/components/reusables/sections/services-section";
import CTASection from "@/components/reusables/sections/cta"; // Assuming your CTA component path is correct

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <main>
      <ServicesSection services={services} />

      {/* CTA Section - Encourages users to take action */}
      <CTASection
        heading="Ready to Enhance Your Surfaces?"
        subheading="Whether it's for a commercial project or a home renovation, our experts are ready to provide unparalleled solutions."
      />
    </main>
  );
}
