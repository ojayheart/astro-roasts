"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const STATUSES = [
  "Calculating planetary positions...",
  "Mapping house placements...",
  "Analyzing aspects...",
  "Identifying patterns...",
  "Compiling weaknesses...",
  "Preparing your reading...",
];

export default function LoadingAnimation({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const chartRef = useRef<SVGSVGElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    // SVG chart building
    const outerWheel = document.getElementById("outer-wheel");
    const innerWheel = document.getElementById("inner-wheel");
    if (!outerWheel || !innerWheel) return;

    const cx = 250,
      cy = 250;

    function createSVGEl(tag: string, attrs: Record<string, string | number>) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, String(val));
      }
      return el;
    }

    // Rings
    const rings = [
      { r: 240, stroke: "#E5E5E5", width: 1, opacity: 0.1 },
      { r: 220, stroke: "#E5E5E5", width: 1, opacity: 0.3 },
      { r: 180, stroke: "#FF2A00", width: 1, opacity: 0.6 },
      { r: 70, stroke: "#E5E5E5", width: 1, opacity: 0.2 },
    ];
    rings.forEach((ring) => {
      outerWheel.appendChild(
        createSVGEl("circle", {
          cx,
          cy,
          r: ring.r,
          stroke: ring.stroke,
          "stroke-width": ring.width,
          fill: "none",
          opacity: ring.opacity,
          class: "draw-path",
        }),
      );
    });

    // House spokes
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180;
      outerWheel.appendChild(
        createSVGEl("line", {
          x1: cx + 70 * Math.cos(angle),
          y1: cy + 70 * Math.sin(angle),
          x2: cx + 240 * Math.cos(angle),
          y2: cy + 240 * Math.sin(angle),
          stroke: "#E5E5E5",
          "stroke-width": 1,
          opacity: 0.15,
          class: "draw-path",
        }),
      );
    }

    // Aspect lines
    const aspectNodes: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180;
      aspectNodes.push({
        x: cx + 180 * Math.cos(angle),
        y: cy + 180 * Math.sin(angle),
      });
    }

    const connections = [
      [0, 4],
      [4, 8],
      [8, 0],
      [2, 6],
      [6, 10],
      [10, 2],
      [1, 4],
      [4, 7],
      [7, 10],
      [10, 1],
      [0, 6],
      [3, 9],
    ];

    connections.forEach((pair, idx) => {
      const isRed = idx % 3 === 0;
      innerWheel.appendChild(
        createSVGEl("line", {
          x1: aspectNodes[pair[0]].x,
          y1: aspectNodes[pair[0]].y,
          x2: aspectNodes[pair[1]].x,
          y2: aspectNodes[pair[1]].y,
          stroke: isRed ? "#FF2A00" : "#E5E5E5",
          "stroke-width": 1,
          opacity: isRed ? 0.7 : 0.3,
          class: "draw-path",
        }),
      );

      if (idx % 2 === 0) {
        innerWheel.appendChild(
          createSVGEl("circle", {
            cx: aspectNodes[pair[0]].x,
            cy: aspectNodes[pair[0]].y,
            r: 3,
            fill: isRed ? "#FF2A00" : "#E5E5E5",
            opacity: 0,
            class: "planet-marker",
          }),
        );
      }
    });

    // Initialize stroke dasharray for draw effect
    document.querySelectorAll(".draw-path").forEach((path) => {
      let length: number;
      if (path.tagName === "circle") {
        length = 2 * Math.PI * parseFloat(path.getAttribute("r") || "0");
      } else {
        const x1 = parseFloat(path.getAttribute("x1") || "0");
        const y1 = parseFloat(path.getAttribute("y1") || "0");
        const x2 = parseFloat(path.getAttribute("x2") || "0");
        const y2 = parseFloat(path.getAttribute("y2") || "0");
        length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      }
      (path as SVGElement).style.strokeDasharray = String(length);
      (path as SVGElement).style.strokeDashoffset = String(length);
    });

    // Animations
    const tl = gsap.timeline();

    tl.to(".draw-path", {
      strokeDashoffset: 0,
      duration: 4,
      ease: "power2.inOut",
      stagger: 0.05,
    });

    tl.to(
      ".planet-marker",
      {
        opacity: 1,
        duration: 1.5,
        ease: "power1.inOut",
        stagger: 0.2,
      },
      2,
    );

    // Continuous rotations
    gsap.to("#outer-wheel", {
      rotation: 360,
      transformOrigin: "center center",
      duration: 40,
      ease: "none",
      repeat: -1,
    });

    gsap.to("#inner-wheel", {
      rotation: -360,
      transformOrigin: "center center",
      duration: 60,
      ease: "none",
      repeat: -1,
    });

    gsap.to(chartRef.current, {
      scale: 1.03,
      duration: 3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    // Cycling statuses
    const interval = setInterval(() => {
      setStatusIndex((prev) => {
        if (prev >= STATUSES.length - 1) return prev;
        return prev + 1;
      });
    }, 1200);

    return () => {
      clearInterval(interval);
      gsap.killTweensOf(".draw-path");
      gsap.killTweensOf(".planet-marker");
      gsap.killTweensOf("#outer-wheel");
      gsap.killTweensOf("#inner-wheel");
      gsap.killTweensOf(chartRef.current);
    };
  }, []);

  // Progress counter driven by polling from parent
  useEffect(() => {
    if (progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      // Flash transition
      if (flashRef.current) {
        gsap.to(flashRef.current, {
          opacity: 1,
          duration: 0.15,
          ease: "power4.in",
          onComplete: () => {
            setTimeout(() => onComplete?.(), 200);
          },
        });
      }
    }
  }, [progress, onComplete]);

  // Simulate progress (actual poll drives final completion)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Hold at 95 until data ready
        return prev + Math.random() * 3;
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background progress number */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className="font-syne font-extrabold text-[25vw] leading-none text-ash opacity-5 tracking-tighter">
          {String(Math.min(Math.round(progress), 99)).padStart(2, "0")}
        </span>
      </div>

      {/* SVG Natal Chart */}
      <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px] z-10 chart-glow">
        <svg
          ref={chartRef}
          id="natal-chart"
          viewBox="0 0 500 500"
          className="w-full h-full"
        >
          <g id="outer-wheel" />
          <g id="inner-wheel" />
          <circle
            cx="250"
            cy="250"
            r="4"
            fill="#FF2A00"
            className="blinking-dot"
          />
          <circle
            cx="250"
            cy="250"
            r="12"
            stroke="#FF2A00"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Status text + progress bar */}
      <div className="absolute bottom-32 md:bottom-40 flex flex-col items-center z-20">
        <div className="h-6 overflow-hidden relative w-full text-center flex items-center justify-center">
          <span className="text-xs md:text-sm tracking-[0.15em] text-blood uppercase">
            {STATUSES[statusIndex]}
          </span>
        </div>
        <div className="w-64 h-[1px] bg-bruise mt-4 relative overflow-hidden">
          <div
            ref={progressRef}
            className="absolute top-0 left-0 h-full bg-blood transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 w-full text-center z-20 pointer-events-none">
        <p className="text-[10px] md:text-xs tracking-[0.3em] text-ash/40 uppercase">
          The stars don&apos;t sugarcoat. Neither do we.
        </p>
      </footer>

      {/* Red flash overlay */}
      <div
        ref={flashRef}
        className="fixed inset-0 bg-blood opacity-0 pointer-events-none z-[100]"
      />
    </div>
  );
}

// Expose a way for the parent to set progress to 100
LoadingAnimation.displayName = "LoadingAnimation";
