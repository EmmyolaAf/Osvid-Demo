"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  getSiteContent,
  saveSiteContent,
  getWebsiteChangeLogs,
  revertWebsiteChangeLog,
} from "@/lib/firebase/content";
import { SiteContent, DEFAULT_SITE_CONTENT, ContentChangeLog } from "@/types/content";
import {
  LayoutTemplate,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Monitor,
  Eye,
  Type,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  Layers,
  Loader2,
  History,
  AlertTriangle,
  Clock,
  ArrowRight,
  MousePointer,
  Check,
  Undo2,
  FileCode2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

interface WebsitePageDefinition {
  title: string;
  path: string;
  description: string;
  sections: string[];
  badge: string;
}

const WEBSITE_PAGES: WebsitePageDefinition[] = [
  {
    title: "Home Page",
    path: "/",
    description: "Main storefront landing page featuring hero banner, slogans, CTA buttons, metrics, and services preview.",
    sections: ["Hero Slogan", "CTA Buttons", "Why Choose Us", "Services Preview", "Testimonials"],
    badge: "Primary Landing",
  },
  {
    title: "About Us",
    path: "/about",
    description: "Company history, mission, vision, core values, leadership team, and industrial chemical capabilities.",
    sections: ["Hero Header", "Intro Section", "Mission & Vision", "History Timeline", "Team"],
    badge: "Company Info",
  },
  {
    title: "Chemical Products & Categories",
    path: "/products",
    description: "High-grade chemical categories, industrial adhesives, sealants, and specialty formulations.",
    sections: ["Category Showcase", "Application Guides", "Technical Specs"],
    badge: "Catalog Hub",
  },
  {
    title: "Services & Applications",
    path: "/services",
    description: "Surface engineering, industrial flooring, concrete polishing, and custom chemical consulting.",
    sections: ["Service Offerings", "Process Workflow", "Consultation CTA"],
    badge: "Operations",
  },
  {
    title: "Store Shop",
    path: "/shop",
    description: "Full retail & bulk purchasing storefront catalog with realtime stock, search filters, and checkout.",
    sections: ["Catalog Grid", "Filters & Search", "Bulk Quote Section"],
    badge: "E-Commerce",
  },
  {
    title: "Portfolio & Projects",
    path: "/portfolio",
    description: "Showcase of completed commercial, residential, and industrial surface applications across Nigeria.",
    sections: ["Project Gallery", "Client Case Studies", "Before & After"],
    badge: "Case Studies",
  },
  {
    title: "Blog & Technical News",
    path: "/blog",
    description: "Industrial chemistry articles, safety handling tips, construction chemical insights, and company news.",
    sections: ["Latest Posts", "Safety Standards", "Industry Insights"],
    badge: "Content & SEO",
  },
  {
    title: "Contact Us & Inquiries",
    path: "/contact",
    description: "Direct customer inquiry form, technical specialist hotlines, warehouse locations, and operating hours.",
    sections: ["Contact Form", "Hotlines & WhatsApp", "Office Locations", "Business Hours"],
    badge: "Support & Sales",
  },
];

export default function WebsiteEditorStudioPage() {
  const { userProfile, role } = useAuth();
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [logs, setLogs] = useState<ContentChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<"pages" | "logs" | "cms">("pages");
  const [selectedPagePath, setSelectedPagePath] = useState<string>("/");

  // CMS Section sub-tab
  const [activeSection, setActiveSection] = useState<"hero" | "announcement" | "about" | "contact">("hero");

  // Load site content
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getSiteContent();
        setContent(data);
      } catch (err) {
        console.error("Error loading site content:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load 7-day change logs
  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await getWebsiteChangeLogs();
      setLogs(data);
    } catch (err) {
      console.error("Error loading change logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab]);

  // Open any page in the Visual Editor in a NEW TAB
  const handleOpenVisualEditor = (path: string) => {
    const editUrl = `${path}${path.includes("?") ? "&" : "?"}editMode=true`;
    window.open(editUrl, "_blank");
  };

  // Revert a log snapshot
  const handleRevertLog = async (log: ContentChangeLog) => {
    if (
      !confirm(
        `Are you sure you want to revert changes from "${log.summary}"? This will write the previous snapshot back into the codebase.`
      )
    ) {
      return;
    }

    try {
      setRevertingId(log.id);
      const res = await revertWebsiteChangeLog(log.id);
      if (res.success) {
        toast.success(res.message || "Successfully reverted changes in codebase!");
        await fetchLogs();
        const updated = await getSiteContent();
        setContent(updated);
      } else {
        toast.error(res.error || "Failed to revert change log");
      }
    } catch (err: any) {
      toast.error(err.message || "Error reverting log");
    } finally {
      setRevertingId(null);
    }
  };

  // Save fallback CMS content
  const handleSaveCMS = async () => {
    try {
      setSaving(true);
      await saveSiteContent(
        content,
        userProfile?.displayName || "Admin",
        undefined,
        "/",
        "Direct CMS form update"
      );
      toast.success("Storefront content saved directly to codebase! Active for all visitors.");
    } catch (err: any) {
      toast.error(err.message || "Failed to publish content");
    } finally {
      setSaving(false);
    }
  };

  // Format time remaining for 1-week log
  const formatTimeRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired (pruned)";
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}d ${hours}h remaining`;
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      <div className="space-y-8 pb-12">
        {/* ============================================================ */}
        {/* HERO BANNER & QUICK LAUNCHER */}
        {/* ============================================================ */}
        <div className="bg-slate-900 rounded-lg p-5 sm:p-6 text-white border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-orange-400 text-[11px] font-medium tracking-wide uppercase mb-2">
                <Sparkles size={13} />
                Visual Front-End Studio
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Website Content Builder &amp; Visual Editor
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Select any page from the website to open in a new tab with in-page visual element editing (text, roundness, colors, buttons), written directly into the codebase.
              </p>
            </div>

            {/* Quick Page Launcher */}
            <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 block mb-1">
                  Pick Website Page to Edit
                </Label>
                <select
                  value={selectedPagePath}
                  onChange={(e) => setSelectedPagePath(e.target.value)}
                  className="bg-slate-900 text-white border border-slate-700 text-xs rounded-md px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {WEBSITE_PAGES.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.title} ({p.path})
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => handleOpenVisualEditor(selectedPagePath)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs rounded-md shadow-none gap-1.5 h-8.5 px-3.5 self-end sm:self-auto cursor-pointer"
              >
                <ExternalLink size={13} />
                <span>Launch in Visual Editor</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MAIN NAVIGATION TABS */}
        {/* ============================================================ */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("pages")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "pages"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Globe size={16} />
            <span>Select Website Page ({WEBSITE_PAGES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "logs"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <History size={16} />
            <span>7-Day Change Logs &amp; Revert History</span>
            {logs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">
                {logs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("cms")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "cms"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileCode2 size={16} />
            <span>Storefront Direct Text Copy</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: INTERACTIVE PAGE SELECTOR GALLERY */}
        {/* ============================================================ */}
        {activeTab === "pages" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Select a Page to Launch In-Page Visual Editor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clicking any page below opens the actual website in a new tab with interactive point-and-click editing enabled.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {WEBSITE_PAGES.map((page) => (
                <div
                  key={page.path}
                  className="bg-white rounded-lg border border-slate-200 p-4 shadow-none hover:border-slate-300 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                        {page.badge}
                      </span>
                      <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                        {page.path}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {page.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {page.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {page.sections.slice(0, 3).map((sec) => (
                        <span
                          key={sec}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100"
                        >
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      onClick={() => handleOpenVisualEditor(page.path)}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs rounded-md h-8.5 gap-1.5 shadow-none cursor-pointer"
                    >
                      <MousePointer size={13} />
                      <span>Edit in New Tab</span>
                    </Button>

                    <Link href={page.path} target="_blank">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8.5 w-8.5 rounded-md border-slate-200 text-slate-500 hover:text-slate-900"
                        title="View Public Page"
                      >
                        <ExternalLink size={13} />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: 7-DAY CHANGE LOGS & REVERT HISTORY */}
        {/* ============================================================ */}
        {activeTab === "logs" && (
          <div className="space-y-5">
            {/* Warning & Policy Banner */}
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-800 uppercase tracking-wider">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>1-Week Change Log Retention Policy</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-normal">
                Changes saved in the Visual Editor are written directly into the application codebase (<code className="font-mono text-amber-950 font-semibold">data/site-content.json</code>) and immediately reflected for all visitors.
              </p>
              <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                ⚠️ Reversible change logs are maintained for a <strong>maximum of 1 week (7 days)</strong>. After 1 week, logs are automatically deleted and changes become permanent in the codebase.
              </p>
            </div>

            {/* Change Logs List */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-none space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Active Change Logs (Within 7 Days)</h3>
                  <p className="text-xs text-slate-500">Each entry captures visual edits with one-click revert capability before expiry.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="rounded-xl text-xs font-semibold h-8"
                >
                  <RotateCcw size={12} className={`mr-1.5 ${logsLoading ? "animate-spin text-orange-600" : ""}`} />
                  <span>Refresh Logs</span>
                </Button>
              </div>

              {logsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                  <p className="text-xs">Loading 7-day change logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-bold text-slate-700">Codebase is in Clean State</p>
                  <p className="text-xs text-slate-500">No recent edits logged within the last 7 days. Make edits via the Visual Editor to see logs here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-orange-200 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {log.page}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{log.summary}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                          <span>By: <strong>{log.author}</strong></span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeRemaining(log.expiresAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevertLog(log)}
                          disabled={revertingId === log.id}
                          className="h-8 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1.5 cursor-pointer"
                        >
                          {revertingId === log.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Undo2 size={12} />
                          )}
                          <span>Revert This Change</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: STOREFRONT DIRECT TEXT COPY (FALLBACK CMS FORM) */}
        {/* ============================================================ */}
        {activeTab === "cms" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Navigation Sidebar */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm space-y-1">
              <p className="text-[11px] font-bold uppercase text-slate-400 px-3 py-2">Editable Sections</p>
              
              <button
                onClick={() => setActiveSection("hero")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                  activeSection === "hero"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Type size={16} />
                <span>Hero Headline &amp; Slogan</span>
              </button>

              <button
                onClick={() => setActiveSection("announcement")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                  activeSection === "announcement"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquare size={16} />
                <span>Announcement Top Bar</span>
              </button>

              <button
                onClick={() => setActiveSection("about")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                  activeSection === "about"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Layers size={16} />
                <span>About Us &amp; Metrics</span>
              </button>

              <button
                onClick={() => setActiveSection("contact")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                  activeSection === "contact"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Phone size={16} />
                <span>Official Contacts &amp; Hours</span>
              </button>
            </div>

            {/* Center Form Section */}
            <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-5 shadow-none space-y-4">
              {activeSection === "hero" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Hero Slogan &amp; CTA Buttons</h3>
                    <p className="text-xs text-slate-500">The first high-impact headline visitors see on the homepage</p>
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Top Eyebrow Badge</Label>
                    <Input
                      value={content.hero.badge}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, badge: e.target.value } })
                      }
                      className="mt-1 h-11 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Primary Headline</Label>
                    <Input
                      value={content.hero.titlePrimary}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, titlePrimary: e.target.value } })
                      }
                      className="mt-1 h-11 rounded-xl text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Secondary Accent Headline</Label>
                    <Input
                      value={content.hero.titleSecondary}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, titleSecondary: e.target.value } })
                      }
                      className="mt-1 h-11 rounded-xl text-sm font-semibold text-orange-600"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Hero Subtitle / Description</Label>
                    <textarea
                      value={content.hero.description}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, description: e.target.value } })
                      }
                      rows={4}
                      className="w-full mt-1 p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <Label className="text-xs font-bold uppercase text-slate-600">Primary CTA Text</Label>
                      <Input
                        value={content.hero.primaryButtonText}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            hero: { ...content.hero, primaryButtonText: e.target.value },
                          })
                        }
                        className="mt-1 h-10 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase text-slate-600">Primary CTA Link</Label>
                      <Input
                        value={content.hero.primaryButtonLink}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            hero: { ...content.hero, primaryButtonLink: e.target.value },
                          })
                        }
                        className="mt-1 h-10 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "announcement" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Top Announcement Banner</h3>
                    <p className="text-xs text-slate-500">Global alert bar displayed at the very top of all storefront pages</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <input
                      type="checkbox"
                      id="announcement-toggle"
                      checked={content.announcement.enabled}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          announcement: { ...content.announcement, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <Label htmlFor="announcement-toggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Enable Top Announcement Bar Globally
                    </Label>
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Announcement Message</Label>
                    <textarea
                      value={content.announcement.text}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          announcement: { ...content.announcement, text: e.target.value },
                        })
                      }
                      rows={3}
                      className="w-full mt-1 p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              {activeSection === "about" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">About Us &amp; Key Metrics</h3>
                    <p className="text-xs text-slate-500">Company highlights displayed on the homepage and about page</p>
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Heading</Label>
                    <Input
                      value={content.aboutSummary.heading}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          aboutSummary: { ...content.aboutSummary, heading: e.target.value },
                        })
                      }
                      className="mt-1 h-11 rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-bold uppercase text-slate-600">Experience</Label>
                      <Input
                        value={content.aboutSummary.yearsOfExperience}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            aboutSummary: { ...content.aboutSummary, yearsOfExperience: e.target.value },
                          })
                        }
                        className="mt-1 h-10 rounded-xl text-xs font-bold text-orange-600"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase text-slate-600">Delivered</Label>
                      <Input
                        value={content.aboutSummary.productsDelivered}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            aboutSummary: { ...content.aboutSummary, productsDelivered: e.target.value },
                          })
                        }
                        className="mt-1 h-10 rounded-xl text-xs font-bold text-orange-600"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase text-slate-600">Satisfaction</Label>
                      <Input
                        value={content.aboutSummary.satisfactionRate}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            aboutSummary: { ...content.aboutSummary, satisfactionRate: e.target.value },
                          })
                        }
                        className="mt-1 h-10 rounded-xl text-xs font-bold text-orange-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "contact" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Official Contact Details</h3>
                    <p className="text-xs text-slate-500">Contact information displayed across the header and footer</p>
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Phone Hotline</Label>
                    <Input
                      value={content.contactInfo.phone}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          contactInfo: { ...content.contactInfo, phone: e.target.value },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">WhatsApp Support</Label>
                    <Input
                      value={content.contactInfo.whatsapp}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          contactInfo: { ...content.contactInfo, whatsapp: e.target.value },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Inquiry Email</Label>
                    <Input
                      value={content.contactInfo.email}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          contactInfo: { ...content.contactInfo, email: e.target.value },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Physical Address</Label>
                    <Input
                      value={content.contactInfo.address}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          contactInfo: { ...content.contactInfo, address: e.target.value },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  onClick={handleSaveCMS}
                  disabled={saving || loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs rounded-md shadow-none h-9 px-4 gap-2 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                  <span>Save to Codebase</span>
                </Button>
              </div>
            </div>

            {/* Right Live Preview Box */}
            <div className="lg:col-span-4 bg-slate-900 rounded-lg p-5 text-white border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Live Typography Preview</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-orange-300 text-xs font-semibold">
                  {content.hero.badge}
                </span>

                <h2 className="text-xl font-extrabold leading-snug">
                  {content.hero.titlePrimary}{" "}
                  <span className="text-orange-400">{content.hero.titleSecondary}</span>
                </h2>

                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  {content.hero.description}
                </p>

                <div className="pt-2 flex items-center gap-2">
                  <button className="h-9 px-4 rounded-lg bg-orange-600 text-white text-xs font-bold shadow-md">
                    {content.hero.primaryButtonText}
                  </button>
                  <button className="h-9 px-3 rounded-lg border border-white/20 text-white text-xs font-medium">
                    {content.hero.secondaryButtonText || "Learn More"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
