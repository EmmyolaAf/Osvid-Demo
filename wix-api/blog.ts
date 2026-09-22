// wix-api/blog.ts
import { wixClientServer } from "@/lib/wix-client.server";
import { BlogPost } from "@/types";
import { cache } from "react";

// Assuming a Category type for clarity, adjust if your Wix data has a different structure
interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  count?: number; // Optional: if you store post count in your custom category item
}

// Fetch all blog posts
export const getBlogPosts = cache(async (): Promise<BlogPost[]> => {
  try {
    const wixClient = await wixClientServer();
    const res = await wixClient.items
      .query("blog") // Assuming "blog" is your collection ID for blog posts
      .limit(20)
      .descending("publishDate") // Latest posts first
      .find();

    return res.items
      .filter((post) => post && post.title && post.slug)
      .map((post) => ({
        id: post._id || post.id || "",
        title: post.title || "",
        slug: post.slug || "",
        excerpt: post.excerpt || "",
        content: post.content || "",
        featuredImage:
          post.featuredImage || "https://via.placeholder.com/600x400",
        publishDate: post.publishDate || post._createdDate || "",
        author: {
          name: post.author?.name || "Osvid Team",
          avatar: post.author?.avatar || undefined,
        },
        category: post.category || "", // Assuming 'category' is a field directly on your blog post item
        tags: Array.isArray(post.tags) ? post.tags : [],
        comments: post.comments || 0,
      }));
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
});

// Fetch a single blog post by slug
export const getBlogPostBySlug = cache(
  async (slug: string): Promise<BlogPost | null> => {
    try {
      const wixClient = await wixClientServer();
      const res = await wixClient.items.query("blog").eq("slug", slug).find();

      if (res.items.length === 0) {
        return null;
      }

      const post = res.items[0];

      return {
        id: post._id || post.id || "",
        title: post.title || "",
        slug: post.slug || "",
        excerpt: post.excerpt || "",
        content: post.content || "",
        featuredImage:
          post.featuredImage || "https://via.placeholder.com/600x400",
        publishDate: post.publishDate || post._createdDate || "",
        author: {
          name: post.author?.name || "Osvid Team",
          avatar: post.author?.avatar || undefined,
        },
        category: post.category || "",
        tags: Array.isArray(post.tags) ? post.tags : [],
        comments: post.comments || 0,
      };
    } catch (error) {
      console.error(`Error fetching blog post with slug ${slug}:`, error);
      return null;
    }
  }
);

// Fetch posts by category
export const getBlogPostsByCategory = cache(
  async (category: string): Promise<BlogPost[]> => {
    try {
      const wixClient = await wixClientServer();
      const res = await wixClient.items
        .query("blog")
        .eq("category", category) // Filter by category field
        .descending("publishDate")
        .find();

      return res.items
        .filter((post) => post && post.title && post.slug)
        .map((post) => ({
          id: post._id || post.id || "",
          title: post.title || "",
          slug: post.slug || "",
          excerpt: post.excerpt || "",
          content: post.content || "",
          featuredImage:
            post.featuredImage || "https://via.placeholder.com/600x400",
          publishDate: post.publishDate || post._createdDate || "",
          author: {
            name: post.author?.name || "Osvid Team",
            avatar: post.author?.avatar || undefined,
          },
          category: post.category || "",
          tags: Array.isArray(post.tags) ? post.tags : [],
          comments: post.comments || 0,
        }));
    } catch (error) {
      console.error(
        `Error fetching blog posts for category ${category}:`,
        error
      );
      return [];
    }
  }
);

// --- NEW FUNCTIONS FOR SIDEBAR ---

// Fetch recent blog posts (uses the same "blog" collection)
export const getRecentBlogPosts = cache(
  async (limit: number = 5): Promise<BlogPost[]> => {
    try {
      const wixClient = await wixClientServer();
      const res = await wixClient.items
        .query("blog") // Query your blog posts collection
        .limit(limit)
        .descending("publishDate") // Sort by publishDate to get recent ones
        .find();

      // Map to BlogPost structure, similar to getBlogPosts
      return res.items
        .filter((post) => post && post.title && post.slug)
        .map((post) => ({
          id: post._id || post.id || "",
          title: post.title || "",
          slug: post.slug || "",
          // Note: for recent posts list, you might not need full content or large images.
          // Adjust mapping as needed if your BlogPost type includes too much data.
          excerpt: post.excerpt || "",
          content: "", // Don't need full content for a list
          featuredImage: post.featuredImage || "",
          publishDate: post.publishDate || post._createdDate || "",
          author: { name: post.author?.name || "" },
          category: post.category || "",
          tags: Array.isArray(post.tags) ? post.tags : [],
          comments: post.comments || 0,
        }));
    } catch (error) {
      console.error(
        `Error fetching recent blog posts (limit ${limit}):`,
        error
      );
      return [];
    }
  }
);

// Fetch blog categories from a custom Wix Data Collection
export const getBlogCategories = cache(async (): Promise<BlogCategory[]> => {
  try {
    const wixClient = await wixClientServer();
    // --- IMPORTANT: Replace "blog" with your actual Wix Data collection name for categories ---
    const res = await wixClient.items.query("blog").find(); // Example: "BlogCategories" or "categories"

    return (
      res.items?.map((cat) => ({
        id: cat._id || "",
        name: cat.name || "", // Assuming your category item has a 'name' field
        slug: cat.slug || "", // Assuming your category item has a 'slug' field
        count: cat.postCount || undefined, // Optional: if you store post count in your category item
      })) || []
    );
  } catch (error) {
    console.error(
      "Error fetching blog categories from custom collection:",
      error
    );
    return [];
  }
});

// You can add getPostsBySearchQuery if you implement a search feature.
/*
export const getPostsBySearchQuery = cache(async (query: string): Promise<BlogPost[]> => {
  try {
    const wixClient = await wixClientServer();
    const res = await wixClient.items
      .query("blog")
      .contains("title", query) // Search in title
      .or(wixClient.items.query("blog").contains("excerpt", query)) // Search in excerpt
      // Add other fields to search, e.g., .or(wixClient.items.query("blog").contains("content", query))
      .descending("publishDate")
      .find();

    return res.items
      .filter((post) => post && post.title && post.slug)
      .map((post) => ({
        id: post._id || post.id || "",
        title: post.title || "",
        slug: post.slug || "",
        excerpt: post.excerpt || "",
        content: post.content || "",
        featuredImage: post.featuredImage || "",
        publishDate: post.publishDate || post._createdDate || "",
        author: { name: post.author?.name || "" },
        category: post.category || "",
        tags: Array.isArray(post.tags) ? post.tags : [],
        comments: post.comments || 0,
      }));
  } catch (error) {
    console.error(`Error searching blog posts for query "${query}":`, error);
    return [];
  }
});
*/
