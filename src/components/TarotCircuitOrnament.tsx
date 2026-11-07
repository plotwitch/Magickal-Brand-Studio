import React from "react";

interface CornerProps {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  className?: string;
}

/**
 * Tarot-and-Circuitry Corner Motif:
 * Combines a celestial tarot diamond/star node with 45-degree PCB circuit traces and terminal nodes in gold.
 */
export const TarotCircuitCorner: React.FC<CornerProps> = ({ position, className = "" }) => {
  const rotation =
    position === "top-left"
      ? "rotate-0 top-2 left-2"
      : position === "top-right"
      ? "rotate-90 top-2 right-2"
      : position === "bottom-right"
      ? "rotate-180 bottom-2 right-2"
      : "-rotate-90 bottom-2 left-2";

  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute w-7 h-7 text-[#D4AF37]/75 ${rotation} ${className}`}
    >
      {/* Outer tarot corner L-frame */}
      <path
        d="M2 38V6L6 2H38"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      {/* Inner circuit trace with 45-deg bend */}
      <path
        d="M7 28V11L11 7H28"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeOpacity="0.7"
      />
      {/* Secondary PCB trace */}
      <path
        d="M11 11L18 18H25"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeOpacity="0.65"
      />
      {/* Circuit terminal pads */}
      <circle cx="28" cy="7" r="1.6" fill="currentColor" />
      <circle cx="7" cy="28" r="1.6" fill="currentColor" />
      <circle cx="26.5" cy="18" r="1.5" stroke="currentColor" strokeWidth="0.9" />
      {/* Tarot 4-point celestial star at vertex */}
      <path
        d="M7 3.5L8 6L10.5 7L8 8L7 10.5L6 8L3.5 7L6 6L7 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
};

interface DividerProps {
  label?: string;
}

/**
 * Horizontal Tarot-and-Circuitry Section Divider
 */
export const TarotCircuitDivider: React.FC<DividerProps> = ({ label }) => {
  return (
    <div className="relative flex items-center justify-center py-2 select-none" aria-hidden="true">
      <div className="flex-1 flex items-center">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-[#D4AF37]/75" />
        <svg viewBox="0 0 80 18" className="w-20 h-4.5 text-[#D4AF37]/80 shrink-0" fill="none">
          <path d="M0 9H28L34 4H54" stroke="currentColor" strokeWidth="1" />
          <path d="M18 9L24 14H44" stroke="#00E5CC" strokeWidth="0.85" strokeOpacity="0.65" />
          <circle cx="56" cy="4" r="1.8" fill="currentColor" />
          <circle cx="46" cy="14" r="1.6" fill="#00E5CC" fillOpacity="0.8" />
          <polygon points="70,9 74,5 78,9 74,13" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </div>

      <div className="px-3 flex items-center gap-2.5">
        {/* Tarot Crescent + Star + Circuit Node */}
        <svg viewBox="0 0 32 24" className="w-7 h-5 text-[#D4AF37]" fill="none">
          <path
            d="M16 2L18.2 8.8L25 11L18.2 13.2L16 20L13.8 13.2L7 11L13.8 8.8L16 2Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="rgba(212, 175, 55, 0.15)"
          />
          <circle cx="16" cy="11" r="2" fill="#00E5CC" />
          <circle cx="3" cy="11" r="1.5" fill="#EB238E" />
          <circle cx="29" cy="11" r="1.5" fill="#EB238E" />
        </svg>
        {label && (
          <span className="font-display text-xs tracking-widest uppercase text-[#F3D36B]">
            {label}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center">
        <svg viewBox="0 0 80 18" className="w-20 h-4.5 text-[#D4AF37]/80 shrink-0 rotate-180" fill="none">
          <path d="M0 9H28L34 4H54" stroke="currentColor" strokeWidth="1" />
          <path d="M18 9L24 14H44" stroke="#EB238E" strokeWidth="0.85" strokeOpacity="0.65" />
          <circle cx="56" cy="4" r="1.8" fill="currentColor" />
          <circle cx="46" cy="14" r="1.6" fill="#EB238E" fillOpacity="0.8" />
          <polygon points="70,9 74,5 78,9 74,13" stroke="currentColor" strokeWidth="1.1" />
        </svg>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#D4AF37]/45 to-[#D4AF37]/75" />
      </div>
    </div>
  );
};
