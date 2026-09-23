"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSiteContent, saveSiteContent } from "@/lib/firebase/content";
import { SiteContent, DEFAULT_SITE_CONTENT } from "@/types/content";
import {
  Edit3,
  Check,
  X,
  Sparkles,
  LayoutTemplate,
  ExternalLink,
  Save,
  RotateCcw,
  Sliders,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function VisualEditorToolbar() {
  const { user, userProfile, role } = useAuth();
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [isEditMode, setIsEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"hero" | "announcement" | "about" | "contact">("hero");

  const canEdit =
    role === "admin" ||
    role === "super_admin" ||
    Boolean(userProfile?.permissions?.canManageWebsite);

  useEffect(() => {
    async function load() {
      const data = await getSiteContent();
      setContent(data);
    }
    load();

    const handleUpdate = (e: any) => {
      if (e.detail) setContent(e.detail);
    };
    window.addEventListener("osvid_content_updated", handleUpdate);
    return () => window.removeEventListener("osvid_content_updated", handleUpdate);
  }, []);

  if (!canEdit || !user) {
    return null;
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSiteContent(content, userProfile?.displayName || "Admin");
      toast.success("Website content published live!");
      setDrawerOpen(false);
    } catch (e) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm("Reset all content back to factory defaults?")) {
      setContent(DEFAULT_SITE_CONTENT);
      toast.info("Content reset to defaults. Click Publish to apply.");
    }
  };

  return (
    <>
      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md text-white border border-white/20 p-2 pl-4 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Admin Mode</span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        <Button
          size="sm"
          onClick={() => setDrawerOpen(true)}
          className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 gap-1.5 h-9"
        >
          <Edit3 size={14} />
          <span>Edit Website Content</span>
        </Button>

        <Link href="/dashboard/website-editor">
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-white/10 text-xs h-9 rounded-xl gap-1 px-2.5"
          >
            <Sliders size={14} />
            <span className="hidden sm:inline">Builder Studio</span>
          </Button>
        </Link>
      </div>

      {/* Slide-out Quick Editor Panel */}
      {drawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between text-slate-800 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold">
                <Edit3 size={16} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Visual Website Editor</h3>
                <p className="text-[11px] text-slate-500">Live on-page storefront content customizer</p>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 px-4 bg-white">
            <button
              onClick={() => setActiveTab("hero")}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === "hero"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Hero Banner
            </button>
            <button
              onClick={() => setActiveTab("announcement")}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === "announcement"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Announcement
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === "about"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              About Stats
            </button>
            <button
              onClick={() => setActiveTab("contact")}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === "contact"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Contact &amp; Hours
            </button>
          </div>

          {/* Content Form Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === "hero" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Top Eyebrow Badge</Label>
                  <Input
                    value={content.hero.badge}
                    onChange={(e) =>
                      setContent({ ...content, hero: { ...content.hero, badge: e.target.value } })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Primary Headline</Label>
                  <Input
                    value={content.hero.titlePrimary}
                    onChange={(e) =>
                      setContent({ ...content, hero: { ...content.hero, titlePrimary: e.target.value } })
                    }
                    className="mt-1 text-sm h-10 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Secondary Headline (Colored)</Label>
                  <Input
                    value={content.hero.titleSecondary}
                    onChange={(e) =>
                      setContent({ ...content, hero: { ...content.hero, titleSecondary: e.target.value } })
                    }
                    className="mt-1 text-sm h-10 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Hero Description</Label>
                  <textarea
                    value={content.hero.description}
                    onChange={(e) =>
                      setContent({ ...content, hero: { ...content.hero, description: e.target.value } })
                    }
                    rows={3}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">CTA Button Text</Label>
                    <Input
                      value={content.hero.primaryButtonText}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: { ...content.hero, primaryButtonText: e.target.value },
                        })
                      }
                      className="mt-1 text-xs h-9 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-600">Secondary Button</Label>
                    <Input
                      value={content.hero.secondaryButtonText}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: { ...content.hero, secondaryButtonText: e.target.value },
                        })
                      }
                      className="mt-1 text-xs h-9 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "announcement" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">Show Announcement Bar</span>
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
                  <Label className="text-xs font-bold uppercase text-slate-600">Announcement Banner Text</Label>
                  <textarea
                    value={content.announcement.text}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        announcement: { ...content.announcement, text: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">About Heading</Label>
                  <Input
                    value={content.aboutSummary.heading}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        aboutSummary: { ...content.aboutSummary, heading: e.target.value },
                      })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] font-bold uppercase text-slate-600">Experience</Label>
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
                      className="mt-1 text-xs h-9 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold uppercase text-slate-600">Delivered</Label>
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
                      className="mt-1 text-xs h-9 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold uppercase text-slate-600">Satisfaction</Label>
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
                      className="mt-1 text-xs h-9 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Official Phone Number</Label>
                  <Input
                    value={content.contactInfo.phone}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, phone: e.target.value },
                      })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">WhatsApp Hotline</Label>
                  <Input
                    value={content.contactInfo.whatsapp}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, whatsapp: e.target.value },
                      })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Email Address</Label>
                  <Input
                    type="email"
                    value={content.contactInfo.email}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, email: e.target.value },
                      })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-600">Facility / Store Address</Label>
                  <Input
                    value={content.contactInfo.address}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        contactInfo: { ...content.contactInfo, address: e.target.value },
                      })
                    }
                    className="mt-1 text-sm h-10 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs rounded-xl gap-1 text-slate-600"
            >
              <RotateCcw size={13} />
              <span>Defaults</span>
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-md shadow-orange-600/20"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                <span>Publish Updates</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
