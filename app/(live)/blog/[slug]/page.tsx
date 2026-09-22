// app/blog/[slug]/page.tsx
import { Metadata } from "next";
import Link from "next/link"; // Import Link for navigation
import {
  getBlogPostBySlug,
  getRecentBlogPosts,
  getBlogCategories,
} from "@/wix-api/blog"; // Assuming you have these API functions
import ContentViewer from "@/components/ContentViwer";
import BlogSection from "@/components/reusables/sections/BlogSection.server";

/* eslint-disable  @typescript-eslint/no-explicit-any */

export async function generateStaticParams() {
  return [{ slug: "welcome-to-osvid" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found | Osvid Limited Blog",
      description: "The requested blog post could not be found.",
    };
  }

  return {
    title: `${post.title} | Osvid Limited Blog`,
    description:
      post.excerpt ||
      "Explore insights on construction chemicals and flooring solutions from Osvid Limited.",
    keywords: [
      "construction chemicals Nigeria",
      "flooring solutions Nigeria",
      "Osvid Limited",
      "blog",
      ...(post.tags || []),
    ],
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      images: post.featuredImage ? [{ url: post.featuredImage }] : [],
      url: `https://osvidcompany.vercel.app/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch all necessary data concurrently
  const [post, recentPostsData, categoriesData] = await Promise.all([
    getBlogPostBySlug(slug),
    getRecentBlogPosts(5), // Fetch top 5 recent posts
    getBlogCategories(), // Fetch all categories
  ]);

  // Determine the content nodes to pass to ContentViewer
  let contentNodes: any[] = [];

  if (post?.content) {
    if (typeof post.content === "string") {
      try {
        const parsedContent = JSON.parse(post.content);
        contentNodes = parsedContent.nodes || parsedContent;
      } catch (e) {
        console.error("Failed to parse post content as JSON:", e);
        contentNodes = [
          { type: "TEXT", textData: { text: post.content, decorations: [] } },
        ];
      }
    } else if (
      typeof post.content === "object" &&
      Array.isArray(post.content.nodes)
    ) {
      contentNodes = post.content.nodes;
    }
  }

  // Handle case where post is not found
  if (!post) {
    return (
      <main>
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold">Post Not Found</h1>
            <p className="mt-4">
              The blog post you are looking for does not exist.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const recentPosts = recentPostsData || [];
  const categories = categoriesData || [];

  // Filter out the current post from recentPosts for "More Blog Posts" section
  const moreBlogPosts = recentPosts
    .filter((rp) => rp.slug !== slug)
    .slice(0, 3); // Get up to 3 more posts

  return (
    <main>
      {/* --- */}
      {/* Page Header */}
      {/* --- */}
      <section
        className="relative bg-cover bg-center py-20 md:py-28"
        style={{
          backgroundImage: `url(${
            post.featuredImage || "/images/blog-default-banner.jpg"
          })`, // Use featured image or a default
          backgroundColor: post.featuredImage ? "transparent" : "#374151", // Fallback color if no image
        }}
      >
        <div className="absolute inset-0 bg-black opacity-60"></div>{" "}
        {/* Overlay for readability */}
        <div className="container mx-auto px-4 md:px-12 relative z-10 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{post.title}</h1>
          <p className="text-lg md:text-xl">
            {post.excerpt || "Dive deeper into our insights."}
          </p>
          <div className="text-sm mt-4 flex justify-center flex-wrap gap-x-3">
            {post.author?.name && <span>By {post.author.name}</span>}
            {post.publishDate && (
              <>
                <span className="mx-0.5">|</span>
                <span>
                  {new Date(post.publishDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
            {post.category && (
              <>
                <span className="mx-0.5">|</span>
                <span>Category: {post.category}</span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-12 flex flex-col md:flex-row gap-8">
          {/* Main Content Area */}
          <article className="w-full md:w-2/3">
            {/* Blog Content rendered by ContentViewer */}
            <div className="prose prose-lg max-w-none text-gray-700">
              <ContentViewer nodes={contentNodes} />
            </div>
          </article>

          {/* Sidebar Area */}
          <aside className="w-full md:w-1/3 space-y-8 mt-12 md:mt-0">
            {/* Search Bar */}
            <div className="p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Search</h3>
              <form action="/blog/search" method="GET">
                {" "}
                {/* Adjust action based on your search route */}
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
                        {cat.name} ({cat.count})
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

      {/* --- */}
      {/* More Blog Posts Section */}
      {/* --- */}
      {moreBlogPosts.length > 0 && (
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-4 md:px-12">
            <h2 className="text-3xl font-bold text-center mb-10 text-gray-800">
              More Blog Posts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {moreBlogPosts.map((post) => (
                <div
                  key={post.slug}
                  className="bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105"
                >
                  {post.featuredImage && (
                    <Link href={`/blog/${post.slug}`}>
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-48 object-cover"
                      />
                    </Link>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-gray-800 hover:text-blue-600"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {post.publishDate &&
                        new Date(post.publishDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                    </p>
                    <p className="text-gray-700">
                      {post.excerpt
                        ? `${post.excerpt.substring(0, 100)}...`
                        : "Read more..."}
                    </p>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="mt-4 inline-block text-blue-600 hover:underline"
                    >
                      Read Article &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <BlogSection />
    </main>
  );
}
