"use client";

import { useEffect, useRef, useState } from "react";
import ZodiacAvatar from "./ZodiacAvatar";
import type { ZodiacSign } from "./zodiacPaths";

const ROAST_LINES: {
  quote: string;
  author: string;
  placement: string;
  sign: ZodiacSign;
}[] = [
  {
    quote:
      "Tea and feelings — but the tea's brewed at the temperature of the earth's core. You serve it smiling, then act surprised when someone mentions the burns. Hospitality as siege warfare. The doilies are load-bearing.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "You don't experience feelings. You undergo them, the way buildings undergo demolition. Afterwards you sweep the rubble behind the couch and call it processing.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "Two people stacked in a trench coat — and the scary one got the outside. Visitors knock and the soft one answers through the letterbox. Nobody's been past the hallway since 2019. You call this boundaries; the chart calls it a moat.",
    author: "Noor",
    placement: "Scorpio Rising",
    sign: "Scorpio",
  },
  {
    quote:
      "You text the emotional bomb, then follow up twenty minutes later with “what I meant was—”. The clarification is always longer than the detonation. Forensics could reconstruct your relationships from the edit history alone.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "You've rewritten text messages more times than most people rewrite their CVs. Every draft gets colder, and you call that maturity. Somewhere there's a museum of the warm versions you never sent.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "The 12th-house Venus is writing poetry. Mars is guarding the notebook with a sword. Nobody has read a single stanza in eleven years, and you wonder why people describe you as hard to know. The poems are good — that's the tragedy.",
    author: "Noor",
    placement: "Scorpio Rising",
    sign: "Scorpio",
  },
  {
    quote:
      "Joy has a permit system. Applications are reviewed quarterly by a committee of your worst memories. Approved fun must be completed quietly and is subject to inspection. Saturn signed off on this, and you framed the signature.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "A sommelier of your own darkness. You swirl the mood, sniff it, announce the vintage — ah yes, 2014, abandonment with oak notes. Connoisseurship is not the same as healing. But God, the cellar is impressive.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "Give her a Capricorn Ascendant so she walks into every room like she's about to chair a meeting, FIVE fire planets so the meeting is secretly a bonfire, an Aries stellium in the 3rd house so her mouth is a flamethrower that thinks it's making polite conversation.",
    author: "Imogen",
    placement: "Aries Sun",
    sign: "Aries",
  },
  {
    quote:
      "Her mind works like a duck: smooth on the surface, paddling FURIOUSLY underneath.",
    author: "Theo",
    placement: "Gemini Sun",
    sign: "Gemini",
  },
];

const ROTATION_MS = 9000;

const pad = (n: number) => String(n + 1).padStart(2, "0");

