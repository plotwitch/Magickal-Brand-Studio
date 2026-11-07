import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RefreshCw,
  Maximize2,
  Download,
  SlidersHorizontal,
  AlertCircle,
  Lock,
  Sparkles,
} from "lucide-react";
import { GeneratedMediumShot, MediumDefinition } from "../types/brand";
import { TarotCircuitCorner } from "./TarotCircuitOrnament";
import { downloadExactSizedImage, formatExportFilename } from "../utils/imageExport";

interface MediumCardProps {
  medium: MediumDefinition;
  shot: GeneratedMediumShot;
  productName: string;
  isAnchorApproved: boolean;
  onGenerate: (mediumId: string, customSceneNote?: string) => void;
  onInspect: (medium: MediumDefinition) => void;
  isGlobalGenerating: boolean;
}

export const MediumCard: React.FC<MediumCardProps> = ({
  medium,
  shot,
  productName,
  isAnchorApproved,
  onGenerate,
  onInspect,
  isGlobalGenerating,
}) => {
  const [showCustomDirection, setShowCustomDirection] = useState(false);
  const [customNote, setCustomNote] = useState(shot?.customSceneNote || "");
  const [imgError, setImgError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number }>({
    rotateX: 0,
    rotateY: 0,
  });

  const isGenerating = shot?.status === "generating";
  const hasImage = shot?.status === "completed" && Boolean(shot?.imageUrl) && !imgError;

  // Plain-text sentence status for AI agents and screen readers
  const statusSentence = isGenerating
    ? `${medium.title}: generating`
    : hasImage
    ? `${medium.title}: done.`
    : shot?.status === "error"
    ? `${medium.title}: error.`
    : `${medium.title}: waiting.`;

  const exportFilename = formatExportFilename(
    productName,
    medium.slug,
    medium.targetWidth,
    medium.targetHeight
  );

  const aspectClass =
    medium.id === "etsy_listing"
      ? "aspect-4/3"
      : medium.id === "instagram_portrait"
      ? "aspect-4/5"
      : medium.id === "square"
      ? "aspect-square"
      : medium.id === "tiktok_reel_cover"
      ? "aspect-9/16 max-h-[460px] mx-auto"
      : medium.id === "pinterest_pin"
      ? "aspect-2/3 max-h-[460px] mx-auto"
      : "aspect-video";

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: Number((-y * 4).toFixed(2)),
      rotateY: Number((x * 4).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shot?.imageUrl || isDownloading) return;
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

  const handleGenerateClick = () => {
    if (!isAnchorApproved || isGenerating) return;
    setImgError(false);
    onGenerate(medium.id, customNote.trim() || undefined);
  };

  return (
    <motion.article
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      style={{ transformPerspective: 1100 }}
      className="relative tarot-card-frame rounded-2xl overflow-hidden flex flex-col justify-between"
    >
      <TarotCircuitCorner position="top-left" />
      <TarotCircuitCorner position="top-right" />
      <TarotCircuitCorner position="bottom-left" />
      <TarotCircuitCorner position="bottom-right" />

      <div>
        {/* Card Header — Plain Unboxed Metadata + Visible Text Labels on All Buttons */}
        <div className="px-7 pt-6 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D4AF37]/25">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-purple-200/75 mb-1">
              <span className="text-[#00E5CC] font-medium" aria-live="polite">
                {statusSentence}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-spec text-[#F3D36B]">{medium.dimensionsLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-spec text-purple-300/70 truncate max-w-[200px]">
                {exportFilename}
              </span>
            </div>
            <h3 className="font-display text-lg font-semibold text-[#FAF6FF] tracking-wide">
              {medium.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 z-10">
            <button
              type="button"
              onClick={() => setShowCustomDirection((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                showCustomDirection
                  ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3D36B]"
                  : "border-[#D4AF37]/35 text-purple-100 hover:bg-white/5 hover:text-[#F3D36B]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Scene Notes
            </button>

            <button
              type="button"
              onClick={() => hasImage && onInspect(medium)}
              disabled={!hasImage}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#D4AF37]/35 text-purple-100 hover:bg-white/5 hover:text-[#F3D36B] disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              View Full Size
            </button>
          </div>
        </div>

        {/* Optional Scene Notes Drawer (Label Stacked Above Input) */}
        {showCustomDirection && (
          <div className="px-7 py-4 bg-[#12081D] border-b border-[#D4AF37]/25 space-y-2">
            <label
              htmlFor={`scene-note-${medium.id}`}
              className="block text-xs font-medium text-[#F3D36B]"
            >
              Scene Notes for {medium.title}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`scene-note-${medium.id}`}
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g., Add dark quartz crystals, teal backlight, or velvet desk surface..."
                className="flex-1 bg-[#09050E] border border-[#D4AF37]/40 rounded-lg px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
              />
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={isGenerating || !isAnchorApproved}
                className="px-3.5 py-2 text-xs font-semibold border border-[#D4AF37] text-[#F3D36B] hover:bg-[#D4AF37]/15 rounded-lg disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Apply Notes
              </button>
            </div>
          </div>
        )}

        {/* Framed Image Result Area with Animated Progress State & Settle Animation */}
        <div className="p-6 bg-[#0B0613]/80">
          <div
            onClick={() => hasImage && onInspect(medium)}
            className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-[#140A22] result-image-frame flex items-center justify-center ${
              hasImage ? "cursor-pointer group" : ""
            }`}
          >
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="w-11 h-11 rounded-full border-2 border-[#D4AF37]/30 border-t-[#F3D36B] border-r-[#00E5CC] flex items-center justify-center mb-4"
                  >
                    <Sparkles className="w-4 h-4 text-[#F3D36B]" />
                  </motion.div>

                  <p className="font-display text-xs font-semibold text-[#F3D36B] tracking-wide">
                    {medium.title}: generating
                  </p>
                  <p className="text-xs text-purple-200/75 mt-1">
                    Rendering {medium.targetWidth}×{medium.targetHeight} px from approved master image
                  </p>

                  {/* Animated Progress Bar */}
                  <div className="w-48 h-1.5 bg-[#09050F] border border-[#D4AF37]/40 rounded-full overflow-hidden mt-4">
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-full h-full bg-gradient-to-r from-[#2A1442] via-[#00E5CC] to-[#F3D36B]"
                    />
                  </div>
                </motion.div>
              ) : hasImage ? (
                <motion.div
                  key={shot.imageUrl}
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full h-full"
                >
                  <img
                    src={shot.imageUrl}
                    alt={`${productName} — ${medium.title} (${medium.targetWidth}x${medium.targetHeight})`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08050D]/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end justify-between p-4">
                    <span className="text-xs font-medium text-[#F3D36B]">
                      Click to view and compare with master image
                    </span>
                    <span className="text-xs font-mono-spec text-[#00E5CC]">
                      {medium.targetWidth}×{medium.targetHeight} px
                    </span>
                  </div>
                </motion.div>
              ) : shot?.status === "error" ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-6 text-center max-w-sm"
                >
                  <AlertCircle className="w-6 h-6 text-[#EB238E] mb-2" />
                  <p className="text-xs font-semibold text-white mb-1">
                    {medium.title}: error.
                  </p>
                  <p className="text-xs text-purple-200/75 leading-relaxed">
                    {shot.error || "Unable to create this image size right now."}
                  </p>
                </motion.div>
              ) : !isAnchorApproved ? (
                <motion.div
                  key="locked"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-6 text-center max-w-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1F0F33] border border-[#D4AF37]/40 flex items-center justify-center mb-3 text-[#F3D36B]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <p className="font-display text-sm font-semibold text-white">
                    {medium.title}: waiting.
                  </p>
                  <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
                    Approve the master image in Step 1 first.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-6 text-center max-w-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1F0F33] border border-[#D4AF37]/45 flex items-center justify-center mb-3 text-[#00E5CC]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="font-display text-sm font-semibold text-white">
                    {medium.title}: waiting.
                  </p>
                  <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
                    Output size: <span className="font-mono-spec text-[#F3D36B]">{medium.targetWidth}×{medium.targetHeight} px</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Card Footer — Fixed Button Positions Before, During, and After Generation */}
      <div className="px-7 py-4 bg-[#12091E]/90 border-t border-[#D4AF37]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-purple-200/75 line-clamp-1">
          {medium.description}
        </p>

        <div className="flex items-center gap-2 shrink-0 z-10">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasImage || isDownloading || isGenerating}
            className="px-3 py-1.5 text-xs font-medium text-[#00E5CC] border border-[#00E5CC]/40 hover:border-[#00E5CC] hover:bg-[#00E5CC]/10 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? "Saving..." : `Download ${medium.targetWidth}×${medium.targetHeight}`}
          </button>

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating || !isAnchorApproved || isGlobalGenerating}
            className="px-3.5 py-1.5 text-xs font-semibold border border-[#D4AF37]/50 hover:border-[#F3D36B] text-[#F3D36B] hover:bg-[#D4AF37]/15 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "Making Size..." : hasImage ? "Remake Size" : "Make Size"}
          </button>
        </div>
      </div>
    </motion.article>
  );
};
