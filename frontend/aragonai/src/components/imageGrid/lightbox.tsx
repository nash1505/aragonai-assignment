import React, { useEffect } from "react";

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
}

export const Lightbox: React.FC<LightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl max-h-[90vh] px-4 flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-4 text-white/80 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/10"
          aria-label="Close lightbox"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image Card Container */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-white/10 shadow-2xl max-h-[80vh] flex items-center justify-center animate-scale-in">
          <img
            src={imageUrl}
            alt={imageName}
            className="object-contain max-w-full max-h-[75vh]"
          />
        </div>

        {/* Title/Label */}
        <span className="mt-4 text-sm font-medium text-white/90 text-center select-none bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-sm truncate max-w-sm">
          {imageName}
        </span>
      </div>
    </div>
  );
};
