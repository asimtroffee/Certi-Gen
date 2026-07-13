import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/auth-guard";
import { saveFile, UploadError } from "@/src/lib/upload";

/**
 * POST /api/upload/field-image
 *
 * Uploads an image for a certificate field (logo, signature, etc.).
 * Content-Type: multipart/form-data with `image` field.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

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
    if (!imageFile || typeof imageFile !== "object" || !("arrayBuffer" in imageFile)) {
      return NextResponse.json(
        { error: "Image file is required. Send as 'image' field in form data" },
        { status: 400 }
      );
    }

    let uploadResult;
    try {
      uploadResult = await saveFile(imageFile as File, "field-images");
    } catch (error) {
      if (error instanceof UploadError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }

    return NextResponse.json({
      url: uploadResult.url,
      originalName: uploadResult.originalName,
      size: uploadResult.size,
    });
  } catch (error) {
    console.error("[POST /api/upload/field-image]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
