import PageHeader from "@/components/reusables/PageHeader";
import ContactPageClient from "@/components/reusables/sections/ContactPageClient";
import React from "react";

export default function ContactPage() {
  return (
    <main>
      {/* Page Header */}
      <PageHeader title="Contact & Quotations" />

      {/* Main Content */}
      <section className="container px-4 py-12 md:px-14">
        <ContactPageClient />
      </section>
    </main>
  );
}
