"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSiteContent } from "@/lib/firebase/content";
import { ElementStyleOverride } from "@/types/content";

/**
 * Searches the DOM robustly to find the target element by:
 * 1. data-editable-id attribute
 * 2. Exact CSS selector
 * 3. Element text matching originalText
 * 4. Extracted id heuristics (e.g. elem_span_3+ -> <span> containing "3+")
 */
function findTargetElement(id: string, style: ElementStyleOverride): HTMLElement | null {
  if (typeof document === "undefined") return null;

  // 1. Explicit data-editable-id attribute
  try {
    const byId = document.querySelector(`[data-editable-id="${id}"]`);
    if (byId instanceof HTMLElement) return byId;
  } catch {}

  // 2. CSS selector if recorded
  if (style.selector) {
    try {
      const bySelector = document.querySelector(style.selector);
      if (bySelector instanceof HTMLElement) return bySelector;
    } catch {}
  }

  // 3. Match by originalText
  if (style.originalText && style.originalText.trim()) {
    const trimmedTarget = style.originalText.trim();
    const candidateTags = style.tagName
      ? [style.tagName.toUpperCase()]
      : ["H1", "H2", "H3", "H4", "H5", "H6", "P", "SPAN", "BUTTON", "A", "STRONG", "EM", "LABEL"];

    for (const tag of candidateTags) {
      const elements = document.getElementsByTagName(tag);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        if (el.innerText?.trim() === trimmedTarget) {
          return el;
        }
      }
    }
  }

  // 4. Extracted heuristic from auto-generated id format: elem_{tagName}_{textSnippet}
  if (id.startsWith("elem_")) {
    const parts = id.split("_");
    if (parts.length >= 3) {
      const tag = parts[1].toUpperCase();
      const snippet = parts.slice(2).join("_").replace(/_/g, " ").trim();
      if (snippet) {
        const elements = document.getElementsByTagName(tag);
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as HTMLElement;
          const text = el.innerText?.trim() || "";
          if (text === snippet || text.startsWith(snippet) || (snippet.length >= 2 && text.includes(snippet))) {
            return el;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Applies saved element styles directly to DOM nodes across the live website.
 */
export function applyElementOverridesToDOM(elements: Record<string, ElementStyleOverride>) {
  if (typeof document === "undefined" || !elements) return;

  for (const [id, style] of Object.entries(elements)) {
    if (!id || !style) continue;

    const el = findTargetElement(id, style);
    if (el) {
      // Ensure element retains its data-editable-id for instant subsequent lookup
      if (!el.getAttribute("data-editable-id")) {
        el.setAttribute("data-editable-id", id);
      }

      // Apply text override if text changed
      if (style.text !== undefined && style.text !== null) {
        // Only replace innerText if it doesn't destroy complex interactive child components
        if (el.childElementCount === 0 || ["BUTTON", "A", "H1", "H2", "H3", "H4", "H5", "H6", "P", "SPAN"].includes(el.tagName)) {
          el.innerText = style.text;
        }
      }

      if (style.textColor) {
        el.style.color = style.textColor;
      }
      if (style.backgroundColor) {
        el.style.backgroundColor = style.backgroundColor;
      }
      if (style.borderRadius) {
        el.style.borderRadius = style.borderRadius;
      }
      if (style.fontSize) {
        el.style.fontSize = style.fontSize;
      }
      if (style.fontWeight) {
        el.style.fontWeight = style.fontWeight;
      }
      if (style.padding) {
        el.style.padding = style.padding;
      }
    }
  }
}

export default function SiteContentApplier() {
  const pathname = usePathname();
  const cachedContentRef = useRef<Record<string, ElementStyleOverride> | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const runApplication = (elements: Record<string, ElementStyleOverride>) => {
      applyElementOverridesToDOM(elements);
      // Secondary pass to ensure elements rendered post-hydration receive overrides
      const timer1 = setTimeout(() => applyElementOverridesToDOM(elements), 250);
      const timer2 = setTimeout(() => applyElementOverridesToDOM(elements), 800);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    };

    if (cachedContentRef.current) {
      runApplication(cachedContentRef.current);
    } else {
      getSiteContent()
        .then((content) => {
          if (!isSubscribed) return;
          if (content?.elements) {
            cachedContentRef.current = content.elements;
            runApplication(content.elements);
          }
        })
        .catch((err) => {
          console.warn("Could not apply initial site content overrides:", err);
        });
    }

    // Dynamic updates when saved in the visual editor
    const handleUpdate = (e: any) => {
      if (e.detail?.elements) {
        cachedContentRef.current = e.detail.elements;
        runApplication(e.detail.elements);
      }
    };

    window.addEventListener("osvid_content_updated", handleUpdate);
    return () => {
      isSubscribed = false;
      window.removeEventListener("osvid_content_updated", handleUpdate);
    };
  }, [pathname]);

  return null;
}
