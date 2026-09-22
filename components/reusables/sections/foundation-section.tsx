"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import {
  FaCheckCircle,
  FaCogs,
  FaHandshake,
  FaShieldAlt,
} from "react-icons/fa";
import { RevealAnimationWrapper } from "../custom-animation-wrapper";

export default function FoundationSection() {
  return (
    <section className="relative py-24 bg-gradient-to-br from-yellow-50 to-white px-4 md:px-8 lg:px-12 overflow-hidden">
      {/* Background Elements */}
      <div
        className="absolute top-0 left-0 w-full h-full z-0"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-orange-200/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-orange-100/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 xl:gap-16">
          {/* Image Column */}
          <div className="w-full lg:w-1/2 relative">
            <div className="relative h-[500px] lg:h-[600px] rounded-2xl shadow-2xl">
              <Image
                fill
                loading="lazy"
                quality={90}
                src="/images/about-section.webp"
                alt="OSVID team working on construction project"
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" /> */}
            </div>

            {/* Experience Badge */}
            <div className="absolute -bottom-8 z-40 -left-8 w-40 h-40 md:w-48 md:h-48">
              <div className="relative w-full h-full">
                <Image
                  height={920}
                  width={1080}
                  loading="lazy"
                  quality={100}
                  src="/images/experience.png"
                  alt="Decorative gear icon signifying experience" // More descriptive alt text
                  className="w-48 h-48  object-cover animate-spin [animation-duration:6s] " // Corrected animation duration
                />{" "}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                    <span className="text-2xl md:text-3xl font-bold text-white">
                      3+
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Column */}
          <div className="w-full lg:w-1/2 space-y-8">
            <RevealAnimationWrapper trigger="scroll" index={0.4}>
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span className="text-sm font-medium text-orange-800 uppercase tracking-wider">
                    About OSVID Chemicals Ltd.
                  </span>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                  Building Trust Through{" "}
                  <span className="text-orange-500">Quality</span>
                </h2>

                <p className="text-lg text-gray-600 leading-relaxed">
                  At{" "}
                  <strong className="text-gray-800">
                    OSVID Chemicals Ltd.
                  </strong>
                  , we don&apos;t just supply products - we deliver
                  <strong className="text-gray-800"> confidence</strong>. Our
                  journey from pioneering acrylic sealants to becoming a
                  nationwide standard reflects our commitment to excellence in
                  every solution we provide.
                </p>
              </div>
            </RevealAnimationWrapper>

            <RevealAnimationWrapper trigger="scroll" index={0.5}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    icon: <FaShieldAlt className="text-orange-500 text-xl" />,
                    title: "Certified-Grade Products",
                    description:
                      "Rigorously tested materials that exceed industry standards for performance and longevity.",
                  },
                  {
                    icon: <FaCogs className="text-orange-500 text-xl" />,
                    title: "Technical Expertise",
                    description:
                      "On-demand support from our team of formulation specialists and application experts.",
                  },
                  {
                    icon: <FaHandshake className="text-orange-500 text-xl" />,
                    title: "Trusted Nationwide",
                    description:
                      "Preferred supplier for leading construction firms and engineering projects across Nigeria.",
                  },
                  {
                    icon: <FaCheckCircle className="text-orange-500 text-xl" />,
                    title: "Quality Commitment",
                    description:
                      "We stand behind every product with comprehensive warranties and guarantees.",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RevealAnimationWrapper>

            <RevealAnimationWrapper trigger="scroll" index={0.6}>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Button
                    asChild
                    className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-base hover:shadow-lg transition-all"
                  >
                    <Link href="/about">
                      Learn More <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    className="h-14 px-6 border-orange-500 text-orange-500 hover:bg-orange-50 rounded-lg text-base"
                  >
                    <Link href="/contact">Contact Our Experts</Link>
                  </Button>
                </div>
              </div>
            </RevealAnimationWrapper>
          </div>
        </div>
      </div>
    </section>
  );
}
