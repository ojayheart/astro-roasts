import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { resolveBirthLocation } from "@/lib/location";
import type { ChartResponse, NatalChart } from "@/lib/types";

export const maxDuration = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fast chart call for the loading screen. Resolves the roast's birth data to
 * coordinates and asks the runner to compute the chart deterministically
 * (natal_chart.py --json, no LLM, ~1s). Result is cached on roasts.chart_json.
 *
 * Every failure path returns 200 {chart:null} — the loading screen falls back
 * to its chart-less layout and the roast pipeline is never affected.
 */
export async function POST(req: NextRequest) {
  const nullResponse = NextResponse.json({ chart: null } as ChartResponse);

  try {
    const body = (await req.json().catch(() => ({}))) as { roastId?: unknown };
    const roastId = typeof body.roastId === "string" ? body.roastId : "";
    if (!UUID_RE.test(roastId)) return nullResponse;

    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, roastId),
      with: { user: true },
    });
    if (!roast || !roast.user) return nullResponse;

    // Cache hit
    if (roast.chartJson) {
      return NextResponse.json({
        chart: roast.chartJson as NatalChart,
      } as ChartResponse);
    }

    const { name, dob, birthTime, birthCity } = roast.user;
    const [year, month, day] = dob.split("-").map(Number);
    if (!year || !month || !day) return nullResponse;

    let hour: number | null = null;
    let minute = 0;
    if (birthTime) {
      const [h, m] = birthTime.split(":").map(Number);
      if (Number.isInteger(h)) {
        hour = h;
        minute = Number.isInteger(m) ? m : 0;
      }
    }

    // Resolve coordinates: built-in city list first, Open-Meteo geocoding
    // fallback for everywhere else (free, returns lat/lon + IANA timezone).
    let { lat, lon, tz, knownCoordinates } = resolveBirthLocation(birthCity);
    if (!knownCoordinates) {
      const [cityPartRaw, ...rest] = birthCity.split(",");
      const cityPart = cityPartRaw?.trim();
      if (!cityPart) return nullResponse;
      const countryPart = rest.join(",").trim().toLowerCase();
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityPart)}&count=5&language=en&format=json`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!geoRes.ok) return nullResponse;
      const geo = (await geoRes.json()) as {
        results?: {
          latitude?: number;
          longitude?: number;
          timezone?: string;
          country?: string;
        }[];
      };
      const candidates = (geo.results ?? []).filter(
        (r) =>
          typeof r.latitude === "number" &&
          typeof r.longitude === "number" &&
          typeof r.timezone === "string",
      );
      // A misspelled city can fuzzy-match a same-named village on the wrong
      // continent ("Taipai, Taiwan" → Indonesia). If the user gave a country,
      // require it — a wrong chart is worse than the chart-less fallback.
      const hit = countryPart
        ? candidates.find((r) =>
            (r.country ?? "").toLowerCase().includes(countryPart),
          )
        : candidates[0];
      if (!hit) return nullResponse;
      lat = hit.latitude!;
      lon = hit.longitude!;
      tz = hit.timezone!;
    }

    const runnerUrl = process.env.ROAST_RUNNER_URL;
    const runnerSecret = process.env.ROAST_RUNNER_SECRET;
    if (!runnerUrl || !runnerSecret) return nullResponse;

    const chartRes = await fetch(`${runnerUrl}/chart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runnerSecret}`,
      },
      body: JSON.stringify({
        name,
        year,
        month,
        day,
        hour,
        minute,
        lat,
        lon,
        tz,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!chartRes.ok) {
      Sentry.withScope((scope) => {
        scope.setTag("route", "/api/chart");
        scope.setContext("chart", { roastId, status: chartRes.status });
        Sentry.captureMessage("Chart runner call failed", "warning");
      });
      return nullResponse;
    }

    const chart = (await chartRes.json()) as NatalChart;
    if (chart?.schema !== 1) return nullResponse;

    await db
      .update(roasts)
      .set({ chartJson: chart })
      .where(eq(roasts.id, roastId));

    return NextResponse.json({ chart } as ChartResponse);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/chart");
      Sentry.captureException(error);
    });
    return nullResponse;
  }
}
