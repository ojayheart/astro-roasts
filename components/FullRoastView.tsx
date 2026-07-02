"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShareButton from "./ShareButton";
import SignGlyph from "./SignGlyph";
import RoastWheel from "./RoastWheel";
import { renderEmphasis } from "./Emphasis";

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
  fullText: string;
  callouts: string[];
  roastId: string;
  subjectNames?: string[];
  extraPlacements?: {
    name: string;
    sunSign: string;
    moonSign: string;
    rising: string | null;
  }[];
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
  fullText,
  callouts,
  roastId,
  subjectNames,
  extraPlacements,
}: FullRoastViewProps) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
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
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.utils.toArray<HTMLElement>(".gs-reveal").forEach((elem) => {
        gsap.set(elem, { autoAlpha: 1, y: 0 });
      });
    });

    return () => {
      mm.revert();
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

  // Split prose into paragraphs
  const paragraphs = fullText.split("\n\n").filter((p) => p.trim());

  // Distribute callouts evenly through the text as pull-quotes
  const calloutPositions = callouts.map((_, i) =>
    Math.floor(((i + 1) * paragraphs.length) / (callouts.length + 1)),
  );

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
            Full roast unlocked — proceed carefully
          </p>
          <h1 className="font-syne font-extrabold text-5xl sm:text-6xl md:text-7xl tracking-tighter uppercase mb-12 text-ash leading-none">
            Subject:
            <br />
            <span className="[overflow-wrap:anywhere]">{name}</span>
          </h1>

          {/* The wheel — the evidence everything below cites */}
          <RoastWheel
            roastId={roastId}
            caption="Exhibit A — the chart itself"
          />

          <h2 className="sr-only">Dossier</h2>
          <div className="border-y border-ash/10 py-8 relative bg-void">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-bruise/30 to-transparent pointer-events-none" />
            <div className="space-y-8 relative z-10">
              {/* Person 1 (main) */}
              <div>
                {subjectNames?.[0] && (
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-blood mb-4">
                    {subjectNames[0]}
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4 font-mono text-sm uppercase tracking-[0.15em] text-ash/80">
                  {placements.map((p) => (
                    <div key={p.label}>
                      <span className="block text-ash/40 text-[10px] mb-2 font-medium">
                        {p.label}
                      </span>
                      <span>
                        {p.value} <SignGlyph sign={p.value} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra people */}
              {extraPlacements?.map((ep, i) => (
                <div key={i} className="border-t border-ash/10 pt-8">
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-blood mb-4">
                    {ep.name}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4 font-mono text-sm uppercase tracking-[0.15em] text-ash/80">
                    <div>
                      <span className="block text-ash/40 text-[10px] mb-2 font-medium">
                        SUN
                      </span>
                      <span>
                        {ep.sunSign} <SignGlyph sign={ep.sunSign} />
                      </span>
                    </div>
                    <div>
                      <span className="block text-ash/40 text-[10px] mb-2 font-medium">
                        MOON
                      </span>
                      <span>
                        {ep.moonSign} <SignGlyph sign={ep.moonSign} />
                      </span>
                    </div>
                    <div>
                      <span className="block text-ash/40 text-[10px] mb-2 font-medium">
                        RISING
                      </span>
                      <span>
                        {ep.rising ?? "—"}{" "}
                        {ep.rising && <SignGlyph sign={ep.rising} />}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Continuous Prose */}
        <section
          aria-labelledby="reading-heading"
          className="border-t border-ash/10 pt-20 mt-20 gs-reveal relative"
        >
          <h2 id="reading-heading" className="sr-only">
            The reading
          </h2>
          <div className="space-y-8 text-ash/85 text-lg leading-[1.8]">
            {paragraphs.map((p, i) => {
              // Check if a callout should appear before this paragraph
              const calloutIndex = calloutPositions.indexOf(i);
              return (
                <div key={i}>
                  {calloutIndex !== -1 && callouts[calloutIndex] && (
                    <div className="callout border-l-2 border-blood pl-6 py-6 my-12 text-ash font-medium text-xl md:text-2xl leading-relaxed italic">
                      &ldquo;{renderEmphasis(callouts[calloutIndex])}&rdquo;
                    </div>
                  )}
                  <p
                    className={
                      i === 0
                        ? "first-letter:font-syne first-letter:font-extrabold first-letter:text-blood first-letter:text-6xl md:first-letter:text-7xl first-letter:leading-[0.8] first-letter:float-left first-letter:mr-3 first-letter:mt-1"
                        : undefined
                    }
                  >
                    {renderEmphasis(p)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upsell block */}
        {!extraPlacements?.length && (
          <div className="mt-16 border-t border-ash/15 pt-10 gs-reveal">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-blood mb-3">
              Next victim
            </p>
            <p className="font-syne font-bold text-2xl text-ash mb-6">
              Now do your family. €4 a head.
            </p>
            <a
              href="/?mode=family#confessional"
              className="interactive inline-block bg-ash text-void font-syne font-bold uppercase px-8 py-4 hover:bg-blood hover:text-ash transition-colors duration-300"
            >
              Roast my family
            </a>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-ash/10 pt-16 mt-32 pb-16 gs-reveal">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h3 className="font-syne font-extrabold text-2xl uppercase tracking-tight text-ash mb-2">
                Still standing?
              </h3>
              <p className="text-ash/50 text-sm">
                Share the link, or generate a fresh chart for someone else.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <ShareButton roastId={roastId} />
              <a
                href="/"
                className="interactive inline-flex items-center justify-center px-6 py-3 min-h-[44px] bg-blood text-white font-mono text-xs uppercase tracking-[0.15em] hover:bg-white hover:text-void active:bg-white active:text-void focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ash focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300"
              >
                Roast someone else
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
