// src/components/reusables/ProductCategoryCard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button"; // Assuming this path is correct
import { ProductCategory } from "@/types";
import Image from "next/image";
import { getWixStaticImageUrl } from "@/utils/wixImageUtils";

interface ProductCategoryCardProps {
  category: ProductCategory;
}

export default function ProductCategoryCard({
  category,
}: ProductCategoryCardProps) {
  // Construct the URL for the category detail page
  const categoryDetailUrl = `/products/${category.slug}`;

  // console.log(category);

  console.log(getWixStaticImageUrl(category.imageUrl));

  return (
    <div className="group relative block w-full rounded-lg overflow-hidden h-max shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out cursor-pointer border border-gray-200 bg-white">
      {/* The Link wraps the content that should lead to the detail page */}

      <Image
        src={
          getWixStaticImageUrl(category.imageUrl) ||
          "/images/default-category-image.webp"
        } // Fallback image
        alt={category.title}
        width={520} // Adjust width as needed
        height={720} // Adjust height as needed
        quality={90} // Adjust quality for better performance
        className="w-full h-60 md:h-72 object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
      />
      <Link
        href={categoryDetailUrl}
        className="absolute inset-0 z-10"
        aria-label={`View details for ${category._id}`}
      >
        {/* We use an invisible Link overlay and put interactive elements (buttons) on top */}
      </Link>

      <div className="relative p-6 flex flex-col h-full z-20">
        <h3 className="text-2xl font-bold text-osvid-blue mb-3">
          {category.title}
        </h3>
        <p className="text-gray-700 text-base mb-6 flex-grow leading-relaxed">
          {category.description}
        </p>

        <Button
          asChild
          className="flex-1 bg-osvid-orange hover:bg-orange-600 text-white transition-colors py-3 text-base"
        >
          <Link href={categoryDetailUrl}> Learn more</Link>
        </Button>
      </div>
    </div>
  );
}
