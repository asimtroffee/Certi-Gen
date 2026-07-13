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
 * Creates a magic link for a teacher and sends the email.
 * Skips if an active link already exists for this teacher.
 *
 * Returns the created magic link info, or null if skipped.
 */
export async function createMagicLink(
  eventId: string,
  eventTitle: string,
  teacherName: string,
  teacherEmail: string
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

  try {
    await sendMagicLinkEmail({
      to: teacherEmail.trim(),
      teacherName,
      eventTitle,
      magicUrl,
      expiresAt,
    });
  } catch (emailError) {
    console.error("[Magic Link] Email send failed:", emailError);
    const detail = emailError instanceof Error ? emailError.message : String(emailError);
    warning =
      `Magic link created but email delivery failed: ${detail}`;
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
