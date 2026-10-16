"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NatalWheel from "@/components/NatalWheel";
import { computeSynastry } from "@/lib/synastry";
import type { ChartPlacement, NatalChart } from "@/lib/types";

const SOLO_STATUSES = [
  "Locating your planets. Bracing for impact...",
  "Calculating exactly where it went wrong...",
  "Cross-referencing your delusions...",
  "Consulting Saturn. Saturn is disappointed...",
  "Measuring the gap between you and your potential...",
  "Asking Mercury why you said that in 2019...",
  "Tallying the red flags. Running low on ink...",
  "Translating your trauma into degrees and minutes...",
  "Notifying your rising sign. It already knew...",
  "Reviewing your texts with the Moon. Oh no...",
  "Asking Venus what that was about. She's still laughing...",
  "Checking if Mercury was retrograde. You'd have done it anyway...",
  "Pulling your file. It has its own gravity...",
  "Locating your boundaries. Expanding the search radius...",
  "Confirming with three separate planets. All three agree...",
  "Drafting an apology on the universe's behalf. Request denied...",
  "Interviewing your inner child. Lawyer present...",
  "Estimating your self-awareness. Rounding up to be kind...",
  "Counting the planets in your tenth house. Sitting down first...",
  "Running the numbers twice. They're worse the second time...",
  "Calibrating the roast. Removing the padding...",
  "Finding the part you hoped we'd miss...",
  "Sealing the chart. The universe signs in red...",
  "Almost done. You're not going to love this...",
];

/**
 * Two-chart path. The solo deck talks to one person about themselves; this one
 * talks to two people about each other, which is the thing they actually paid
 * for. `{a}` / `{b}` take the two names, `{rel}` the relationship they picked.
 */
const DUO_STATUSES = [
  "Laying the two charts on top of each other. Something is already grinding...",
  "Measuring the distance between {a} and {b}. In degrees, then in years...",
  "Finding the aspect that explains the same argument every time...",
  "Cross-referencing {a}'s Moon against {b}'s Mars. Standing back...",
  "Confirming you two are {rel}. The charts had guesses...",
  "Counting the squares between you. Running out of fingers...",
  "Locating who apologises first. It's structural...",
  "Checking whose Saturn is sitting on whose Sun. One of you knew...",
  "Reading the Venus overlay. This is where it gets specific...",
  "Timing the silence after {a} says the thing...",
  "Asking Mercury how you two communicate. Mercury is choosing words...",
  "Working out which of you is the weather and which is the barometer...",
  "Tracing the pattern back to the third week. It was always there...",
  "Weighing {b}'s side of it. Then weighing it again...",
  "Finding the trine you both lean on when it gets bad...",
  "Deciding how much of this to say out loud. All of it...",
  "Sealing both charts. Neither of you comes out of this clean...",
  "Almost done. One of you is going to screenshot this...",
];

const STATUS_ROTATION_MS = 6500;
const FACT_REVEAL_MS = 1400;
const MOBILE_FACT_ROTATION_MS = 4000;

const ASPECT_SYMBOLS: Record<string, string> = {
  conjunction: "☌",
  sextile: "✶",
  square: "□",
  trine: "△",
  quincunx: "⚻",
  opposition: "☍",
};

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** Instrument-readout lines derived from the real chart. */
function buildFacts(chart: NatalChart): string[] {
  const facts: string[] = [];
  const b = chart.birth;

  const [y, m, d] = b.date.split("-").map(Number);
  const dateLine = `${d} ${MONTHS[(m ?? 1) - 1]} ${y}${b.time ? ` · ${b.time}` : ""}`;
  facts.push(`${chart.name.toUpperCase()} — NATAL CHART`);
  facts.push(dateLine);
  facts.push(
    `${Math.abs(b.lat).toFixed(4)}°${b.lat < 0 ? "S" : "N"} ${Math.abs(b.lon).toFixed(4)}°${b.lon < 0 ? "W" : "E"}`,
  );
  facts.push(`MOON PHASE · ${b.moonPhase.toUpperCase()}`);
  if (b.sect) facts.push(`SECT · ${b.sect.toUpperCase()} CHART`);
  if (b.chartRuler) {
    facts.push(
      `CHART RULER · ${b.chartRuler.modern.toUpperCase()} (${b.chartRuler.ascendantSign.toUpperCase()} RISING)`,
    );
  }
  if (!b.timeKnown) facts.push("BIRTH TIME UNKNOWN · HOUSES WITHHELD");

  const counts = (rec: Record<string, string[]>) =>
    Object.entries(rec)
      .filter(([, v]) => v.length > 0)
      .sort((a, z) => z[1].length - a[1].length);
  const topElement = counts(chart.elements)[0];
  const topModality = counts(chart.modalities)[0];
  if (topElement && topModality) {
    facts.push(
      `${topModality[0].toUpperCase()} ×${topModality[1].length} · ${topElement[0].toUpperCase()} ×${topElement[1].length}`,
    );
  }
  const missing = Object.entries(chart.elements)
    .filter(([, v]) => v.length === 0)
    .map(([k]) => k.toUpperCase());
  if (missing.length > 0) facts.push(`${missing.join(" + ")} · ABSENT`);

  for (const [sign, planets] of Object.entries(chart.stelliums.bySign)) {
    facts.push(`STELLIUM · ${sign.toUpperCase()} ×${planets.length}`);
  }
  for (const a of chart.aspects.slice(0, 4)) {
    facts.push(
      `${a.a.toUpperCase()} ${ASPECT_SYMBOLS[a.type] ?? a.type} ${a.b.toUpperCase()} · ${a.orb.toFixed(2)}°`,
    );
  }
  for (const c of chart.configurations) {
    facts.push(
      `${c.type.toUpperCase()} · ${c.planets.map((p) => p.toUpperCase()).join(" / ")}`,
    );
  }
  return facts;
}

