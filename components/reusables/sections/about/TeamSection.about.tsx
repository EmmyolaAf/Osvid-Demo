"use client";

import Image from "next/image";

import { motion } from "framer-motion";
import TeamMemberCard from "../../cards/TeamMemberCard";
import { TeamMember } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TeamSectionAbout({
  teamMembers,
}: {
  teamMembers: TeamMember[];
}) {
  return (
    <section className="relative py-20 bg-gray-100 overflow-hidden">
      {/* Decorative background with improved opacity control */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/bbb.jpg"
          alt="Abstract team collaboration background"
          fill
          sizes="100vw"
          className="object-cover w-full h-full object-top opacity-10" // Reduced opacity for better readability
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-100/30 via-gray-100/70 to-gray-100/90" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="w-8 h-0.5 bg-osvid-orange" />
            <span className="text-sm font-semibold tracking-widest text-osvid-orange uppercase">
              Our Experts
            </span>
            <span className="w-8 h-0.5 bg-osvid-orange" />
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
            Meet Our <span className="text-osvid-orange">Team</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            The talented professionals behind our success
          </p>
        </motion.div>

        {/* Group Photo Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="hidden md:block relative w-full h-[400px] mb-16 rounded-2xl overflow-hidden shadow-2xl"
        >
          <Image
            src="/images/team-1.webp"
            alt="OSVID team collaborating in our workspace"
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
            <p className="text-white font-medium text-lg">The OSVID Family</p>
          </div>
        </motion.div>

        {/* Individual Team Member Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
        >
          {teamMembers.map((teamMember, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <TeamMemberCard {...teamMember} />
            </motion.div>
          ))}
        </motion.div>

        {/* Optional CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16"
        >
          <p className="text-gray-600 mb-6">Want to join our growing team?</p>
          <Button
            asChild
            variant="outline"
            className="border-osvid-orange text-osvid-orange hover:bg-osvid-orange/5"
          >
            <Link href="/careers">
              View Open Positions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
