"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShareButton from "./ShareButton";
import type { RoastSection } from "@/lib/types";

interface FullRoastViewProps {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string;
  mercury: string;
  venus: string;
  mars: string;
  jupiter: string;
  saturn: string;
  sections: RoastSection[];
  roastId: string;
}

const ZODIAC_GLYPHS: Record<string, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};

function glyph(sign: string): string {
  return ZODIAC_GLYPHS[sign] || "";
}

export default function FullRoastView({
  name,
  sunSign,
  moonSign,
  rising,
  mercury,
  venus,
  mars,
  jupiter,
  saturn,
  sections,
  roastId,
}: FullRoastViewProps) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Section reveal animations
    gsap.utils.toArray<HTMLElement>(".gs-reveal").forEach((elem) => {
      gsap.fromTo(
        elem,
        { y: 60, autoAlpha: 0 },
        {
          duration: 1.2,
          y: 0,
          autoAlpha: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: elem,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        },
      );
    });

    // Progress bar
    gsap.to("#progress-fill", {
      scaleY: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.2,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  const placements = [
    { label: "SUN", value: sunSign },
    { label: "MOON", value: moonSign },
    { label: "RISING", value: rising },
    { label: "MERCURY", value: mercury },
    { label: "VENUS", value: venus },
    { label: "MARS", value: mars },
    { label: "JUPITER", value: jupiter },
    { label: "SATURN", value: saturn },
  ];

  return (
    <>
      {/* Scroll Progress */}
      <div className="progress-container">
        <div className="progress-fill" id="progress-fill" />
      </div>

      <main className="max-w-3xl mx-auto px-6 py-24 md:py-32 relative z-10">
        {/* Header Dossier */}
        <header className="mb-32 gs-reveal">
          <p className="font-mono text-[10px] md:text-xs uppercase tracking-[0.15em] text-blood mb-6 flex items-center gap-4">
            <span className="w-12 h-px bg-blood" />
            RESTRICTED CLEARANCE // DO NOT DISTRIBUTE
          </p>
          <h1 className="font-syne font-extrabold text-6xl md:text-8xl tracking-tighter uppercase mb-12 text-ash leading-none">
            Subject:
            <br />
            {name}
          </h1>

          <div className="border-y border-ash/10 py-8 relative bg-void">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-bruise/30 to-transparent pointer-events-none" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4 font-mono text-sm uppercase tracking-[0.15em] text-ash/80 relative z-10">
              {placements.map((p) => (
                <div key={p.label}>
                  <span className="block text-ash/40 text-[10px] mb-2 font-medium">
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "'Segoe UI Symbol', 'Apple Symbols', sans-serif",
                    }}
                  >
                    {p.value} {glyph(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Sections */}
        {sections.map((section, i) => (
          <section
            key={i}
            className="border-t border-ash/10 pt-20 mt-20 gs-reveal relative"
          >
            <h2 className="font-syne font-extrabold text-4xl md:text-5xl tracking-tighter uppercase mb-10 text-ash">
              {String(i + 1).padStart(2, "0")} // {section.title}
            </h2>

            <div className="space-y-8 text-ash/70">
              {section.content.split("\n\n").map((p, j) => (
                <p key={j}>{p}</p>
              ))}

              {section.callout && (
                <div className="callout border-l-2 border-blood pl-6 py-6 my-12 text-ash font-medium text-xl md:text-2xl leading-relaxed italic">
                  &ldquo;{section.callout}&rdquo;
                </div>
              )}
            </div>
          </section>
        ))}

        {/* Footer */}
        <footer className="border-t border-ash/10 pt-16 mt-32 pb-16 gs-reveal">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h3 className="font-syne font-extrabold text-2xl uppercase tracking-tight text-ash mb-2">
                Survive the roast?
              </h3>
              <p className="text-ash/50 text-sm">
                Make someone else suffer. Share your dossier.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <ShareButton roastId={roastId} />
              <a
                href="/"
                className="interactive px-6 py-3 bg-blood text-white font-mono text-xs uppercase tracking-[0.15em] hover:bg-white hover:text-void transition-colors duration-300"
              >
                Get Another Roast
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
