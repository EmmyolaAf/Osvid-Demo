import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, authErrorResponse } from "@/lib/server/auth";
import { getRecentAuditLogs } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limitCount = Math.min(200, Math.max(10, parseInt(limitParam || "50", 10)));

    const logs = await getRecentAuditLogs(limitCount);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
