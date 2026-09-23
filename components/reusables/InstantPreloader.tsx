"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useRef(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ""));

  const [isLoading, setIsLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(10);
  const [statusText, setStatusText] = useState("Loading OSVID Experience...");

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  const startLoading = (customStatus = "Loading...") => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setIsFadingOut(false);
    setIsLoading(true);
    setProgress(15);
    setStatusText(customStatus);
    document.body.style.overflow = "hidden";

    // Progressively increment up to 88% while waiting for page completion
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const jump = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + jump, 88);
      });
    }, 50);
  };

  const finishLoading = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
    setStatusText("Ready");

    // Brief delay to show 100% then smooth fade out
    setTimeout(() => {
      setIsFadingOut(true);
      document.body.style.overflow = "unset";

      setTimeout(() => {
        setIsLoading(false);
        setIsFadingOut(false);
        isNavigatingRef.current = false;
      }, 350);
    }, 200);
  };

  // 1. Initial Page Load
  useEffect(() => {
    startLoading("Initializing OSVID Chemicals...");

    const handleInitialLoad = () => {
      finishLoading();
    };

    if (document.readyState === "complete") {
      finishLoading();
    } else {
      window.addEventListener("load", handleInitialLoad);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      window.removeEventListener("load", handleInitialLoad);
      document.body.style.overflow = "unset";
    };
  }, []);

  // 2. Intercept Route / Section Navigation Clicks
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Find the closest anchor tag
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      // Skip external links, new tabs, download links, hash anchors, or tel/mailto
      if (
        !href ||
        targetAttr === "_blank" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      // Check if it is an internal route
      try {
        const destinationUrl = new URL(anchor.href, window.location.href);
        const currentOrigin = window.location.origin;

        if (destinationUrl.origin === currentOrigin) {
          const newPath = destinationUrl.pathname + destinationUrl.search;
          const currentPath = window.location.pathname + window.location.search;

          if (newPath !== currentPath && !destinationUrl.hash.startsWith("#")) {
            isNavigatingRef.current = true;
            startLoading("Loading Section...");
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    };

    // Custom event listeners for programmatic navigation
    const handleCustomNavStart = (e: any) => {
      isNavigatingRef.current = true;
      startLoading(e.detail?.message || "Loading...");
    };

    const handleCustomNavEnd = () => {
      finishLoading();
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });
    window.addEventListener("osvid:navigation-start", handleCustomNavStart);
    window.addEventListener("osvid:navigation-end", handleCustomNavEnd);

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      window.removeEventListener("osvid:navigation-start", handleCustomNavStart);
      window.removeEventListener("osvid:navigation-end", handleCustomNavEnd);
    };
  }, []);

  // 3. Route Change Listener (triggers when new pathname or searchParams is mounted)
  useEffect(() => {
    const newUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (newUrl !== currentUrl.current) {
      currentUrl.current = newUrl;
      // Complete the loading screen
      finishLoading();
    }
  }, [pathname, searchParams]);

  if (!isLoading) return null;

  return (
    <div
      id="osvid-screen-preloader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? "scale(1.01)" : "scale(1)",
        pointerEvents: isFadingOut ? "none" : "auto",
        userSelect: "none",
      }}
      aria-live="polite"
      aria-busy={isLoading}
    >
      {/* Background Soft Glow */}
      <div
        style={{
          position: "absolute",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,94,0,0.08) 0%, rgba(255,255,255,0) 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Center Box */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          padding: "24px",
        }}
      >
        {/* Logo Frame with Torchlight Shine Effect */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: "16px",
            backgroundColor: "#fafafa",
            border: "1px solid #f1f5f9",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* Company Logo */}
          <div style={{ position: "relative", width: "160px", height: "55px" }}>
            <Image
              src="/images/logo.webp"
              alt="OSVID Chemicals"
              fill
              priority
              style={{ objectFit: "contain" }}
            />
          </div>

          {/* Torchlight Sweep Animation */}
          <div
            className="osvid-torchlight-shine"
            style={{
              position: "absolute",
              top: 0,
              left: "-130%",
              width: "90%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)",
              transform: "skewX(-25deg)",
              pointerEvents: "none",
              animation: "osvidTorchlightMove 1.8s infinite ease-in-out",
            }}
          />
        </div>

        {/* Brand Subtitle & Status Text */}
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "800",
              letterSpacing: "0.08em",
              color: "#0f172a",
              textTransform: "uppercase",
            }}
          >
            OSVID CHEMICALS
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "4px",
              fontWeight: "500",
              letterSpacing: "0.02em",
              minHeight: "18px",
            }}
          >
            {statusText}
          </p>
        </div>

        {/* Sleek Progress Track & Numeric Counter */}
        <div
          style={{
            width: "220px",
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {/* Progress Bar Track */}
          <div
            style={{
              width: "100%",
              height: "4px",
              backgroundColor: "#e2e8f0",
              borderRadius: "9999px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #f55e00 0%, #ff8800 100%)",
                borderRadius: "9999px",
                transition: "width 0.2s ease-out",
                boxShadow: "0 0 10px rgba(245, 94, 0, 0.5)",
              }}
            />
          </div>

          {/* Numerical Percentage */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              fontFamily: "monospace, sans-serif",
              color: "#94a3b8",
              fontWeight: "600",
            }}
          >
            <span style={{ letterSpacing: "0.05em" }}>LOADING</span>
            <span style={{ color: "#f55e00", fontWeight: "700" }}>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Global CSS for Torchlight Animation */}
      <style>{`
        @keyframes osvidTorchlightMove {
          0% {
            left: -130%;
          }
          65%, 100% {
            left: 150%;
          }
        }
      `}</style>
    </div>
  );
}

export default function InstantPreloader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
