import crypto from "crypto";
import { prisma } from "@/src/lib/prisma";
import { sendMagicLinkEmail } from "@/src/lib/email";

const DEFAULT_TTL_DAYS = 7;

export type MagicLinkResult = {
  id: string;
  teacherEmail: string;
  magicUrl: string;
  createdAt: Date;
  expiresAt: Date;
  warning?: string;
};

/**
 * Creates a magic link for a teacher and optionally sends the email.
 * Skips if an active link already exists for this teacher.
 *
 * Returns the created magic link info, or null if skipped.
 */
export async function createMagicLink(
  eventId: string,
  eventTitle: string,
  teacherName: string,
  teacherEmail: string,
  sendEmail: boolean = true
): Promise<MagicLinkResult | null> {
  const now = new Date();

  // Check if an active link already exists
  const existing = await prisma.magicLink.findFirst({
    where: {
      eventId,
      teacherEmail: teacherEmail.trim(),
      isRevoked: false,
      expiresAt: { gt: now },
      submission: null,
    },
    select: { id: true, createdAt: true },
  });

  if (existing) {
    return null; // Skip — already has an active link
  }

  // Generate token and expiry
  const token = crypto.randomBytes(32).toString("hex");
  const ttlDays = parseInt(
    process.env.MAGIC_LINK_TTL_DAYS || String(DEFAULT_TTL_DAYS),
    10
  );
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  // Create magic link record
  const magicLink = await prisma.magicLink.create({
    data: {
      eventId,
      token,
      teacherEmail: teacherEmail.trim(),
      expiresAt,
    },
  });

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const magicUrl = `${appUrl}/submit/${token}`;

  let warning: string | undefined;

  if (sendEmail) {
    try {
      await sendMagicLinkEmail({
        to: teacherEmail.trim(),
        teacherName,
        eventTitle,
        magicUrl,
        expiresAt,
      });
      await prisma.magicLink.update({
        where: { id: magicLink.id },
        data: { emailSent: true },
      });
    } catch (emailError) {
      console.error("[Magic Link] Email send failed:", emailError);
      const detail = emailError instanceof Error ? emailError.message : String(emailError);
      warning =
        `Magic link created but email delivery failed: ${detail}`;
    }
  }

  return {
    id: magicLink.id,
    teacherEmail: magicLink.teacherEmail,
    magicUrl,
    createdAt: magicLink.createdAt,
    expiresAt: magicLink.expiresAt,
    warning,
  };
}

/**
 * Sends a pending email for a magic link and marks it as sent.
 * Returns true if successful, false if the link doesn't exist or email was already sent.
 */
export async function sendPendingEmail(
  magicLinkId: string
): Promise<{ success: boolean; warning?: string }> {
  const magicLink = await prisma.magicLink.findUnique({
    where: { id: magicLinkId },
    include: { event: { select: { title: true } } },
  });

  if (!magicLink) return { success: false, warning: "Magic link not found" };
  if (magicLink.emailSent) return { success: false, warning: "Email already sent" };

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const magicUrl = `${appUrl}/submit/${magicLink.token}`;

  try {
    await sendMagicLinkEmail({
      to: magicLink.teacherEmail,
      teacherName: magicLink.teacherEmail,
      eventTitle: magicLink.event.title,
      magicUrl,
      expiresAt: magicLink.expiresAt,
    });
    await prisma.magicLink.update({
      where: { id: magicLinkId },
      data: { emailSent: true },
    });
    return { success: true };
  } catch (emailError) {
    console.error("[sendPendingEmail] Failed:", emailError);
    const detail = emailError instanceof Error ? emailError.message : String(emailError);
    return { success: false, warning: `Email delivery failed: ${detail}` };
  }
}
