"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ServiceCategoryCard from "../cards/ServiceCategoryCard";
import { Service } from "@/types";
import { useSwipeable } from "react-swipeable";
import { useWindowSize } from "@/hooks/useWindowSize"; // Custom hook for window size

// Improved chunking function with type safety
function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [];
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

// Animation variants for smoother transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0.5,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0.5,
    scale: 0.95,
  }),
};

// Responsive breakpoints configuration
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export default function FeaturedServicesSection({
  services,
  title = "Featured Services",
  description = "Explore our top services",
}: {
  services: Service[];
  title?: string;
  description?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const { width } = useWindowSize();

  // Determine chunk size based on responsive breakpoints
  const getChunkSize = useCallback(() => {
    if (!width) return 1;
    if (width >= BREAKPOINTS.lg) return 3;
    if (width >= BREAKPOINTS.md) return 2;
    return 1;
  }, [width]);

  const chunkSize = getChunkSize();
  const slides = chunkArray(services, chunkSize);

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1) return;

    const interval = setInterval(() => {
      paginate(1);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, currentIndex, slides.length]);

  // Navigation handlers
  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection);
      setCurrentIndex(
        (prev) => (prev + newDirection + slides.length) % slides.length
      );
    },
    [slides.length]
  );

  // Swipe handlers for touch devices
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => paginate(1),
    onSwipedRight: () => paginate(-1),
    trackMouse: true,
  });

  // Enhanced transition settings
  const transition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    duration: 0.5,
  } as const;

  // Dot indicators for navigation
  const renderDots = () => (
    <div className="flex justify-center mt-6 space-x-2">
      {slides.map((_, index) => (
        <button
          key={index}
          onClick={() => {
            setDirection(index > currentIndex ? 1 : -1);
            setCurrentIndex(index);
          }}
          className={`w-3 h-3 rounded-full transition-all ${
            index === currentIndex
              ? "bg-osvid-orange w-6"
              : "bg-gray-300 hover:bg-gray-400"
          }`}
          aria-label={`Go to slide ${index + 1}`}
        />
      ))}
    </div>
  );

  return (
    <section
      className="relative w-full px-4 py-12 md:py-16 bg-gray-50"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      {...swipeHandlers}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {title}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        <div className="relative">
          {/* Navigation Arrows */}
          {slides.length > 1 && (
            <>
              <button
                onClick={() => paginate(-1)}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-4 md:-translate-x-8 bg-white text-gray-700 rounded-full p-2 shadow-lg hover:bg-gray-100 hover:text-osvid-orange transition-all focus:outline-none focus:ring-2 focus:ring-osvid-orange"
                aria-label="Previous slide"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => paginate(1)}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-4 md:translate-x-8 bg-white text-gray-700 rounded-full p-2 shadow-lg hover:bg-gray-100 hover:text-osvid-orange transition-all focus:outline-none focus:ring-2 focus:ring-osvid-orange"
                aria-label="Next slide"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Slides Container */}
          <div className="relative overflow-hidden px-8 md:px-12">
            <AnimatePresence
              initial={false}
              custom={direction}
              mode="popLayout"
            >
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
                className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              >
                {slides[currentIndex]?.map((service, index) => (
                  <ServiceCategoryCard
                    index={index}
                    key={service._id}
                    service={service}
                    className="h-full"
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Dots */}
          {slides.length > 1 && renderDots()}
        </div>
      </div>
    </section>
  );
}
