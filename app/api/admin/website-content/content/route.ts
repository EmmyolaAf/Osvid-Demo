import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { SiteContent, DEFAULT_SITE_CONTENT } from "@/types/content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contentFilePath = path.join(process.cwd(), "data", "site-content.json");
    try {
      const fileData = await fs.readFile(contentFilePath, "utf8");
      const content: SiteContent = JSON.parse(fileData);
      return NextResponse.json({ success: true, content });
    } catch {
      return NextResponse.json({ success: true, content: DEFAULT_SITE_CONTENT });
    }
  } catch (err: any) {
    return NextResponse.json({ success: true, content: DEFAULT_SITE_CONTENT });
  }
}
