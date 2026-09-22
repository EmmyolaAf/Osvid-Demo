"use client";

import React from "react";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function IntroSectionAbout() {
  return (
    <section className="relative py-20 bg-white overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-20 -left-20 w-64 h-64 bg-osvid-orange/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-osvid-blue/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <div className="flex flex-col-reverse md:flex-row items-center gap-12 lg:gap-16">
          {/* Text Content */}
          <motion.div
            className="w-full md:w-1/2 space-y-6 md:space-y-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              <span className="inline-block mb-3">OSVID is a&nbsp;</span>
              <span className="relative text-osvid-orange">
                <span className="relative z-10">trusted name</span>
                <span
                  className="absolute bottom-0 left-0 w-full h-2 bg-osvid-orange/20 -z-0"
                  style={{ bottom: "5%" }}
                />
              </span>
              <span className="inline">&nbsp;in the Nigerian industry</span>
            </h1>

            <div className="space-y-4">
              <p className="text-lg text-gray-700 leading-relaxed">
                With decades of combined industry experience and a commitment to
                excellence, our products are designed to withstand the demands
                of both small-scale and large-scale projects.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Our passion lies in delivering consistent quality, innovation,
                and customer satisfaction through a wide range of chemical
                products and finishing services.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                asChild
                size="lg"
                className="bg-osvid-blue hover:bg-osvid-orange text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <Link href="/contact">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-osvid-blue text-osvid-blue hover:bg-osvid-blue/5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <Link href="/products">Our Products</Link>
              </Button>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            className="w-full md:w-1/2 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <div className="relative overflow-hidden rounded-xl shadow-2xl">
              <Image
                src="/images/why-osvid.webp"
                alt="High-quality OSVID chemical products in industrial setting"
                width={1080}
                height={720}
                className="w-full h-auto object-cover aspect-video md:aspect-square lg:aspect-video"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -right-6 bg-osvid-orange w-24 h-24 rounded-xl z-[-1] hidden md:block" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
