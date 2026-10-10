import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  requireAdminOrSuperAdmin,
  authErrorResponse,
  AuthError,
} from "@/lib/server/auth";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 300;
const MAX_HTML_LENGTH = 200000;

export function getResendClient(): { resend: Resend; fromEmail: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    throw new AuthError(
      "Transactional email service is currently unavailable.",
      503
    );
  }

  return {
    resend: new Resend(apiKey),
    fromEmail,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize: Admin or Super Admin
    const caller = await requireAdminOrSuperAdmin(req);

    // 2. Operational subscription guard
    await assertOperationalSubscription(caller);

    // 3. Parse and validate input payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload: JSON object expected." },
        { status: 400 }
      );
    }

    const { to, subject, html } = body;

    if (!to || typeof to !== "string" || to.trim().length === 0) {
      return NextResponse.json(
        { error: "Recipient email ('to') is required." },
        { status: 400 }
      );
    }

    const cleanTo = to.trim();
    if (cleanTo.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(cleanTo)) {
      return NextResponse.json(
        { error: "Invalid recipient email address." },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json(
        { error: "Email subject is required." },
        { status: 400 }
      );
    }

    const cleanSubject = subject.trim();
    if (cleanSubject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: `Email subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!html || typeof html !== "string" || html.trim().length === 0) {
      return NextResponse.json(
        { error: "Email body ('html') is required." },
        { status: 400 }
      );
    }

    if (html.length > MAX_HTML_LENGTH) {
      return NextResponse.json(
        { error: `Email body exceeds maximum size of ${MAX_HTML_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // 4. Runtime Resend client & sender resolution (fails closed with 503 if unconfigured)
    const { resend, fromEmail } = getResendClient();

    // 5. Send email via Resend
    const response = await resend.emails.send({
      from: `Osvid Chemicals Ltd. <${fromEmail}>`,
      to: cleanTo,
      subject: cleanSubject,
      html,
    });

    if (response.error) {
      console.error(
        "[EMAIL_PROVIDER_ERROR] Resend send error:",
        response.error.message || response.error
      );
      return NextResponse.json(
        { error: "Failed to send email via delivery provider." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      id: response.data?.id,
    });
  } catch (error: any) {
    if (error instanceof AuthError || error?.name === "AuthError") {
      return authErrorResponse(error);
    }

    console.error(
      "[EMAIL_SEND_ERROR] Unexpected error in email dispatch:",
      error?.message || error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred while processing the email request." },
      { status: 500 }
    );
  }
}
