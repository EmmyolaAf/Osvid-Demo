"use client";

// app/components/reusables/sections/BlogSection.client.tsx
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import BlogCard from "../cards/BlogCard";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BlogPost } from "@/types";

interface BlogSectionClientProps {
  posts: BlogPost[];
}

export default function BlogSectionClient({ posts }: BlogSectionClientProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section className="py-16 md:py-24 bg-white relative overflow-hidden">
      {/* Background with subtle pattern */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/bgs/blog-pattern.svg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover w-full h-full opacity-5"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-white/90" />
      </div>

      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="text-center"
        >
          <motion.div variants={itemVariants}>
            <span className="inline-block text-sm md:text-base mb-4 font-semibold uppercase tracking-widest text-osvid-orange border-y border-osvid-orange/50 py-1 px-2">
              Insights & Updates
            </span>
          </motion.div>

          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mt-4 mb-6 leading-tight"
          >
            Latest From Our <span className="text-osvid-orange">Blog</span>
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="text-lg text-gray-600 max-w-3xl mx-auto mb-12"
          >
            Discover industry trends, expert tips, and company news
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10 py-6"
        >
          {posts.map((post, index) => (
            <motion.div key={index} variants={itemVariants}>
              <BlogCard post={post} />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <Button
            asChild
            size="lg"
            className="bg-osvid-orange hover:bg-orange-700 text-white font-semibold py-6 px-8 text-base group"
          >
            <Link href="/blog">
              View All Articles
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
