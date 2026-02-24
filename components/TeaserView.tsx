"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShareButton from "./ShareButton";

interface TeaserViewProps {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string;
  teaser: string;
  sectionHeaders: string[];
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

// Placeholder text for blurred sections
const BLUR_PLACEHOLDER =
  "The patterns encoded in your chart reveal something you already suspect but refuse to acknowledge. Every placement, every aspect, every house cusp points toward a singular truth that you have been carefully constructing elaborate defenses against for your entire life.";

export default function TeaserView({
  name,
  sunSign,
  moonSign,
  rising,
  teaser,
  sectionHeaders,
  roastId,
}: TeaserViewProps) {
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

    // Blur section reveals
    document.querySelectorAll(".blur-section").forEach((section) => {
      const targetOpacity = section.getAttribute("data-opacity") || "0.3";
      gsap.fromTo(
        section,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: parseFloat(targetOpacity),
          duration: 1.5,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 85%",
            end: "top 60%",
            toggleActions: "play none none reverse",
          },
        },
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // Split teaser into paragraphs
  const teaserParagraphs = teaser.split("\n\n").filter((p) => p.trim());

  const blurLevels = [
    { blur: 1, opacity: 0.7 },
    { blur: 2, opacity: 0.5 },
    { blur: 3, opacity: 0.35 },
    { blur: 4, opacity: 0.25 },
    { blur: 5, opacity: 0.15 },
    { blur: 6, opacity: 0.1 },
  ];

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

        {/* Free Teaser */}
        <div className="teaser-block pl-6 md:pl-8 py-2 mb-8 space-y-8 text-lg md:text-xl text-ash/90 font-light leading-relaxed">
          {teaserParagraphs.map((p, i) => (
            <p key={i} className="teaser-p">
              {p}
            </p>
          ))}
        </div>

        {/* Share */}
        <div className="share-wrapper mb-20 pl-6 md:pl-8">
          <ShareButton roastId={roastId} />
        </div>

        {/* Progressive Blur Paywall */}
        <div className="blur-container space-y-24 blur-protect">
          {sectionHeaders.map((title, i) => {
            const level = blurLevels[i] || blurLevels[blurLevels.length - 1];
            return (
              <article
                key={i}
                className="blur-section"
                data-opacity={level.opacity}
              >
                <div style={{ filter: `blur(${level.blur}px)` }}>
                  <h3 className="font-syne text-2xl md:text-3xl font-extrabold uppercase tracking-tighter mb-4 text-outline">
                    {title}
                  </h3>
                  <p className="text-lg text-ash/90 leading-relaxed font-light">
                    {BLUR_PLACEHOLDER}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
