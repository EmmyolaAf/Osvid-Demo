"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { getSiteContent, saveSiteContent } from "@/lib/firebase/content";
import { SiteContent, DEFAULT_SITE_CONTENT } from "@/types/content";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function WebsiteEditorStudioPage() {
  const { userProfile, role } = useAuth();
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"hero" | "announcement" | "about" | "contact">("hero");

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

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSiteContent(content, userProfile?.displayName || "Admin");
      toast.success("Storefront content published live successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to publish content");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Revert all sections to default content?")) {
      setContent(DEFAULT_SITE_CONTENT);
      toast.info("Content reverted. Click Publish to apply live.");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles size={14} />
                Visual Front-End Builder
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Storefront Website Content Editor
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                Customize live slogans, headlines, announcement alerts, and company details across your customer storefront in real-time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" target="_blank">
                <Button
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs font-semibold gap-2 rounded-xl"
                >
                  <ExternalLink size={14} />
                  <span>Preview Live Store</span>
                </Button>
              </Link>

              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                <span>Publish Updates Live</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Builder Studio Workspace */}
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

            <div className="pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs rounded-xl gap-2 justify-start"
              >
                <RotateCcw size={14} />
                <span>Revert to Defaults</span>
              </Button>
            </div>
          </div>

          {/* Center Form Section */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
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
                    <Label className="text-xs font-bold uppercase text-slate-600">Primary Link</Label>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Secondary CTA Text</Label>
                    <Input
                      value={content.hero.secondaryButtonText}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: { ...content.hero, secondaryButtonText: e.target.value },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Secondary Link</Label>
                    <Input
                      value={content.hero.secondaryButtonLink}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: { ...content.hero, secondaryButtonLink: e.target.value },
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
                  <h3 className="text-base font-extrabold text-slate-900">Announcement Top Bar</h3>
                  <p className="text-xs text-slate-500">Notice banner displayed at the very top of all store pages</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enable Announcement Bar</p>
                    <p className="text-[11px] text-slate-500">Turn on or off live announcement alerts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={content.announcement.enabled}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        announcement: { ...content.announcement, enabled: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                  />
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Button Link Text</Label>
                    <Input
                      value={content.announcement.linkText || ""}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          announcement: { ...content.announcement, linkText: e.target.value },
                        })
                      }
                      placeholder="e.g. Shop Promo"
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Target URL</Label>
                    <Input
                      value={content.announcement.linkUrl || ""}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          announcement: { ...content.announcement, linkUrl: e.target.value },
                        })
                      }
                      placeholder="e.g. /shop"
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "about" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">About Us Highlights &amp; Metrics</h3>
                  <p className="text-xs text-slate-500">Corporate stats and values displayed on homepage and about page</p>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Section Heading</Label>
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

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Subheading / Value Slogan</Label>
                  <Input
                    value={content.aboutSummary.subheading}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        aboutSummary: { ...content.aboutSummary, subheading: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Overview Description</Label>
                  <textarea
                    value={content.aboutSummary.description}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        aboutSummary: { ...content.aboutSummary, description: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full mt-1 p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Experience Stat</Label>
                    <Input
                      value={content.aboutSummary.yearsOfExperience}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          aboutSummary: {
                            ...content.aboutSummary,
                            yearsOfExperience: e.target.value,
                          },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Delivered Stat</Label>
                    <Input
                      value={content.aboutSummary.productsDelivered}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          aboutSummary: {
                            ...content.aboutSummary,
                            productsDelivered: e.target.value,
                          },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Satisfaction</Label>
                    <Input
                      value={content.aboutSummary.satisfactionRate}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          aboutSummary: {
                            ...content.aboutSummary,
                            satisfactionRate: e.target.value,
                          },
                        })
                      }
                      className="mt-1 h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "contact" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Official Contact Details</h3>
                  <p className="text-xs text-slate-500">Contact information rendered in navigation, footer, and contact page</p>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Phone Number</Label>
                  <Input
                    value={content.contactInfo.phone}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, phone: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">WhatsApp Number</Label>
                  <Input
                    value={content.contactInfo.whatsapp}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, whatsapp: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Support / Business Email</Label>
                  <Input
                    type="email"
                    value={content.contactInfo.email}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, email: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Factory / Corporate Address</Label>
                  <Input
                    value={content.contactInfo.address}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, address: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Operational Business Hours</Label>
                  <Input
                    value={content.contactInfo.businessHours}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, businessHours: e.target.value },
                      })
                    }
                    className="mt-1 h-11 rounded-xl text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-4 bg-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase text-orange-400 flex items-center gap-1.5">
                <Eye size={14} />
                Live Preview Snapshot
              </span>
              <span className="text-[11px] text-slate-400">Real-time simulation</span>
            </div>

            {/* Announcement simulation */}
            {content.announcement.enabled && (
              <div className="p-2.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-[11px] text-orange-200">
                {content.announcement.text}
              </div>
            )}

            {/* Hero simulation */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {content.hero.badge}
              </span>
              <h4 className="text-base font-extrabold text-white leading-tight">
                {content.hero.titlePrimary}{" "}
                <span className="text-orange-500">{content.hero.titleSecondary}</span>
              </h4>
              <p className="text-xs text-slate-400 line-clamp-3">{content.hero.description}</p>
              <div className="flex gap-2 pt-2">
                <div className="px-3 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-bold">
                  {content.hero.primaryButtonText}
                </div>
                <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-medium border border-slate-700">
                  {content.hero.secondaryButtonText}
                </div>
              </div>
            </div>

            {/* About metrics simulation */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                <p className="text-xs font-black text-orange-400">{content.aboutSummary.yearsOfExperience}</p>
                <p className="text-[9px] text-slate-400 uppercase">Experience</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                <p className="text-xs font-black text-orange-400">{content.aboutSummary.productsDelivered}</p>
                <p className="text-[9px] text-slate-400 uppercase">Delivered</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                <p className="text-xs font-black text-orange-400">{content.aboutSummary.satisfactionRate}</p>
                <p className="text-[9px] text-slate-400 uppercase">Satisfaction</p>
              </div>
            </div>

            {/* Contact quick simulation */}
            <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
              <p>📞 {content.contactInfo.phone}</p>
              <p>📍 {content.contactInfo.address}</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
