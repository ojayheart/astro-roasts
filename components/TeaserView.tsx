"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShareButton from "./ShareButton";
import PaywallCTA from "./PaywallCTA";
import SignGlyph from "./SignGlyph";
import Redacted from "./Redacted";
import RoastWheel from "./RoastWheel";
import { renderEmphasis, stripEmphasis } from "./Emphasis";

interface TeaserViewProps {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string;
  teaser: string;
  roastId: string;
  subjectNames?: string[];
  extraPlacements?: {
    name: string;
    sunSign: string;
    moonSign: string;
    rising: string | null;
  }[];
  amountMinorUnits?: number;
}

export default function TeaserView({
  name,
  sunSign,
  moonSign,
  rising,
  teaser,
  roastId,
  subjectNames,
  extraPlacements,
  amountMinorUnits = 500,
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

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // Split teaser into paragraphs — show first 2 clear + 1 short blurred tease
  const allParagraphs = teaser.split("\n\n").filter((p) => p.trim());
  const teaserParagraphs = allParagraphs.slice(0, 3);

  return (
    <>
      <main className="max-w-2xl mx-auto px-6 pt-16 pb-24 relative z-10">
        {/* Dossier Header */}
        <header className="dossier border border-bruise bg-void p-5 mb-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 bg-blood" />
          <div className="space-y-6">
            {/* Person 1 (main) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs tracking-[0.2em] uppercase text-ash/60 font-light">
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Subject
                </span>
                <span className="text-ash font-medium">
                  {subjectNames?.[0] ?? name}
                </span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Sun
                </span>
                <span className="text-ash font-medium">
                  {sunSign} <SignGlyph sign={sunSign} />
                </span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Moon
                </span>
                <span className="text-ash font-medium">
                  {moonSign} <SignGlyph sign={moonSign} />
                </span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Rising
                </span>
                <span className="text-ash font-medium">
                  {rising} <SignGlyph sign={rising} />
                </span>
              </div>
            </div>

            {/* Extra people */}
            {extraPlacements?.map((ep, i) => (
              <div
                key={i}
                className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs tracking-[0.2em] uppercase text-ash/60 font-light border-t border-ash/10 pt-6"
              >
                <div>
                  <span className="block text-blood mb-1.5 text-[10px] font-bold">
                    Subject
                  </span>
                  <span className="text-ash font-medium">{ep.name}</span>
                </div>
                <div>
                  <span className="block text-blood mb-1.5 text-[10px] font-bold">
                    Sun
                  </span>
                  <span className="text-ash font-medium">
                    {ep.sunSign} <SignGlyph sign={ep.sunSign} />
                  </span>
                </div>
                <div>
                  <span className="block text-blood mb-1.5 text-[10px] font-bold">
                    Moon
                  </span>
                  <span className="text-ash font-medium">
                    {ep.moonSign} <SignGlyph sign={ep.moonSign} />
                  </span>
                </div>
                <div>
                  <span className="block text-blood mb-1.5 text-[10px] font-bold">
                    Rising
                  </span>
                  <span className="text-ash font-medium">
                    {ep.rising ?? "—"}{" "}
                    {ep.rising && <SignGlyph sign={ep.rising} />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* The subject's actual wheel — exhibit before testimony */}
        <RoastWheel roastId={roastId} caption="Exhibit A — the chart itself" />

        {/* Title */}
        <h1 className="main-title font-syne text-4xl md:text-5xl font-extrabold uppercase tracking-tighter mb-12 text-outline">
          The first findings
        </h1>

        {/* Free Teaser: 2 clear paragraphs + 1 short blurred tease, then inline paywall */}
        <div className="teaser-block pl-6 md:pl-8 py-2 mb-4 space-y-8 text-lg md:text-xl text-ash/90 font-light leading-relaxed relative">
          {teaserParagraphs.map((p, i) => {
            // Clamp the 3rd paragraph to ~160 chars; it renders FOIA-redacted
            // as the tease — bars read as "locked", unlike a blur.
            const display =
              i === 2 && p.length > 160 ? p.slice(0, 160).trimEnd() + "…" : p;

            return (
              <p key={i} className="teaser-p">
                {i === 2 ? (
                  <Redacted text={stripEmphasis(display)} />
                ) : (
                  renderEmphasis(display)
                )}
              </p>
            );
          })}
        </div>

        {/* Inline paywall — sits right under the teaser, no scroll trigger */}
        <PaywallCTA roastId={roastId} amountMinorUnits={amountMinorUnits} />

        {/* Share */}
        <div className="share-wrapper pl-6 md:pl-8">
          <ShareButton roastId={roastId} />
        </div>
      </main>
    </>
  );
}
