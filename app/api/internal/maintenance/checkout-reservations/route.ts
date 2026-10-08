import crypto from "crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredCheckoutReservations } from "@/lib/server/checkout-session";
import { requireMaintenanceCronSecret } from "@/lib/server/env";
import { logger, getOrGenerateRequestId } from "@/lib/server/logger";

export const dynamic = "force-dynamic";

/**
 * Constant-time comparison helper to prevent timing attacks against maintenance tokens
 */
function isSecretValid(incoming: string | null | undefined, expected: string): boolean {
  if (!incoming || !expected) return false;
  const inBuf = Buffer.from(incoming.trim(), "utf8");
  const expBuf = Buffer.from(expected.trim(), "utf8");
  if (inBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(inBuf, expBuf);
}

/**
 * Protected internal endpoint to clean up expired checkout reservations.
 *
 * Requirements:
 * - Server only.
 * - Authenticated with MAINTENANCE_CRON_SECRET via Bearer token or x-maintenance-key header.
 * - Constant-time secret verification.
 * - Bounded cleanup batch size (default 50, maximum 100).
 * - Safe response: summary count and timestamp only. Never echoes secrets or customer PII.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getOrGenerateRequestId(req);

  // 1. Resolve and validate maintenance secret configuration
  let configuredSecret: string;
  try {
    configuredSecret = requireMaintenanceCronSecret();
  } catch (confErr: any) {
    logger.error("Maintenance cleanup endpoint called but MAINTENANCE_CRON_SECRET is unconfigured", {
      requestId,
      operation: "maintenance_cleanup",
      outcome: "failure",
    });
    return NextResponse.json(
      { success: false, error: "Maintenance service unavailable" },
      { status: 503 }
    );
  }

  // 2. Extract incoming authentication header
  const authHeader = req.headers.get("authorization");
  const directKey = req.headers.get("x-maintenance-key") || req.headers.get("x-cron-secret");

  let candidateSecret: string | null = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    candidateSecret = authHeader.substring(7).trim();
  } else if (directKey) {
    candidateSecret = directKey.trim();
  }

  // 3. Constant-time authentication
  if (!isSecretValid(candidateSecret, configuredSecret)) {
    logger.warn("Unauthorized attempt to invoke maintenance cleanup endpoint", {
      requestId,
      operation: "maintenance_cleanup",
      outcome: "failure",
    });
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 4. Parse bounded batch limit
  const { searchParams } = new URL(req.url);
  const rawBatch = parseInt(searchParams.get("batch") || "50", 10);
  const batchLimit = Math.max(1, Math.min(isNaN(rawBatch) ? 50 : rawBatch, 100));

  logger.info(`Starting maintenance cleanup for expired checkout reservations (batchLimit: ${batchLimit})`, {
    requestId,
    operation: "maintenance_cleanup",
    outcome: "in_progress",
  });

  try {
    const cleanedCount = await cleanupExpiredCheckoutReservations(batchLimit);

    logger.info(`Completed maintenance cleanup for expired checkout reservations`, {
      requestId,
      operation: "maintenance_cleanup",
      cleanedCount,
      batchLimit,
      outcome: "success",
    });

    return NextResponse.json(
      {
        success: true,
        cleanedCount,
        releasedCount: cleanedCount,
        batchLimit,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (err: any) {
    logger.error(
      "Unexpected error executing expired checkout reservation cleanup",
      {
        requestId,
        operation: "maintenance_cleanup",
        outcome: "failure",
      },
      err
    );

    return NextResponse.json(
      { success: false, error: "Maintenance execution failed" },
      { status: 500 }
    );
  }
}
