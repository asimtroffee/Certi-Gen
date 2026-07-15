import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") === "archived" ? "archived" : "active";
    const query = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;
    const isArchived = tab === "archived";

    const where = {
      adminId: admin.id,
      isArchived,
      ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
    };

    const allEventIds = await prisma.event.findMany({
      where: { adminId: admin.id },
      select: { id: true },
    }).then((rows: { id: string }[]) => rows.map((r) => r.id));

    const [events, totalEvents, totalMagicLinks, archivedCount, submissions] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
        include: {
          _count: { select: { magicLinks: true } },
        },
      }),
      prisma.event.count({ where }),
      prisma.magicLink.count({
        where: { event: { adminId: admin.id } },
      }),
      prisma.event.count({
        where: { adminId: admin.id, isArchived: true },
      }),
      allEventIds.length > 0
        ? prisma.submission.findMany({
            where: { eventId: { in: allEventIds } },
            select: { certificateCount: true },
          })
        : Promise.resolve([]),
    ]);

    const totalPages = Math.ceil(totalEvents / PAGE_SIZE);
    const totalSubmissions = submissions.length;
    const totalCertificates = submissions.reduce((sum: number, s: { certificateCount: number }) => sum + s.certificateCount, 0);

    return NextResponse.json({
      events,
      totalEvents,
      totalPages,
      page,
      stats: {
        totalEvents: events.length,
        totalMagicLinks,
        totalSubmissions,
        totalCertificates,
        archivedCount,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/events]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
