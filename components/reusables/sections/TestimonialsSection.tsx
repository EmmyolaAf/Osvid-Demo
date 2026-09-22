"use client";

import React from "react";

import { motion } from "framer-motion";
import TestimonialsCarousel from "../TestimonialCarousels";
import { Testimonial } from "@/types";

export default function TestimonialsSection({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  return (
    <section className="bg-gradient-to-b from-orange-50 to-amzer-50 py-16 md:py-24 lg:py-28 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-osvid-orange mix-blend-multiply filter blur-xl"></div>
        <div className="absolute bottom-10 right-20 w-40 h-40 rounded-full bg-osvid-lime mix-blend-multiply filter blur-xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <span className="inline-block text-xs md:text-sm mb-4 font-semibold uppercase tracking-widest text-osvid-orange border-y border-osvid-orange/50 py-1 px-2">
              Client Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
              Hear From Our <span className="text-osvid-orange">Satisfied</span>{" "}
              Clients
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Don&apos;t just take our word for it. Here&apos;s what our clients
              say about their experience with our services.
            </p>
          </motion.div>
        </div>

        {/* Testimonial Carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          viewport={{ once: true }}
        >
          <TestimonialsCarousel testimonials={testimonials} />
        </motion.div>

        {/* Trust Indicators */}
        <div className="mt-20 pt-10 border-t border-orange-100">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="text-center">
              <p className="text-4xl font-bold text-osvid-orange">4.9/5</p>
              <p className="text-gray-600 mt-2">Average Rating</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-osvid-orange">98%</p>
              <p className="text-gray-600 mt-2">Client Satisfaction</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-osvid-orange">250+</p>
              <p className="text-gray-600 mt-2">Happy Clients</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
