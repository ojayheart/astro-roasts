"use client";

import { useEffect, useState, useRef, useId } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HumanDesignChart from "./HumanDesignChart";
import "./ChartExplorer.css";
import {
  enumerateElements,
  enumerateDuoElements,
} from "@/lib/chart-annotations";
import NatalWheel, { type HoverInfo } from "./NatalWheel";
import { useRoastCharts, type RoastCharts } from "@/lib/use-roast-charts";
import type { ChartAnnotations, WheelSelection } from "@/lib/chart-annotations";

const KIND_LABEL: Record<WheelSelection["kind"], string> = {
  planet: "Placement",
  angle: "Angle",
  aspect: "Aspect",
  house: "House",
  sign: "Sign",
  synastry: "Between you",
};

// The subject's real natal wheel on teaser/full roast pages. Fetches the
// cached chart via /api/chart (computes + caches on first call); renders
// nothing when the chart can't be resolved so the dossier layout collapses
// cleanly. On the full roast, the wheel is interactive — hover/click any
// element for a witty, roast-tied read (lazily generated + cached server-side).
export default function RoastWheel({
  roastId,
  caption,
  names,
  charts: providedCharts,
}: {
  roastId: string;
  caption: string;
  /** Subject names in position order. Two → the wheel draws the pair. */
  names?: string[];
  /** Already-fetched charts from the parent, to avoid a second round trip. */
  charts?: RoastCharts;
}) {
  const fetched = useRoastCharts(providedCharts ? "" : roastId);
  const { chart, charts } = providedCharts ?? fetched;
  // Two charts → bi-wheel. One → the solo wheel, exactly as before.
  const partner = charts?.[1] ?? null;

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState(0);
  const [person, setPerson] = useState(0);
  const [allAspects, setAllAspects] = useState(true);
  const [zoom, setZoom] = useState(1);
  const start = useRef<{ x: number; y: number } | null>(null);
  const uid = useId();
  const detailRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<ChartAnnotations | null>(null);
  const [selected, setSelected] = useState<WheelSelection | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    // Opening the charts moves the roast's scroll-triggered paragraphs.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (
      selected &&
      window.matchMedia("(max-width:680px)").matches &&
      detailRef.current
    ) {
      detailRef.current.focus({ preventScroll: true });
      window.scrollTo({
        top:
          detailRef.current.getBoundingClientRect().top + window.scrollY - 24,
        behavior: "instant",
      });
    }
  }, [selected]);
  // Once the chart exists, fetch the per-element copy. First call for a paid
  // roast generates + caches the witty lines (one Opus pass); later calls and
  // unpaid roasts return instantly. Failure retains deterministic chart facts and the authored fallback.
  useEffect(() => {
    if (!chart || !roastId || !expanded) return;
    setAnnotations(null);
    let cancelled = false;
    fetch("/api/chart-annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roastId }),
    })
      .then((res) => (res.ok ? res.json() : { annotations: null }))
      .then((data: { annotations: ChartAnnotations | null }) => {
        if (!cancelled && data?.annotations) setAnnotations(data.annotations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chart, roastId, expanded]);

  if (!chart) return null;

  const elements = partner
    ? enumerateDuoElements(chart, partner, {
        nameA: names?.[0],
        nameB: names?.[1],
      })
    : enumerateElements(chart);
  const facts = elements.find((e) => e.id === selected?.id);
  const detail = selected ? annotations?.[selected.id] : undefined;

  return (
    <figure className="chart-explorer my-8 md:my-10">
      <details
        className="chart-disclosure"
        onToggle={(event) => {
          setExpanded(event.currentTarget.open);
          setHover(null);
        }}
      >
        <summary className="chart-disclosure-toggle">
          <span>
            <span className="chart-disclosure-title">Explore your charts</span>
            <span className="chart-disclosure-meta">
              Astrology &amp; Human Design
            </span>
          </span>
          <span className="chart-disclosure-icon" aria-hidden="true" />
        </summary>
        <div className="natal-wheel-scope relative border-t border-ash/10 p-4 md:p-6">
          {expanded && (
            <>
              {/* Glyph <text> nodes carry no font-family — steer them to the
            self-hosted symbols font. Plus the interaction states: dim the
            wheel on selection, light the chosen element + hovered element. */}
              <style>{`
          .natal-wheel-scope svg text:not([font-family]) { font-family: var(--font-symbols), system-ui, sans-serif; }
          .natal-wheel-scope svg [data-el-id] { transition: opacity .15s ease, filter .15s ease; }
          .natal-wheel-scope svg.has-selection [data-el-id] { opacity: .26; }
          .natal-wheel-scope svg.has-selection [data-el-id].is-selected { opacity: 1; filter: drop-shadow(0 0 5px rgba(255,42,0,.55)); }
          .natal-wheel-scope svg [data-el-id].is-hover { opacity: 1; filter: drop-shadow(0 0 6px rgba(255,42,0,.85)); }
        `}</style>
              <div
                className="chart-tabs"
                role="tablist"
                aria-label="Chart type"
              >
                {["Astrology", "Human Design"].map((label, i) => (
                  <button
                    key={label}
                    id={uid + "-tab-" + i}
                    role="tab"
                    aria-selected={tab === i}
                    aria-controls={uid + "-panel"}
                    tabIndex={tab === i ? 0 : -1}
                    onClick={() => {
                      setTab(i);
                      setHover(null);
                    }}
                    onKeyDown={(e) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          e.key,
                        )
                      ) {
                        e.preventDefault();
                        const next =
                          e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - tab;
                        setTab(next);
                        document.getElementById(uid + "-tab-" + next)?.focus();
                      }
                    }}
                  >
                    0{i + 1} / {label}
                  </button>
                ))}
              </div>
              <p className="chart-hint">
                Swipe left or right to switch charts. Or use the tabs above.
              </p>
              <div
                id={uid + "-panel"}
                role="tabpanel"
                aria-labelledby={uid + "-tab-" + tab}
                className="chart-swipe"
                onTouchStart={(e) => {
                  if (
                    (e.target as Element).closest("[data-chart-zoomed=true]")
                  ) {
                    start.current = null;
                    return;
                  }
                  if (e.touches.length === 1)
                    start.current = {
                      x: e.touches[0].clientX,
                      y: e.touches[0].clientY,
                    };
                }}
                onTouchCancel={() => {
                  start.current = null;
                }}
                onTouchEnd={(e) => {
                  const p = start.current;
                  start.current = null;
                  if (!p) return;
                  const t = e.changedTouches[0],
                    dx = t.clientX - p.x,
                    dy = t.clientY - p.y;
                  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    setTab(dx < 0 ? 1 : 0);
                    setHover(null);
                  }
                }}
              >
                {tab === 1 ? (
                  <>
                    {partner && (
                      <label className="chart-controls">
                        Whose Human Design?
                        <select
                          value={person}
                          onChange={(e) => setPerson(Number(e.target.value))}
                        >
                          <option value={0}>{names?.[0] || chart.name}</option>
                          <option value={1}>
                            {names?.[1] || partner.name}
                          </option>
                        </select>
                      </label>
                    )}
                    <HumanDesignChart
                      chart={person === 1 && partner ? partner : chart}
                    />
                  </>
                ) : (
                  <>
                    <div className="chart-controls">
                      <p>
                        Placements = where · Houses = life areas · Lines =
                        relationships
                      </p>
                      <button
                        aria-pressed={allAspects}
                        onClick={() => setAllAspects(!allAspects)}
                      >
                        {allAspects
                          ? "Focus on placements"
                          : "Show aspect connections"}
                      </button>
                    </div>
                    <div className="chart-layout">
                      <div className={allAspects ? "" : "natal-key-only"}>
                        <div
                          className="chart-zoom"
                          role="group"
                          aria-label="Astrology chart zoom"
                        >
                          <button
                            disabled={zoom === 1}
                            onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                            aria-label="Zoom out"
                          >
                            −
                          </button>
                          <output>{zoom * 100}%</output>
                          <button
                            disabled={zoom === 2.5}
                            onClick={() => setZoom(Math.min(2.5, zoom + 0.5))}
                            aria-label="Zoom in"
                          >
                            +
                          </button>
                        </div>
                        <div
                          className="chart-map-scroll"
                          data-chart-zoomed={zoom > 1}
                        >
                          <div
                            ref={wheelRef}
                            style={{
                              width: `${zoom * 100}%`,
                            }}
                            className="mx-auto aspect-square"
                          >
                            <NatalWheel
                              chart={chart}
                              partner={partner}
                              names={
                                partner
                                  ? [
                                      names?.[0] || chart.name,
                                      names?.[1] || partner.name,
                                    ]
                                  : undefined
                              }
                              onSelect={setSelected}
                              onHover={setHover}
                              selectedId={selected?.id ?? null}
                            />
                          </div>
                        </div>
                      </div>
                      <aside className="chart-reader">
                        <small>START WITH A PLACEMENT</small>
                        <div className="chart-placements">
                          {elements
                            .filter(
                              (e) => e.kind === "planet" || e.kind === "angle",
                            )
                            .map((e) => (
                              <button
                                key={e.id}
                                className="chart-row"
                                aria-pressed={selected?.id === e.id}
                                onClick={() => setSelected(e)}
                              >
                                <strong>{e.title}</strong>
                                <span>
                                  {e.facts.split(" · ").slice(0, 2).join(" · ")}
                                </span>
                              </button>
                            ))}
                        </div>
                        <p className="chart-hint">
                          Select a placement here or on the chart. Its exact
                          position stays attached to the explanation.
                        </p>
                        {/* First-run affordance — make it unmistakable the wheel is alive.
            Retires the moment they pin a read. */}
                        {!selected && (
                          <div className="mt-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/45 select-none">
                            <span className="w-6 h-px bg-blood/70 shrink-0" />
                            <span>
                              {partner
                                ? "tap any mark — the lines between are you two"
                                : "tap any mark to read it"}
                            </span>
                            <span className="inline-block w-1.5 h-3 bg-blood animate-pulse" />
                          </div>
                        )}

                        {/* Detail card — pinned read of the clicked element. */}
                        {selected && (
                          <div
                            ref={detailRef}
                            tabIndex={-1}
                            className="chart-detail mt-2 border-t border-ash/10 pt-4"
                          >
                            <button
                              className="chart-return"
                              onClick={() =>
                                wheelRef.current?.scrollIntoView({
                                  block: "center",
                                  behavior: "instant",
                                })
                              }
                            >
                              ↑ Back to graph
                            </button>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-blood">
                                  {KIND_LABEL[selected.kind]}
                                </div>
                                <div
                                  className="mt-1 text-ash text-xl leading-none"
                                  style={{
                                    fontFamily: "var(--font-symbols), inherit",
                                  }}
                                >
                                  {selected.title}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelected(null)}
                                aria-label="Close"
                                className="shrink-0 font-mono text-ash/40 hover:text-ash transition-colors text-sm"
                              >
                                ✕
                              </button>
                            </div>
                            {(facts?.facts || detail?.facts) && (
                              <div className="mt-2 font-mono text-[11px] text-ash/50">
                                {facts?.facts || detail?.facts}
                              </div>
                            )}
                            {detail?.line ? (
                              <p className="mt-3 text-ash/90 leading-relaxed">
                                {detail.line}
                              </p>
                            ) : (
                              <p className="mt-3 text-ash/40 italic text-sm">
                                {selected.kind === "aspect" ||
                                selected.kind === "synastry"
                                  ? "Two chart factors, one conversation. The aspect describes how they interact; the orb tells you how close the connection is."
                                  : selected.kind === "planet"
                                    ? "The planet is the character. The sign is its style. The house is where it makes everyone else deal with it."
                                    : "Your chart has supplied the coordinates. The consequences remain your department."}
                              </p>
                            )}
                          </div>
                        )}
                      </aside>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/50 flex items-center gap-4">
                <span className="w-8 h-px bg-blood shrink-0" />
                {caption}
              </p>
            </>
          )}
        </div>
      </details>

      {/* Hover tooltip — follows the pointer, names the element. */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 font-mono text-[10px] uppercase tracking-[0.2em] text-ash bg-void/90 border border-ash/20 px-2 py-1"
          style={{
            left: hover.x + 14,
            top: hover.y + 14,
            fontFamily: "var(--font-symbols), inherit",
          }}
        >
          {hover.title}
        </div>
      )}
    </figure>
  );
}
