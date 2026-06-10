/**
 * Shared API types matching the backend Prisma schema and controller responses.
 *
 * These types are the single source of truth for all API communication.
 * They mirror the `select` projection used in the backend ImageController.
 */

// --- Domain Types ---

export type ProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Represents an image record as returned by the backend.
 * Mirrors the Prisma `Image` model's select projection.
 */
export interface ImageRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: ProcessingStatus;
  originalUrl: string;
  processedUrl: string | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  createdAt: string; // ISO 8601 date string from JSON serialization
}

// --- API Response Types ---

/** Response from POST /api/images/upload */
export interface UploadResponse {
  message: string;
  images: ImageRecord[];
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}

/** Response from GET /api/images */
export interface ImagesListResponse {
  images: ImageRecord[];
  nextCursor: string | null;
}

/** Response from DELETE /api/images/:id */
export interface DeleteResponse {
  message: string;
  id: string;
}

// --- Error Types ---

/**
 * Normalized error shape used across all API hooks.
 * Every API error — network, timeout, 4xx, 5xx — gets normalized into this.
 */
export interface ApiError {
  message: string;
  status: number | null; // null for network/timeout errors
  details?: Array<{
    filename: string;
    error: string;
  }>;
}

// --- Upload Form Types ---

/** Shape of the react-hook-form values for the upload form */
export interface UploadFormValues {
  files: FileList;
}

/** Result of client-side file validation */
export interface FileValidationResult {
  validFiles: File[];
  rejectedFiles: Array<{
    file: File;
    error: string;
  }>;
}