/** Fill {a}/{b}/{rel} and drop any placeholder we have no value for. */
function fillDuoStatus(
  line: string,
  names: string[],
  relationship: string,
): string {
  const [a, b] = names;
  return line
    .replace(/\{a\}/g, a || "person one")
    .replace(/\{b\}/g, b || "person two")
    .replace(/\{rel\}/g, relationship);
}

interface LoadingAnimationProps {
  placements?: ChartPlacement[];
  onComplete?: () => void;
  /**
   * Which loading screen to run. "duo" is the two-chart path — different
   * status deck, different footer, and the readout says which chart it's on.
   */
  mode?: "solo" | "duo";
  /** Subject names, in position order. Used by the duo statuses. */
  names?: string[];
  /** What they are to each other — free text from the form's "other". */
  relationship?: string;
  /**
   * 0-100 target reported from the server. Bar smooth-tweens toward this
   * each frame so big jumps don't snap. Defaults to a 0→88 background creep
   * over ~90s so the bar never appears stalled when callbacks haven't fired.
   */
  targetPct?: number;
  /** Fast-call natal chart. null/undefined → chart-less fallback layout. */
  chart?: NatalChart | null;
  /**
   * Person 2's chart on the duo path. Present → the wheel draws the pair while
   * they wait, which is what they bought; absent → chart 1 alone.
   */
  partnerChart?: NatalChart | null;
}

