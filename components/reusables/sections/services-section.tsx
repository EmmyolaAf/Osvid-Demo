// components/reusables/sections/services-section.tsx
"use client"; // This component remains a client component if ServiceCategoryCard or other parts use client-side features

import React from "react";
import ServiceCategoryCard from "../cards/ServiceCategoryCard"; // Make sure this path is correct
import Image from "next/image"; // Keep this import for the second background image
import { Service } from "@/types"; // Assuming Service type is defined
// import { motion } from "framer-motion"; // Removed, as its variants were specific to the old hero
import PageHeader from "../PageHeader"; // Import PageHeader

export default function ServicesSection({ services }: { services: Service[] }) {
  // Removed textVariants as it was specific to the old hero section's animation

  return (
    <>
      {/* Replaced the custom hero section with PageHeader */}
      <PageHeader
        title="Our Services"
        description="We deliver reliable and high-quality solutions for every project."
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "Services",
            href: "/services", // Adjust the href if your services page has a different path
          },
        ]}
        // Reusing the background image from the old hero for consistency
      />

      {/* Main Services Content Section */}
      <section className="relative overflow-hidden bg-white py-16 md:py-24">
        {/* Background image - Keep if you want, but ensure it complements content */}
        <div className="absolute inset-0 z-0 opacity-20">
          <Image
            src="/images/bbb.jpg" // This image is still used for the services grid background
            alt="Services Background Pattern"
            fill
            sizes="100vw"
            className="object-cover w-full h-full"
          />
        </div>

        {/* Foreground content */}
        <div className="relative z-10 container px-4 md:px-12">
          {/* Introduction / Headline Area */}
          <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
            <h2 className="text-sm md:text-base font-semibold uppercase w-max border-y py-1 px-4 mx-auto text-osvid-orange border-osvid-orange tracking-wider mb-4">
              Our Comprehensive Services
            </h2>
            <p className="text-3xl md:text-5xl font-bold text-gray-800 leading-tight">
              Bring Your Surfaces to Life and Solutions to Reality
            </p>
            <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you need expert chemical products, flawless surface
              installations, or technical advice you can trust, our team is
              ready to deliver excellence every step of the way.
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 gap-8 md:gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <ServiceCategoryCard
                key={service._id}
                index={index + 1}
                service={service}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
