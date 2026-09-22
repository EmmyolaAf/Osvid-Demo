// src/components/reusables/PageHeader.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link"; // Import Link for breadcrumbs

// Define BreadcrumbItem type
interface BreadcrumbItem {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  description?: string; // Optional description
  breadcrumbs?: BreadcrumbItem[]; // Optional array of breadcrumb items
  bgImageSrc?: string; // Optional custom background image URL
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  bgImageSrc,
}: PageHeaderProps) {
  // Use custom image or fallback to default
  const imageUrl = bgImageSrc || "/images/bgs/page-header.webp"; // Reverted default back to page-header.webp

  return (
    <section className="relative h-[40vh] md:min-h-[50vh] w-full overflow-hidden flex items-end justify-start pb-8 px-4 sm:px-6 lg:px-14">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        <Image
          src={imageUrl}
          alt={`${title} Background`}
          fill
          priority // Ensures the image is loaded with high priority for LCP
          sizes="100vw"
          className="object-cover w-full h-full"
        />
        {/* Gradient Overlay for Sleek UI */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, var(--osvid-blue-rgb) 70%, transparent 100%)", // Gradient from left (osvid-blue) to right (transparent)
            opacity: 0.9, // Adjust overall opacity of the gradient here
            backdropFilter: "blur(4px)", // Apply a subtle blur to the background behind the gradient
          }}
        />
      </div>

      <div className="container">
        {/* Content Container (Left-aligned) */}
        <div className="relative  z-10 text-left  w-full">
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="mb-4 text-sm text-gray-200" aria-label="breadcrumb">
              <ol className="flex space-x-2">
                {breadcrumbs.map((item, index) => (
                  <li key={item.href} className="flex items-center">
                    <Link
                      href={item.href}
                      className="hover:text-osvid-orange transition-colors"
                    >
                      {item.label}
                    </Link>
                    {index < breadcrumbs.length - 1 && (
                      <span className="mx-2 text-gray-400">/</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Separator Line */}
          <div className="w-20 h-1 bg-osvid-orange mb-4 animate-fade-in delay-100" />
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight drop-shadow-lg animate-fade-in-up delay-200">
            {title}
          </h1>
          {/* Description */}
          {description && (
            <p className="mt-4 text-lg md:text-xl text-gray-200 drop-shadow-md max-w-2xl animate-fade-in-up delay-300">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
