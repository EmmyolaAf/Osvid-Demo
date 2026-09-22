import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-static";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;

    const response = await resend.emails.send({
      from: `Osvid Chemicals Ltd. <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[EMAIL_SEND_ERROR]", error);
    return NextResponse.json({ success: false, error });
  }
}
