import { useState, useEffect, useRef, useCallback } from "react";
import type { ApiError, ImageRecord, ImagesListResponse } from "../types/api";
import { apiGet } from "../utils/apiClient";

export interface UseImagesReturn {
  images: ImageRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const PAGE_LIMIT = 20;
const POLLING_INTERVAL_MS = 4000; // Poll every 4 seconds if there are pending/processing items

export function useImages(): UseImagesReturn {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep track of the current cursor to prevent race conditions during pagination
  const nextCursorRef = useRef<string | null>(null);
  nextCursorRef.current = nextCursor;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  /**
   * Fetches the first page of images.
   * Clears errors and resets the pagination cursor.
   */
  const fetchInitialImages = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await apiGet<ImagesListResponse>(`/api/images?limit=${PAGE_LIMIT}`);
      
      if (isMountedRef.current) {
        setImages(data.images);
        setNextCursor(data.nextCursor);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const apiError =
          err && typeof err === "object" && "message" in err
            ? (err as ApiError)
            : { message: "Failed to fetch images.", status: null };
        setError(apiError);
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Fetches the next page of images using cursor-based pagination.
   * Appends results to the existing list.
   */
  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || isLoadingMore || isLoading) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const data = await apiGet<ImagesListResponse>(
        `/api/images?limit=${PAGE_LIMIT}&cursor=${cursor}`
      );

      if (isMountedRef.current) {
        setImages((prev) => {
          // Prevent duplicate entries by checking IDs
          const existingIds = new Set(prev.map((img) => img.id));
          const newImages = data.images.filter((img) => !existingIds.has(img.id));
          return [...prev, ...newImages];
        });
        setNextCursor(data.nextCursor);
        setIsLoadingMore(false);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const apiError =
          err && typeof err === "object" && "message" in err
            ? (err as ApiError)
            : { message: "Failed to load more images.", status: null };
        setError(apiError);
        setIsLoadingMore(false);
      }
    }
  }, [isLoading, isLoadingMore]);

  // Initial fetch on mount
  useEffect(() => {
    fetchInitialImages(true);
  }, [fetchInitialImages]);

  // Auto-polling effect: If there are PENDING or PROCESSING images, poll the backend
  useEffect(() => {
    const hasPendingImages = images.some(
      (img) => img.status === "PENDING" || img.status === "PROCESSING"
    );

    if (hasPendingImages) {
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(() => {
          // Silently refresh the list without showing full page loading skeleton/spinners
          fetchInitialImages(false);
        }, POLLING_INTERVAL_MS);
      }
    } else {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [images, fetchInitialImages]);

  const refetch = useCallback(() => fetchInitialImages(true), [fetchInitialImages]);

  return {
    images,
    isLoading,
    isLoadingMore,
    error,
    hasMore: !!nextCursor,
    refetch,
    loadMore,
  };
}
