// app/blog/page.tsx
import { Metadata } from "next";
import Link from "next/link";
import {
  getBlogPosts,
  getRecentBlogPosts,
  getBlogCategories,
} from "@/wix-api/blog";
import PageHeader from "@/components/reusables/PageHeader";
import BlogCard from "@/components/reusables/cards/BlogCard";

// Assuming you have a default placeholder if a post lacks an image

export const metadata: Metadata = {
  title: "Blog | Osvid Limited",
  description:
    "Latest articles and insights on construction chemicals and flooring solutions from Osvid Limited.",
};

export default async function BlogPage() {
  // Fetch all blog posts for the main list, and data for the sidebar concurrently
  const [allPosts, recentPostsData, categoriesData] = await Promise.all([
    getBlogPosts(), // This should ideally be paginated
    getRecentBlogPosts(5), // Fetch top 5 recent posts for the sidebar
    getBlogCategories(), // Fetch all categories for the sidebar
  ]);

  const recentPosts = recentPostsData || [];
  const categories = categoriesData || [];

  return (
    <main>
      <PageHeader title="Blog" />

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-12 flex flex-col md:flex-row gap-8">
          {/* Main Blog Post Listing Area */}
          <div className="w-full md:w-2/3">
            {allPosts.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-2">
                {allPosts.map((post) => (
                  // Render BlogCard for each post
                  <BlogCard key={post.id || post.slug} post={post} />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600">No blog posts found.</p>
            )}

            {/* TODO: Add Pagination UI here */}
          </div>

          {/* Sidebar Area (reusable from single post page) */}
          <aside className="w-full md:w-1/3 space-y-8 mt-8 md:mt-0">
            {/* Search Bar */}
            <div className="p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Search</h3>
              <form action="/blog/search" method="GET">
                <div className="flex">
                  <input
                    type="search"
                    name="q"
                    placeholder="Search articles..."
                    className="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white p-2 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Articles */}
            <div className="p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Recent Articles</h3>
              {recentPosts.length > 0 ? (
                <ul>
                  {recentPosts.map((rp) => (
                    <li key={rp.slug} className="mb-2">
                      <Link
                        href={`/blog/${rp.slug}`}
                        className="text-blue-600 hover:underline"
                      >
                        {rp.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No recent articles found.</p>
              )}
            </div>

            {/* Categories */}
            <div className="p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Categories</h3>
              {categories.length > 0 ? (
                <ul>
                  {categories.map((cat) => (
                    <li key={cat.slug} className="mb-2">
                      <Link
                        href={`/blog/category/${cat.slug}`}
                        className="text-blue-600 hover:underline"
                      >
                        {cat.name} ({cat.count || 0})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No categories found.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
