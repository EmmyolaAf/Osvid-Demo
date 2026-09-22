"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface PreloaderProps {
  /** Optional min display duration in ms (default: 2000ms) */
  minDuration?: number;
}

export default function Preloader({ minDuration = 2000 }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusText, setStatusText] = useState("Initializing Experience...");

  useEffect(() => {
    // Disable scrolling during preloader
    if (isLoading) {
      document.body.style.overflow = "hidden";
    }

    const startTime = performance.now();
    const intervalTime = 20; // 50fps update

    const timer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const rawProgress = Math.min((elapsed / minDuration) * 100, 100);

      // Smooth easing step
      setProgress((prev) => {
        const next = Math.floor(rawProgress);
        if (next < 30) {
          setStatusText("Initializing Experience...");
        } else if (next < 65) {
          setStatusText("Loading Chemical Solutions...");
        } else if (next < 90) {
          setStatusText("Preparing Quality Services...");
        } else {
          setStatusText("Welcome to OSVID");
        }

        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setIsLoading(false);
            document.body.style.overflow = "unset";
          }, 400);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    // If window finishes loading earlier, guarantee smooth transition
    const handleLoad = () => {
      // Keep running interval to complete progress smoothly
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener("load", handleLoad);
      document.body.style.overflow = "unset";
    };
  }, [minDuration, isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            y: -30,
            scale: 1.02,
            transition: { duration: 0.7, ease: [0.65, 0, 0.35, 1] },
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#070b1e] text-white select-none overflow-hidden"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {/* Ambient Background Aura */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[#0e166e]/40 via-[#f55e00]/25 to-[#aaf202]/15 rounded-full blur-[110px] animate-pulse" />
            <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-orange-500/15 rounded-full blur-[90px]" />
            <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-600/20 rounded-full blur-[90px]" />
          </div>

          {/* Logo & Spotlight Frame */}
          <div className="relative flex flex-col items-center justify-center z-10 px-6">
            <div className="relative flex items-center justify-center">
              {/* Outer Rotating Torchlight / Shimmer Orbit */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full p-[2px]"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(245, 94, 0, 0.9) 60deg, rgba(253, 213, 126, 1) 120deg, transparent 180deg, rgba(170, 242, 2, 0.7) 270deg, transparent 360deg)",
                }}
              >
                <div className="w-full h-full rounded-full bg-[#070b1e]/90 backdrop-blur-md" />
              </motion.div>

              {/* Secondary Counter-rotating Subtle Glow */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                className="absolute w-44 h-44 sm:w-48 sm:h-48 rounded-full border border-dashed border-orange-400/30"
              />

              {/* Central Badge Container with Torchlight Sheen */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{
                  scale: [0.95, 1.03, 0.95],
                  opacity: 1,
                }}
                transition={{
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  opacity: { duration: 0.5 },
                }}
                className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_50px_rgba(245,94,0,0.3)] flex items-center justify-center overflow-hidden p-6"
              >
                {/* Torchlight Sweep Across Logo */}
                <motion.div
                  animate={{
                    x: ["-150%", "150%"],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 0.3,
                  }}
                  className="absolute inset-0 w-full h-full -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-20"
                />

                {/* Torchlight Radial Beam (Spotlight Following Motion) */}
                <motion.div
                  animate={{
                    x: [-20, 20, -20],
                    y: [-15, 15, -15],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute w-24 h-24 rounded-full bg-white/30 blur-md pointer-events-none z-10"
                />

                {/* Company Logo */}
                <div className="relative w-28 h-28 flex items-center justify-center z-10 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  <Image
                    src="/images/logo.webp"
                    alt="OSVID Logo"
                    width={140}
                    height={140}
                    priority
                    className="w-auto h-auto max-h-20 max-w-full object-contain"
                  />
                </div>
              </motion.div>
            </div>

            {/* Brand Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-center"
            >
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-amber-200">
                OSVID CHEMICALS
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 font-medium tracking-widest uppercase mt-1 h-5">
                {statusText}
              </p>
            </motion.div>

            {/* Progress & Percentage Bar */}
            <div className="w-64 sm:w-80 mt-6 flex flex-col items-center gap-2">
              {/* Numeric Percentage */}
              <div className="w-full flex justify-between items-center text-xs font-mono px-1">
                <span className="text-gray-400 font-semibold tracking-wider">
                  LOADING
                </span>
                <span className="text-orange-400 font-bold text-sm tracking-wider">
                  {progress}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-[2px] border border-white/10 backdrop-blur-sm">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-osvid-orange via-amber-400 to-[#aaf202] shadow-[0_0_12px_rgba(245,94,0,0.8)] relative"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                >
                  {/* Leading Sparkle */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#fff]" />
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
