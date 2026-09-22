"use client";

import React from "react";

import { motion } from "framer-motion";
import Image from "next/image";

export default function HistorySectionAbout() {
  return (
    <section className="relative bg-gray-50 py-20 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-osvid-orange/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-40 w-96 h-96 bg-osvid-blue/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 xl:gap-16">
          {/* Image */}
          <motion.div
            className="w-full lg:w-2/5 relative"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="relative group overflow-hidden rounded-2xl shadow-2xl">
              <Image
                src="/images/ceo.webp"
                alt="OSVID CEO in professional setting"
                width={1080}
                height={1620}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-osvid-orange w-24 h-24 rounded-xl z-[-1] hidden lg:block" />
          </motion.div>

          {/* Text Content */}
          <motion.div
            className="w-full lg:w-3/5 space-y-6 md:space-y-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-1 bg-osvid-orange rounded-full" />
              <span className="text-sm font-semibold uppercase tracking-wider text-osvid-orange">
                Our Journey
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Building Trust Through{" "}
              <span className="text-osvid-orange">Innovation</span>
            </h2>

            <div className="space-y-5">
              <p className="text-lg text-gray-700 leading-relaxed">
                <span className="font-semibold text-osvid-orange">
                  Founded in 2022
                </span>
                , OSVID began with a breakthrough in adhesive coating agents —
                the{" "}
                <span className="font-semibold text-gray-800 underline decoration-osvid-orange/30 decoration-2 underline-offset-4">
                  OSVID SEALANT POLISH (Acrylic Resin)
                </span>
                . This flagship innovation catalyzed early growth and
                established our reputation for quality.
              </p>

              <div className="relative pl-6 border-l-2 border-osvid-orange/20">
                <p className="text-lg text-gray-700 leading-relaxed">
                  Today, OSVID has evolved into a comprehensive solutions
                  provider, offering premium chemical and surface finishing
                  products trusted by professionals across Nigeria.
                </p>
                <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-osvid-orange border-4 border-white" />
              </div>

              <p className="text-lg text-gray-700 leading-relaxed">
                Our journey continues to be guided by three core principles:{" "}
                <span className="font-semibold text-osvid-blue">integrity</span>
                ,{" "}
                <span className="font-semibold text-osvid-blue">
                  reliability
                </span>
                , and{" "}
                <span className="font-semibold text-osvid-blue">
                  continuous innovation
                </span>
                .
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row items-start gap-6 pt-4"
            >
              {/* <Image
                src="/images/written.png"
                alt="CEO Signature"
                width={180}
                height={48}
                className="h-12 w-auto"
              /> */}
              <h3 className="font-medium text-lg md:text-xl">
                Prch. David Osuji
              </h3>
              <div className="text-sm text-gray-500">
                <p className="font-medium">Founder & CEO</p>
                <p>OSVID Chemicals</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
