/**
 * Centralized Application Constants.
 *
 * This file serves as the single source of truth for:
 * 1. Configuration constants (timeouts, polling, endpoints)
 * 2. Strict validation parameters (extensions, file size limits, count limits)
 * 3. Static UI copy strings (titles, badges, labels, formats)
 */

// --- API & Routing Config ---
export const API_BASE_URL = "http://localhost:3001";
export const API_ROUTES = {
  UPLOAD: "/api/images/upload",
  IMAGES: "/api/images",
  IMAGE_BY_ID: (id: string) => `/api/images/${id}`,
} as const;

// --- Network & Polling Config ---
export const DEFAULT_TIMEOUT_MS = 30_000; // 30s
export const UPLOAD_TIMEOUT_MS = 120_000; // 120s
export const PAGE_LIMIT = 20;
export const POLLING_INTERVAL_MS = 4000; // Poll status every 4 seconds

// --- Strict File Validation Constraints ---
export const ALLOWED_EXTENSIONS = ["png", "jpeg", "heic"] as const;
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
] as const;
export const MAX_FILE_SIZE_BYTES = 120 * 1024 * 1024; // 120MB
export const MAX_FILES_PER_UPLOAD = 15;

// --- Static UI Copy ---
export const UI_COPY = {
  HEADER: {
    BADGE: "AI PHOTO GENERATOR",
    TITLE: "Upload your photos",
    DESCRIPTION: "Uploading a mix of close-ups, selfies and mid-range shots can help the AI better capture your face and body type.",
  },
  UPLOAD_BUTTON: {
    PROMPT: "Click to upload or drag and drop",
    LIMITS: "PNG, JPEG, HEIC up to 120MB",
    FOOTER_SUBTEXT: "It can take up to 1 minute to upload",
  },
  IMAGE_GRID: {
    TITLE: "Your Uploads",
    DELETING: "DELETING",
    HEIC_QUEUE: "QUEUEING HEIC",
    HEIC_CONVERT: "CONVERTING HEIC",
    HEIC_SUBTEXT: "Browser conversion in progress",
  },
  VALIDATION: {
    FORMATS_DISPLAY: "PNG, JPEG, HEIC",
    EMPTY_FILE: "File is empty (0 bytes).",
    NO_EXTENSION: (name: string) => `File "${name}" has no extension. Only PNG, JPEG, HEIC formats are allowed.`,
    UNSUPPORTED_EXTENSION: (ext: string) => `".${ext}" is not a supported format. Only PNG, JPEG, HEIC are allowed.`,
    UNSUPPORTED_MIME: (name: string, type: string) => `File "${name}" has MIME type "${type}" which does not match PNG, JPEG, HEIC.`,
    SIZE_EXCEEDED: (name: string) => `File "${name}" exceeds the 120MB size limit.`,
    COUNT_EXCEEDED: (limit: number) => `Exceeded maximum of ${limit} files per upload. This file was not included.`,
  },
} as const;
