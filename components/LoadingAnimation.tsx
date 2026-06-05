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
  /**
   * 0-100 target reported from the server. Bar smooth-tweens toward this
   * each frame so big jumps don't snap. Defaults to a 0→90 background creep
   * over ~90s so the bar never appears stalled when callbacks haven't fired.
   */
  targetPct?: number;
}

export default function LoadingAnimation({
  onComplete,
  targetPct = 0,
}: LoadingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [flash, setFlash] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const completedRef = useRef(false);
  const startedAtRef = useRef<number>(0);

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

  // Smooth-tween toward the server-reported target. Also tick a slow
  // background creep so the bar never appears stuck when callbacks haven't
  // fired yet — caps at ~90% so we don't lie about being done.
  useEffect(() => {
    startedAtRef.current = performance.now();
    const EXPECTED_MS = 90_000; // matches p50 generation time
    const CREEP_CAP = 88;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const elapsed = performance.now() - startedAtRef.current;
        const creep = Math.min(CREEP_CAP, (elapsed / EXPECTED_MS) * CREEP_CAP);
        const target = Math.max(targetPct, creep);
        if (prev >= target) return prev;
        // Ease ~20% of the gap per tick — feels like real work landing
        // rather than a sudden snap when callbacks arrive.
        const next = prev + Math.max(0.4, (target - prev) * 0.2);
        return Math.min(target, next);
      });
    }, 120);

    return () => clearInterval(timer);
  }, [targetPct]);

  useEffect(() => {
    if (progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      setFlash(true);
      setTimeout(() => onComplete?.(), 350);
    }
  }, [progress, onComplete]);

  // Allow 100 only when targetPct hit 100 (status flipped to "ready").
  const ceiling = targetPct >= 100 ? 100 : 99;
  const clampedProgress = Math.min(Math.round(progress), ceiling);

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
        <div className="min-h-[3.5rem] md:min-h-[4rem] overflow-hidden relative w-full max-w-2xl text-center flex items-center justify-center">
          <span
            key={statusIndex}
            className="status-line font-syne font-extrabold text-xl md:text-3xl tracking-tight text-ash uppercase leading-tight"
            style={{
              textShadow:
                "0 2px 12px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6)",
            }}
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
