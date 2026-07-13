import nodemailer from "nodemailer";

interface MagicLinkEmailParams {
  /** Recipient email address */
  to: string;
  /** Teacher's name for personalization */
  teacherName: string;
  /** Event title for context in the email */
  eventTitle: string;
  /** Full magic link URL (e.g., https://certigen.app/submit/abc123) */
  magicUrl: string;
  /** When the link expires */
  expiresAt: Date;
}

/**
 * Sends a personalized magic link email to a teacher.
 *
 * In development: if SMTP is not configured, logs the email to the console
 * instead of sending it. This allows testing without an email server.
 *
 * In production: requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 */
export async function sendMagicLinkEmail(
  params: MagicLinkEmailParams
): Promise<void> {
  const { to, teacherName, eventTitle, magicUrl, expiresAt } = params;

  const subject = `📜 Certificate Submission Link — ${eventTitle}`;
  const expiryFormatted = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hello ${teacherName},</h2>
      <p style="color: #4a4a6a; font-size: 16px; line-height: 1.6;">
        You've been invited to submit student data for <strong>${eventTitle}</strong>.
      </p>
      <p style="color: #4a4a6a; font-size: 16px; line-height: 1.6;">
        We need you to upload your student list (CSV file) so we can generate certificates for <strong>${teacherName}'s class</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${magicUrl}"
           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white; padding: 14px 32px; text-decoration: none;
                  border-radius: 8px; font-size: 16px; font-weight: 600;
                  display: inline-block;">
          Upload Student Data →
        </a>
      </div>
      <p style="color: #8888aa; font-size: 13px; line-height: 1.5;">
        This link is valid until <strong>${expiryFormatted}</strong>.
        It can only be used once. If the link expires, you can request a new one.
      </p>
      <p style="color: #4a4a6a; font-size: 16px; line-height: 1.6;">
        Thank you, ${teacherName}, for your cooperation.
      </p>
      <hr style="border: none; border-top: 1px solid #e8e8f0; margin: 24px 0;" />
      <p style="color: #aaaacc; font-size: 12px;">
        CertiGen — Automated Certificate Issuance
      </p>
    </div>
  `;

  const text = `
Hello ${teacherName},

You've been invited to submit student data for "${eventTitle}".

We need you to upload your student list (CSV file) so we can generate certificates for ${teacherName}'s class.

Click here to upload your CSV: ${magicUrl}

This link expires on ${expiryFormatted} and can only be used once.

Thank you, ${teacherName}, for your cooperation.
  `.trim();

  // --- Check if SMTP is configured ---
  const smtpHost = process.env.SMTP_HOST;

  if (!smtpHost) {
    // Development fallback: log to console
    console.log("\n" + "=".repeat(60));
    console.log("📧 MAGIC LINK EMAIL (SMTP not configured — dev mode)");
    console.log("=".repeat(60));
    console.log(`To:      ${to}`);
    console.log(`Name:    ${teacherName}`);
    console.log(`Subject: ${subject}`);
    console.log(`Link:    ${magicUrl}`);
    console.log(`Expires: ${expiryFormatted}`);
    console.log("=".repeat(60) + "\n");
    return;
  }

  // --- Production: send via SMTP ---
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"CertiGen" <noreply@certigen.app>`,
    to,
    subject,
    text,
    html,
  });
}
