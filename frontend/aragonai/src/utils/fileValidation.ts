/**
 * Centralized file validation logic.
 *
 * This is the single source of truth for what the frontend considers a valid upload.
 * These rules MUST stay in sync with the backend's imageController validation.
 *
 * Allowed formats: PNG, JPEG, HEIC (no JPG, no WEBP, no GIF, no SVG).
 */

import type { FileValidationResult } from "../types/api";

// --- Constants ---

/** Allowed file extensions (lowercase, without dot) */
export const ALLOWED_EXTENSIONS = ["png", "jpeg", "heic"] as const;

/** Allowed MIME types corresponding to the extensions */
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif", // HEIC files may report as image/heif on some platforms
] as const;

/** Maximum file size in bytes (120 MB) */
export const MAX_FILE_SIZE_BYTES = 120 * 1024 * 1024;

/** Maximum number of files per single upload request (backend multer limit) */
export const MAX_FILES_PER_UPLOAD = 15;

/** Human-readable format string for UI display */
export const ALLOWED_FORMATS_DISPLAY = "PNG, JPEG, HEIC";

// --- Helpers ---

/**
 * Extracts the lowercase file extension from a filename.
 * Returns empty string for files with no extension.
 *
 * Handles edge cases:
 * - Hidden files starting with dot (e.g. ".bashrc" → "bashrc" is not a valid image ext)
 * - Double extensions (e.g. "photo.png.exe" → "exe", which will fail validation)
 * - No extension (e.g. "photo" → "")
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) return ""; // No dot, or dot is first char (hidden file)
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

// --- Validation ---

/**
 * Validates a single file against allowed format and size constraints.
 *
 * Performs dual validation:
 * 1. Extension check — guards against renamed files being sent to the server
 * 2. MIME type check — guards against files with wrong extensions
 * 3. Size check — prevents uploading files over 120MB
 * 4. Zero-byte check — prevents empty files
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Edge case: zero-byte file
  if (file.size === 0) {
    return { valid: false, error: "File is empty (0 bytes)." };
  }

  // Extension check
  const extension = getFileExtension(file.name);
  if (!extension) {
    return {
      valid: false,
      error: `File "${file.name}" has no extension. Only ${ALLOWED_FORMATS_DISPLAY} formats are allowed.`,
    };
  }

  const isExtensionValid = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  if (!isExtensionValid) {
    return {
      valid: false,
      error: `".${extension}" is not a supported format. Only ${ALLOWED_FORMATS_DISPLAY} are allowed.`,
    };
  }

  // MIME type check — some browsers may not detect MIME for HEIC, so allow empty MIME
  // only when extension is heic. For all other cases, MIME must match.
  const isMimeValid =
    (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) ||
    (extension === "heic" && (file.type === "" || file.type === "application/octet-stream"));

  if (!isMimeValid) {
    return {
      valid: false,
      error: `File "${file.name}" has MIME type "${file.type}" which does not match ${ALLOWED_FORMATS_DISPLAY}.`,
    };
  }

  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds the 120MB size limit.`,
    };
  }

  return { valid: true };
}

/**
 * Validates a batch of files. Splits into valid and rejected lists.
 * Also enforces the maximum file count per upload.
 */
export function validateFiles(files: File[]): FileValidationResult {
  const validFiles: File[] = [];
  const rejectedFiles: FileValidationResult["rejectedFiles"] = [];

  // Edge case: too many files
  if (files.length > MAX_FILES_PER_UPLOAD) {
    // Reject all files beyond the limit rather than silently truncating
    const excess = files.slice(MAX_FILES_PER_UPLOAD);
    for (const file of excess) {
      rejectedFiles.push({
        file,
        error: `Exceeded maximum of ${MAX_FILES_PER_UPLOAD} files per upload. This file was not included.`,
      });
    }
    // Only validate the first MAX_FILES_PER_UPLOAD
    files = files.slice(0, MAX_FILES_PER_UPLOAD);
  }

  for (const file of files) {
    const result = validateFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else {
      rejectedFiles.push({ file, error: result.error! });
    }
  }

  return { validFiles, rejectedFiles };
}
