import PageHeader from "@/components/reusables/PageHeader";
import React from "react";

export default function CartPage() {
  return (
    <main>
      <PageHeader title="Cart" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2>Empty cart currently</h2>
      </section>
    </main>
  );
}
