// app/(live)/blog/[slug]/page.tsx
import { Metadata } from "next";
import Link from "next/link";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/server/storefront";
import ContentViewer from "@/components/ContentViwer";
import BlogSection from "@/components/reusables/sections/BlogSection.server";
import { ArrowLeft, Calendar, User, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBlogPostBySlug(slug);

  if (!result.success || !result.data) {
    return {
      title: "Post Not Found | OSVID CHEMICALS LTD. Blog",
      description: "Technical chemical formulations and surface engineering insights.",
    };
  }

  const post = result.data;

  return {
    title: `${post.title} | OSVID CHEMICALS LTD. Blog`,
    description:
      post.excerpt ||
      "Technical chemical insights, application standards, and industry recommendations.",
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      images: post.featuredImage ? [{ url: post.featuredImage }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [postResult, allPostsResult] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
  ]);

  if (!postResult.success || !postResult.data) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-black text-slate-900 mb-2">
            Article Not Found
          </h1>
          <p className="text-xs text-slate-600 mb-6">
            The blog post you requested does not exist or may have been updated.
          </p>
          <Link href="/blog">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold gap-2">
              <ArrowLeft size={16} />
              Return to Blog Index
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const post = postResult.data;
  const allPosts = allPostsResult.success ? allPostsResult.data : [];
  const recentPosts = allPosts.filter((p) => p.slug !== slug).slice(0, 5);

  // Parse rich content if present
  let contentNodes: any[] = [];
  if (post.content) {
    if (typeof post.content === "string") {
      try {
        const parsed = JSON.parse(post.content);
        contentNodes = parsed.nodes || parsed;
      } catch {
        contentNodes = [];
      }
    } else if (typeof post.content === "object" && Array.isArray((post.content as any).nodes)) {
      contentNodes = (post.content as any).nodes;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50/50">
      {/* Banner / Header */}
      <section
        className="relative bg-cover bg-center py-20 md:py-28"
        style={{
          backgroundImage: `url(${post.featuredImage || "/images/blog-default-banner.jpg"})`,
          backgroundColor: "#0f172a",
        }}
      >
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center text-white max-w-3xl">
          {post.category && (
            <span className="inline-block px-3 py-1 rounded-full bg-orange-600 font-bold text-xs uppercase tracking-wider mb-3">
              {post.category}
            </span>
          )}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-sm md:text-base text-slate-200 leading-relaxed max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          )}

          <div className="text-xs text-slate-300 mt-6 flex justify-center items-center flex-wrap gap-4 font-medium">
            <span className="flex items-center gap-1.5">
              <User size={14} className="text-orange-400" />
              {post.author?.name || "OSVID Technical Team"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-orange-400" />
              {post.publishDate
                ? new Date(post.publishDate).toLocaleDateString("en-NG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Published"}
            </span>
          </div>
        </div>
      </section>

      {/* Content Area */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col lg:flex-row gap-10">
          <article className="w-full lg:w-2/3 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 mb-2 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to all articles</span>
            </Link>

            {contentNodes.length > 0 ? (
              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm sm:text-base">
                <ContentViewer nodes={contentNodes} />
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm sm:text-base whitespace-pre-line">
                {typeof post.content === "string" ? post.content : post.excerpt}
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="pt-6 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <Tag size={14} className="text-orange-600" />
                {post.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-1/3 space-y-6">
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-orange-600">
                Related Technical Articles
              </h3>
              {recentPosts.length > 0 ? (
                <ul className="divide-y divide-slate-100 text-xs">
                  {recentPosts.map((rp) => (
                    <li key={rp.slug} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/blog/${rp.slug}`}
                        className="font-bold text-slate-800 hover:text-orange-600 transition-colors line-clamp-2"
                      >
                        {rp.title}
                      </Link>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {rp.publishDate
                          ? new Date(rp.publishDate).toLocaleDateString("en-NG", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Published"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No other articles yet.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <BlogSection />
    </main>
  );
}
