"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useRef(
    pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
  );

  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startNavigation = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setIsNavigating(true);
    setProgress(25);

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const jump = Math.floor(Math.random() * 12) + 6;
        return Math.min(prev + jump, 90);
      });
    }, 80);
  };

  const finishNavigation = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);

    setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 250);
  };

  // Intercept Route Navigation Clicks for Instant Top Bar Feedback
  useEffect(() => {
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
        const currentOrigin = window.location.origin;

        if (destinationUrl.origin === currentOrigin) {
          const newPath = destinationUrl.pathname + destinationUrl.search;
          const currentPath = window.location.pathname + window.location.search;

          if (newPath !== currentPath && !destinationUrl.hash.startsWith("#")) {
            startNavigation();
          }
        }
      } catch {
        // Ignore URL parse errors
      }
    };

    const handleCustomNavStart = () => startNavigation();
    const handleCustomNavEnd = () => finishNavigation();

    document.addEventListener("click", handleGlobalClick, { capture: true });
    window.addEventListener("osvid:navigation-start", handleCustomNavStart);
    window.addEventListener("osvid:navigation-end", handleCustomNavEnd);

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      window.removeEventListener("osvid:navigation-start", handleCustomNavStart);
      window.removeEventListener("osvid:navigation-end", handleCustomNavEnd);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Complete Top Loading Bar on Route Change
  useEffect(() => {
    const newUrl =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (newUrl !== currentUrl.current) {
      currentUrl.current = newUrl;
      finishNavigation();
    }
  }, [pathname, searchParams]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      id="osvid-top-loader"
      className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none h-[3px] bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 transition-all duration-200 ease-out shadow-[0_0_8px_rgba(245,94,0,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: isNavigating || progress > 0 ? 1 : 0,
        }}
      />
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
