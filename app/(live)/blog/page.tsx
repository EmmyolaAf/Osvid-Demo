// app/(live)/blog/page.tsx
import { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/server/storefront";
import PageHeader from "@/components/reusables/PageHeader";
import BlogCard from "@/components/reusables/cards/BlogCard";
import { AlertCircle, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Chemical Insights & Blog | OSVID CHEMICALS LTD.",
  description:
    "Technical articles, application guides, and expert chemical insights from OSVID CHEMICALS LTD.",
};

export const revalidate = 1800; // ISR revalidation every 30 minutes for blog articles

export default async function BlogPage() {
  const result = await getBlogPosts();
  const allPosts = result.success ? result.data : [];

  // Extract unique categories and counts
  const categoryMap = new Map<string, number>();
  allPosts.forEach((p) => {
    const cat = p.category || "General Insights";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  });
  const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  const recentPosts = allPosts.slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-50/50">
      <PageHeader
        title="Technical Chemical Blog & Insights"
        description="Learn industry best practices for surface excellence, epoxy application, and chemical safety."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
        ]}
      />

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col lg:flex-row gap-10">
          {/* Main Blog Post Listing Area */}
          <div className="w-full lg:w-2/3 space-y-8">
            {!result.success ? (
              <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center shadow-sm">
                <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-red-900 mb-1">
                  Unable to Load Blog Articles
                </h3>
                <p className="text-xs text-red-700 mb-4">{result.error}</p>
                <Link href="/blog">
                  <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </Link>
              </div>
            ) : allPosts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  No Blog Posts Published Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Our laboratory and engineering team are preparing new technical guides and application manuals.
                </p>
                <Link href="/shop">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold">
                    Browse Chemical Catalog
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allPosts.map((post) => (
                  <BlogCard key={post.id || post.slug} post={post} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Area */}
          <aside className="w-full lg:w-1/3 space-y-6">
            {/* Recent Articles */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-orange-600">
                Recent Insights
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
                <p className="text-xs text-slate-400">No recent articles found.</p>
              )}
            </div>

            {/* Categories */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-orange-600">
                Article Categories
              </h3>
              {categories.length > 0 ? (
                <ul className="space-y-1.5 text-xs">
                  {categories.map((cat, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between py-1 text-slate-700 font-medium"
                    >
                      <span>{cat.name}</span>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {cat.count}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No categories found.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
