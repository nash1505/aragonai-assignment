/**
 * Hook for uploading images to the backend.
 *
 * Provides a mutation-style API with real XHR progress tracking,
 * client-side validation, and abort support on unmount.
 *
 * Usage:
 *   const { upload, isUploading, progress, error, lastResult, reset } = useUploadImages();
 *   const result = await upload(files);
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { ApiError, UploadResponse, FileValidationResult } from "../types/api";
import { validateFiles } from "../utils/fileValidation";
import { uploadFiles } from "../utils/apiClient";

export interface UseUploadImagesReturn {
  /**
   * Validates and uploads an array of files.
   * Returns the validation result (including rejected files) and the server response.
   * Throws if ALL files are rejected by validation or the upload fails entirely.
   */
  upload: (files: File[]) => Promise<{
    validation: FileValidationResult;
    response: UploadResponse | null;
  }>;
  /** True while an upload XHR is in-flight */
  isUploading: boolean;
  /** Upload progress 0–100 from XHR */
  progress: number;
  /** Last API or network error, null when clear */
  error: ApiError | null;
  /** Last successful upload response */
  lastResult: UploadResponse | null;
  /** Reset error and progress state */
  reset: () => void;
}

export function useUploadImages(): UseUploadImagesReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  // AbortController reference for cleanup on unmount
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any in-flight upload when component unmounts
      abortControllerRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
    setLastResult(null);
  }, []);

  const upload = useCallback(
    async (
      files: File[]
    ): Promise<{
      validation: FileValidationResult;
      response: UploadResponse | null;
    }> => {
      // 1. Client-side validation
      const validation = validateFiles(files);

      // If no valid files remain, return early without hitting the server
      if (validation.validFiles.length === 0) {
        return { validation, response: null };
      }

      // 2. Prepare upload
      setIsUploading(true);
      setProgress(0);
      setError(null);

      // Create new abort controller for this upload
      abortControllerRef.current?.abort(); // Cancel any stale upload
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await uploadFiles(validation.validFiles, {
          onProgress: (percent) => {
            if (isMountedRef.current) {
              setProgress(percent);
            }
          },
          signal: controller.signal,
        });

        if (isMountedRef.current) {
          setLastResult(response);
          setIsUploading(false);
        }

        return { validation, response };
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const apiError =
            err && typeof err === "object" && "message" in err
              ? (err as ApiError)
              : { message: "An unexpected error occurred.", status: null };
          setError(apiError);
          setIsUploading(false);
        }
        throw err; // Re-throw so the caller can also handle it
      }
    },
    []
  );

  return { upload, isUploading, progress, error, lastResult, reset };
}
