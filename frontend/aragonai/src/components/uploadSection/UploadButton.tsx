import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { UploadFormValues } from "../../types";
import { UI_COPY, ALLOWED_EXTENSIONS } from "../../constants/appConstants";

interface UploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  error?: string | null;
  onErrorDismiss?: () => void;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
  onFilesSelected,
  isUploading,
  error,
  onErrorDismiss,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const { register, handleSubmit, setValue, watch, reset } = useForm<UploadFormValues>();
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Register files input field
  const { ref: registeredRef, onChange: registeredOnChange, ...restRegister } = register("files");

  // Watch for changes in files
  const watchedFiles = watch("files");

  // Automatically trigger submit when files are selected
  useEffect(() => {
    if (watchedFiles && watchedFiles.length > 0) {
      handleSubmit(onSubmit)();
    }
  }, [watchedFiles]);

  const onSubmit = (data: UploadFormValues) => {
    if (!data.files || data.files.length === 0) return;
    const filesArray = Array.from(data.files);
    onFilesSelected(filesArray);
    reset(); // Clear form state and input value
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (isUploading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setValue("files", e.dataTransfer.files);
    }
  };

  const onButtonClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  // Build the file pick accept string using ALLOWED_EXTENSIONS
  const acceptString = ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(",") + 
                       ",image/png,image/jpeg,image/heic,image/heif";

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
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
            <span className="text-sm font-medium">{error}</span>
          </div>
          {onErrorDismiss && (
            <button
              onClick={onErrorDismiss}
              className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Upload Box Container */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-300 group bg-white
            ${
              isDragActive
                ? "border-[#FF8A65] bg-orange-50/40 scale-[1.01] shadow-md"
                : "border-slate-300 hover:border-[#FF8A65] hover:bg-slate-50/50"
            }
            ${isUploading ? "pointer-events-none opacity-90" : ""}
          `}
        >
          {/* Hidden File Input */}
          <input
            {...restRegister}
            onChange={(e) => {
              registeredOnChange(e);
            }}
            ref={(instance) => {
              registeredRef(instance);
              fileInputRef.current = instance;
            }}
            type="file"
            multiple
            accept={acceptString}
            className="hidden"
            id="file-upload"
          />

          {/* Upload/Uploading Button */}
          <button
            type="button"
            disabled={isUploading}
            className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-white font-medium text-sm transition-all duration-300 shadow-sm
              ${
                isUploading
                  ? "bg-[#FF8A65] opacity-90 cursor-not-allowed min-w-[150px]"
                  : "bg-[#FF8A65] hover:bg-[#FF7043] active:scale-95 group-hover:shadow"
              }
            `}
          >
            {isUploading ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span>Upload photos</span>
              </>
            )}
          </button>

          {/* Click to upload or drag and drop */}
          <p className="mt-5 text-base font-semibold text-slate-800 text-center tracking-tight">
            {UI_COPY.UPLOAD_BUTTON.PROMPT}
          </p>

          {/* File Formats & Max Size */}
          <p className="mt-1 text-xs text-slate-500 text-center tracking-wide font-medium">
            {UI_COPY.UPLOAD_BUTTON.LIMITS}
          </p>
        </div>
      </form>
    </div>
  );
};
