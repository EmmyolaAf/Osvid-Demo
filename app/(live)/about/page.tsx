export const dynamic = "force-dynamic";

import React from "react";

import { getTeam } from "@/wix-api/teams";
import companyData from "@/data/company";
import CTASection from "@/components/reusables/sections/cta";
import PageHeader from "@/components/reusables/PageHeader";
import MissionVisionCard from "@/components/reusables/cards/MisionVisionCard";
import getCoreValueIcon from "@/helpers/getHelperIcon";
import IntroSectionAbout from "@/components/reusables/sections/about/IntroSection.about";
import HistorySectionAbout from "@/components/reusables/sections/about/HistorySection.about";
import TeamSectionAbout from "@/components/reusables/sections/about/TeamSection.about";

export default async function AboutPage() {
  const teamMembers = await getTeam();

  return (
    <main>
      {/* HERO SECTION - Uses PageHeader */}
      <PageHeader
        title="About Us"
        description="Build stronger with OSVID Chemicals Ltd."
        breadcrumbs={[
          {
            label: "Home",
            href: "/",
          },
          {
            label: "About",
            href: "/about",
          },
        ]}
      />

      <IntroSectionAbout />

      <div className="bg-osvid-blue text-osvid-orange container ">
        <h2 className="py-4 uppercase text-2xl md:text-4xl text-center">
          Jesus Loves You . Don&apos;t die in your Sin.
        </h2>
      </div>

      <HistorySectionAbout />

      {/* MISSION + VISION - UPDATED */}
      <section className="bg-osvid-cream py-20 overflow-hidden">
        <div className="container mx-auto px-4 md:px-12">
          <h3 className="text-3xl md:text-5xl font-bold text-center text-gray-900 mb-12 animate-fade-in-down">
            Our Mission & Vision
          </h3>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Vision Card */}
            <MissionVisionCard
              icon="💡" // Lightbulb icon
              title="Our Vision"
              content="To be Nigeria's most trusted and innovative solution provider — recognized for excellence in construction chemicals, customer value, and sustainable progress."
              delay={100} // Overall card animation delay
            />

            {/* Mission Card */}
            <MissionVisionCard
              icon="🎯" // Target/Dartboard icon
              title="Our Mission"
              content="To deliver world-class, reliable chemical solutions that empower builders and businesses to create stronger, safer, and longer-lasting structures — every time."
              delay={200} // Overall card animation delay
            />
          </div>
        </div>
      </section>

      {/* CORE VALUES - UPDATED */}
      <section className="py-20 bg-gray-50 overflow-hidden">
        <div className="container">
          <h3 className="text-3xl md:text-5xl font-bold text-gray-900 mb-12 text-center animate-fade-in-down">
            Our Core Values
          </h3>

          <div className="grid gap-8 md:grid-cols-2">
            {" "}
            {/* Changed to lg:grid-cols-3 for more values */}
            {companyData.coreValues.map((value, index) => (
              <div
                key={value.id}
                className={`p-6 bg-white rounded-xl shadow-md border-b-4 border-transparent hover:border-osvid-orange transition-all duration-300 transform hover:scale-[1.01] hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-${
                  index * 100
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  {" "}
                  {/* Added margin-bottom */}
                  <div
                    className="text-3xl flex-shrink-0
                                  p-3 rounded-full bg-osvid-blue/10 text-osvid-blue
                                  group-hover:bg-osvid-orange/20 group-hover:text-osvid-orange transition-all duration-300"
                  >
                    {getCoreValueIcon(index)} {/* Dynamic icon */}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xl text-gray-800">
                      {value.label}
                    </h4>
                  </div>
                </div>
                <p className="text-gray-600 mt-2 text-base leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TeamSectionAbout teamMembers={teamMembers} />

      {/* WHY CHOOSE US */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="container">
          <h3 className="text-3xl md:text-5xl font-bold text-center text-gray-900 mb-12 animate-fade-in-down">
            Why Choose OSVID?
          </h3>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            {[
              {
                icon: "🔬",
                title: "Top-Grade Materials",
                description:
                  "Meeting the highest performance and durability standards across all product lines.",
              },
              {
                icon: "🤝",
                title: "Customer-First Approach",
                description:
                  "We build long-term partnerships — focused on trust, service, and satisfaction.",
              },
              {
                icon: "🌍",
                title: "Nationwide Reach",
                description:
                  "With strategic supply points across Nigeria, we deliver promptly and reliably.",
              },
              {
                icon: "🧪",
                title: "Innovation & Integrity",
                description:
                  "Our R&D never stops — and neither does our dedication to honest practices.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex gap-4 bg-gray-50 p-6 rounded-xl shadow-sm hover:shadow-md transition transform hover:scale-102 animate-fade-in-up delay-${
                  i * 100
                }`}
              >
                <div className="text-3xl text-osvid-orange flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-gray-800">
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        heading="Partner with OSVID Chemicals Today"
        subheading="Get reliable, tested, and professional-grade chemical and finishing solutions from a company built on integrity, innovation, and excellence."
      />
    </main>
  );
}
