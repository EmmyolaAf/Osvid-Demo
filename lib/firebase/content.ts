import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./client";
import { SiteContent, DEFAULT_SITE_CONTENT } from "@/types/content";

const SITE_CONTENT_DOC_ID = "homepage";

/**
 * Fetch dynamic website content with fallback
 */
export async function getSiteContent(): Promise<SiteContent> {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("osvid_site_content");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // fallback
    }
  }

  try {
    const docRef = doc(db, "site_content", SITE_CONTENT_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SiteContent;
      if (typeof window !== "undefined") {
        localStorage.setItem("osvid_site_content", JSON.stringify(data));
      }
      return data;
    }
  } catch (err) {
    console.warn("Could not fetch site content from Firestore, using default:", err);
  }

  return DEFAULT_SITE_CONTENT;
}

/**
 * Save updated website content (Admin only)
 */
export async function saveSiteContent(content: Partial<SiteContent>, updatedBy?: string): Promise<SiteContent> {
  const current = await getSiteContent();
  const merged: SiteContent = {
    ...current,
    ...content,
    hero: { ...current.hero, ...(content.hero || {}) },
    announcement: { ...current.announcement, ...(content.announcement || {}) },
    aboutSummary: { ...current.aboutSummary, ...(content.aboutSummary || {}) },
    contactInfo: { ...current.contactInfo, ...(content.contactInfo || {}) },
    lastUpdated: new Date().toISOString(),
    updatedBy: updatedBy || "Admin",
  };

  if (typeof window !== "undefined") {
    localStorage.setItem("osvid_site_content", JSON.stringify(merged));
    // Dispatch a storage/custom event so open pages update in real-time
    window.dispatchEvent(new CustomEvent("osvid_content_updated", { detail: merged }));
  }

  try {
    const docRef = doc(db, "site_content", SITE_CONTENT_DOC_ID);
    await setDoc(docRef, merged, { merge: true });
  } catch (err) {
    console.warn("Could not write site content to Firestore, saved locally:", err);
  }

  return merged;
}
