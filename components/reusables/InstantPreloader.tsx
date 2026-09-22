"use client";

import React, { useEffect, useState } from "react";

export default function InstantPreloader() {
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Disable scroll while preloader is active
    document.body.style.overflow = "hidden";

    let currentProgress = 0;
    let pageFullyLoaded = document.readyState === "complete";

    const handleWindowLoad = () => {
      pageFullyLoaded = true;
    };

    if (!pageFullyLoaded) {
      window.addEventListener("load", handleWindowLoad);
    }

    const interval = setInterval(() => {
      // Progressively increment counter
      if (!pageFullyLoaded) {
        // Increment up to 90% while waiting for page load
        if (currentProgress < 90) {
          currentProgress += Math.floor(Math.random() * 8) + 3;
          if (currentProgress > 90) currentProgress = 90;
        }
      } else {
        // Once page is loaded, quickly reach 100%
        currentProgress += Math.floor(Math.random() * 15) + 8;
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(interval);

          setTimeout(() => {
            setIsLoaded(true);
            document.body.style.overflow = "unset";
            // Remove from DOM after fade transition completes
            setTimeout(() => setIsVisible(false), 500);
          }, 300);
        }
      }

      setProgress(currentProgress);
    }, 40);

    return () => {
      clearInterval(interval);
      window.removeEventListener("load", handleWindowLoad);
      document.body.style.overflow = "unset";
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      id="osvid-instant-preloader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.5s ease, visibility 0.5s ease",
        opacity: isLoaded ? 0 : 1,
        visibility: isLoaded ? "hidden" : "visible",
        pointerEvents: isLoaded ? "none" : "auto",
        userSelect: "none",
      }}
      aria-hidden={isLoaded}
    >
      {/* Center Container: Logo & Torchlight Light Sweep */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo Container with overflow hidden for light sweep */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            display: "inline-block",
            padding: "8px 12px",
          }}
        >
          {/* Company Logo */}
          <img
            src="/images/logo.webp"
            alt="OSVID Logo"
            style={{
              height: "60px",
              width: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />

          {/* Torchlight / Light Sweep Animation across the Logo */}
          <div
            className="torchlight-shine"
            style={{
              position: "absolute",
              top: 0,
              left: "-120%",
              width: "80%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)",
              transform: "skewX(-25deg)",
              pointerEvents: "none",
              animation: "torchlightMove 2s infinite ease-in-out",
            }}
          />
        </div>

        {/* Minimal Percentage Counter */}
        <div
          style={{
            marginTop: "16px",
            fontSize: "14px",
            fontWeight: "600",
            color: "#374151",
            fontFamily: "monospace, sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          {progress}%
        </div>
      </div>

      {/* Embedded CSS for Torchlight Animation */}
      <style>{`
        @keyframes torchlightMove {
          0% {
            left: -120%;
          }
          60%, 100% {
            left: 140%;
          }
        }
      `}</style>
    </div>
  );
}
