import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import { slugify } from "@/src/lib/slugify";

/**
 * GET /api/events
 *
 * Lists all events for the authenticated admin.
 * Supports pagination via ?page=1&limit=10
 * Excludes archived events by default (?archived=true to include).
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const includeArchived = searchParams.get("archived") === "true";

    const where = {
      adminId: admin.id,
      ...(includeArchived ? {} : { isArchived: false }),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              magicLinks: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return NextResponse.json({
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET /api/events]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 *
 * Creates a new event for the authenticated admin.
 *
 * Body: {
 *   title: string (required)
 *   slug?: string (auto-generated from title if omitted)
 *   templateUrl?: string
 *   templateConfig?: object (defaults to empty array)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { title, slug, templateUrl, templateConfig } = body as {
      title?: string;
      slug?: string;
      templateUrl?: string;
      templateConfig?: unknown;
    };

    // --- Validation ---
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }

    // --- Generate or validate slug ---
    const eventSlug =
      slug && typeof slug === "string" ? slug.trim() : slugify(title.trim());

    // Check slug uniqueness
    const existingSlug = await prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json(
        {
          error: `Slug "${eventSlug}" is already in use. Please provide a unique slug.`,
        },
        { status: 409 }
      );
    }

    // --- Create event ---
    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        slug: eventSlug,
        templateUrl:
          typeof templateUrl === "string" ? templateUrl.trim() : "",
        templateConfig: templateConfig ?? [],
        adminId: admin.id,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/events]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
