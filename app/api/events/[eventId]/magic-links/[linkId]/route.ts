import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";

interface RouteParams {
  params: Promise<{ eventId: string; linkId: string }>;
}

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId, linkId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    const link = await prisma.magicLink.findUnique({ where: { id: linkId } });
    if (!link || link.eventId !== eventId) {
      return NextResponse.json({ error: "Magic link not found" }, { status: 404 });
    }

    if (link.isRevoked) {
      return NextResponse.json({ error: "Magic link is already revoked" }, { status: 409 });
    }

    const updated = await prisma.magicLink.update({
      where: { id: linkId },
      data: { isRevoked: true },
    });

    return NextResponse.json({ magicLink: updated });
  } catch (error) {
    console.error("[PATCH /api/events/:id/magic-links/:linkId]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
