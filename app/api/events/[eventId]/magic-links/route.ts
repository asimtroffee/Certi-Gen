import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";
import { createMagicLink } from "@/src/lib/magic-link";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 10 POST requests per minute per admin
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(adminId: string, maxRequests = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  let timestamps = rateLimitMap.get(adminId) ?? [];
  timestamps = timestamps.filter((t: number) => now - t < windowMs);

  if (timestamps.length >= maxRequests) return false;

  timestamps.push(now);
  rateLimitMap.set(adminId, timestamps);
  return true;
}

// Periodic cleanup every 5 minutes to prevent unbounded Map growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [key, timestamps] of rateLimitMap) {
      const filtered = timestamps.filter((t: number) => t > cutoff);
      if (filtered.length === 0) rateLimitMap.delete(key);
      else rateLimitMap.set(key, filtered);
    }
  }, 300_000);
}

/**
 * GET /api/events/:eventId/magic-links
 *
 * Lists all magic links for an event with their submission status.
 * Supports ?page=1&limit=20 for pagination.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    // Parse pagination
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const skip = (page - 1) * limit;

    const [magicLinks, total] = await Promise.all([
      prisma.magicLink.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          teacherEmail: true,
          expiresAt: true,
          isRevoked: true,
          createdAt: true,
          submission: {
            select: {
              id: true,
              teacherName: true,
              teacherEmail: true,
              certificateCount: true,
              hasDownloaded: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.magicLink.count({ where: { eventId } }),
    ]);

    // Enrich with computed status
    const now = new Date();
    const enriched = magicLinks.map((ml: {
      id: string;
      teacherEmail: string;
      expiresAt: Date;
      isRevoked: boolean;
      createdAt: Date;
      submission: {
        id: string;
        teacherName: string;
        teacherEmail: string;
        certificateCount: number;
        hasDownloaded: boolean;
        createdAt: Date;
      } | null;
    }) => ({
      ...ml,
      status: ml.isRevoked
        ? "revoked"
        : ml.expiresAt < now
          ? "expired"
          : ml.submission
            ? "submitted"
            : "pending",
    }));

    return NextResponse.json({
      magicLinks: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET /api/events/:id/magic-links]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/:eventId/magic-links
 *
 * Generates a new magic link for a teacher and emails it.
 *
 * Body: {
 *   teacherEmail: string (required)
 * }
 *
 * The generated token is a 32-byte crypto-random hex string (64 chars).
 * The teacher URL format: {APP_URL}/submit/{token}
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    // Rate limit check
    if (!checkRateLimit(admin.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending more magic links." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { teacherEmail, teacherName } = body as {
      teacherEmail?: string;
      teacherName?: string;
    };

    // --- Validate email ---
    if (
      !teacherEmail ||
      typeof teacherEmail !== "string" ||
      teacherEmail.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "teacherEmail is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teacherEmail.trim())) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    const name = (teacherName || teacherEmail.split("@")[0] || "Teacher").trim();

    // --- Create magic link using shared utility ---
    const result = await createMagicLink(
      eventId,
      ownershipCheck.title,
      name,
      teacherEmail.trim()
    );

    if (!result) {
      return NextResponse.json(
        {
          error: `An active magic link already exists for ${teacherEmail.trim()}. Revoke it first or wait for it to expire.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        magicLink: {
          id: result.id,
          teacherEmail: result.teacherEmail,
          expiresAt: result.expiresAt,
          createdAt: result.createdAt,
        },
        magicUrl: result.magicUrl,
        warning: result.warning,
        message: result.warning
          ? "Magic link created but email delivery failed."
          : `Magic link sent to ${teacherEmail.trim()}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/events/:id/magic-links]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
