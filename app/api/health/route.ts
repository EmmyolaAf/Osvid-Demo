import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight public runtime health check for Cloud Run and uptime monitoring.
 *
 * Security Invariants:
 * - NEVER exposes secrets, provider keys, credentials, or PII.
 * - Does NOT perform expensive Firestore or Paystack API calls on health probes.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "osvid-web",
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
