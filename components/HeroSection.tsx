"use client";

import { useEffect } from "react";
import gsap from "gsap";

export default function HeroSection() {
  useEffect(() => {
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
  }, []);

  return (
    <section className="relative h-screen w-full flex flex-col justify-center items-center overflow-hidden px-4">
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

      {/* Hero Typography */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center text-center clip-text">
        <h1 className="font-syne font-extrabold text-[12vw] md:text-[8vw] leading-[0.85] tracking-tighter uppercase flex flex-col items-center">
          <div className="hero-line overflow-hidden">
            <span className="block translate-y-[100%]">Stop blaming</span>
          </div>
          <div className="hero-line overflow-hidden">
            <span className="block translate-y-[100%] text-outline">
              your moon
            </span>
          </div>
          <div className="hero-line overflow-hidden">
            <span className="block translate-y-[100%] text-blood">sign.</span>
          </div>
        </h1>

        <p className="hero-fade mt-8 md:mt-12 text-sm md:text-base max-w-md opacity-0 font-light text-ash/70 leading-relaxed">
          A radically honest, surgically precise teardown of your exact natal
          chart. We see your patterns. We know your delusions.
        </p>

        <div className="hero-fade mt-16 opacity-0 flex flex-col items-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">
            Scroll to face it
          </span>
          <div className="w-[1px] h-16 bg-gradient-to-b from-ash to-transparent" />
        </div>
      </div>
    </section>
  );
}
