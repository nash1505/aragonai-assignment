/**
 * Thin API client for communicating with the backend.
 *
 * Provides:
 * - `apiGet` / `apiDelete` — JSON fetch wrappers with timeout and error normalization
 * - `uploadFiles` — XHR-based multipart upload with progress tracking
 *
 * Every error — network, timeout, HTTP 4xx/5xx — is normalized into an `ApiError` shape.
 */

import type { ApiError, UploadResponse } from "../types";
import {
  API_BASE_URL,
  API_ROUTES,
  DEFAULT_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
} from "../constants/appConstants";

// --- Error Normalization ---

function createApiError(
  message: string,
  status: number | null = null,
  details?: ApiError["details"]
): ApiError {
  return { message, status, details };
}

/**
 * Parses an HTTP response into a typed result or throws an ApiError.
 */
async function parseResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Response body is not JSON
    throw createApiError(
      response.statusText || `Request failed with status ${response.status}`,
      response.status
    );
  }

  if (!response.ok) {
    const errorBody = body as { error?: string; message?: string; details?: ApiError["details"] } | undefined;
    throw createApiError(
      errorBody?.error || errorBody?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.details
    );
  }

  return body as T;
}

// --- Fetch Wrappers ---

/**
 * Performs a GET request and returns the parsed JSON response.
 */
export async function apiGet<T>(
  path: string,
  options?: { timeout?: number; signal?: AbortSignal }
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Merge external signal with our timeout signal
  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return await parseResponse<T>(response);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error && "status" in error) {
      throw error; // Already an ApiError
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options?.signal?.aborted) {
        throw createApiError("Request was cancelled.");
      }
      throw createApiError("Request timed out. Please try again.");
    }
    throw createApiError("Network error. Please check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Performs a DELETE request and returns the parsed JSON response.
 */
export async function apiDelete<T>(
  path: string,
  options?: { timeout?: number; signal?: AbortSignal }
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return await parseResponse<T>(response);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error && "status" in error) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options?.signal?.aborted) {
        throw createApiError("Request was cancelled.");
      }
      throw createApiError("Request timed out. Please try again.");
    }
    throw createApiError("Network error. Please check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Upload (XHR for progress) ---

export interface UploadOptions {
  /** Progress callback (0–100) */
  onProgress?: (percent: number) => void;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /** Timeout in ms (default 120s) */
  timeout?: number;
}

/**
 * Uploads files via multipart/form-data using XMLHttpRequest.
 *
 * Uses XHR instead of fetch because fetch does not support upload progress events.
 * The field name "files" matches the backend multer configuration.
 */
export function uploadFiles(
  files: File[],
  options?: UploadOptions
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeout = options?.timeout ?? UPLOAD_TIMEOUT_MS;

    // Build FormData payload
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    // Wire up progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && options?.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress(percent);
      }
    });

    // Success handler
    xhr.addEventListener("load", () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(createApiError("Invalid response from server.", xhr.status));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResponse);
      } else {
        const errorBody = body as { error?: string; details?: ApiError["details"] } | undefined;
        reject(
          createApiError(
            errorBody?.error || `Upload failed with status ${xhr.status}`,
            xhr.status,
            errorBody?.details
          )
        );
      }
    });

    // Error handler (network errors, CORS failures, etc.)
    xhr.addEventListener("error", () => {
      reject(createApiError("Network error. Please check your connection and try again.", null));
    });

    // Timeout handler
    xhr.addEventListener("timeout", () => {
      reject(createApiError("Upload timed out. Please try again with smaller files or a faster connection."));
    });

    // Abort handler
    xhr.addEventListener("abort", () => {
      reject(createApiError("Upload was cancelled."));
    });

    // Wire up external abort signal
    if (options?.signal) {
      if (options.signal.aborted) {
        reject(createApiError("Upload was cancelled."));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort());
    }

    // Send
    xhr.open("POST", `${API_BASE_URL}${API_ROUTES.UPLOAD}`);
    xhr.timeout = timeout;
    xhr.send(formData);
  });
}
