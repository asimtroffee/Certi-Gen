import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/events/:eventId
 *
 * Returns a single event with aggregated stats (magic link count,
 * submission count, total certificates generated).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    // Fetch event with full stats
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { magicLinks: true },
        },
        magicLinks: {
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
                certificateCount: true,
                hasDownloaded: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Compute aggregate stats
    const totalSubmissions = event!.magicLinks.filter(
      (ml: { submission: { certificateCount: number } | null }) => ml.submission !== null
    ).length;
    const totalCertificates = event!.magicLinks.reduce(
      (sum: number, ml: { submission: { certificateCount: number } | null }) => sum + (ml.submission?.certificateCount ?? 0),
      0
    );

    return NextResponse.json({
      event,
      stats: {
        totalMagicLinks: event!._count.magicLinks,
        totalSubmissions,
        totalCertificates,
      },
    });
  } catch (error) {
    console.error("[GET /api/events/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/:eventId
 *
 * Partial update — only provided fields are changed.
 * Updatable fields: title, slug, templateUrl, templateConfig, isArchived
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { title, slug, templateUrl, templateConfig, isArchived } = body as {
      title?: string;
      slug?: string;
      templateUrl?: string;
      templateConfig?: unknown;
      isArchived?: boolean;
    };

    // --- Build update data (only include provided fields) ---
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        );
      }
      if (title.trim().length > 200) {
        return NextResponse.json(
          { error: "Title must be 200 characters or less" },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (slug !== undefined) {
      if (typeof slug !== "string" || slug.trim().length === 0) {
        return NextResponse.json(
          { error: "Slug must be a non-empty string" },
          { status: 400 }
        );
      }
      // Check slug uniqueness (excluding current event)
      const existingSlug = await prisma.event.findFirst({
        where: { slug: slug.trim(), id: { not: eventId } },
        select: { id: true },
      });
      if (existingSlug) {
        return NextResponse.json(
          { error: `Slug "${slug.trim()}" is already in use` },
          { status: 409 }
        );
      }
      updateData.slug = slug.trim();
    }

    if (templateUrl !== undefined) {
      updateData.templateUrl = typeof templateUrl === "string" ? templateUrl.trim() : "";
    }

    if (templateConfig !== undefined) {
      updateData.templateConfig = templateConfig;
    }

    if (isArchived !== undefined) {
      if (typeof isArchived !== "boolean") {
        return NextResponse.json(
          { error: "isArchived must be a boolean" },
          { status: 400 }
        );
      }
      updateData.isArchived = isArchived;
    }

    // --- Check if anything to update ---
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("[PUT /api/events/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/:eventId
 *
 * Soft-deletes an event by setting isArchived = true.
 * The event and its magic links / submissions are preserved for audit.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    // Check if already archived
    if (ownershipCheck.isArchived) {
      return NextResponse.json(
        { error: "Event is already archived" },
        { status: 409 }
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: { isArchived: true },
    });

    return NextResponse.json({
      message: "Event archived successfully",
      event,
    });
  } catch (error) {
    console.error("[DELETE /api/events/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
