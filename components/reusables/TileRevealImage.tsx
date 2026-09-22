// components/TileRevealImage.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";

interface TileRevealImageProps {
  src: string;
  alt: string;
  isActive: boolean; // Controls when the reveal animation plays
  width?: number; // Optional, for specific image sizing if needed
  height?: number; // Optional, for specific image sizing if needed
  quality?: number;
  priority?: boolean;
  sizes?: string;
  className?: string; // Class name for the Image component
  tileCount?: { rows: number; cols: number };
  tileDuration?: number; // Duration of each tile animation
  tileStagger?: number; // Stagger delay between tiles
}

export default function TileRevealImage({
  src,
  alt,
  isActive,
  width,
  height,
  quality = 90,
  priority = false,
  className = "object-cover",
  tileCount = { rows: 8, cols: 8 }, // Default to 8x8 grid
  tileDuration = 0.3,
  tileStagger = 0.03,
}: TileRevealImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<number[]>([]);

  useEffect(() => {
    // Generate tiles dynamically
    const numTiles = tileCount.rows * tileCount.cols;
    setTiles(Array.from({ length: numTiles }, (_, i) => i));
  }, [tileCount]);

  const tileVariants: Variants = {
    hidden: { opacity: 1, scale: 1 },
    revealed: {
      opacity: 0.0,
      scale: 0.8, // Slightly shrink as they disappear
      transition: { duration: tileDuration, ease: "easeOut" },
    },
  };

  const containerVariants: Variants = {
    hidden: { transition: { staggerChildren: 0.0, staggerDirection: -1 } }, // No stagger initially
    revealed: {
      transition: { staggerChildren: tileStagger, staggerDirection: 1 },
    }, // Stagger reveal
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
      <Image
        src={src}
        alt={alt}
        fill={!width && !height} // Use fill if width/height not provided
        width={width}
        height={height}
        quality={quality}
        priority={priority}
        className={className}
      />

      {/* Overlay for reveal effect */}
      <motion.div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${tileCount.cols}, 1fr)`,
          gridTemplateRows: `repeat(${tileCount.rows}, 1fr)`,
        }}
        variants={containerVariants}
        initial="hidden"
        animate={isActive ? "revealed" : "hidden"} // Animate based on isActive prop
      >
        {tiles.map((i) => (
          <motion.div
            key={i}
            className="bg-black origin-center" // Adjust background color of tiles
            variants={tileVariants}
          />
        ))}
      </motion.div>
    </div>
  );
}
