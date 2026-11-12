import PageHeader from "@/components/reusables/PageHeader";
import ContactPageClient from "@/components/reusables/sections/ContactPageClient";
import React from "react";

export default function ContactPage() {
  return (
    <main>
      {/* Page Header */}
      <PageHeader title="Contact & Quotations" />

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 py-10 sm:py-12">
        <ContactPageClient />
      </section>
    </main>
  );
}
