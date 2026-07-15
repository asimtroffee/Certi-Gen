import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/events/:eventId/bulk-submit
 *
 * Saves an admin-generated bulk submission (no magic link).
 * Body: { teacherName, studentData }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const teacherName = typeof body.teacherName === "string" ? body.teacherName : undefined;
    const studentData = body.studentData;

    if (!Array.isArray(studentData)) {
      return NextResponse.json(
        { error: "studentData must be an array" },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.create({
      data: {
        eventId,
        adminId: admin.id,
        teacherName: teacherName || admin.name || "Admin",
        teacherEmail: admin.email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        studentData: studentData as any,
        certificateCount: studentData.length,
        hasDownloaded: true,
        downloadedAt: new Date(),
      },
    });

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[POST /api/events/:id/bulk-submit]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
