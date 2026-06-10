import React from "react";
import type { UploadProgressItem } from "../../types";

interface ProgressListProps {
  items: UploadProgressItem[];
  onClear: () => void;
  onRetry?: (id: string) => void;
  onRemoveItem?: (id: string) => void;
}

export const ProgressList: React.FC<ProgressListProps> = ({
  items,
  onClear,
  onRetry,
  onRemoveItem,
}) => {
  if (items.length === 0) return null;

  const activeCount = items.filter((item) => item.status === "uploading").length;
  const completedCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "failed" || item.status === "rejected").length;

  return (
    <div className="w-full max-w-xl mx-auto mt-6 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {activeCount > 0 ? "Uploading photos..." : "Upload status"}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {completedCount} succeeded • {failedCount} failed • {activeCount} active
          </p>
        </div>
        {activeCount === 0 && (
          <button
            onClick={onClear}
            className="text-[11px] font-semibold text-slate-500 hover:text-[#FF8A65] transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-50"
          >
            Clear status
          </button>
        )}
      </div>

      <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
        {items.map((item) => {
          const isUploading = item.status === "uploading";
          const isSuccess = item.status === "success";
          const isFailed = item.status === "failed";
          const isRejected = item.status === "rejected";

          return (
            <div
              key={item.id}
              className={`space-y-1.5 p-3 rounded-xl border transition-all duration-200
                ${
                  isRejected || isFailed
                    ? "bg-red-50/30 border-red-100"
                    : isSuccess
                    ? "bg-emerald-50/10 border-slate-50"
                    : "bg-slate-50/20 border-slate-100"
                }
              `}
            >
              {/* Header: Name and Status Text */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 truncate max-w-[65%]" title={item.name}>
                  {item.name}
                </span>
                <span
                  className={`font-semibold tabular-nums
                    ${
                      isSuccess
                        ? "text-emerald-600"
                        : isFailed
                        ? "text-red-500"
                        : isRejected
                        ? "text-red-500"
                        : "text-slate-500"
                    }
                  `}
                >
                  {isSuccess && "Success"}
                  {isFailed && "Failed"}
                  {isRejected && "Rejected"}
                  {isUploading && `${item.progress}%`}
                </span>
              </div>

              {/* Middle Row: Progress Bar & Icon */}
              {!isRejected && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out
                        ${isFailed ? "bg-red-400" : isSuccess ? "bg-emerald-500" : "bg-[#FF8A65]"}
                      `}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  {isUploading && (
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-[#FF8A65] shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}

                  {isSuccess && (
                    <svg
                      className="h-4 w-4 text-emerald-500 shrink-0 animate-scale-in"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}

                  {isFailed && (
                    <svg
                      className="h-4 w-4 text-red-500 shrink-0 animate-scale-in"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              )}

              {/* Error messages and Action Buttons */}
              {(isFailed || isRejected) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] pt-1">
                  <span className="text-red-500 font-medium italic">
                    {item.error || "An unknown error occurred"}
                  </span>
                  <div className="flex items-center gap-2">
                    {isFailed && onRetry && (
                      <button
                        onClick={() => onRetry(item.id)}
                        className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold transition-colors duration-150"
                      >
                        Retry
                      </button>
                    )}
                    {onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition-colors duration-150"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* File Info Subtext */}
              {!isFailed && !isRejected && (
                <div className="text-[10px] text-slate-400 font-medium">
                  {item.size}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
