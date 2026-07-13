import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";
import { shareSheetWithServiceAccount, getAdminAccessToken } from "@/src/lib/google-drive";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/events/:eventId/form-link
 *
 * Returns the linked Google Sheet info for an event.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    return NextResponse.json({
      googleFormSheetId: ownershipCheck.googleFormSheetId,
      lastPolledRow: ownershipCheck.lastPolledRow,
    });
  } catch (error) {
    console.error("[GET /api/events/:id/form-link]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/:eventId/form-link
 *
 * Links a Google Sheet ID to an event for auto-importing form responses.
 *
 * Body: { sheetId: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    let body: { sheetId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { sheetId } = body;

    // Unlink: set to null
    if (!sheetId || typeof sheetId !== "string" || sheetId.trim().length === 0) {
      const event = await prisma.event.update({
        where: { id: eventId },
        data: {
          googleFormSheetId: null,
          lastPolledRow: 0,
        },
      });

      return NextResponse.json({
        message: "Google Sheet unlinked successfully",
        googleFormSheetId: event.googleFormSheetId,
        lastPolledRow: event.lastPolledRow,
      });
    }

    const trimmed = sheetId.trim();

    // Check if another event already uses this sheet
    const existing = await prisma.event.findFirst({
      where: {
        googleFormSheetId: trimmed,
        id: { not: eventId },
      },
      select: { id: true, title: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `This Google Sheet is already linked to "${existing.title}". Unlink it first before linking to this event.`,
        },
        { status: 409 }
      );
    }

    // Auto-share the sheet with the service account via Drive API
    try {
      const accessToken = await getAdminAccessToken(admin.id);
      await shareSheetWithServiceAccount(trimmed, accessToken);
    } catch (driveErr) {
      const message = driveErr instanceof Error ? driveErr.message : "Unknown error";
      return NextResponse.json(
        {
          error: `Could not share sheet with service account. ${message}`,
        },
        { status: 502 }
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        googleFormSheetId: trimmed,
        lastPolledRow: 0,
      },
    });

    return NextResponse.json({
      message: "Google Sheet linked and shared with service account successfully",
      googleFormSheetId: event.googleFormSheetId,
      lastPolledRow: event.lastPolledRow,
    });
  } catch (error) {
    console.error("[POST /api/events/:id/form-link]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
