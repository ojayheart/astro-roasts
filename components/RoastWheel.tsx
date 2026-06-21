"use client";

import { useEffect, useState } from "react";
import NatalWheel from "./NatalWheel";
import type { ChartResponse, NatalChart } from "@/lib/types";

// The subject's real natal wheel on teaser/full roast pages. Fetches the
// cached chart via /api/chart (computes + caches on first call); renders
// nothing when the chart can't be resolved so the dossier layout collapses
// cleanly.
export default function RoastWheel({
  roastId,
  caption,
}: {
  roastId: string;
  caption: string;
}) {
  const [chart, setChart] = useState<NatalChart | null>(null);

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

  if (!chart) return null;

  return (
    <figure className="my-12 md:my-16">
      <div className="natal-wheel-scope relative border border-ash/10 bg-void p-4 md:p-8">
        {/* Glyph <text> nodes in NatalWheel carry no font-family attribute —
            steer them to the self-hosted symbols font so zodiac/planet marks
            don't fall back to OS emoji rendering. */}
        <style>{`.natal-wheel-scope svg text:not([font-family]) { font-family: var(--font-symbols), system-ui, sans-serif; }`}</style>
        <div className="absolute top-0 left-0 w-2 h-2 bg-blood" />
        <div className="max-w-[480px] mx-auto aspect-square">
          <NatalWheel chart={chart} />
        </div>
      </div>
      <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/50 flex items-center gap-4">
        <span className="w-8 h-px bg-blood shrink-0" />
        {caption}
      </figcaption>
    </figure>
  );
}
