"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShareButton from "./ShareButton";
import PaywallCTA from "./PaywallCTA";

interface TeaserViewProps {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string;
  teaser: string;
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

export default function TeaserView({
  name,
  sunSign,
  moonSign,
  rising,
  teaser,
  roastId,
}: TeaserViewProps) {
  const [showPaywall, setShowPaywall] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered paywall: appears after user scrolls past 3rd paragraph
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowPaywall(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline();
    tl.from(".dossier", {
      y: -30,
      opacity: 0,
      duration: 1.2,
      ease: "power4.out",
      delay: 0.2,
    })
      .from(
        ".main-title",
        { y: 20, opacity: 0, duration: 1, ease: "power4.out" },
        "-=0.8",
      )
      .from(
        ".teaser-block",
        { borderColor: "transparent", duration: 0.8, ease: "power2.out" },
        "-=0.6",
      )
      .from(
        ".teaser-p",
        {
          y: 25,
          opacity: 0,
          duration: 1.2,
          stagger: 0.3,
          ease: "power3.out",
        },
        "-=0.8",
      )
      .from(".share-wrapper", { opacity: 0, duration: 1 }, "-=0.4")
      .from(
        ".paywall-ui",
        { y: 100, opacity: 0, duration: 1.5, ease: "power4.out" },
        "-=1",
      );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // Split teaser into paragraphs
  const teaserParagraphs = teaser.split("\n\n").filter((p) => p.trim());

  return (
    <>
      <main className="max-w-2xl mx-auto px-6 pt-16 pb-80 relative z-10">
        {/* Dossier Header */}
        <header className="dossier border border-bruise bg-void p-5 mb-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 bg-blood" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs tracking-[0.2em] uppercase text-ash/60 font-light">
            <div>
              <span className="block text-blood mb-1.5 text-[10px] font-bold">
                Subject
              </span>
              <span className="text-ash font-medium">{name}</span>
            </div>
            <div>
              <span className="block text-blood mb-1.5 text-[10px] font-bold">
                Sun
              </span>
              <span
                className="text-ash font-medium"
                style={{
                  fontFamily: "'Segoe UI Symbol', 'Apple Symbols', sans-serif",
                }}
              >
                {sunSign} {glyph(sunSign)}
              </span>
            </div>
            <div>
              <span className="block text-blood mb-1.5 text-[10px] font-bold">
                Moon
              </span>
              <span
                className="text-ash font-medium"
                style={{
                  fontFamily: "'Segoe UI Symbol', 'Apple Symbols', sans-serif",
                }}
              >
                {moonSign} {glyph(moonSign)}
              </span>
            </div>
            <div>
              <span className="block text-blood mb-1.5 text-[10px] font-bold">
                Rising
              </span>
              <span
                className="text-ash font-medium"
                style={{
                  fontFamily: "'Segoe UI Symbol', 'Apple Symbols', sans-serif",
                }}
              >
                {rising} {glyph(rising)}
              </span>
            </div>
          </div>
        </header>

        {/* Title */}
        <h1 className="main-title font-syne text-4xl md:text-5xl font-extrabold uppercase tracking-tighter mb-12 text-outline">
          Analysis Complete
        </h1>

        {/* Free Teaser with Progressive Blur */}
        <div className="teaser-block pl-6 md:pl-8 py-2 mb-8 space-y-8 text-lg md:text-xl text-ash/90 font-light leading-relaxed relative">
          {teaserParagraphs.map((p, i) => {
            // Apply progressive blur to later paragraphs
            const isLast = i === teaserParagraphs.length - 1;
            const isSecondLast = i === teaserParagraphs.length - 2;
            const blurStyle = isLast
              ? { filter: "blur(2px)", opacity: 0.5 }
              : isSecondLast
                ? { filter: "blur(0.5px)", opacity: 0.75 }
                : undefined;

            return (
              <div key={i}>
                <p className="teaser-p" style={blurStyle}>
                  {p}
                </p>
                {/* Sentinel after 4th paragraph triggers paywall */}
                {i === 3 && <div ref={sentinelRef} className="h-0" />}
              </div>
            );
          })}
          {/* Gradient fade overlay at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--color-void, #0a0a0a))",
            }}
          />
        </div>

        {/* Share */}
        <div className="share-wrapper mb-20 pl-6 md:pl-8">
          <ShareButton roastId={roastId} />
        </div>
      </main>

      {/* Scroll-triggered paywall */}
      <div
        className={`transition-all duration-700 ease-out ${
          showPaywall
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0"
        }`}
      >
        <PaywallCTA roastId={roastId} />
      </div>
    </>
  );
}
