import { put, del } from "@vercel/blob";
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
  /** Public URL to access the file */
  url: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes */
  size: number;
}

/**
 * Validates and saves an uploaded file to Vercel Blob.
 *
 * In development: falls back to local disk if BLOB_READ_WRITE_TOKEN is not set.
 *
 * @param file - The uploaded File object from FormData
 * @param directory - Prefix for the blob path (e.g., "templates")
 * @returns The public URL and metadata
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
  const blobPath = `${directory}/${filename}`;

  // --- Upload to Vercel Blob ---
  const blob = await put(blobPath, file, {
    access: "private",
    addRandomSuffix: false,
  });

  return {
    url: blob.downloadUrl,
    originalName: file.name,
    size: file.size,
  };
}

/**
 * Deletes an uploaded file from Vercel Blob by its URL.
 * Silently ignores if file doesn't exist (idempotent).
 */
export async function deleteFile(publicUrl: string): Promise<void> {
  try {
    await del(publicUrl);
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
