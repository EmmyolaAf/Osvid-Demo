import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "./client";
import { SiteContent, DEFAULT_SITE_CONTENT, ContentChangeLog, ElementStyleOverride } from "@/types/content";

const SITE_CONTENT_DOC_ID = "homepage";

/**
 * Fetch dynamic website content directly from codebase with fallback
 */
export async function getSiteContent(): Promise<SiteContent> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/admin/website-content/content", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          localStorage.setItem("osvid_site_content", JSON.stringify(data.content));
          return data.content;
        }
      }
    } catch {
      // Fallback to localStorage or Firestore if offline
    }

    try {
      const cached = localStorage.getItem("osvid_site_content");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
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
 * Save updated website content and element styles directly to the codebase
 */
export async function saveSiteContent(
  content: Partial<SiteContent>,
  updatedBy?: string,
  elements?: Record<string, ElementStyleOverride>,
  page?: string,
  summary?: string
): Promise<SiteContent> {
  const current = await getSiteContent();
  const merged: SiteContent = {
    ...current,
    ...content,
    hero: { ...current.hero, ...(content.hero || {}) },
    announcement: { ...current.announcement, ...(content.announcement || {}) },
    aboutSummary: { ...current.aboutSummary, ...(content.aboutSummary || {}) },
    contactInfo: { ...current.contactInfo, ...(content.contactInfo || {}) },
    elements: {
      ...(current.elements || {}),
      ...(elements || {}),
    },
    lastUpdated: new Date().toISOString(),
    updatedBy: updatedBy || "Administrator",
  };

  if (typeof window !== "undefined") {
    localStorage.setItem("osvid_site_content", JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("osvid_content_updated", { detail: merged }));

    // Send to codebase save endpoint
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      const res = await fetch("/api/admin/website-content/save", {
        method: "POST",
        headers,
        body: JSON.stringify({
          page: page || window.location.pathname || "/",
          content: merged,
          elements: elements || {},
          summary: summary || `Updated ${page || "website"} elements in codebase`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || "Server rejected website content save";
        console.warn("Codebase save API returned error:", msg);
        throw new Error(msg);
      }
    } catch (apiErr: any) {
      console.warn("Failed to reach codebase save endpoint:", apiErr);
      throw apiErr;
    }
  }

  // Backup to Firestore
  try {
    const docRef = doc(db, "site_content", SITE_CONTENT_DOC_ID);
    const sanitizedMerged = JSON.parse(JSON.stringify(merged));
    await setDoc(docRef, sanitizedMerged, { merge: true });
  } catch (err) {
    console.warn("Could not write site content to Firestore:", err);
  }

  return merged;
}

/**
 * Fetch 7-day change logs from codebase
 */
export async function getWebsiteChangeLogs(): Promise<ContentChangeLog[]> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

    const res = await fetch("/api/admin/website-content/logs", {
      headers,
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch (err) {
    console.warn("Failed to fetch change logs:", err);
  }
  return [];
}

/**
 * Revert changes from an active 7-day log snapshot
 */
export async function revertWebsiteChangeLog(logId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

    const res = await fetch("/api/admin/website-content/revert", {
      method: "POST",
      headers,
      body: JSON.stringify({ logId }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to revert change log" };
    }

    if (data.content && typeof window !== "undefined") {
      localStorage.setItem("osvid_site_content", JSON.stringify(data.content));
      window.dispatchEvent(new CustomEvent("osvid_content_updated", { detail: data.content }));
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error reverting change log" };
  }
}

