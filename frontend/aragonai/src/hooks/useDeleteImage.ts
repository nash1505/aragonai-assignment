import { useState, useCallback, useRef, useEffect } from "react";
import type { ApiError, DeleteResponse } from "../types/api";
import { apiDelete } from "../utils/apiClient";

export interface UseDeleteImageReturn {
  deleteImage: (id: string) => Promise<DeleteResponse>;
  isDeleting: boolean;
  error: ApiError | null;
  reset: () => void;
}

export function useDeleteImage(): UseDeleteImageReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const deleteImage = useCallback(async (id: string): Promise<DeleteResponse> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiDelete<DeleteResponse>(`/api/images/${id}`);
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
      return response;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const apiError =
          err && typeof err === "object" && "message" in err
            ? (err as ApiError)
            : { message: "Failed to delete the image.", status: null };
        setError(apiError);
        setIsDeleting(false);
      }
      throw err;
    }
  }, []);

  return { deleteImage, isDeleting, error, reset };
}
