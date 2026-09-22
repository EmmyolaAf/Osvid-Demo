// src/components/reusables/TrustBuildingSection.tsx
"use client";

import React from "react";
import { ShieldCheck, Truck } from "lucide-react"; // Icons
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"; // Shadcn Accordion
import Link from "next/link"; // For internal links

export default function TrustBuildingSection() {
  return (
    <section className="bg-osvid-cream py-16 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold text-osvid-blue mb-12">
          Shop with Confidence
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Secure Payment Card */}
          <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-100 flex flex-col items-center justify-center hover:shadow-2xl transition-shadow duration-300">
            <ShieldCheck className="w-16 h-16 text-osvid-orange mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Secure Payments
            </h3>
            <p className="text-gray-700 text-base leading-relaxed mb-4">
              We offer multiple secure payment options, including direct bank
              transfers and POS at our outlets, ensuring your transactions are
              always safe and protected.
            </p>
            <Link
              href="/#payment-methods"
              className="text-osvid-blue hover:text-osvid-orange font-semibold transition-colors mt-auto"
            >
              Learn More about Payment Methods &rarr;
            </Link>
          </div>

          {/* Nationwide Delivery Card */}
          <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-100 flex flex-col items-center justify-center hover:shadow-2xl transition-shadow duration-300">
            <Truck className="w-16 h-16 text-osvid-orange mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Nationwide Delivery
            </h3>
            <p className="text-gray-700 text-base leading-relaxed mb-4">
              Enjoy fast and reliable delivery of our premium chemical products
              to any location across Nigeria, ensuring your supplies arrive when
              you need them.
            </p>
            <Accordion
              type="single"
              collapsible
              className="w-full max-w-md mt-auto"
            >
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-osvid-blue hover:text-osvid-orange font-semibold text-center w-full justify-center">
                  Terms & Conditions Apply
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm p-2 text-left bg-gray-50 rounded-b-md border-t border-gray-100">
                  Delivery times may vary based on location and order size.
                  Additional charges may apply for remote areas or expedited
                  delivery. For full details, please refer to our dedicated{" "}
                  <Link
                    href="/shipping-policy"
                    className="underline hover:no-underline text-osvid-blue"
                  >
                    Shipping Policy
                  </Link>
                  .
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
