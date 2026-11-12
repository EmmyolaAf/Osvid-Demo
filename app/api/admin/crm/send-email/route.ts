import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminOrSuperAdmin, authErrorResponse, AuthError } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function getResendInstance(): { resend: Resend; fromEmail: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.FROM_EMAIL?.trim() || "orders@osvid.com.ng";

  if (!apiKey) {
    throw new AuthError("Resend API key is not configured.", 503);
  }

  return {
    resend: new Resend(apiKey),
    fromEmail,
  };
}

function wrapInOsvidBrandedTemplate(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #ea580c;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">OSVID CHEMICALS</h1>
      <p style="color: #fdba74; margin: 6px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Industrial & Construction Formulations</p>
    </div>

    <!-- Main Content -->
    <div style="padding: 36px 32px; font-size: 14px; line-height: 1.6; color: #334155;">
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">OSVID Chemical Formulation & Technical Services</p>
      <p style="margin: 0 0 8px 0;">Official Commercial & Technical Communications</p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        This email was sent by OSVID Chemical Company. If you have questions, please reach our technical sales desk at info@osvidcompany.com.
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdminOrSuperAdmin(req);
    const { resend, fromEmail } = getResendInstance();

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const {
      action = "send_direct",
      to,
      subject,
      contentHtml,
      recipientName,
      quoteDetails,
      campaignId,
    } = payload;

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Email subject is required." }, { status: 400 });
    }

    // 1. ACTION: SEND FORMAL QUOTATION (RFQ RESPONSE)
    if (action === "send_quote") {
      if (!to || !to.includes("@")) {
        return NextResponse.json({ error: "Valid recipient email is required for quotation." }, { status: 400 });
      }

      const q = quoteDetails || {};
      const quoteHtmlContent = `
        <div style="margin-bottom: 24px;">
          <span style="background-color: #ffedd5; color: #c2410c; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            Official Commercial Quotation
          </span>
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 12px 0 4px 0;">
            Quotation Ref: ${q.quoteNumber || "RFQ-CONFIRMATION"}
          </h2>
          <p style="color: #64748b; margin: 0; font-size: 13px;">Dear ${recipientName || "Valued Client"}, thank you for your request. Below is our formal commercial pricing for your requested chemical specifications.</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 10px; text-align: left; color: #475569;">Description / Product</th>
            <th style="padding: 10px; text-align: center; color: #475569;">Quantity</th>
            <th style="padding: 10px; text-align: right; color: #475569;">Unit Price (NGN)</th>
            <th style="padding: 10px; text-align: right; color: #475569;">Total (NGN)</th>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">
              ${q.productName || "Chemical Formulation Order"}
              ${q.variantName ? `<br><span style="font-size: 11px; color: #64748b; font-weight: normal;">${q.variantName}</span>` : ""}
            </td>
            <td style="padding: 12px 10px; text-align: center; font-weight: 600;">${q.requestedQuantity || 1} ${q.unit || "Units"}</td>
            <td style="padding: 12px 10px; text-align: right; font-mono; font-weight: 600;">₦${(q.quotedUnitPrice || 0).toLocaleString()}</td>
            <td style="padding: 12px 10px; text-align: right; font-mono; font-weight: 700; color: #ea580c;">₦${(q.quotedTotalAmount || 0).toLocaleString()}</td>
          </tr>
        </table>

        <!-- Summary & Terms Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Quotation Terms & Delivery</h4>
          <table style="width: 100%; font-size: 12px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b; width: 40%;">Logistics / Freight:</td>
              <td style="font-weight: 600; color: #0f172a;">₦${(q.quotedShippingFee || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Estimated Lead Time:</td>
              <td style="font-weight: 600; color: #0f172a;">${q.quoteLeadTime || "2 - 4 Business Days upon confirmation"}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Payment Terms:</td>
              <td style="font-weight: 600; color: #0f172a;">${q.quotePaymentTerms || "100% Prior to Dispatch"}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Quote Validity:</td>
              <td style="font-weight: 600; color: #0f172a;">${q.quoteValidityDays || 14} Calendar Days</td>
            </tr>
          </table>

          ${q.quoteNotes ? `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #475569;">
              <strong>Technical Engineer Notes:</strong><br>${q.quoteNotes}
            </div>
          ` : ""}
        </div>

        <p style="font-size: 13px; color: #334155;">
          To accept this quotation or discuss custom delivery arrangements, please reply directly to this email or contact our technical sales desk at <strong>+234 800 OSVID</strong>.
        </p>
      `;

      const finalHtml = wrapInOsvidBrandedTemplate(subject, quoteHtmlContent);

      const sendResult = await resend.emails.send({
        from: `OSVID Chemicals <${fromEmail}>`,
        to: [to],
        subject,
        html: finalHtml,
      });

      // Log in Firestore
      await adminDb.collection("crm_email_logs").add({
        to,
        recipientName: recipientName || to,
        subject,
        snippet: `Quotation #${q.quoteNumber || "RFQ"} - Total: ₦${(q.quotedTotalAmount || 0).toLocaleString()}`,
        category: "quote",
        referenceId: q.id || q.quoteNumber,
        status: "sent",
        sentBy: caller.email,
        sentAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Quotation successfully sent to ${to}`,
        sendResult,
      });
    }

    // 2. ACTION: SEND DIRECT EMAIL (SINGLE RECIPIENT)
    if (action === "send_direct") {
      if (!to || !to.includes("@")) {
        return NextResponse.json({ error: "Valid recipient email is required." }, { status: 400 });
      }

      const bodyHtml = contentHtml || "<p>Thank you for choosing OSVID Chemicals.</p>";
      const finalHtml = wrapInOsvidBrandedTemplate(subject, bodyHtml);

      const sendResult = await resend.emails.send({
        from: `OSVID Chemicals <${fromEmail}>`,
        to: [to],
        subject,
        html: finalHtml,
      });

      await adminDb.collection("crm_email_logs").add({
        to,
        recipientName: recipientName || to,
        subject,
        snippet: (bodyHtml.replace(/<[^>]*>/g, "").slice(0, 120)) || "Direct Message",
        category: "direct",
        status: "sent",
        sentBy: caller.email,
        sentAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Email dispatched to ${to}`,
        sendResult,
      });
    }

    // 3. ACTION: SEND NEWSLETTER / BROADCAST TO AUDIENCE
    if (action === "send_broadcast" || action === "send_newsletter") {
      const audience: string = payload.targetAudience || "all_subscribers";
      let recipientEmails: string[] = [];

      if (audience === "all_subscribers") {
        const snap = await adminDb
          .collection("newsletter_subscribers")
          .where("status", "==", "active")
          .get();
        recipientEmails = snap.docs.map((d) => d.data().email).filter(Boolean);
      } else if (audience === "all_customers") {
        const snap = await adminDb.collection("users").get();
        recipientEmails = snap.docs
          .map((d) => d.data().email)
          .filter((e) => e && e.includes("@"));
      } else if (audience === "quote_leads") {
        const snap = await adminDb.collection("quote_requests").get();
        recipientEmails = Array.from(
          new Set(snap.docs.map((d) => d.data().email).filter(Boolean))
        );
      } else if (Array.isArray(payload.recipientList) && payload.recipientList.length > 0) {
        recipientEmails = payload.recipientList.filter((e: string) => e && e.includes("@"));
      }

      if (recipientEmails.length === 0) {
        return NextResponse.json(
          { error: `No active email recipients found in selected audience: ${audience}.` },
          { status: 400 }
        );
      }

      // De-duplicate emails
      const uniqueRecipients = Array.from(new Set(recipientEmails.map((e) => e.trim().toLowerCase())));
      const finalHtml = wrapInOsvidBrandedTemplate(subject, contentHtml);

      // Resend supports batching or individual loop
      let successCount = 0;
      let failCount = 0;

      // Send in batches of 50
      for (const recipient of uniqueRecipients) {
        try {
          await resend.emails.send({
            from: `OSVID Chemicals <${fromEmail}>`,
            to: [recipient],
            subject,
            html: finalHtml,
          });
          successCount++;
        } catch (sendErr) {
          console.warn(`Failed to send broadcast email to ${recipient}:`, sendErr);
          failCount++;
        }
      }

      // Log the campaign broadcast
      await adminDb.collection("crm_email_logs").add({
        to: `${uniqueRecipients.length} recipients (${audience})`,
        subject,
        snippet: (contentHtml.replace(/<[^>]*>/g, "").slice(0, 120)) || "Newsletter Broadcast",
        category: "newsletter",
        referenceId: campaignId || undefined,
        status: successCount > 0 ? "sent" : "failed",
        sentBy: caller.email,
        sentAt: new Date().toISOString(),
      });

      // Update campaign document if campaignId was supplied
      if (campaignId) {
        await adminDb.collection("crm_email_campaigns").doc(campaignId).set(
          {
            status: "sent",
            sentAt: new Date().toISOString(),
            recipientCount: successCount,
            sentBy: caller.email,
          },
          { merge: true }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Broadcast complete: ${successCount} sent successfully (${failCount} failed).`,
        totalRecipients: uniqueRecipients.length,
        successCount,
        failCount,
      });
    }

    return NextResponse.json({ error: "Invalid action requested." }, { status: 400 });
  } catch (err: any) {
    console.error("CRM send-email route error:", err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json(
      { error: err?.message || "Failed to process CRM email dispatch." },
      { status: 500 }
    );
  }
}

