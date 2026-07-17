import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        zipUrl: true,
        errorLogs: true,
        certificateCount: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("Failed to get submission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
