import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";
import { sendPendingEmail } from "@/src/lib/magic-link";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/events/:eventId/send-emails
 *
 * Sends pending email invitations for one or more magic links.
 * Body: { linkIds: string[] } or { sendAll: true }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const event = await requireEventOwnership(admin.id, eventId);
    if (event instanceof NextResponse) return event;

    const body = await request.json();
    let linkIds: string[] = [];

    if (body.sendAll) {
      const allPending = await prisma.magicLink.findMany({
        where: { eventId, emailSent: false, isRevoked: false },
        select: { id: true },
      });
      linkIds = allPending.map((l) => l.id);
    } else if (Array.isArray(body.linkIds)) {
      linkIds = body.linkIds;
    } else {
      return NextResponse.json(
        { error: "Provide linkIds[] or sendAll: true" },
        { status: 400 }
      );
    }

    if (linkIds.length === 0) {
      return NextResponse.json({
        message: "No pending emails to send.",
        sent: 0,
        failed: 0,
        results: [],
      });
    }

    const results: Array<{ id: string; success: boolean; warning?: string }> = [];
    for (const id of linkIds) {
      const result = await sendPendingEmail(id);
      results.push({ id, ...result });
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${sent} email(s).${failed > 0 ? ` ${failed} failed.` : ""}`,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error("[POST /api/events/:id/send-emails]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
