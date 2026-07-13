import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

/** Allowed MIME types for template images */
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/** Maximum file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  /** Public URL path to access the file (e.g., "/uploads/templates/abc.png") */
  url: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes */
  size: number;
}

/**
 * Validates and saves an uploaded file to local disk.
 *
 * Files are stored in `public/uploads/{directory}/` and served statically
 * by Next.js. The returned URL is a path relative to the public root.
 *
 * To swap to S3, replace the body of this function with an S3 PutObject call
 * and return the S3 URL instead.
 *
 * @param file - The uploaded File object from FormData
 * @param directory - Subdirectory under uploads (e.g., "templates")
 * @returns The public URL path and metadata
 */
export async function saveFile(
  file: File,
  directory: string
): Promise<UploadResult> {
  // --- Validate file type ---
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError(
      `Invalid file type "${file.type}". Allowed: PNG, JPG, WEBP`,
      400
    );
  }

  // --- Validate file size ---
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`,
      400
    );
  }

  // --- Generate unique filename ---
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const filename = `${uniqueId}.${ext}`;

  // --- Ensure directory exists ---
  const uploadDir = path.join(process.cwd(), "public", "uploads", directory);
  await mkdir(uploadDir, { recursive: true });

  // --- Write file to disk ---
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${directory}/${filename}`,
    originalName: file.name,
    size: file.size,
  };
}

/**
 * Deletes an uploaded file by its public URL path.
 * Silently ignores if file doesn't exist (idempotent).
 */
export async function deleteFile(publicUrl: string): Promise<void> {
  const { unlink } = await import("fs/promises");
  const filePath = path.join(process.cwd(), "public", publicUrl);
  try {
    await unlink(filePath);
  } catch {
    // File doesn't exist — that's fine
  }
}

/**
 * Custom error class for upload validation failures.
 * Carries an HTTP status code for direct use in API responses.
 */
export class UploadError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "UploadError";
    this.statusCode = statusCode;
  }
}
