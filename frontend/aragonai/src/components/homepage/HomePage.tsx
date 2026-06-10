import { useState, useEffect, useRef } from "react";
import { UploadButton, ProgressList } from "../UploadSection";
import type { UploadProgressItem } from "../../types";
import { ImageGrid } from "../ImageGrid";
import { useImages } from "../../hooks/useImages";
import { useUploadImages } from "../../hooks/useUploadImages";
import { useDeleteImage } from "../../hooks/useDeleteImage";
import { formatBytes } from "../../utils/formatters";
import { validateFiles } from "../../utils/fileValidation";
import { UI_COPY } from "../../constants/appConstants";

export const HomePage = () => {
  const {
    images,
    isLoading: isGridLoading,
    isLoadingMore,
    error: gridError,
    hasMore,
    refetch,
    loadMore,
  } = useImages();

  const {
    upload,
    isUploading: isUploadHookLoading,
    progress: uploadProgress,
    error: uploadHookError,
    reset: uploadReset,
  } = useUploadImages();

  const { deleteImage, reset: deleteReset } = useDeleteImage();

  // State to track individual file uploads in the ProgressList UI
  const [uploadingQueue, setUploadingQueue] = useState<UploadProgressItem[]>([]);
  
  // State to track which images are currently deleting to show loading spinners on the cards
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Keep track of Files corresponding to the queue items for retry capability
  const filesRef = useRef<{ [id: string]: File }>({});

  // Error boundary/notification state
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Sync global progress to active uploading queue items
  useEffect(() => {
    if (isUploadHookLoading) {
      setUploadingQueue((prevQueue) =>
        prevQueue.map((item) => {
          if (item.status === "uploading") {
            return { ...item, progress: uploadProgress };
          }
          return item;
        })
      );
    }
  }, [uploadProgress, isUploadHookLoading]);

  // Clear errors when the queue is empty
  useEffect(() => {
    if (uploadingQueue.length === 0) {
      setGlobalError(null);
      uploadReset();
      deleteReset();
    }
  }, [uploadingQueue, uploadReset, deleteReset]);

  // Handle files selected via the file input or drag-and-drop
  const handleFilesSelected = async (files: File[]) => {
    // Clear all previous validation and connection errors when starting a new batch
    setGlobalError(null);
    uploadReset();
    deleteReset();

    const newQueueItems: UploadProgressItem[] = [];
    const validFilesToUpload: File[] = [];
    const validQueueIds: string[] = [];

    // 1. Validate all files locally first
    const validation = validateFiles(files);

    // Process client-side rejected files
    validation.rejectedFiles.forEach(({ file, error }) => {
      const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      newQueueItems.push({
        id,
        name: file.name,
        progress: 0,
        size: formatBytes(file.size),
        status: "rejected",
        error,
      });
    });

    // Process client-side valid files
    validation.validFiles.forEach((file) => {
      const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      filesRef.current[id] = file;
      validFilesToUpload.push(file);
      validQueueIds.push(id);

      newQueueItems.push({
        id,
        name: file.name,
        progress: 0,
        size: formatBytes(file.size),
        status: "uploading",
      });
    });

    // Add everything to the upload queue UI
    if (newQueueItems.length > 0) {
      setUploadingQueue((prev) => [...prev, ...newQueueItems]);
    }

    // If there are no valid files, stop here
    if (validFilesToUpload.length === 0) return;

    try {
      // 2. Perform the upload
      const { response } = await upload(validFilesToUpload);

      // 3. Handle response to update progress queue items
      if (response) {
        const successNames = new Set(response.images.map((img) => img.originalName));
        const serverErrors = response.errors || [];
        const errorMap = new Map(serverErrors.map((err) => [err.filename, err.error]));

        setUploadingQueue((prevQueue) =>
          prevQueue.map((item) => {
            if (!validQueueIds.includes(item.id)) return item;

            if (successNames.has(item.name)) {
              // Clean up file reference to prevent memory leaks on success
              delete filesRef.current[item.id];
              return {
                ...item,
                progress: 100,
                status: "success",
              };
            }

            const serverError = errorMap.get(item.name);
            if (serverError) {
              return {
                ...item,
                progress: 100,
                status: "failed",
                error: serverError,
              };
            }

            // Fallback status if somehow missing from both success and errors list
            return {
              ...item,
              progress: 100,
              status: "success",
            };
          })
        );
      }

      // Refetch the images grid to load the newly uploaded items
      await refetch();
    } catch (err: any) {
      // Network error or entire batch request failed
      const errMsg = err?.message || "Connection error. Upload failed.";
      
      setUploadingQueue((prevQueue) =>
        prevQueue.map((item) => {
          if (validQueueIds.includes(item.id)) {
            return {
              ...item,
              status: "failed",
              error: errMsg,
            };
          }
          return item;
        })
      );
    }
  };

  // Retry upload for a single failed file item
  const handleRetryUpload = async (id: string) => {
    // Clear top error banner when retrying
    setGlobalError(null);
    uploadReset();
    deleteReset();

    const file = filesRef.current[id];
    if (!file) {
      setUploadingQueue((prevQueue) =>
        prevQueue.map((item) =>
          item.id === id
            ? { ...item, status: "rejected", error: "Source file lost. Please re-upload." }
            : item
        )
      );
      return;
    }

    // Mark item as uploading in queue UI
    setUploadingQueue((prevQueue) =>
      prevQueue.map((item) =>
        item.id === id ? { ...item, status: "uploading", progress: 0, error: undefined } : item
      )
    );

    try {
      const { response } = await upload([file]);

      if (response) {
        const successNames = new Set(response.images.map((img) => img.originalName));
        const serverErrors = response.errors || [];
        const errorMap = new Map(serverErrors.map((err) => [err.filename, err.error]));

        setUploadingQueue((prevQueue) =>
          prevQueue.map((item) => {
            if (item.id !== id) return item;

            if (successNames.has(item.name)) {
              delete filesRef.current[item.id];
              return { ...item, progress: 100, status: "success" };
            }

            const serverError = errorMap.get(item.name);
            return {
              ...item,
              progress: 100,
              status: "failed",
              error: serverError || "Upload failed",
            };
          })
        );
      }

      await refetch();
    } catch (err: any) {
      const errMsg = err?.message || "Upload failed.";
      setUploadingQueue((prevQueue) =>
        prevQueue.map((item) => (item.id === id ? { ...item, status: "failed", error: errMsg } : item))
      );
    }
  };

  // Remove a single status item from the queue list
  const handleRemoveQueueItem = (id: string) => {
    setUploadingQueue((prev) => {
      const next = prev.filter((item) => item.id !== id);
      
      // If there are no more failed or rejected items in the queue, clear error banner
      const hasErrors = next.some((item) => item.status === "failed" || item.status === "rejected");
      if (!hasErrors) {
        setGlobalError(null);
        uploadReset();
        deleteReset();
      }
      return next;
    });
    delete filesRef.current[id];
  };

  // Clear completed and failed queue items from UI
  const handleClearFinishedQueue = () => {
    setUploadingQueue((prev) => {
      const next = prev.filter((item) => item.status === "uploading");
      
      // If the queue now has no items (or no failed/rejected items), clear the error banner
      const hasErrors = next.some((item) => item.status === "failed" || item.status === "rejected");
      if (!hasErrors) {
        setGlobalError(null);
        uploadReset();
        deleteReset();
      }
      return next;
    });
  };

  // Delete an image by ID
  const handleDeleteImage = async (id: string) => {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      await deleteImage(id);
      await refetch();
    } catch (err: any) {
      setGlobalError(err?.message || "Failed to delete the image.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const isUploading = uploadingQueue.some((item) => item.status === "uploading");

  // Determine upload display error
  const displayError = globalError || uploadHookError?.message || gridError?.message;

  const handleClearErrors = () => {
    setGlobalError(null);
    uploadReset();
    deleteReset();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header Section */}
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/80 text-orange-700 text-xs font-bold tracking-wide border border-orange-200/50 animate-fade-in">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            {UI_COPY.HEADER.BADGE}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-fade-in">
            {UI_COPY.HEADER.TITLE}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed font-medium animate-fade-in">
            {UI_COPY.HEADER.DESCRIPTION}
          </p>
        </header>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Upload panel (sticky on desktop) */}
          <div className={`space-y-6 lg:sticky lg:top-8 ${images.length > 0 ? "lg:col-span-4" : "lg:col-span-8 lg:col-start-3"}`}>
            <UploadButton
              onFilesSelected={handleFilesSelected}
              isUploading={isUploading}
              error={displayError}
              onErrorDismiss={handleClearErrors}
            />

            <ProgressList
              items={uploadingQueue}
              onClear={handleClearFinishedQueue}
              onRetry={handleRetryUpload}
              onRemoveItem={handleRemoveQueueItem}
            />

            <div className="text-center">
              <span className="text-xs text-slate-400 font-medium">
                {UI_COPY.UPLOAD_BUTTON.FOOTER_SUBTEXT}
              </span>
            </div>
          </div>

          {/* Grid Preview Panel */}
          {images.length > 0 && (
            <div className="lg:col-span-8">
              <ImageGrid
                images={images}
                onDelete={handleDeleteImage}
                deletingIds={deletingIds}
              />
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {isGridLoading && images.length === 0 && (
            <div className="lg:col-span-8 space-y-6">
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="aspect-square bg-slate-200 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
