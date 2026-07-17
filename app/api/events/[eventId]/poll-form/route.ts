import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";
import { fetchNewSheetRows } from "@/src/lib/google-sheets";
import { createMagicLink } from "@/src/lib/magic-link";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/events/:eventId/poll-form
 *
 * Polls the linked Google Sheet for new form responses,
 * creates magic links for new teachers, and sends email invitations.
 *
 * Responses are expected to have at least: teacher name, teacher email.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const event = await requireEventOwnership(admin.id, eventId);
    if (event instanceof NextResponse) return event;

    if (!event.googleFormSheetId) {
      return NextResponse.json(
        { error: "No Google Sheet linked to this event. Link one first." },
        { status: 400 }
      );
    }

    // Fetch new rows from the Google Sheet
    let rows: Awaited<ReturnType<typeof fetchNewSheetRows>>["rows"];
    let totalRows: number;
    try {
      const result = await fetchNewSheetRows(
        event.googleFormSheetId,
        event.lastPolledRow
      );
      rows = result.rows;
      totalRows = result.totalRows;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        {
          error: `Failed to poll sheet. ${message}. Make sure the Google Sheets API is enabled and the sheet is shared as Editor with the service account.`,
        },
        { status: 502 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({
        message: "No new form responses found.",
        totalRows,
        lastPolledRow: event.lastPolledRow,
        linksCreated: 0,
        teachers: [],
      });
    }

    // Create magic links for each new teacher (no email sent yet)
    const results: Array<{
      id: string;
      teacherName: string;
      teacherEmail: string;
      skipped?: boolean;
      error?: string;
    }> = [];

    for (const row of rows) {
      try {
        const result = await createMagicLink(
          eventId,
          event.title,
          row.teacherName,
          row.teacherEmail,
          false // don't send email yet
        );
        if (result) {
          results.push({
            id: result.id,
            teacherName: row.teacherName,
            teacherEmail: row.teacherEmail,
          });
        } else {
          results.push({
            id: "",
            teacherName: row.teacherName,
            teacherEmail: row.teacherEmail,
            skipped: true,
          });
        }
      } catch (err) {
        console.error(`Failed to create magic link for ${row.teacherEmail}:`, err);
        results.push({
          id: "",
          teacherName: row.teacherName,
          teacherEmail: row.teacherEmail,
          error: "Failed to create magic link",
        });
      }
    }

    // Update the last polled row
    await prisma.event.update({
      where: { id: eventId },
      data: { lastPolledRow: totalRows },
    });

    const created = results.filter((r) => !r.skipped && !r.error);
    const skipped = results.filter((r) => r.skipped);

    return NextResponse.json({
      message: `Processed ${rows.length} response(s). Created ${created.length} new magic link(s). No emails sent — review and send from the dashboard.`,
      totalRows,
      lastPolledRow: totalRows,
      linksCreated: created.length,
      skipped: skipped.length,
      pendingLinks: created.map((r) => ({
        id: r.id,
        name: r.teacherName,
        email: r.teacherEmail,
        status: "pending" as const,
      })),
      teachers: results.map((r) => ({
        name: r.teacherName,
        email: r.teacherEmail,
        status: r.skipped ? "already_active" : r.error ? "error" : "pending",
      })),
    });
  } catch (error) {
    console.error("[POST /api/events/:id/poll-form]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
