import { Resend } from "resend";
import { ADMISSIONS_EMAIL, ADMISSIONS_DOMAIN } from "@/lib/constants";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.NODE_ENV === "production" 
  ? `EDEX Admissions Team <${ADMISSIONS_EMAIL}>` 
  : "onboarding@resend.dev";

// ─────────────────────────────────────────────────────────────────────────────
// OTP Verification Email
// ─────────────────────────────────────────────────────────────────────────────
export async function sendOTPEmail({
  to,
  name,
  program,
  otp,
  expiryMinutes,
}: {
  to: string;
  name: string;
  program: string;
  otp: string;
  expiryMinutes: number;
}) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set. Mocking OTP email send.", { to, otp });
    return { data: { id: "mock_id" }, error: null };
  }

  const result = await resend.emails.send({
    from: FROM,
    to,
    replyTo: ADMISSIONS_EMAIL,
    subject: "EDEX Life School — Verify Your Email",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:sans-serif;background:#ffffff;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <h1 style="font-size:24px;font-weight:700;color:#161616;margin-bottom:8px;">EDEX Life School</h1>
    <p style="font-size:14px;color:#666;margin-bottom:32px;">Admissions Platform</p>

    <h2 style="font-size:20px;font-weight:600;color:#161616;margin-bottom:12px;">Verify your email address</h2>
    <p style="color:#444;margin-bottom:24px;">Hi ${name}, please use the code below to verify your email and complete your ${program} application.</p>

    <div style="background:#161616;border-radius:12px;padding:32px;text-align:center;margin-bottom:24px;">
      <span style="font-size:48px;font-weight:700;color:#CEFF00;letter-spacing:16px;">${otp}</span>
    </div>

    <p style="color:#666;font-size:14px;margin-bottom:8px;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
    <p style="color:#666;font-size:14px;margin-bottom:32px;">
      ⚠️ For your security, never share this code with anyone. EDEX will never ask for your OTP.
    </p>

    <p style="color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px;">
      If you did not request this email, you can safely ignore it.<br>
      EDEX Life School · <a href="${ADMISSIONS_DOMAIN}" style="color:#161616;">${ADMISSIONS_DOMAIN}</a>
    </p>
  </div>
</body>
</html>`,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Confirmation Email
// ─────────────────────────────────────────────────────────────────────────────
export async function sendConfirmationEmail({
  to,
  name,
  program,
  applicationId,
  receiptBuffer,
  receiptFilename,
}: {
  to: string;
  name: string;
  program: string;
  applicationId: string;
  receiptBuffer: Buffer;
  receiptFilename: string;
}) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set. Mocking confirmation email send.", { to, applicationId });
    return { data: { id: "mock_id" }, error: null };
  }

  const result = await resend.emails.send({
    from: FROM,
    to,
    replyTo: ADMISSIONS_EMAIL,
    subject: `EDEX Life School — Application Confirmed | ${applicationId}`,
    attachments: [
      {
        filename: receiptFilename,
        content: receiptBuffer,
      },
    ],
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:sans-serif;background:#ffffff;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <h1 style="font-size:24px;font-weight:700;color:#161616;margin-bottom:8px;">EDEX Life School</h1>
    <p style="font-size:14px;color:#666;margin-bottom:32px;">Admissions Platform</p>

    <div style="background:#CEFF00;border-radius:12px;padding:24px;margin-bottom:32px;">
      <h2 style="font-size:20px;font-weight:700;color:#161616;margin:0 0 8px;">Application Confirmed ✓</h2>
      <p style="color:#161616;margin:0;">Your application has been received and payment verified.</p>
    </div>

    <p style="color:#444;margin-bottom:24px;">Hi ${name},</p>
    <p style="color:#444;margin-bottom:24px;">We're thrilled to have you apply for <strong>${program}</strong> at EDEX Life School. Here's a summary of your application:</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Application ID</td>
        <td style="padding:12px 0;color:#161616;font-weight:600;font-size:14px;">${applicationId}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Program</td>
        <td style="padding:12px 0;color:#161616;font-weight:600;font-size:14px;">${program}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Application Fee</td>
        <td style="padding:12px 0;color:#161616;font-weight:600;font-size:14px;">₹1,000 — Paid</td>
      </tr>
    </table>

    <h3 style="font-size:16px;font-weight:600;color:#161616;margin-bottom:12px;">What's next?</h3>
    <ol style="color:#444;padding-left:20px;margin-bottom:32px;">
      <li style="margin-bottom:8px;">Our admissions team will review your application.</li>
      <li style="margin-bottom:8px;">You will be contacted within 3–5 business days.</li>
      <li>Your payment receipt is attached to this email.</li>
    </ol>

    <a href="https://wa.me/919539752725" style="display:inline-block;background:#161616;color:#CEFF00;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:32px;">
      Contact us on WhatsApp →
    </a>

    <p style="color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px;">
      EDEX Life School · <a href="${ADMISSIONS_DOMAIN}" style="color:#161616;">${ADMISSIONS_DOMAIN}</a><br>
      ${ADMISSIONS_EMAIL} · wa.me/919539752725<br>
      <a href="https://www.instagram.com/edex_life_school/" style="color:#999;">@edex_life_school</a>
    </p>
  </div>
</body>
</html>`,
  });

  return result;
}
