import { NextResponse } from "next/server";
import { releaseCheckoutReservation } from "@/lib/server/checkout-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content-type" }, { status: 415 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const { checkoutSessionId, releaseToken } = body || {};

    if (!checkoutSessionId || typeof checkoutSessionId !== "string") {
      return NextResponse.json(
        { error: "checkoutSessionId is required." },
        { status: 400 }
      );
    }

    const result = await releaseCheckoutReservation(
      checkoutSessionId,
      "client_cancelled",
      releaseToken
    );

    return NextResponse.json({ ...result }, { status: 200 });
  } catch (err: any) {
    console.error("Error in /api/checkout/release:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to release reservation." },
      { status: err?.statusCode || 500 }
    );
  }
}
