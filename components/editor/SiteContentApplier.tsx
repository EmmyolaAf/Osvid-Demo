"use client";

import { useEffect } from "react";
import { getSiteContent } from "@/lib/firebase/content";
import { ElementStyleOverride } from "@/types/content";

/**
 * Applies saved element styles directly to DOM nodes matching data-editable-id
 * across the entire live website for all visitors.
 */
export function applyElementOverridesToDOM(elements: Record<string, ElementStyleOverride>) {
  if (typeof document === "undefined" || !elements) return;

  for (const [id, style] of Object.entries(elements)) {
    if (!id || !style) continue;
    const el = document.querySelector(`[data-editable-id="${id}"]`) as HTMLElement;
    if (el) {
      if (style.text && el.childElementCount === 0) {
        el.innerText = style.text;
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
    }
  }
}

export default function SiteContentApplier() {
  useEffect(() => {
    // 1. Initial application on page load
    getSiteContent()
      .then((content) => {
        if (content?.elements) {
          applyElementOverridesToDOM(content.elements);
        }
      })
      .catch((err) => {
        console.warn("Could not apply initial site content overrides:", err);
      });

    // 2. Real-time dynamic updates when saved in the visual editor
    const handleUpdate = (e: any) => {
      if (e.detail?.elements) {
        applyElementOverridesToDOM(e.detail.elements);
      }
    };

    window.addEventListener("osvid_content_updated", handleUpdate);
    return () => window.removeEventListener("osvid_content_updated", handleUpdate);
  }, []);

  return null;
}
