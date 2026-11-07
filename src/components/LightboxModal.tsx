import React, { useState, useEffect } from "react";
import { X, Download, Sparkles, Columns, Maximize2, RefreshCw } from "lucide-react";
import { CanonicalProductSpec, GeneratedMediumShot, MediumDefinition } from "../types/brand";
import { downloadExactSizedImage, formatExportFilename } from "../utils/imageExport";
import { TarotCircuitCorner } from "./TarotCircuitOrnament";

interface LightboxModalProps {
  medium: MediumDefinition | null;
  shot: GeneratedMediumShot | null;
  anchorImageUrl: string;
  canonicalSpec: CanonicalProductSpec;
  productName: string;
  onClose: () => void;
  onRefine: (mediumId: string, instruction: string) => Promise<void>;
  isRefining: boolean;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  medium,
  shot,
  anchorImageUrl,
  canonicalSpec,
  productName,
  onClose,
  onRefine,
  isRefining,
}) => {
  const [compareWithAnchor, setCompareWithAnchor] = useState(true);
  const [editInstruction, setEditInstruction] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!medium || !shot || !shot.imageUrl) return null;

  const exportFilename = formatExportFilename(
    productName,
    medium.slug,
    medium.targetWidth,
    medium.targetHeight
  );

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || isRefining) return;
    await onRefine(medium.id, editInstruction.trim());
    setEditInstruction("");
  };

  const handleDownload = async () => {
    if (!shot.imageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadExactSizedImage(
        shot.imageUrl,
        productName,
        medium.slug,
        medium.targetWidth,
        medium.targetHeight
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#07040B]/95 text-[#FAF6FF] flex flex-col justify-between overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`${medium.title} Preview`}
    >
      {/* Top Bar — All Buttons Have Visible Text Labels */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#D4AF37]/30 bg-[#11081C]">
        <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200/75">
          <span className="font-display text-sm font-semibold text-[#F3D36B] tracking-wide">
            {medium.title}: done.
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-spec text-[#00E5CC]">
            Size: {medium.targetWidth}×{medium.targetHeight} px
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-spec text-purple-200/80">{exportFilename}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setCompareWithAnchor((prev) => !prev)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              compareWithAnchor
                ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3D36B]"
                : "bg-white/5 border-white/15 text-purple-100 hover:border-[#D4AF37]/60"
            }`}
          >
            {compareWithAnchor ? <Columns className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {compareWithAnchor ? "Hide Master Image" : "Compare with Master Image"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="btn-gold-glow px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? "Saving..." : `Download ${exportFilename}`}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-purple-100 border border-[#D4AF37]/40 hover:border-[#F3D36B] hover:text-[#F3D36B] rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col justify-center">
        {compareWithAnchor ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Master Image Column */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="text-xs text-purple-200/75 flex items-center justify-between">
                <span className="font-display font-semibold text-[#F3D36B]">
                  Master Image
                </span>
                <span className="font-mono-spec text-[#00E5CC]">Approved Reference</span>
              </div>
              <div className="relative tarot-card-frame rounded-2xl p-4 aspect-square flex items-center justify-center">
                <TarotCircuitCorner position="top-left" />
                <TarotCircuitCorner position="top-right" />
                <TarotCircuitCorner position="bottom-left" />
                <TarotCircuitCorner position="bottom-right" />
                <img
                  src={anchorImageUrl}
                  alt={`${productName} Master Image`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-xl result-image-frame"
                />
              </div>
              <div className="pt-2 space-y-1.5 text-xs text-purple-200/80">
                <p className="text-[#F3D36B] font-medium">Product Details</p>
                <p className="leading-relaxed">{canonicalSpec.silhouetteLock}</p>
                <p className="text-purple-300/60">{canonicalSpec.surfaceMaterials}</p>
              </div>
            </div>

            {/* Selected Size Output Column */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="text-xs text-purple-200/75 flex items-center justify-between">
                <span className="font-display font-semibold text-[#F3D36B]">
                  {medium.title} ({medium.targetWidth}×{medium.targetHeight} px)
                </span>
                <span className="font-mono-spec text-[#EB238E]">{exportFilename}</span>
              </div>
              <div className="relative tarot-card-frame rounded-2xl p-5 flex items-center justify-center max-h-[68vh]">
                <TarotCircuitCorner position="top-left" />
                <TarotCircuitCorner position="top-right" />
                <TarotCircuitCorner position="bottom-left" />
                <TarotCircuitCorner position="bottom-right" />
                <img
                  src={shot.imageUrl}
                  alt={`${productName} in ${medium.title}`}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[62vh] object-contain rounded-lg result-image-frame"
                />
              </div>
              <p className="text-xs text-purple-200/75 leading-relaxed pt-1">
                {medium.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="relative tarot-card-frame rounded-2xl p-6 max-h-[74vh] flex items-center justify-center">
              <TarotCircuitCorner position="top-left" />
              <TarotCircuitCorner position="top-right" />
              <TarotCircuitCorner position="bottom-left" />
              <TarotCircuitCorner position="bottom-right" />
              <img
                src={shot.imageUrl}
                alt={`${productName} in ${medium.title}`}
                referrerPolicy="no-referrer"
                className="max-h-[66vh] w-auto object-contain rounded-lg result-image-frame"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Edit Bar — Label Stacked Above Field */}
      <div className="border-t border-[#D4AF37]/30 bg-[#11081C] px-6 py-4">
        <form
          onSubmit={handleRefineSubmit}
          className="max-w-5xl mx-auto space-y-2"
        >
          <label
            htmlFor="lightbox-edit-input"
            className="block text-xs font-semibold text-[#F3D36B]"
          >
            Edit This {medium.title} Image
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 bg-[#09050E] border border-[#D4AF37]/45 rounded-lg px-4 py-2.5 focus-within:border-[#00E5CC] transition-colors">
              <Sparkles className="w-4 h-4 text-[#F3D36B] shrink-0" />
              <input
                id="lightbox-edit-input"
                type="text"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder={`Describe changes for this ${medium.title} image...`}
                className="w-full bg-transparent text-sm text-white placeholder-purple-300/40 focus:outline-none"
                disabled={isRefining}
              />
            </div>
            <button
              type="submit"
              disabled={isRefining || !editInstruction.trim()}
              className="btn-gold-glow px-5 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRefining ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Updating Image...
                </>
              ) : (
                "Update Image"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
