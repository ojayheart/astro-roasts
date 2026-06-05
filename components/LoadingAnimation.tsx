"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartPlacement } from "@/lib/types";

const STATUSES = [
  "Locating your planets. Bracing for impact...",
  "Calculating exactly where it went wrong...",
  "Cross-referencing your delusions...",
  "Consulting Saturn. Saturn is disappointed...",
  "Measuring the gap between you and your potential...",
  "Asking Mercury why you said that in 2019...",
  "Tallying the red flags. Running low on ink...",
  "Translating your trauma into degrees and minutes...",
  "Finding the part you hoped we'd miss...",
  "Almost done. You're not going to love this...",
];

const STATUS_ROTATION_MS = 6500;

interface LoadingAnimationProps {
  placements?: ChartPlacement[];
  onComplete?: () => void;
}

export default function LoadingAnimation({
  onComplete,
}: LoadingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [flash, setFlash] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const completedRef = useRef(false);

  // Gate the 10MB looping background video on prefers-reduced-motion and the
  // Save-Data client hint, so low-end / cellular / accessibility users don't
  // pay the bandwidth or compositor cost.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const saveData = connection?.saveData === true;
    const slow =
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";
    setShowVideo(!reduce && !saveData && !slow);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUSES.length);
    }, STATUS_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 3));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      setFlash(true);
      setTimeout(() => onComplete?.(), 350);
    }
  }, [progress, onComplete]);

  const clampedProgress = Math.min(Math.round(progress), 99);

  return (
    <div
      className="h-[100dvh] w-screen flex flex-col items-center justify-center relative overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {showVideo ? (
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          src="/loading-loop.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0 bg-void/40 z-[1]" aria-hidden="true" />

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]"
        aria-hidden="true"
      >
        <span className="font-syne font-extrabold text-[25vw] leading-none text-ash opacity-5 tracking-tighter">
          {String(clampedProgress).padStart(2, "0")}
        </span>
      </div>

      <div className="absolute bottom-32 md:bottom-40 flex flex-col items-center z-20 px-6 w-full">
        <div className="h-6 overflow-hidden relative w-full text-center flex items-center justify-center">
          <span
            key={statusIndex}
            className="status-line text-xs md:text-sm tracking-[0.15em] text-blood uppercase"
          >
            {STATUSES[statusIndex]}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Calculating chart"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedProgress}
          className="w-64 h-[1px] bg-bruise mt-4 relative overflow-hidden"
        >
          <div
            className="absolute top-0 left-0 h-full bg-blood transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <footer
        className="absolute bottom-0 left-0 w-full text-center z-20 pointer-events-none px-6"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        aria-hidden="true"
      >
        <p className="text-[10px] md:text-xs tracking-[0.3em] text-ash/40 uppercase">
          Built from chart data. Delivered without padding.
        </p>
      </footer>

      <div
        className="fixed inset-0 bg-blood pointer-events-none z-[100] transition-opacity duration-150"
        style={{ opacity: flash ? 1 : 0 }}
        aria-hidden="true"
      />
    </div>
  );
}

LoadingAnimation.displayName = "LoadingAnimation";
