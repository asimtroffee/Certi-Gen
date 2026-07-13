import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin, requireEventOwnership } from "@/src/lib/auth-guard";
import { saveFile, UploadError } from "@/src/lib/upload";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/events/:eventId/template
 *
 * Uploads a certificate background image and saves the bounding-box
 * configuration for the event.
 *
 * Content-Type: multipart/form-data
 * Fields:
 *   - image: File (required) — PNG, JPG, or WEBP, max 10MB
 *   - templateConfig: string (required) — JSON string of bounding box config
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const { eventId } = await params;
    const ownershipCheck = await requireEventOwnership(admin.id, eventId);
    if (ownershipCheck instanceof NextResponse) return ownershipCheck;

    // --- Parse multipart form data ---
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data. Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image");
    const configRaw = formData.get("templateConfig");

    // --- Validate image ---
    if (!imageFile || typeof imageFile !== "object" || !("arrayBuffer" in imageFile)) {
      return NextResponse.json(
        { error: "Image file is required. Send as 'image' field in form data" },
        { status: 400 }
      );
    }
    const file = imageFile as File;

    // --- Validate templateConfig JSON ---
    if (!configRaw || typeof configRaw !== "string") {
      return NextResponse.json(
        {
          error:
            "templateConfig is required. Send as a JSON string in form data",
        },
        { status: 400 }
      );
    }

    let templateConfig: unknown;
    try {
      templateConfig = JSON.parse(configRaw);
    } catch {
      return NextResponse.json(
        { error: "templateConfig is not valid JSON" },
        { status: 400 }
      );
    }

    // Ensure templateConfig is an array of bounding box objects
    if (!Array.isArray(templateConfig)) {
      return NextResponse.json(
        {
          error: "templateConfig must be a JSON array of bounding box objects",
        },
        { status: 400 }
      );
    }

    // --- Upload image ---
    let uploadResult;
    try {
      uploadResult = await saveFile(file, "templates");
    } catch (error) {
      if (error instanceof UploadError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }

    // --- Update event in a single transaction ---
    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        templateUrl: uploadResult.url,
        templateConfig: templateConfig,
      },
    });

    return NextResponse.json({
      message: "Template uploaded successfully",
      event,
      upload: {
        url: uploadResult.url,
        originalName: uploadResult.originalName,
        size: uploadResult.size,
      },
    });
  } catch (error) {
    console.error("[POST /api/events/:id/template]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
