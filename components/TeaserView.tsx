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
  currency?: string;
  onUnlocked?: () => void;
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
  currency = "usd",
  onUnlocked,
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
      // Long stagger on purpose: each paragraph is a joke, and landing them
      // all inside a second buries the earlier ones. One at a time, with room
      // to read, beats a wall of funny arriving at once.
      .from(
        ".teaser-p",
        {
          y: 25,
          opacity: 0,
          duration: 1.2,
          stagger: 1.5,
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

  // Three readable paragraphs, then a short redacted 4th as the tease.
  const CLEAR_PARAGRAPHS = 3;
  const allParagraphs = teaser.split("\n\n").filter((p) => p.trim());
  const teaserParagraphs = allParagraphs.slice(0, CLEAR_PARAGRAPHS + 1);

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
        <RoastWheel roastId={roastId} caption="The material — your chart" />

        {/* Title */}
        <h1 className="main-title font-syne text-4xl md:text-5xl font-extrabold uppercase tracking-tighter mb-12 text-outline">
          The warm-up
        </h1>

        {/* Free teaser: 3 clear paragraphs + 1 redacted tease, then inline paywall */}
        <div className="teaser-block pl-6 md:pl-8 py-2 mb-4 space-y-8 text-lg md:text-xl text-ash/90 font-light leading-relaxed relative">
          {teaserParagraphs.map((p, i) => {
            // Clamp the redacted paragraph to ~160 chars; bars read as
            // "locked" in a way a blur doesn't.
            const isRedacted = i === CLEAR_PARAGRAPHS;
            const display =
              isRedacted && p.length > 160
                ? p.slice(0, 160).trimEnd() + "…"
                : p;

            return (
              <p key={i} className="teaser-p">
                {isRedacted ? (
                  <Redacted text={stripEmphasis(display)} />
                ) : (
                  renderEmphasis(display)
                )}
              </p>
            );
          })}
        </div>

        {/* Inline paywall — sits right under the teaser, no scroll trigger */}
        <PaywallCTA
          roastId={roastId}
          amountMinorUnits={amountMinorUnits}
          currency={currency}
          onUnlocked={onUnlocked}
        />

        {/* Share */}
        <div className="share-wrapper pl-6 md:pl-8">
          <ShareButton roastId={roastId} />
        </div>
      </main>
    </>
  );
}
