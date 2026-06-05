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
  const completedRef = useRef(false);

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

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="/loading-loop.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-void/40 z-[1]" />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
        <span className="font-syne font-extrabold text-[25vw] leading-none text-ash opacity-5 tracking-tighter">
          {String(Math.min(Math.round(progress), 99)).padStart(2, "0")}
        </span>
      </div>

      <div className="absolute bottom-32 md:bottom-40 flex flex-col items-center z-20 px-6">
        <div className="h-6 overflow-hidden relative w-full text-center flex items-center justify-center">
          <span
            key={statusIndex}
            className="status-line text-xs md:text-sm tracking-[0.15em] text-blood uppercase"
          >
            {STATUSES[statusIndex]}
          </span>
        </div>
        <div className="w-64 h-[1px] bg-bruise mt-4 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-blood transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <footer className="absolute bottom-8 w-full text-center z-20 pointer-events-none px-6">
        <p className="text-[10px] md:text-xs tracking-[0.3em] text-ash/40 uppercase">
          Built from chart data. Delivered without padding.
        </p>
      </footer>

      <div
        className="fixed inset-0 bg-blood pointer-events-none z-[100] transition-opacity duration-150"
        style={{ opacity: flash ? 1 : 0 }}
      />
    </div>
  );
}

LoadingAnimation.displayName = "LoadingAnimation";
