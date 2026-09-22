"use client";

import { FaVial, FaHandshake, FaUsers } from "react-icons/fa";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { FadeInAnimationWrapper } from "../custom-animation-wrapper";
import Link from "next/link";

export default function WhyChooseOsvid() {
  const features = [
    {
      title: "Top-Grade Materials",
      description:
        "Our products are formulated and tested to meet the highest standards of strength, durability, and performance across industrial and domestic applications.",
      icon: <FaVial className="text-orange-500" />,
      bgColor: "bg-orange-50",
    },
    {
      title: "Customer-First Approach",
      description:
        "We prioritize long-term partnerships over transactions — offering personalized guidance, tailored support, and reliable service at every stage.",
      icon: <FaHandshake className="text-orange-500" />,
      bgColor: "bg-orange-50",
    },
    {
      title: "Professional Application Services",
      description:
        "Our trained surface applicators and engineers deliver expert installation and finishing for flawless, lasting results you can trust.",
      icon: <FaUsers className="text-orange-500" />,
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <section className="relative py-24 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[800px] h-[800px] bg-orange-50/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <FadeInAnimationWrapper
              key={index}
              type="fadeInY"
              index={index}
              className="h-full"
            >
              <div
                className={`h-full p-8 rounded-2xl ${feature.bgColor} shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col`}
              >
                <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center mb-6 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 flex-grow">{feature.description}</p>
              </div>
            </FadeInAnimationWrapper>
          ))}
        </div>

        {/* CTA Section */}
        <div className="flex flex-col lg:flex-row items-center gap-12 xl:gap-16 bg-white rounded-3xl p-8 md:p-12 shadow-xl">
          {/* Image Stack */}
          <div className="w-full lg:w-1/2 relative">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/images/epoxy-resin.jpg"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                alt="OSVID professional at work"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -right-6 w-2/3 h-2/3 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
              <Image
                src="/images/why-osvid.webp"
                fill
                sizes="(max-width: 768px) 66vw, 33vw"
                className="object-cover"
                alt="OSVID team consultation"
                loading="lazy"
              />
            </div>
          </div>

          {/* CTA Content */}
          <div className="w-full lg:w-1/2 space-y-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              When quality matters,{" "}
              <span className="text-orange-500">OSVID delivers</span>
            </h2>
            <p className="text-lg text-gray-600">
              Choose OSVID for uncompromised quality and dedicated service in
              every project. Our team is ready to bring your vision to life with
              expertise and precision.
            </p>
            <Button
              asChild
              className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-lg hover:shadow-lg transition-all"
            >
              <Link href="/contact">
                Get in touch <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
