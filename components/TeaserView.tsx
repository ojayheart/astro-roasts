"use client";

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
  // Three readable paragraphs, then a short redacted 4th as the tease.
  const CLEAR_PARAGRAPHS = 3;
  const allParagraphs = teaser.split("\n\n").filter((p) => p.trim());
  const teaserParagraphs = allParagraphs.slice(0, CLEAR_PARAGRAPHS + 1);

  const people = [
    { name: subjectNames?.[0] ?? name, sunSign, moonSign, rising },
    ...(extraPlacements ?? []),
  ];
  const isDuo = people.length > 1;

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-5 pb-24 pt-14 md:px-6 md:pt-20">
      <header className="rise mb-12 md:mb-14">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-blood">
          {isDuo ? "Case file · both charts" : "Case file"}
        </p>
        <h1 className="font-syne text-[clamp(2.5rem,11vw,5rem)] font-extrabold uppercase leading-[0.88] tracking-tighter [overflow-wrap:anywhere]">
          {people.map((person, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-[0.25em] text-blood">&times;</span>}
              {person.name}
            </span>
          ))}
        </h1>

        <div className="mt-8 divide-y divide-ash/15 border-y border-ash/15">
          {people.map((person, i) => (
            <dl key={i} className="grid grid-cols-3 gap-x-4 py-4">
              {isDuo && (
                <div className="col-span-3 mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-blood">
                  {person.name}
                </div>
              )}
              {[
                ["Sun", person.sunSign],
                ["Moon", person.moonSign],
                ["Rising", person.rising],
              ].map(([label, sign]) => (
                <div key={label}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash/50">
                    {label}
                  </dt>
                  <dd className="mt-1.5 font-syne text-base font-bold uppercase leading-none tracking-tight md:text-xl">
                    {sign ? (
                      <>
                        {sign} <SignGlyph sign={sign} />
                      </>
                    ) : (
                      <span className="text-ash/40">&mdash;</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </header>

      {/* The subject's actual wheel — exhibit before testimony */}
      <RoastWheel
        roastId={roastId}
        caption={
          isDuo
            ? "The material — both charts, and what they do to each other"
            : "The material — your chart"
        }
        names={isDuo ? [people[0].name, people[1].name] : undefined}
      />

      <h2 className="mb-6 mt-12 font-mono text-xs uppercase tracking-[0.2em] text-blood">
        The warm-up
      </h2>

      {/* Free teaser: 3 clear paragraphs + 1 redacted tease, then the paywall.
          One paragraph at a time, opacity only: each is a joke and needs a
          beat, but the reader never waits long for the next one. */}
      <div className="teaser-block space-y-7 py-2 pl-5 text-lg leading-relaxed text-ash/90 md:pl-8 md:text-xl">
        {teaserParagraphs.map((p, i) => {
          // Clamp the redacted paragraph to ~160 chars; bars read as
          // "locked" in a way a blur doesn't.
          const isRedacted = i === CLEAR_PARAGRAPHS;
          const display =
            isRedacted && p.length > 160 ? p.slice(0, 160).trimEnd() + "…" : p;

          return (
            <p
              key={i}
              className="rise"
              style={{ "--d": `${250 + i * 450}ms` } as React.CSSProperties}
            >
              {isRedacted ? (
                <Redacted text={stripEmphasis(display)} />
              ) : (
                renderEmphasis(display)
              )}
            </p>
          );
        })}
      </div>

      <div
        className="rise"
        style={
          {
            "--d": `${250 + teaserParagraphs.length * 450}ms`,
          } as React.CSSProperties
        }
      >
        <PaywallCTA
          roastId={roastId}
          amountMinorUnits={amountMinorUnits}
          currency={currency}
          onUnlocked={onUnlocked}
        />

        <div className="flex justify-center">
          <ShareButton roastId={roastId} />
        </div>
      </div>
    </main>
  );
}
