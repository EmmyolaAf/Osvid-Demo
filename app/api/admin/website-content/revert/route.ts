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
        { error: "Forbidden: You lack operational permission to revert website content." },
        { status: 403 }
      );
    }

    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "Missing logId parameter." }, { status: 400 });
    }

    const dataDir = path.join(process.cwd(), "data");
    const contentFilePath = path.join(dataDir, "site-content.json");
    const logsFilePath = path.join(dataDir, "change-logs.json");

    let logs: ContentChangeLog[] = [];
    try {
      const logsData = await fs.readFile(logsFilePath, "utf8");
      logs = JSON.parse(logsData);
    } catch {
      logs = [];
    }

    const now = Date.now();
    const targetLog = logs.find((l) => l.id === logId);

    if (!targetLog) {
      return NextResponse.json(
        { error: "Change log not found. Logs older than 1 week are automatically deleted and cannot be reverted." },
        { status: 404 }
      );
    }

    const expTime = new Date(targetLog.expiresAt).getTime();
    if (expTime <= now) {
      // Expired: prune it immediately
      const activeLogs = logs.filter((l) => new Date(l.expiresAt).getTime() > now);
      await fs.writeFile(logsFilePath, JSON.stringify(activeLogs, null, 2), "utf8");

      return NextResponse.json(
        { error: "This change log has expired (older than 1 week) and has been permanently deleted. Cannot revert." },
        { status: 410 }
      );
    }

    if (!targetLog.previousSnapshot || Object.keys(targetLog.previousSnapshot).length === 0) {
      return NextResponse.json(
        { error: "No rollback snapshot available for this change log entry." },
        { status: 400 }
      );
    }

    // Read current content from codebase
    let currentContent: SiteContent = DEFAULT_SITE_CONTENT;
    try {
      const fileData = await fs.readFile(contentFilePath, "utf8");
      currentContent = JSON.parse(fileData);
    } catch {
      currentContent = DEFAULT_SITE_CONTENT;
    }

    // Revert the elements that were changed
    const updatedElements = { ...(currentContent.elements || {}) };
    for (const [key, prevVal] of Object.entries(targetLog.previousSnapshot)) {
      if (prevVal) {
        updatedElements[key] = prevVal as any;
      } else {
        delete updatedElements[key];
      }
    }

    const revertedContent: SiteContent = {
      ...currentContent,
      elements: updatedElements,
      lastUpdated: new Date().toISOString(),
      updatedBy: `${user.displayName || user.email} (Reverted log ${targetLog.id})`,
    };

    // Write reverted content to codebase file
    await fs.writeFile(contentFilePath, JSON.stringify(revertedContent, null, 2), "utf8");

    // Create a new log entry for the reversion action
    const revertLogEntry: ContentChangeLog = {
      id: "log_" + now + "_revert_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      author: user.displayName || user.email || "Administrator",
      page: targetLog.page,
      summary: `Reverted changes from log entry "${targetLog.summary}"`,
      changes: targetLog.previousSnapshot,
    };

    logs.unshift(revertLogEntry);
    await fs.writeFile(logsFilePath, JSON.stringify(logs, null, 2), "utf8");

    // Dual write to Firestore
    try {
      await adminDb.collection("site_content").doc("homepage").set(revertedContent, { merge: true });
    } catch (e) {
      console.warn("Firestore sync warning on revert:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Successfully reverted changes in codebase!",
      content: revertedContent,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error reverting website content:", err);
    return NextResponse.json(
      { error: err.message || "Failed to revert website content" },
      { status: 500 }
    );
  }
}
