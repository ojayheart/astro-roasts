"use client";

import { useEffect, useState } from "react";
import type { ChartResponse, NatalChart } from "./types";

export type RoastCharts = {
  /** Person 1's chart, or null while loading / unresolvable. */
  chart: NatalChart | null;
  /** Both charts in position order on a duo roast, else null. */
  charts: [NatalChart, NatalChart] | null;
};

/**
 * Fetch a roast's cached natal charts. `/api/chart` computes and caches on the
 * first call, so repeat callers are a cheap DB read.
 *
 * Shared by the wheel and the placements block so a duo roast can give both
 * people the same set of placements — before this, person 2 existed only as
 * the sun/moon/rising that survived in extra_placements.
 */
export function useRoastCharts(roastId: string): RoastCharts {
  const [state, setState] = useState<RoastCharts>({
    chart: null,
    charts: null,
  });

  useEffect(() => {
    // Empty id means the parent already has the charts — don't fetch at all.
    if (!roastId) return;
    let cancelled = false;
    fetch("/api/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roastId }),
    })
      .then((res) => (res.ok ? res.json() : { chart: null }))
      .then((data: ChartResponse) => {
        if (cancelled) return;
        const pair =
          data?.charts?.length === 2
            ? ([data.charts[0], data.charts[1]] as [NatalChart, NatalChart])
            : null;
        setState({ chart: pair?.[0] ?? data?.chart ?? null, charts: pair });
      })
      .catch(() => {
        // The wheel is decoration-plus — the roast must never depend on it.
      });
    return () => {
      cancelled = true;
    };
  }, [roastId]);

  return state;
}
