import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { inngest } from "@/src/jobs/inngest-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink) {
      return NextResponse.json({ error: "Invalid magic link" }, { status: 404 });
    }

    if (new Date() > new Date(magicLink.expiresAt) || magicLink.isRevoked) {
      return NextResponse.json({ error: "Magic link expired or revoked" }, { status: 403 });
    }

    const existingSubmission = await prisma.submission.findUnique({
      where: { magicLinkId: magicLink.id },
    });

    if (existingSubmission) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    const body = await request.json();

    const submission = await prisma.submission.create({
      data: {
        magicLinkId: magicLink.id,
        eventId: magicLink.eventId,
        teacherName: body.teacherName || "Teacher",
        teacherEmail: magicLink.teacherEmail,
        studentData: body.studentData,
        certificateCount: 0,
        status: "PENDING",
        hasDownloaded: false,
      },
    });

    await inngest.send({
      name: "certificates/generate",
      data: { submissionId: submission.id },
    });

    return NextResponse.json({ ...submission, message: "Job queued" });
  } catch (error: unknown) {
    console.error("Failed to save submission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
