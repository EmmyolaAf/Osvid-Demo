import { NextRequest, NextResponse } from "next/server";
import { saveNewsletterSubscriberInDb } from "@/lib/firebase/crm";

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

    const { email, name, source } = body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const result = await saveNewsletterSubscriberInDb(
      email,
      name,
      source || "footer"
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to subscribe." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.isNew
        ? "Thank you for subscribing to OSVID newsletter!"
        : "Welcome back! Your subscription is active.",
      isNew: result.isNew,
    });
  } catch (error: any) {
    console.error("API /newsletter/subscribe error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

