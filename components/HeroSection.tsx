"use client";

import { useEffect } from "react";
import gsap from "gsap";
import AstroWheel from "./AstroWheel";

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
      {/* Background natal wheel */}
      <AstroWheel className="astro-wheel-mask absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] md:w-[min(80vw,100dvh)] h-auto text-ash pointer-events-none" />

      {/* Hero Typography — headline locked to the vertical center */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
        <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center text-center">
          <h1 className="font-syne font-extrabold text-[clamp(1.25rem,7vw,8.5rem)] leading-[0.85] tracking-tighter uppercase flex flex-col items-center">
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