export default function LoadingAnimation({
  onComplete,
  targetPct = 0,
  chart,
  partnerChart,
  mode = "solo",
  names = [],
  relationship = "a pair",
}: LoadingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [factCount, setFactCount] = useState(0);
  const [mobileFactIndex, setMobileFactIndex] = useState(0);
  const [flash, setFlash] = useState(false);
  const completedRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  const statuses = useMemo(
    () =>
      mode === "duo"
        ? DUO_STATUSES.map((line) => fillDuoStatus(line, names, relationship))
        : SOLO_STATUSES,
    // names is a fresh array each render from the parent; key on its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, names.join("|"), relationship],
  );

  const facts = useMemo(() => {
    if (!chart) return [];
    const base = buildFacts(chart);
    if (mode !== "duo") return base;

    const [a, b] = names;
    const head = [
      `SYNASTRY · ${(a || chart.name).toUpperCase()} × ${(b || partnerChart?.name || "CHART 2").toUpperCase()}`,
    ];
    // Both charts land on the same fast call, so the readout can count the
    // contacts between them rather than announcing chart 2 as pending.
    if (partnerChart) {
      const contacts = computeSynastry(chart, partnerChart);
      const tight = contacts.filter((s) => s.strength >= 4).length;
      head.push(
        `${contacts.length} CONTACTS BETWEEN YOU · ${tight} INSIDE 2°`,
        ...(contacts[0]
          ? [
              `TIGHTEST · ${(a || "ONE").toUpperCase()}'S ${contacts[0].a.toUpperCase()} ${contacts[0].type.toUpperCase()} ${(b || "TWO").toUpperCase()}'S ${contacts[0].b.toUpperCase()}`,
            ]
          : []),
      );
    }
    return [...head, ...base.slice(1)];
  }, [chart, partnerChart, mode, names]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, STATUS_ROTATION_MS);
    return () => clearInterval(interval);
  }, [statuses.length]);

  // Reveal readout lines one by one once the chart lands.
  useEffect(() => {
    if (facts.length === 0) return;
    setFactCount(0);
    const interval = setInterval(() => {
      setFactCount((prev) => {
        if (prev >= facts.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, FACT_REVEAL_MS);
    return () => clearInterval(interval);
  }, [facts]);

  // Mobile shows one cycling readout line instead of the column.
  useEffect(() => {
    if (facts.length === 0) return;
    const interval = setInterval(() => {
      setMobileFactIndex((prev) => (prev + 1) % facts.length);
    }, MOBILE_FACT_ROTATION_MS);
    return () => clearInterval(interval);
  }, [facts]);

  // Smooth-tween toward the server-reported target. Also tick a slow
  // background creep so the bar never appears stuck when callbacks haven't
  // fired yet — caps at ~88% so we don't lie about being done.
  useEffect(() => {
    startedAtRef.current = performance.now();
    const EXPECTED_MS = 90_000; // matches p50 generation time
    const CREEP_CAP = 88;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const elapsed = performance.now() - startedAtRef.current;
        const creep = Math.min(CREEP_CAP, (elapsed / EXPECTED_MS) * CREEP_CAP);
        const target = Math.max(targetPct, creep);
        if (prev >= target) return prev;
        // Ease ~20% of the gap per tick — feels like real work landing
        // rather than a sudden snap when callbacks arrive.
        const next = prev + Math.max(0.4, (target - prev) * 0.2);
        return Math.min(target, next);
      });
    }, 120);

    return () => clearInterval(timer);
  }, [targetPct]);

  useEffect(() => {
    if (progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      setFlash(true);
      setTimeout(() => onComplete?.(), 350);
    }
  }, [progress, onComplete]);

  // Allow 100 only when targetPct hit 100 (status flipped to "ready").
  const ceiling = targetPct >= 100 ? 100 : 99;
  const clampedProgress = Math.min(Math.round(progress), ceiling);

  return (
    <div
      className="h-[100dvh] w-screen flex flex-col items-center justify-center relative overflow-hidden bg-void"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        aria-hidden="true"
      >
        <span className="font-syne font-extrabold text-[25vw] leading-none text-ash opacity-5 tracking-tighter">
          {String(clampedProgress).padStart(2, "0")}
        </span>
      </div>

      {chart ? (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-[min(72vmin,560px)] h-[min(72vmin,560px)] -translate-y-14 md:-translate-y-12">
            <NatalWheel
              chart={chart}
              partner={mode === "duo" ? partnerChart : null}
              names={
                mode === "duo" && partnerChart
                  ? [names[0] || chart.name, names[1] || partnerChart.name]
                  : undefined
              }
            />
          </div>
        </div>
      ) : null}

      {facts.length > 0 ? (
        <div
          className="absolute left-6 top-6 md:left-10 md:top-10 z-20 hidden md:flex flex-col gap-2 pointer-events-none"
          aria-hidden="true"
        >
          {facts.slice(0, factCount).map((fact, i) => (
            <span
              key={i}
              className="fact-line font-mono text-[10px] tracking-[0.2em] text-ash/45 uppercase whitespace-nowrap"
            >
              {fact}
            </span>
          ))}
        </div>
      ) : null}

      <div className="absolute bottom-24 md:bottom-32 flex flex-col items-center z-20 px-6 w-full">
        {facts.length > 0 ? (
          <span
            key={mobileFactIndex}
            className="fact-line md:hidden font-mono text-[9px] tracking-[0.25em] text-ash/40 uppercase mb-3 text-center"
            aria-hidden="true"
          >
            {facts[mobileFactIndex]}
          </span>
        ) : null}
        <div className="min-h-[3.5rem] md:min-h-[4rem] overflow-hidden relative w-full max-w-2xl text-center flex items-center justify-center">
          <span
            key={statusIndex}
            className="status-line font-syne font-extrabold text-xl md:text-3xl tracking-tight text-ash uppercase leading-tight"
          >
            {statuses[statusIndex % statuses.length]}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={
            mode === "duo" ? "Calculating charts" : "Calculating chart"
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedProgress}
          className="w-64 h-[1px] bg-bruise mt-4 relative overflow-hidden"
        >
          <div
            className="absolute top-0 left-0 h-full bg-blood transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <footer
        className="absolute bottom-0 left-0 w-full text-center z-20 pointer-events-none px-6"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        aria-hidden="true"
      >
        <p className="text-[10px] md:text-xs tracking-[0.3em] text-ash/40 uppercase">
          {mode === "duo"
            ? "Written from both charts. Neither of you is the reasonable one."
            : "Written from your chart. Delivered without a warm-up."}
        </p>
      </footer>

      <div
        className="fixed inset-0 bg-blood pointer-events-none z-[100] transition-opacity duration-150"
        style={{ opacity: flash ? 1 : 0 }}
        aria-hidden="true"
      />
    </div>
  );
}

LoadingAnimation.displayName = "LoadingAnimation";
