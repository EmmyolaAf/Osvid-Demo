// src/components/reusables/cards/MissionVisionCard.tsx
"use client";

import React from "react";

interface MissionVisionCardProps {
  icon: string; // Emoji or path to an SVG/Image for the icon
  title: string;
  content: string;
  delay?: number; // Animation delay in milliseconds
}

const MissionVisionCard = ({
  icon,
  title,
  content,
  delay = 0,
}: MissionVisionCardProps) => {
  return (
    <div
      className={`bg-white p-8 rounded-xl shadow-lg border-l-8 border-osvid-orange text-left space-y-4
        transform hover:scale-[1.01] hover:-translate-y-1 transition-all duration-300 ease-in-out hover:shadow-2xl
        animate-fade-in-up delay-${delay}`}
    >
      {/* Icon - Centered on mobile, left-aligned on larger screens */}
      <div className="text-5xl text-osvid-blue mb-4 flex justify-center md:justify-start">
        {icon}
      </div>

      {/* Title with internal animation */}
      <h4 className="text-3xl font-extrabold text-gray-900 animate-fade-in-up delay-200">
        {title}
      </h4>

      {/* Content with internal animation */}
      <p className="text-gray-700 text-lg leading-relaxed animate-fade-in-up delay-300">
        {content}
      </p>
    </div>
  );
};

export default MissionVisionCard;
