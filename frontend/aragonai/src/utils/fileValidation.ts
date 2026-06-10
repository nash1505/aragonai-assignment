/**
 * Centralized file validation logic.
 *
 * This is the single source of truth for what the frontend considers a valid upload.
 * These rules MUST stay in sync with the backend's imageController validation.
 */

import type { FileValidationResult } from "../types";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
  UI_COPY,
} from "../constants/appConstants";

/**
 * Extracts the lowercase file extension from a filename.
 * Returns empty string for files with no extension.
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) return ""; // No dot, or dot is first char (hidden file)
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Validates a single file against allowed format and size constraints.
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Edge case: zero-byte file
  if (file.size === 0) {
    return { valid: false, error: UI_COPY.VALIDATION.EMPTY_FILE };
  }

  // Extension check
  const extension = getFileExtension(file.name);
  if (!extension) {
    return {
      valid: false,
      error: UI_COPY.VALIDATION.NO_EXTENSION(file.name),
    };
  }

  const isExtensionValid = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  if (!isExtensionValid) {
    return {
      valid: false,
      error: UI_COPY.VALIDATION.UNSUPPORTED_EXTENSION(extension),
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
      error: UI_COPY.VALIDATION.UNSUPPORTED_MIME(file.name, file.type),
    };
  }

  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: UI_COPY.VALIDATION.SIZE_EXCEEDED(file.name),
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
  let filesToValidate = files;

  // Edge case: too many files
  if (filesToValidate.length > MAX_FILES_PER_UPLOAD) {
    const excess = filesToValidate.slice(MAX_FILES_PER_UPLOAD);
    for (const file of excess) {
      rejectedFiles.push({
        file,
        error: UI_COPY.VALIDATION.COUNT_EXCEEDED(MAX_FILES_PER_UPLOAD),
      });
    }
    filesToValidate = filesToValidate.slice(0, MAX_FILES_PER_UPLOAD);
  }

  for (const file of filesToValidate) {
    const result = validateFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else {
      rejectedFiles.push({ file, error: result.error! });
    }
  }

  return { validFiles, rejectedFiles };
}
