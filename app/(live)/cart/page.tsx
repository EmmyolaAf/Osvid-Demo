import PageHeader from "@/components/reusables/PageHeader";
import React from "react";

export default function CartPage() {
  return (
    <main>
      <PageHeader title="Cart" />

      <section className="container py-12">
        <h2>Empty cart currently</h2>
      </section>
    </main>
  );
}
