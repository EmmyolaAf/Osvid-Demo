// components/BlogCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link"; // Import Link for internal navigation
import Image from "next/image"; // Import Next.js Image component
import { motion } from "framer-motion";
import { BlogPost } from "@/types"; // Assuming BlogPost type is defined here or imported from types.ts
import { getWixStaticImageUrl } from "@/utils/wixImageUtils";

interface BlogCardProps {
  post: BlogPost;
}

export default function BlogCard({ post }: BlogCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Fallback for featured image if none is provided
  const imageUrl =
    getWixStaticImageUrl(post.featuredImage) || "/images/placeholder-blog.jpg"; // Provide a local placeholder image path

  return (
    <motion.div
      className="max-w-sm mx-auto overflow-hidden shadow-lg bg-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{
        scale: 1.03,
        transition: { duration: 0.2 },
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Category Tag */}
      <div className="relative">
        {post.category && (
          <div className="absolute top-4 left-4 z-10">
            <motion.span
              className="px-4 py-1 text-sm font-medium text-white bg-orange-400"
              whileHover={{ scale: 1.05 }}
            >
              {post.category}
            </motion.span>
          </div>
        )}
        {/* Featured Image */}
        <Link href={`/blog/${post.slug}`}>
          <motion.div
            className="h-64 w-full overflow-hidden"
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <Image
              src={imageUrl}
              alt={post.title || "Blog Post Image"}
              width={600} // Set appropriate width for optimization
              height={400} // Set appropriate height for optimization
              className="object-cover w-full h-full"
              priority // Consider if this is above the fold, otherwise remove
            />
          </motion.div>
        </Link>
      </div>
      {/* Content */}
      <div className="p-6">
        <Link href={`/blog/${post.slug}`}>
          <motion.h2
            className="mb-3 text-xl font-bold text-gray-800"
            animate={{ color: isHovered ? "#f97316" : "#1f2937" }} // orange-500 is #f97316
            transition={{ duration: 0.2 }}
          >
            {post.title}
          </motion.h2>
        </Link>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-gray-700 mb-4 line-clamp-3">{post.excerpt}</p>
        )}

        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <div className="flex items-center">
            {/* Author Icon */}
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            <span>By {post.author?.name || "Osvid Team"}</span>
          </div>

          <div className="flex items-center">
            {/* Comments Icon and Count */}
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
                clipRule="evenodd"
              />
            </svg>
            <span>Comments {post.comments || 0}</span>
          </div>
        </div>

        {/* Read More Link */}
        <motion.div
          className="mt-5"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center font-medium text-orange-500 hover:text-orange-600"
          >
            Read more
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
