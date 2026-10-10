import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.FROM_EMAIL?.trim();

    if (!apiKey || !fromEmail) {
      return NextResponse.json(
        { success: false, error: "Transactional email service is unconfigured." },
        { status: 503 }
      );
    }

    const resend = new Resend(apiKey);
    const body = await req.json();
    const { to, subject, html } = body;

    const response = await resend.emails.send({
      from: `Osvid Chemicals Ltd. <${fromEmail}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[EMAIL_SEND_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email." },
      { status: 500 }
    );
  }
}