// The argument (three lines), the evidence (real roast lines) and the method
// (three steps). Static layout: reveals are CSS opacity fades, nothing is
// pinned or scroll-scrubbed, so the form is never far away.
export default function ManifestoSection({ price }: { price: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const exhibitsRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  // Auto-rotate — paused when off-screen, when the reader opts out, or under
  // prefers-reduced-motion.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;
    const el = exhibitsRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    io.observe(el);

    const id = setInterval(() => {
      if (!visibleRef.current || document.hidden) return;
      setActive((i) => (i + 1) % ROAST_LINES.length);
    }, ROTATION_MS);

    return () => {
      clearInterval(id);
      io.disconnect();
    };
  }, [paused]);

  const steps = [
    {
      title: "Tell us when and where.",
      text: "Date, place, and the time if you know it. No birth time? We leave the houses out rather than guess.",
    },
    {
      title: "We cast the actual chart.",
      text: "Every planet, placed for your exact minute and coordinates from an astronomical ephemeris. Not a sun-sign horoscope.",
    },
    {
      title: "It reads you.",
      text: `Your habits, your timing, your contradictions, in everyday scenes you will recognise. The opening is free. The whole thing is ${price}.`,
    },
  ];

  return (
    <>
      {/* The argument */}
      <section
        id="manifesto"
        className="relative w-full bg-void px-4 py-24 md:px-12 md:py-40 lg:px-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_50%,rgba(26,5,0,0.9)_0%,rgba(3,3,3,0)_100%)]"
        />
        <div className="relative mx-auto w-full max-w-7xl">
          <h2 className="font-syne text-[clamp(1.3rem,5.6vw,5.25rem)] font-extrabold uppercase leading-[0.95] tracking-tighter">
            {[
              ["Your therapist is", "too nice.", "text-outline"],
              ["Co-star is", "too vague.", "text-outline"],
              ["The cosmos is", "neither.", "text-blood"],
            ].map(([claim, verdict, tone]) => (
              <span key={claim} className="on-view block whitespace-nowrap">
                {claim}
                <span className={`block pl-[18%] ${tone}`}>{verdict}</span>
              </span>
            ))}
          </h2>
          <p className="on-view mt-12 max-w-md text-base leading-relaxed text-ash/75 md:ml-[18%] md:mt-16 md:text-lg">
            A horoscope flatters twelve kinds of people at once. A roast is
            about one. Yours comes from your own chart, and it is specific
            enough to be uncomfortable.
          </p>
        </div>
      </section>

      {/* The evidence */}
      <section
        id="exhibits"
        aria-labelledby="exhibits-title"
        className="relative w-full scroll-mt-24 bg-void px-4 pb-24 md:px-12 md:pb-40 lg:px-16"
      >
        <div
          ref={exhibitsRef}
          className="mx-auto w-full max-w-7xl border-t border-ash/15 pt-6"
        >
          <div className="flex items-baseline justify-between gap-6">
            <h2
              id="exhibits-title"
              className="font-mono text-xs uppercase tracking-[0.2em] text-blood"
            >
              What the chart actually said
            </h2>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="interactive -my-3 min-h-[44px] font-mono text-[11px] uppercase tracking-[0.2em] text-ash/55 transition-colors hover:text-blood"
            >
              {paused ? "Play" : "Pause"}
            </button>
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-8 md:mt-14 lg:grid-cols-12">
            {/* Index: a ruled list on desktop, a number strip on mobile */}
            <div
              role="tablist"
              aria-label="Roast line"
              aria-orientation="vertical"
              className="-mx-4 flex overflow-x-auto px-4 lg:col-span-4 lg:mx-0 lg:block lg:overflow-visible lg:px-0"
            >
              {ROAST_LINES.map((t, i) => {
                const on = i === active;
                return (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    id={`exhibit-tab-${i}`}
                    aria-selected={on}
                    aria-controls="exhibit-panel"
                    onClick={() => {
                      setActive(i);
                      setPaused(true);
                    }}
                    className={`interactive group flex min-h-[44px] shrink-0 items-baseline gap-4 border-ash/10 px-3 text-left transition-colors duration-300 lg:w-full lg:border-b lg:px-0 lg:py-3 ${
                      on ? "text-ash" : "text-ash/40 hover:text-ash/80"
                    }`}
                  >
                    <span
                      className={`font-mono text-xs tabular-nums tracking-[0.1em] ${on ? "text-blood" : ""}`}
                    >
                      {pad(i)}
                    </span>
                    <span className="hidden font-syne text-sm font-bold uppercase tracking-tight lg:inline">
                      {t.author}
                    </span>
                    <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.18em] lg:inline">
                      {t.placement}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Every line is stacked in one grid cell, so the block is as tall
                as the longest quote and never jumps when the line changes. */}
            <div
              id="exhibit-panel"
              role="tabpanel"
              aria-labelledby={`exhibit-tab-${active}`}
              className="grid lg:col-span-8"
            >
              {ROAST_LINES.map((t, i) => (
                <figure
                  key={i}
                  aria-hidden={i !== active}
                  className={`col-start-1 row-start-1 m-0 flex flex-col justify-between gap-8 transition-opacity duration-700 ease-out ${
                    i === active ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <blockquote className="font-quote text-[1.55rem] italic leading-[1.22] text-ash md:text-[2.5rem] md:leading-[1.16]">
                    <span aria-hidden className="text-blood">
                      &ldquo;
                    </span>
                    {t.quote}
                    <span aria-hidden className="text-blood">
                      &rdquo;
                    </span>
                  </blockquote>
                  <figcaption className="flex items-center gap-3.5">
                    <ZodiacAvatar sign={t.sign} className="h-11 w-11" />
                    <div>
                      <div className="font-syne text-base font-bold uppercase leading-tight tracking-tight">
                        {t.author}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ash/50">
                        {t.placement}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The method */}
      <section
        aria-labelledby="method-title"
        className="relative w-full bg-void px-4 pb-24 md:px-12 md:pb-40 lg:px-16"
      >
        <div className="mx-auto w-full max-w-7xl">
          <h2
            id="method-title"
            className="font-mono text-xs uppercase tracking-[0.2em] text-blood"
          >
            How it goes
          </h2>
          <ol className="mt-6 border-b border-ash/15">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="on-view grid gap-x-10 gap-y-3 border-t border-ash/15 py-8 md:grid-cols-12 md:items-baseline md:py-10"
              >
                <span
                  aria-hidden
                  className="text-outline font-syne text-4xl font-extrabold leading-none tracking-tighter md:col-span-2 md:text-6xl"
                >
                  {pad(i)}
                </span>
                <h3 className="font-syne text-2xl font-extrabold uppercase leading-[0.95] tracking-tighter md:col-span-4 md:text-3xl">
                  {step.title}
                </h3>
                <p className="max-w-xl text-base leading-relaxed text-ash/75 md:col-span-6 md:text-lg">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
