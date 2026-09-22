// src/components/reusables/sections/TrustHeroSection.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button"; // Assuming this path is correct

export default function TrustHeroSection() {
  return (
    <section
      className="relative w-full h-[550px] md:h-[650px] flex items-center justify-center text-center px-4"
      style={{
        backgroundImage: "url('/images/bgs/hero-trust-bg.webp')", // Placeholder background image
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed", // Creates a parallax-like effect on scroll
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>

      {/* Content */}
      <div className="relative z-10 text-white max-w-4xl mx-auto flex flex-col items-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-in-up">
          Your Infallible Partner in Quality & Progress
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl mb-10 opacity-0 animate-fade-in delay-200">
          At OSVID Chemicals, we deliver premium solutions built on trust,
          consistency, and results. Experience the difference of unparalleled
          quality.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-in delay-400">
          <Button
            asChild
            className="bg-osvid-orange hover:bg-orange-600 text-white text-lg px-8 py-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Link href="/shop">Explore Our Products</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-2 border-white text-white bg-transparent hover:bg-white hover:text-osvid-blue text-lg px-8 py-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Link href="/contact?inquiry=general-quote">Get a Free Quote</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
