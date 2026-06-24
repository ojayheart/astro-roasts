"use client";

import { useEffect, useState } from "react";
import NatalWheel, { type HoverInfo } from "./NatalWheel";
import type { ChartResponse, NatalChart } from "@/lib/types";
import type { ChartAnnotations, WheelSelection } from "@/lib/chart-annotations";

const KIND_LABEL: Record<WheelSelection["kind"], string> = {
  planet: "Placement",
  angle: "Angle",
  aspect: "Aspect",
  house: "House",
  sign: "Sign",
};

// The subject's real natal wheel on teaser/full roast pages. Fetches the
// cached chart via /api/chart (computes + caches on first call); renders
// nothing when the chart can't be resolved so the dossier layout collapses
// cleanly. On the full roast, the wheel is interactive — hover/click any
// element for a witty, roast-tied read (lazily generated + cached server-side).
export default function RoastWheel({
  roastId,
  caption,
}: {
  roastId: string;
  caption: string;
}) {
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [annotations, setAnnotations] = useState<ChartAnnotations | null>(null);
  const [selected, setSelected] = useState<WheelSelection | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roastId }),
    })
      .then((res) => (res.ok ? res.json() : { chart: null }))
      .then((data: ChartResponse) => {
        if (!cancelled && data?.chart) setChart(data.chart);
      })
      .catch(() => {
        // Wheel is decoration-plus — the roast must never depend on it.
      });
    return () => {
      cancelled = true;
    };
  }, [roastId]);

  // Once the chart exists, fetch the per-element copy. First call for a paid
  // roast generates + caches the witty lines (one Opus pass); later calls and
  // unpaid roasts return instantly. Failure leaves the wheel facts-less but
  // still fully interactive.
  useEffect(() => {
    if (!chart) return;
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
  }, [chart, roastId]);

  if (!chart) return null;

  const detail = selected ? annotations?.[selected.id] : undefined;

  return (
    <figure className="my-12 md:my-16">
      <div className="natal-wheel-scope relative border border-ash/10 bg-void p-4 md:p-8">
        {/* Glyph <text> nodes carry no font-family — steer them to the
            self-hosted symbols font. Plus the interaction states: dim the
            wheel on selection, light the chosen element + hovered element. */}
        <style>{`
          .natal-wheel-scope svg text:not([font-family]) { font-family: var(--font-symbols), system-ui, sans-serif; }
          .natal-wheel-scope svg [data-el-id] { transition: opacity .15s ease; }
          .natal-wheel-scope svg.has-selection [data-el-id] { opacity: .26; }
          .natal-wheel-scope svg.has-selection [data-el-id].is-selected { opacity: 1; }
          .natal-wheel-scope svg [data-el-id].is-hover { opacity: 1; }
        `}</style>
        <div className="absolute top-0 left-0 w-2 h-2 bg-blood" />
        <div className="max-w-[480px] mx-auto aspect-square">
          <NatalWheel
            chart={chart}
            onSelect={setSelected}
            onHover={setHover}
            selectedId={selected?.id ?? null}
          />
        </div>

        {/* Detail card — pinned read of the clicked element. */}
        {selected && (
          <div className="mt-2 border-t border-ash/10 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-blood">
                  {KIND_LABEL[selected.kind]}
                </div>
                <div
                  className="mt-1 text-ash text-xl leading-none"
                  style={{ fontFamily: "var(--font-symbols), inherit" }}
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
            {detail?.facts && (
              <div className="mt-2 font-mono text-[11px] text-ash/50">
                {detail.facts}
              </div>
            )}
            {detail?.line ? (
              <p className="mt-3 text-ash/90 leading-relaxed">{detail.line}</p>
            ) : (
              <p className="mt-3 text-ash/40 italic text-sm">
                Reading the chart…
              </p>
            )}
          </div>
        )}
      </div>

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

      <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/50 flex items-center gap-4">
        <span className="w-8 h-px bg-blood shrink-0" />
        {caption}
      </figcaption>
    </figure>
  );
}
