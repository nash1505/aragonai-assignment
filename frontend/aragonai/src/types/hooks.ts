import type { ApiError, ImageRecord, UploadResponse, FileValidationResult, DeleteResponse } from "./api";

export interface UseUploadImagesReturn {
  upload: (files: File[]) => Promise<{
    validation: FileValidationResult;
    response: UploadResponse | null;
  }>;
  isUploading: boolean;
  progress: number;
  error: ApiError | null;
  lastResult: UploadResponse | null;
  reset: () => void;
}

export interface UseImagesReturn {
  images: ImageRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface UseDeleteImageReturn {
  deleteImage: (id: string) => Promise<DeleteResponse>;
  isDeleting: boolean;
  error: ApiError | null;
  reset: () => void;
}
