"use client";

import { useEffect } from "react";
import gsap from "gsap";

export default function HeroSection() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const heroLines = document.querySelectorAll(".hero-line span");
      gsap.to(heroLines, {
        y: "0%",
        duration: 1.2,
        stagger: 0.2,
        ease: "power4.out",
        delay: 0.5,
      });

      gsap.to(".hero-fade", {
        opacity: 1,
        duration: 1,
        stagger: 0.3,
        ease: "power2.out",
        delay: 1.5,
      });
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".hero-line span", { y: "0%" });
      gsap.set(".hero-fade", { opacity: 1 });
    });

    return () => mm.revert();
  }, []);

  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Background SVG */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] md:w-[80vw] h-auto opacity-10 animate-spin-slow pointer-events-none"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.2"
      >
        <circle cx="50" cy="50" r="48" strokeDasharray="1 2" />
        <circle cx="50" cy="50" r="38" />
        <circle cx="50" cy="50" r="28" strokeDasharray="4 4" />
        <path
          d="M50 2 L50 98 M2 50 L98 50 M16 16 L84 84 M16 84 L84 16"
          opacity="0.5"
        />
        <polygon points="50,12 88,50 50,88 12,50" opacity="0.3" />
      </svg>

      {/* Hero Typography — headline locked to the vertical center */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
        <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center text-center clip-text">
          <h1 className="font-syne font-extrabold text-[13vw] md:text-[min(8vw,8.5rem)] leading-[0.85] tracking-tighter uppercase flex flex-col items-center">
            <div className="hero-line overflow-hidden">
              <span className="block translate-y-[100%] whitespace-nowrap">
                Stop blaming
              </span>
            </div>
            <div className="hero-line overflow-hidden">
              <span className="block translate-y-[100%] whitespace-nowrap text-outline">
                your moon
              </span>
            </div>
            <div className="hero-line overflow-hidden">
              <span className="block translate-y-[100%] whitespace-nowrap text-blood">
                sign.
              </span>
            </div>
          </h1>

          <p className="hero-fade absolute top-full left-1/2 -translate-x-1/2 mt-6 md:mt-8 w-full max-w-md text-sm md:text-base opacity-0 font-light text-ash/70 leading-relaxed">
            A radically honest, surgically precise teardown of your exact natal
            chart. We see your patterns. We know your delusions.
          </p>
        </div>
      </div>

      {/* Scroll cue — pinned to the bottom, out of the centering calc */}
      <div className="hero-fade absolute bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-0 flex flex-col items-center gap-4">
        <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">
          Scroll to face it
        </span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-ash to-transparent" />
      </div>
    </section>
  );
}
