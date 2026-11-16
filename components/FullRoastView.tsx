"use client";

import ShareButton from "./ShareButton";
import SignGlyph from "./SignGlyph";
import RoastWheel from "./RoastWheel";
import { renderEmphasis } from "./Emphasis";
import { formatPrice } from "@/lib/currency";
import { useRoastCharts } from "@/lib/use-roast-charts";

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
  /** What the two of them are to each other — free text, absent on solo. */
  relationship?: string;
  currency?: string;
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
  relationship,
  currency = "usd",
}: FullRoastViewProps) {
  const charts = useRoastCharts(roastId);
  const isDuo = (extraPlacements?.length ?? 0) > 0;
  const pairNames = isDuo
    ? [subjectNames?.[0] || name, extraPlacements![0].name]
    : null;
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

  // Person 2's full set, read off their real chart. The stored
  // extra_placements only ever held sun/moon/rising, which rendered them as a
  // footnote to person 1 rather than half the roast.
  const PLACEMENT_BODIES = [
    ["SUN", "Sun"],
    ["MOON", "Moon"],
    ["MERCURY", "Mercury"],
    ["VENUS", "Venus"],
    ["MARS", "Mars"],
    ["JUPITER", "Jupiter"],
    ["SATURN", "Saturn"],
  ] as const;

  const partnerPlacements = (() => {
    const partner = charts.charts?.[1];
    if (!partner) return null;
    const signOf = (body: string) =>
      partner.planets.find((p) => p.name === body)?.sign ?? "";
    const rows = [
      { label: "SUN", value: signOf("Sun") },
      { label: "MOON", value: signOf("Moon") },
      {
        label: "RISING",
        value: partner.angles?.ascendant.sign ?? "",
      },
      ...PLACEMENT_BODIES.slice(2).map(([label, body]) => ({
        label,
        value: signOf(body),
      })),
    ];
    return rows.filter((r) => r.value);
  })();

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
        <div className="progress-fill" />
      </div>

      <main className="relative z-10 mx-auto max-w-2xl px-5 py-16 md:px-6 md:py-24">
        {/* Header Dossier */}
        <header className="rise mb-20 md:mb-24">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-blood">
            {isDuo
              ? `Both charts — ${relationship || "the pair"}, no survivors`
              : "The full set — no survivors"}
          </p>
          <h1 className="mb-12 font-syne text-[clamp(2.25rem,9.5vw,5.25rem)] font-extrabold uppercase leading-[0.88] tracking-tighter text-ash">
            Tonight:
            <br />
            {pairNames ? (
              <span className="[overflow-wrap:anywhere]">
                {pairNames[0]}
                <span className="text-blood mx-3">&times;</span>
                {pairNames[1]}
              </span>
            ) : (
              <span className="[overflow-wrap:anywhere]">{name}</span>
            )}
          </h1>

          {/* The wheel — the evidence everything below cites */}
          <RoastWheel
            roastId={roastId}
            caption={
              isDuo
                ? "The material — both charts, and what they do to each other"
                : "The material — your chart"
            }
            names={pairNames ?? undefined}
            charts={charts}
          />

          <h2 className="sr-only">Placements</h2>
          <div className="border-y border-ash/15 py-8">
            <div className="space-y-8">
              {/* Person 1 (main) */}
              <div>
                {subjectNames?.[0] && (
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-blood mb-4">
                    {subjectNames[0]}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-4">
                  {placements.map((p) => (
                    <div key={p.label}>
                      <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ash/50">
                        {p.label}
                      </span>
                      <span className="mt-1.5 block font-syne text-base font-bold uppercase leading-none tracking-tight md:text-lg">
                        {p.value} <SignGlyph sign={p.value} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra people. Their real chart gives the same eight rows
                  person 1 gets; the stored three are the fallback for older
                  roasts whose second chart was never cast. */}
              {extraPlacements?.map((ep, i) => {
                const rows =
                  i === 0 && partnerPlacements?.length
                    ? partnerPlacements
                    : [
                        { label: "SUN", value: ep.sunSign },
                        { label: "MOON", value: ep.moonSign },
                        { label: "RISING", value: ep.rising ?? "" },
                      ].filter((r) => r.value);

                return (
                  <div key={i} className="border-t border-ash/10 pt-8">
                    <p className="font-mono text-xs uppercase tracking-[0.15em] text-blood mb-4">
                      {ep.name}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-4">
                      {rows.map((r) => (
                        <div key={r.label}>
                          <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ash/50">
                            {r.label}
                          </span>
                          <span className="mt-1.5 block font-syne text-base font-bold uppercase leading-none tracking-tight md:text-lg">
                            {r.value} <SignGlyph sign={r.value} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* Continuous Prose */}
        <section
          aria-labelledby="reading-heading"
          className="relative"
        >
          <h2 id="reading-heading" className="sr-only">
            The set
          </h2>
          <div className="space-y-7 text-lg leading-[1.75] text-ash/90 md:text-[1.1875rem]">
            {paragraphs.map((p, i) => {
              // Check if a callout should appear before this paragraph
              const calloutIndex = calloutPositions.indexOf(i);
              return (
                <div key={i}>
                  {calloutIndex !== -1 && callouts[calloutIndex] && (
                    <blockquote className="on-view my-14 border-y border-ash/15 py-8 font-quote text-[1.75rem] italic leading-[1.15] text-ash md:my-16 md:text-[2.5rem]">
                      &ldquo;{renderEmphasis(callouts[calloutIndex])}&rdquo;
                    </blockquote>
                  )}
                  <p
                    className={
                      i === 0
                        ? "font-quote text-[1.75rem] italic leading-[1.18] text-ash md:text-[2.1rem]"
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
          <div className="mt-20 border-t border-ash/15 pt-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-blood mb-3">
              Pass the mic
            </p>
            <p className="mb-4 font-syne text-3xl font-extrabold uppercase leading-[0.95] tracking-tighter text-ash md:text-4xl">
              Now put someone else up there with you.
            </p>
            <p className="mb-7 max-w-lg text-base leading-relaxed text-ash/70">
              Two charts, and then they get each other. Partners, exes,
              siblings, the friend who knows too much — you say what you are to
              each other and the roast goes after exactly that.{" "}
              {formatPrice(800, currency)} for the pair, warm-up free like yours
              was.
            </p>
            <a
              href="/?mode=couple#mic"
              className="cta interactive"
            >
              Roast us both
            </a>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-24 border-t border-ash/15 pb-16 pt-12">
          <div className="flex flex-col items-start gap-7">
            <div>
              <h3 className="mb-2 font-syne text-2xl font-extrabold uppercase tracking-tight text-ash">
                Still standing?
              </h3>
              <p className="text-base text-ash/70">
                Send it to whoever you were thinking about the whole way
                through.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <ShareButton roastId={roastId} />
              <a
                href="/"
                className="cta interactive"
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
