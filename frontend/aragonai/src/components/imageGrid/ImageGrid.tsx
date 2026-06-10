import React, { useState } from "react";
import type { ImageRecord } from "../../types";
import { formatBytes } from "../../utils/formatters";
import { UI_COPY } from "../../constants/appConstants";
import { Lightbox } from "./Lightbox";

interface ImageGridProps {
  images: ImageRecord[];
  onDelete: (id: string) => Promise<void> | void;
  deletingIds?: Set<string>;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onDelete,
  deletingIds = new Set(),
}) => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>("");

  const isHeic = (img: ImageRecord) => {
    const nameLower = img.originalName.toLowerCase();
    return (
      nameLower.endsWith(".heic") ||
      nameLower.endsWith(".heif") ||
      img.mimeType.includes("heic") ||
      img.mimeType.includes("heif")
    );
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-10 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {UI_COPY.IMAGE_GRID.TITLE} <span className="text-sm font-normal text-slate-500 ml-1">({images.length} photos)</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((image) => {
          const isPending = image.status === "PENDING";
          const isProcessing = image.status === "PROCESSING";
          const isFailed = image.status === "FAILED";
          const isCompleted = image.status === "COMPLETED";
          const isDeleting = deletingIds.has(image.id);

          const isHeicFormat = isHeic(image);
          
          // Determine the thumbnail display URL
          const previewUrl = isCompleted
            ? (image.thumbnailUrl || image.processedUrl || image.originalUrl)
            : (!isHeicFormat && !isFailed ? image.originalUrl : "");

          // Determine high-res lightbox URL
          const lightboxUrl = image.processedUrl || image.originalUrl;

          return (
            <div
              key={image.id}
              className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-50 border shadow-sm transition-all duration-300
                ${isDeleting ? "opacity-60 pointer-events-none" : "hover:shadow-md hover:scale-[1.02]"}
                ${isFailed ? "border-red-200 bg-red-50/20" : "border-slate-100 hover:border-slate-200"}
                ${!isHeicFormat && previewUrl ? "cursor-zoom-in" : "cursor-default"}
              `}
            >
              {/* Deleting Spinner Overlay */}
              {isDeleting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <svg
                    className="animate-spin h-6 w-6 text-red-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="mt-1 text-[10px] text-red-600 font-bold tracking-wider">{UI_COPY.IMAGE_GRID.DELETING}</span>
                </div>
              )}

              {/* HEIC / No-Preview State */}
              {isHeicFormat && !isCompleted && !isFailed && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 text-orange-600/80">
                  <svg
                    className="animate-spin h-5 w-5 mb-2 text-orange-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 tracking-wider">
                    {isPending ? UI_COPY.IMAGE_GRID.HEIC_QUEUE : UI_COPY.IMAGE_GRID.HEIC_CONVERT}
                  </span>
                  <span className="mt-1.5 text-[9px] text-slate-400 font-medium text-center truncate max-w-full px-2">
                    {UI_COPY.IMAGE_GRID.HEIC_SUBTEXT}
                  </span>
                </div>
              )}

              {/* Failed Processing State */}
              {isFailed && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-red-600">
                  <svg
                    className="w-8 h-8 mb-1.5 text-red-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 tracking-wider">
                    FAILED
                  </span>
                  <span className="mt-1 text-[9px] text-red-500 font-medium text-center line-clamp-2 px-1" title={image.errorMessage || "Unknown error"}>
                    {image.errorMessage || "Processing failed"}
                  </span>
                </div>
              )}

              {/* Standard Image Render */}
              {!isFailed && !(isHeicFormat && !isCompleted) && previewUrl && (
                <div className="w-full h-full relative">
                  <img
                    src={previewUrl}
                    alt={image.originalName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onClick={() => {
                      if (isCompleted) {
                        setSelectedImageUrl(lightboxUrl);
                        setSelectedImageName(image.originalName);
                      }
                    }}
                  />
                  
                  {/* Processing overlay for non-HEIC images */}
                  {(isPending || isProcessing) && (
                    <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px] flex flex-col items-center justify-center text-white p-2">
                      <svg
                        className="animate-spin h-5 w-5 mb-1.5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-[9px] font-bold tracking-wider bg-black/40 px-1.5 py-0.5 rounded">
                        {isPending ? "QUEUEING..." : "OPTIMIZING..."}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Hover Backdrop Overlay */}
              {!isDeleting && (isCompleted || isFailed || (!isHeicFormat && previewUrl)) && (
                <div
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3.5"
                  onClick={() => {
                    if (isCompleted) {
                      setSelectedImageUrl(lightboxUrl);
                      setSelectedImageName(image.originalName);
                    }
                  }}
                >
                  {/* Top Row: Actions */}
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(image.id);
                      }}
                      className="p-2 bg-white/90 hover:bg-red-500 hover:text-white text-slate-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-sm hover:shadow"
                      title="Delete image"
                      aria-label={`Delete image ${image.originalName}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Bottom Row: Metadata */}
                  <div className="text-white space-y-0.5 pointer-events-none select-none">
                    <p className="text-xs font-semibold truncate max-w-[85%]">
                      {image.originalName}
                    </p>
                    <p className="text-[10px] text-white/80 font-medium tracking-wide font-mono">
                      {formatBytes(image.size)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox for large previews */}
      {selectedImageUrl && (
        <Lightbox
          isOpen={!!selectedImageUrl}
          onClose={() => {
            setSelectedImageUrl(null);
            setSelectedImageName("");
          }}
          imageUrl={selectedImageUrl}
          imageName={selectedImageName}
        />
      )}
    </div>
  );
};
