"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useRef(
    pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState("Initializing OSVID Chemicals...");
  const [isNavigating, setIsNavigating] = useState(false);

  // 1. Deterministic, fast Initial Page Load Animation (completes in ~900ms max)
  useEffect(() => {
    // Prevent scrolling during splash
    document.body.style.overflow = "hidden";

    // Fast, smooth step milestones
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusText("Loading Chemical Catalog & Services...");
    }, 200);

    const t2 = setTimeout(() => {
      setProgress(85);
      setStatusText("Preparing Experience...");
    }, 550);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText("Ready");
    }, 850);

    const t4 = setTimeout(() => {
      setIsFadingOut(true);
      document.body.style.overflow = "unset";
    }, 1050);

    const t5 = setTimeout(() => {
      setIsLoading(false);
      setIsFadingOut(false);
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      document.body.style.overflow = "unset";
    };
  }, []);

  // 2. Intercept Internal Route Clicks for Snappy Top Bar Feedback
  useEffect(() => {
    let navInterval: NodeJS.Timeout | null = null;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

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

      try {
        const destinationUrl = new URL(anchor.href, window.location.href);
        if (destinationUrl.origin === window.location.origin) {
          const newPath = destinationUrl.pathname + destinationUrl.search;
          const currentPath = window.location.pathname + window.location.search;

          if (newPath !== currentPath && !destinationUrl.hash.startsWith("#")) {
            setIsNavigating(true);
          }
        }
      } catch {
        // Ignore parsing errors
      }
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      if (navInterval) clearInterval(navInterval);
    };
  }, []);

  // Complete Route Navigation when URL changes
  useEffect(() => {
    const newUrl =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (newUrl !== currentUrl.current) {
      currentUrl.current = newUrl;
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  return (
    <>
      {/* Top Nav Loading Line for route transitions */}
      {isNavigating && (
        <div
          className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none h-[3px] bg-transparent"
          aria-hidden="true"
        >
          <div className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 w-full animate-pulse shadow-[0_0_10px_rgba(245,94,0,0.7)]" />
        </div>
      )}

      {/* Main OSVID Branded Initial Preloader (Sleek, Fast & Reliable) */}
      {isLoading && (
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
          {/* Background Soft Ambient Radial Glow */}
          <div
            style={{
              position: "absolute",
              width: "360px",
              height: "360px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(245,94,0,0.12) 0%, rgba(255,255,255,0) 70%)",
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
                padding: "14px 24px",
                borderRadius: "18px",
                backgroundColor: "#fafafa",
                border: "1px solid #f1f5f9",
                boxShadow:
                  "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
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
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%)",
                  transform: "skewX(-25deg)",
                  pointerEvents: "none",
                  animation: "osvidTorchlightMove 1.4s infinite ease-in-out",
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
                  fontSize: "14px",
                  fontWeight: "800",
                  letterSpacing: "0.1em",
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
                  marginTop: "6px",
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
                    transition: "width 0.25s ease-out",
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

          {/* Torchlight Keyframe */}
          <style>{`
            @keyframes osvidTorchlightMove {
              0% {
                left: -130%;
              }
              60%, 100% {
                left: 150%;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

export default function InstantPreloader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
