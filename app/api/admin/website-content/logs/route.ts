import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuthenticatedUser, AuthError } from "@/lib/server/auth";
import { ContentChangeLog } from "@/types/content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (!user.isSuperAdmin && !user.isAdmin && !user.permissions?.canManageWebsite) {
      return NextResponse.json(
        { error: "Forbidden: You lack operational permission to view website content audit logs." },
        { status: 403 }
      );
    }

    const dataDir = path.join(process.cwd(), "data");
    const logsFilePath = path.join(dataDir, "change-logs.json");

    let logs: ContentChangeLog[] = [];
    try {
      const logsData = await fs.readFile(logsFilePath, "utf8");
      logs = JSON.parse(logsData);
    } catch {
      logs = [];
    }

    const now = Date.now();
    // Prune expired logs older than 7 days
    const activeLogs = logs.filter((l) => {
      const expTime = new Date(l.expiresAt).getTime();
      return expTime > now;
    });

    // If any logs expired, update the file on disk
    if (activeLogs.length !== logs.length) {
      await fs.writeFile(logsFilePath, JSON.stringify(activeLogs, null, 2), "utf8");
    }

    return NextResponse.json({
      success: true,
      logs: activeLogs,
      retentionPolicyDays: 7,
      notice: "Logs older than 7 days are automatically purged. Changes cannot be reverted after 1 week.",
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error reading website change logs:", err);
    return NextResponse.json(
      { error: err.message || "Failed to read change logs" },
      { status: 500 }
    );
  }
}
