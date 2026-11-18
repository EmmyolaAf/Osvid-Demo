"use client";

import React, { useId } from "react";

interface SpinningExperienceBadgeProps {
  circularText?: string;
  centerNumber?: string;
  centerLabel?: string;
  className?: string;
}

export default function SpinningExperienceBadge({
  circularText = "OSVID CHEMICALS • YEARS OF EXCELLENCE DELIVERY • ",
  centerNumber = "3+",
  centerLabel = "Years",
  className = "",
}: SpinningExperienceBadgeProps) {
  const rawId = useId();
  const pathId = "circlePath_" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  // Clean and format text to ensure neat circular rhythm
  const trimmed = (circularText || "").trim();
  const formattedText = trimmed
    ? trimmed.endsWith("•") || trimmed.endsWith("• ")
      ? trimmed + " "
      : trimmed + " • "
    : "OSVID CHEMICALS • YEARS OF EXCELLENCE DELIVERY • ";

  return (
    <div
      className={`relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full bg-white/95 backdrop-blur-md shadow-2xl border border-white/80 p-1.5 transition-transform hover:scale-105 duration-300 ${className}`}
      aria-label={`${centerNumber} ${centerLabel} - ${circularText}`}
    >
      {/* Outer Rotating SVG Circular Text */}
      <div className="absolute inset-0 flex items-center justify-center animate-spin [animation-duration:14s] pointer-events-none">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full overflow-visible select-none"
        >
          <defs>
            <path
              id={pathId}
              d="M 80, 80 m -55, 0 a 55,55 0 1,1 110,0 a 55,55 0 1,1 -110,0"
              fill="none"
            />
          </defs>
          <text className="text-[10px] sm:text-[10.5px] font-black uppercase fill-slate-900 tracking-[0.16em]">
            <textPath href={`#${pathId}`} startOffset="0%">
              {formattedText}
            </textPath>
          </text>
        </svg>
      </div>

      {/* Center Upright Number & Label Badge */}
      <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white flex flex-col items-center justify-center shadow-lg border-2 border-white ring-2 ring-orange-500/20 select-none">
        <span className="text-lg sm:text-xl md:text-2xl font-black leading-none tracking-tight drop-shadow-xs">
          {centerNumber}
        </span>
        {centerLabel && (
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-orange-100 leading-tight mt-0.5">
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  );
}
