// app/components/reusables/sections/BlogSection.server.tsx
import React from "react";
import { getBlogPosts } from "@/lib/firebase/storefront";
import BlogSectionClient from "./BlogSection.client";

export default async function BlogSection() {
  const result = await getBlogPosts();
  const posts = result.success ? result.data.slice(0, 3) : [];

  if (!posts.length) return null;

  return <BlogSectionClient posts={posts} />;
}
