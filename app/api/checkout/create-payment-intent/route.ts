import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * @deprecated Removed in Packet 4.
 * Payment initialization is authoritative via POST /api/payment/initialize.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint deprecated. Use POST /api/payment/initialize for authoritative checkout sessions.",
    },
    { status: 410 }
  );
}
