// app/components/reusables/sections/BlogSection.server.tsx
import React from "react";
import { getRecentBlogPosts, getBlogCategories } from "@/wix-api/blog";
import BlogSectionClient from "./BlogSection.client";

export default async function BlogSection() {
  const [recentPostsData] = await Promise.all([
    getRecentBlogPosts(3),
    getBlogCategories(),
  ]);

  if (!recentPostsData?.length) return null;

  return <BlogSectionClient posts={recentPostsData} />;
}
