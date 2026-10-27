"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSiteContent, saveSiteContent } from "@/lib/firebase/content";
import { SiteContent, DEFAULT_SITE_CONTENT, ElementStyleOverride } from "@/types/content";
import {
  Edit3,
  Check,
  X,
  Sparkles,
  Save,
  RotateCcw,
  Sliders,
  Eye,
  MousePointer,
  Palette,
  Type,
  CornerDownLeft,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface SelectedElementData {
  id: string;
  name: string;
  domElement: HTMLElement;
  text: string;
  textColor: string;
  backgroundColor: string;
  borderRadius: string;
  fontSize: string;
  fontWeight: string;
}

function VisualEditorToolbarInner() {
  const { user, userProfile, role } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(true);
  const [selectedElement, setSelectedElement] = useState<SelectedElementData | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ id: string; name: string; rect: DOMRect } | null>(null);

  // Inspector form states
  const [editText, setEditText] = useState("");
  const [editTextColor, setEditTextColor] = useState("");
  const [editBgColor, setEditBgColor] = useState("");
  const [editBorderRadius, setEditBorderRadius] = useState("");
  const [editFontSize, setEditFontSize] = useState("");
  const [editFontWeight, setEditFontWeight] = useState("");

  // Pending unsaved overrides
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, ElementStyleOverride>>({});
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit =
    role === "admin" ||
    role === "super_admin" ||
    Boolean(userProfile?.permissions?.canManageWebsite);

  // Automatically activate when ?editMode=true is present in query parameters
  useEffect(() => {
    if (searchParams.get("editMode") === "true") {
      setIsEditMode(true);
      setIsSelectMode(true);
    }
  }, [searchParams]);

  // Load site content and apply saved element overrides on page load
  useEffect(() => {
    async function load() {
      const data = await getSiteContent();
      setSiteContent(data);
      applySavedStylesToDOM(data.elements || {});
    }
    load();

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setSiteContent(e.detail);
        applySavedStylesToDOM(e.detail.elements || {});
      }
    };
    window.addEventListener("osvid_content_updated", handleUpdate);
    return () => window.removeEventListener("osvid_content_updated", handleUpdate);
  }, [pathname]);

  // Apply styles saved in codebase to matching DOM elements
  const applySavedStylesToDOM = (elements: Record<string, ElementStyleOverride>) => {
    if (typeof document === "undefined") return;
    for (const [id, style] of Object.entries(elements)) {
      const el = document.querySelector(`[data-editable-id="${id}"]`) as HTMLElement;
      if (el) {
        if (style.text && el.childElementCount === 0) el.innerText = style.text;
        if (style.textColor) el.style.color = style.textColor;
        if (style.backgroundColor) el.style.backgroundColor = style.backgroundColor;
        if (style.borderRadius) el.style.borderRadius = style.borderRadius;
        if (style.fontSize) el.style.fontSize = style.fontSize;
        if (style.fontWeight) el.style.fontWeight = style.fontWeight;
      }
    }
  };

  // Hover and selection interaction
  useEffect(() => {
    if (!isEditMode || !isSelectMode) {
      setHoveredElement(null);
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("#osvid-visual-builder-root")) return;

      // Check if target is a relevant text/button/card element
      const isCandidate =
        target.hasAttribute("data-editable-id") ||
        ["BUTTON", "A", "H1", "H2", "H3", "H4", "P", "SPAN"].includes(target.tagName);

      if (isCandidate) {
        const id =
          target.getAttribute("data-editable-id") ||
          `elem_${target.tagName.toLowerCase()}_${target.innerText?.slice(0, 15).replace(/\s+/g, "_") || "item"}`;
        const name =
          target.getAttribute("data-editable-name") ||
          `${target.tagName.toLowerCase()} (${target.innerText?.slice(0, 20) || "block"})`;

        const rect = target.getBoundingClientRect();
        setHoveredElement({ id, name, rect });
        target.style.outline = "2px dashed #ea580c";
        target.style.outlineOffset = "2px";
        target.style.cursor = "pointer";
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("#osvid-visual-builder-root")) return;
      target.style.outline = "";
      target.style.outlineOffset = "";
      setHoveredElement(null);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("#osvid-visual-builder-root")) return;

      const isCandidate =
        target.hasAttribute("data-editable-id") ||
        ["BUTTON", "A", "H1", "H2", "H3", "H4", "P", "SPAN"].includes(target.tagName);

      if (isCandidate) {
        e.preventDefault();
        e.stopPropagation();

        const id =
          target.getAttribute("data-editable-id") ||
          `elem_${target.tagName.toLowerCase()}_${target.innerText?.slice(0, 15).replace(/\s+/g, "_") || "item"}`;
        const name =
          target.getAttribute("data-editable-name") ||
          `${target.tagName} element ("${target.innerText?.slice(0, 25) || "item"}")`;

        const computed = window.getComputedStyle(target);

        // Populate inspector state
        setSelectedElement({
          id,
          name,
          domElement: target,
          text: target.innerText || "",
          textColor: target.style.color || computed.color || "#000000",
          backgroundColor: target.style.backgroundColor || computed.backgroundColor || "transparent",
          borderRadius: target.style.borderRadius || computed.borderRadius || "0px",
          fontSize: target.style.fontSize || computed.fontSize || "16px",
          fontWeight: target.style.fontWeight || computed.fontWeight || "400",
        });

        setEditText(target.innerText || "");
        setEditTextColor(target.style.color || computed.color || "");
        setEditBgColor(target.style.backgroundColor || computed.backgroundColor || "");
        setEditBorderRadius(target.style.borderRadius || computed.borderRadius || "0px");
        setEditFontSize(target.style.fontSize || computed.fontSize || "16px");
        setEditFontWeight(target.style.fontWeight || computed.fontWeight || "400");
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isEditMode, isSelectMode]);

  // Realtime live DOM updates when inspector form changes
  const updateSelectedDOM = (updates: Partial<ElementStyleOverride>) => {
    if (!selectedElement || !selectedElement.domElement) return;

    const el = selectedElement.domElement;
    if (updates.text !== undefined) {
      if (el.childElementCount === 0 || el.tagName === "BUTTON" || el.tagName === "SPAN" || el.tagName.startsWith("H") || el.tagName === "P") {
        el.innerText = updates.text;
      }
    }
    if (updates.textColor !== undefined) el.style.color = updates.textColor;
    if (updates.backgroundColor !== undefined) el.style.backgroundColor = updates.backgroundColor;
    if (updates.borderRadius !== undefined) el.style.borderRadius = updates.borderRadius;
    if (updates.fontSize !== undefined) el.style.fontSize = updates.fontSize;
    if (updates.fontWeight !== undefined) el.style.fontWeight = updates.fontWeight;

    // Track pending overrides to save to codebase
    setPendingOverrides((prev) => ({
      ...prev,
      [selectedElement.id]: {
        ...(prev[selectedElement.id] || {}),
        ...updates,
      },
    }));
  };

  if (!canEdit || !user) {
    return null;
  }

  // Handle Save directly to codebase
  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      const updatedElements = {
        ...(siteContent.elements || {}),
        ...pendingOverrides,
      };

      await saveSiteContent(
        { elements: updatedElements },
        userProfile?.displayName || user.email || "Admin",
        pendingOverrides,
        pathname,
        `Visual styling & content update on ${pathname} (${Object.keys(pendingOverrides).length} element(s))`
      );

      toast.success("Website content saved to codebase! Live for all visitors.");
      setPendingOverrides({});
      setIsConfirmModalOpen(false);
      setSelectedElement(null);
    } catch (err: any) {
      console.error("Save to codebase error:", err);
      toast.error(err.message || "Failed to save to codebase");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = Object.keys(pendingOverrides).length;

  return (
    <div id="osvid-visual-builder-root" className="pointer-events-auto">
      {/* ============================================================ */}
      {/* TOP FLOATING VISUAL BUILDER WORKSPACE BAR */}
      {/* ============================================================ */}
      {isEditMode ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900/95 backdrop-blur-md text-white border border-white/20 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 sm:gap-4 max-w-[96vw] overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-orange-400">
              Visual Builder
            </span>
            <span className="text-[11px] text-slate-400 hidden md:inline">
              Page: <strong className="text-white">{pathname}</strong>
            </span>
          </div>

          <div className="h-4 w-px bg-white/20 shrink-0" />

          {/* Mode Switch: Select Elements vs Live Preview */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-white/10 shrink-0 text-xs font-semibold">
            <button
              onClick={() => setIsSelectMode(true)}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                isSelectMode
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MousePointer size={13} />
              <span>Click to Edit</span>
            </button>
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedElement(null);
              }}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                !isSelectMode
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          <div className="h-4 w-px bg-white/20 shrink-0" />

          {/* Save to Codebase Button */}
          <Button
            size="sm"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={pendingCount === 0}
            className={`h-8 px-3 rounded-xl font-bold text-xs gap-1.5 shrink-0 transition-all cursor-pointer ${
              pendingCount > 0
                ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-600/30 animate-pulse"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Save size={13} />
            <span>Save to Codebase</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-orange-600 text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </Button>

          {/* Exit / Done button */}
          <button
            onClick={() => {
              setIsEditMode(false);
              setSelectedElement(null);
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Exit Visual Editor"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* Floating Minimized Admin Trigger */
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3 bg-slate-900/95 backdrop-blur-md text-white border border-white/20 p-2 pl-4 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Admin Mode</span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <Button
            size="sm"
            onClick={() => {
              setIsEditMode(true);
              setIsSelectMode(true);
            }}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 gap-1.5 h-9 cursor-pointer"
          >
            <Edit3 size={14} />
            <span>Click to Edit Page</span>
          </Button>

          <Link href="/dashboard/website-editor">
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-300 hover:text-white hover:bg-white/10 text-xs h-9 rounded-xl gap-1 px-2.5"
            >
              <Sliders size={14} />
              <span className="hidden sm:inline">Page Selector</span>
            </Button>
          </Link>
        </div>
      )}

      {/* ============================================================ */}
      {/* FLOATING HOVER ELEMENT TOOLTIP */}
      {/* ============================================================ */}
      {isEditMode && isSelectMode && hoveredElement && !selectedElement && (
        <div
          style={{
            top: `${Math.max(10, hoveredElement.rect.top - 28 + window.scrollY)}px`,
            left: `${Math.max(10, hoveredElement.rect.left + window.scrollX)}px`,
          }}
          className="fixed z-[99998] pointer-events-none bg-orange-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5 animate-in fade-in duration-150"
        >
          <MousePointer size={10} />
          <span>Click to Edit: {hoveredElement.name}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* DOCKED / FLOATING VISUAL ELEMENT INSPECTOR */}
      {/* ============================================================ */}
      {isEditMode && selectedElement && (
        <aside className="fixed top-20 right-4 z-[99999] w-88 max-w-[92vw] bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 text-slate-800 animate-in slide-in-from-right duration-200 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <Sliders size={14} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 truncate">Element Properties</h4>
                <p className="text-[10px] text-slate-400 font-mono truncate">{selectedElement.id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedElement(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>

          {/* Text Content Field */}
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-600 mb-1 block">
              Text in it
            </Label>
            <textarea
              value={editText}
              onChange={(e) => {
                const val = e.target.value;
                setEditText(val);
                updateSelectedDOM({ text: val });
              }}
              rows={3}
              placeholder="Enter text..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
            />
          </div>

          {/* Roundness / Border Radius */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-[11px] font-bold uppercase text-slate-600">
                Roundness ({editBorderRadius})
              </Label>
            </div>
            <div className="grid grid-cols-5 gap-1 mb-2 text-[10px] font-bold">
              {[
                { label: "Sharp", value: "0px" },
                { label: "6px", value: "6px" },
                { label: "12px", value: "12px" },
                { label: "20px", value: "20px" },
                { label: "Pill", value: "9999px" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setEditBorderRadius(opt.value);
                    updateSelectedDOM({ borderRadius: opt.value });
                  }}
                  className={`py-1.5 rounded-lg border text-center transition-all ${
                    editBorderRadius === opt.value
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={parseInt(editBorderRadius) || 0}
              onChange={(e) => {
                const val = `${e.target.value}px`;
                setEditBorderRadius(val);
                updateSelectedDOM({ borderRadius: val });
              }}
              className="w-full accent-orange-600"
            />
          </div>

          {/* Text Color */}
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-600 mb-1.5 block">
              Text Color
            </Label>
            <div className="flex items-center gap-1.5 mb-2">
              {[
                { label: "White", value: "#ffffff" },
                { label: "Black", value: "#000000" },
                { label: "Orange", value: "#ea580c" },
                { label: "Amber", value: "#f59e0b" },
                { label: "Slate", value: "#334155" },
                { label: "Blue", value: "#2563eb" },
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setEditTextColor(c.value);
                    updateSelectedDOM({ textColor: c.value });
                  }}
                  style={{ backgroundColor: c.value }}
                  className={`w-6 h-6 rounded-full border border-slate-300 shadow-xs transition-transform ${
                    editTextColor === c.value ? "scale-125 ring-2 ring-orange-500" : ""
                  }`}
                  title={c.label}
                />
              ))}
              <input
                type="color"
                value={editTextColor.startsWith("#") ? editTextColor : "#000000"}
                onChange={(e) => {
                  setEditTextColor(e.target.value);
                  updateSelectedDOM({ textColor: e.target.value });
                }}
                className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 ml-auto"
                title="Custom Color"
              />
            </div>
          </div>

          {/* Background Color */}
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-600 mb-1.5 block">
              Background Color
            </Label>
            <div className="flex items-center gap-1.5 mb-2">
              {[
                { label: "Transparent", value: "transparent" },
                { label: "Dark", value: "#0f172a" },
                { label: "Orange", value: "#ea580c" },
                { label: "White", value: "#ffffff" },
                { label: "Glass", value: "rgba(255, 255, 255, 0.1)" },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setEditBgColor(c.value);
                    updateSelectedDOM({ backgroundColor: c.value });
                  }}
                  className={`w-6 h-6 rounded-full border border-slate-300 shadow-xs flex items-center justify-center text-[8px] font-bold transition-transform ${
                    editBgColor === c.value ? "scale-125 ring-2 ring-orange-500" : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {c.value === "transparent" && "∅"}
                </button>
              ))}
              <input
                type="color"
                value={editBgColor.startsWith("#") ? editBgColor : "#ffffff"}
                onChange={(e) => {
                  setEditBgColor(e.target.value);
                  updateSelectedDOM({ backgroundColor: e.target.value });
                }}
                className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 ml-auto"
                title="Custom Background"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <Button
              size="sm"
              onClick={() => setSelectedElement(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl h-8 cursor-pointer"
            >
              <Check size={14} className="mr-1" /> Done with Element
            </Button>
          </div>
        </aside>
      )}

      {/* ============================================================ */}
      {/* SAVE TO CODEBASE CONFIRMATION MODAL WITH 1-WEEK WARNING */}
      {/* ============================================================ */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 text-slate-800">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
              <Save size={24} />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900">
              Save Changes Directly to Codebase
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Confirm persisting your front-end edits into the repository codebase file (<code className="text-orange-600 font-mono">data/site-content.json</code>).
            </DialogDescription>
          </DialogHeader>

          {/* 1-Week Retention Policy Warning Banner */}
          <div className="my-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-black text-xs text-amber-800 uppercase tracking-wider">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>1-Week Change Log Retention Policy</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              These changes will be written directly to the application codebase and immediately reflected for <strong>every user visiting the website</strong>.
            </p>
            <p className="text-xs text-amber-800 font-semibold leading-relaxed">
              ⚠️ A rollback change log will be kept for a <strong>maximum of 1 week (7 days)</strong>. After that 1 week, the log will be automatically deleted, meaning you will <strong>not</strong> be able to revert back to past content.
            </p>
          </div>

          {/* Pending Modifications Summary */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Modified Elements ({pendingCount})
            </p>
            {Object.entries(pendingOverrides).map(([id, override]) => (
              <div key={id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
                <span className="font-mono font-bold text-slate-800 truncate">{id}</span>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                  {override.text !== undefined && (
                    <span>Text: &ldquo;{override.text.slice(0, 30)}&rdquo;</span>
                  )}
                  {override.borderRadius !== undefined && (
                    <span>Roundness: {override.borderRadius}</span>
                  )}
                  {override.textColor !== undefined && (
                    <span>Color: {override.textColor}</span>
                  )}
                  {override.backgroundColor !== undefined && (
                    <span>Bg: {override.backgroundColor}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              className="rounded-xl text-xs font-semibold h-10 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saving}
              className="rounded-xl text-xs font-bold h-10 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md shadow-orange-600/20 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Save size={16} className="mr-1.5" />}
              <span>Confirm &amp; Write to Codebase</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VisualEditorToolbar() {
  return (
    <React.Suspense fallback={null}>
      <VisualEditorToolbarInner />
    </React.Suspense>
  );
}

