import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuthenticatedUser, AuthError } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { SiteContent, DEFAULT_SITE_CONTENT, ContentChangeLog } from "@/types/content";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (!user.isSuperAdmin && !user.isAdmin && !user.permissions?.canManageWebsite) {
      return NextResponse.json(
        { error: "Forbidden: You lack operational permission to edit website content." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { page, elements, content, summary } = body;

    const dataDir = path.join(process.cwd(), "data");
    const contentFilePath = path.join(dataDir, "site-content.json");
    const logsFilePath = path.join(dataDir, "change-logs.json");

    // Read current codebase content file
    let currentContent: SiteContent = DEFAULT_SITE_CONTENT;
    try {
      const fileData = await fs.readFile(contentFilePath, "utf8");
      currentContent = JSON.parse(fileData);
    } catch {
      // If missing or parse error, use default
      currentContent = DEFAULT_SITE_CONTENT;
    }

    // Capture previous snapshot of the elements being modified for 1-week revert capability
    const previousSnapshot: Record<string, any> = {};
    if (elements && typeof elements === "object") {
      for (const key of Object.keys(elements)) {
        if (currentContent.elements && currentContent.elements[key]) {
          previousSnapshot[key] = { ...currentContent.elements[key] };
        }
      }
    }

    // Merge updates into codebase content
    const updatedContent: SiteContent = {
      ...currentContent,
      hero: { ...currentContent.hero, ...(content?.hero || {}) },
      announcement: { ...currentContent.announcement, ...(content?.announcement || {}) },
      aboutSummary: { ...currentContent.aboutSummary, ...(content?.aboutSummary || {}) },
      contactInfo: { ...currentContent.contactInfo, ...(content?.contactInfo || {}) },
      elements: {
        ...(currentContent.elements || {}),
        ...(elements || {}),
      },
      lastUpdated: new Date().toISOString(),
      updatedBy: user.displayName || user.email || "Administrator",
    };

    // Write updated content DIRECTLY to the codebase file on disk
    await fs.writeFile(contentFilePath, JSON.stringify(updatedContent, null, 2), "utf8");

    // Manage 7-day (1-week) change log
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now + SEVEN_DAYS_MS).toISOString();

    let logs: ContentChangeLog[] = [];
    try {
      const logsData = await fs.readFile(logsFilePath, "utf8");
      logs = JSON.parse(logsData);
    } catch {
      logs = [];
    }

    // Prune expired logs (> 7 days old)
    const validLogs = logs.filter((l) => {
      const expTime = new Date(l.expiresAt).getTime();
      return expTime > now;
    });

    const newLogEntry: ContentChangeLog = {
      id: "log_" + now + "_" + Math.random().toString(36).substring(2, 8),
      timestamp: new Date(now).toISOString(),
      expiresAt,
      author: user.displayName || user.email || "Administrator",
      page: page || "/",
      summary: summary || `Visual edits applied to ${page || "Home Page"} (${Object.keys(elements || {}).length} element(s))`,
      changes: elements || {},
      previousSnapshot,
    };

    validLogs.unshift(newLogEntry);

    // Save pruned & updated logs to disk
    await fs.writeFile(logsFilePath, JSON.stringify(validLogs, null, 2), "utf8");

    // Realtime dual-write to Firestore for multi-tab synchronization (fail-safe)
    try {
      await adminDb.collection("site_content").doc("homepage").set(updatedContent, { merge: true });
    } catch (e) {
      console.warn("Firestore sync warning in website-content/save:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Website content saved to codebase successfully! Active for all visitors.",
      content: updatedContent,
      log: newLogEntry,
      retentionNotice: "Changes logged with 7-day retention window. Older logs automatically purged.",
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error saving website content to codebase:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save website content to codebase" },
      { status: 500 }
    );
  }
}
