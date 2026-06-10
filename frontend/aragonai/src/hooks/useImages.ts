import { useState, useEffect, useRef, useCallback } from "react";
import type { ApiError, ImageRecord, ImagesListResponse, UseImagesReturn } from "../types";
import { apiGet } from "../utils/apiClient";
import { PAGE_LIMIT, POLLING_INTERVAL_MS, API_ROUTES } from "../constants/appConstants";

export function useImages(): UseImagesReturn {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

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
      fetchAbortControllerRef.current?.abort();
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

    // Cancel any in-flight initial fetch request
    fetchAbortControllerRef.current?.abort();
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;

    try {
      const data = await apiGet<ImagesListResponse>(
        `${API_ROUTES.IMAGES}?limit=${PAGE_LIMIT}`,
        { signal: controller.signal }
      );
      
      if (isMountedRef.current) {
        setImages(data.images);
        setNextCursor(data.nextCursor);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      // Ignore manual aborts / cancellations
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (err && typeof err === "object" && "message" in err) {
        if ((err as any).message === "Request was cancelled.") {
          return;
        }
      }

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
        `${API_ROUTES.IMAGES}?limit=${PAGE_LIMIT}&cursor=${cursor}`
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
