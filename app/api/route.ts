// app/api/related-posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts } from "@/wix-api/blog";

export const dynamic = "force-static";

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug") || "";
    const category = searchParams.get("category") || "";
    const tagsParam = searchParams.get("tags") || "";
    const tags = tagsParam ? tagsParam.split(",") : [];

    // Fetch all blog posts
    const allPosts = await getBlogPosts();

    // Filter out the current post and find related posts
    const filteredPosts = allPosts
      .filter((post) => post.slug !== slug) // Remove current post
      .filter((post) => {
        // Match by category
        if (category && post.category === category) {
          return true;
        }

        // Match by tags
        if (tags.length > 0 && post.tags && post.tags.length > 0) {
          return post.tags.some((tag) => tags.includes(tag));
        }

        return false;
      })
      // Limit to 3 related posts
      .slice(0, 3);

    // If no related posts based on category or tags, return random posts
    let relatedPosts = filteredPosts;
    if (relatedPosts.length === 0) {
      relatedPosts = allPosts.filter((post) => post.slug !== slug).slice(0, 3);
    }

    return NextResponse.json(
      {
        posts: relatedPosts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching related posts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch related posts",
      },
      { status: 500 }
    );
  }
}
