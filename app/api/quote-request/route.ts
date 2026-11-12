import { NextRequest, NextResponse } from "next/server";
import { submitPublicQuoteRequest } from "@/lib/firebase/crm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const {
      customerName,
      companyName,
      email,
      phone,
      deliveryLocation,
      items,
      additionalNotes,
      urgency,
    } = body;

    if (!customerName || typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json(
        { success: false, error: "Contact name is required." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one product item must be specified." },
        { status: 400 }
      );
    }

    const result = await submitPublicQuoteRequest({
      customerName: customerName.trim(),
      companyName: companyName?.trim() || undefined,
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || undefined,
      deliveryLocation: deliveryLocation?.trim() || undefined,
      items,
      additionalNotes: additionalNotes?.trim() || undefined,
      urgency: urgency || "normal",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to submit quotation request." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quoteNumber: result.quoteNumber,
      message: `Quotation request ${result.quoteNumber} received successfully. Our sales team will get back to you with pricing.`,
    });
  } catch (error: any) {
    console.error("API /quote-request error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
