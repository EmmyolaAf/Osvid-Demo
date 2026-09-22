// components/reusables/cards/ServiceCategoryCard.tsx
"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { stripHtmlTags } from "@/helpers/text";
import { Service } from "@/types";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface ServiceCategoryCardProps {
  index: number;
  service: Service;
  className?: string; // Added for custom styling
}

export default function ServiceCategoryCard({
  index,
  service,
  className = "",
}: ServiceCategoryCardProps) {
  const cardDescription = stripHtmlTags(service.description);
  const animationDelay = index * 0.1;

  return (
    <Link
      href={`/services/${service.slug}`}
      aria-label={`View ${service.title} service`}
    >
      <motion.div
        className={`group relative bg-white border-b-4 border-osvid-orange shadow-md
                   hover:shadow-xl hover:border-osvid-lime transition-all duration-300 ease-in-out
                   cursor-pointer h-full flex flex-col justify-between overflow-hidden
                   ${className}`} // Added className prop
        whileHover={{
          y: -8,
          scale: 1.02, // Added subtle scale on hover
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: animationDelay,
          ease: [0.16, 1, 0.3, 1], // Custom easing for smoother animation
        }}
        whileTap={{ scale: 0.98 }} // Added tap feedback
      >
        {/* Image Section with Loading State */}
        <div className="relative w-full h-72 md:h-80 overflow-hidden">
          <Image
            src={service.image || "/images/default-service-image.webp"}
            alt={service.title}
            width={720}
            height={520}
            quality={90}
            className="w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105" // Reduced scale for subtlety
            priority={index < 3} // Only prioritize first few images
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-2xl font-extrabold text-gray-900 mb-3 group-hover:text-osvid-orange transition-colors duration-300">
            {service.title}
          </h3>

          <p className="text-gray-700 leading-relaxed line-clamp-4 mb-4">
            {cardDescription}
          </p>
        </div>

        {/* CTA Section */}
        <div className="px-6 pb-6 flex items-center justify-between text-osvid-orange font-semibold group-hover:text-osvid-lime transition-colors duration-300">
          <span>Explore Service</span>
          <ArrowRight
            className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-2"
            aria-hidden="true"
          />
        </div>
      </motion.div>
    </Link>
  );
}
