/**
 * Transit data from the runner's deterministic transits.py --json (no LLM).
 * Same birth-argument convention as /chart, one JSON object back.
 */

export type BirthInput = {
  name: string;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number;
  lat: number;
  lon: number;
  tz: string;
};

export type TransitHit = {
  summary: string;
  transiter: string;
  aspect: string;
  target: string;
  peak_local: string;
  peak_utc: string;
  orb_deg: number;
  applying: boolean;
};

export type TransitEvent = {
  summary: string;
  transiter: string;
  aspect: string;
  target: string;
  start_local: string;
  end_local: string;
  peak_local: string;
  peak_orb_deg: number;
};

export type DailyTransits = {
  mode: "daily";
  name: string;
  date: string;
  tz: string;
  has_birth_time: boolean;
  natal: Record<string, number>;
  transits: TransitHit[];
};

export type CalendarTransits = {
  mode: "month" | "year";
  name: string;
  start: string;
  end: string;
  tz: string;
  has_birth_time: boolean;
  natal: Record<string, number>;
  events: TransitEvent[];
};

export type TransitPeriod =
  | { mode: "daily"; date: string }
  | { mode: "month"; targetYear: number; targetMonth: number }
  | { mode: "year"; start: string };

type Transits = DailyTransits | CalendarTransits;

async function fetchTransits(
  birth: BirthInput,
  period: TransitPeriod,
  doFetch: typeof fetch = fetch,
): Promise<Transits | null> {
  const runnerUrl = process.env.ROAST_RUNNER_URL;
  const runnerSecret = process.env.ROAST_RUNNER_SECRET;
  if (!runnerUrl || !runnerSecret) return null;

  const res = await doFetch(`${runnerUrl}/transits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runnerSecret}`,
    },
    body: JSON.stringify({ ...birth, ...period }),
    signal: AbortSignal.timeout(period.mode === "year" ? 150_000 : 40_000),
  });
  if (!res.ok) return null;

  const out = (await res.json()) as Transits & { error?: string };
  return out?.error ? null : out;
}

export async function dailyTransits(
  birth: BirthInput,
  date: string,
  doFetch?: typeof fetch,
): Promise<DailyTransits | null> {
  const out = await fetchTransits(birth, { mode: "daily", date }, doFetch);
  return out?.mode === "daily" ? out : null;
}

export async function monthTransits(
  birth: BirthInput,
  targetYear: number,
  targetMonth: number,
  doFetch?: typeof fetch,
): Promise<CalendarTransits | null> {
  const out = await fetchTransits(
    birth,
    { mode: "month", targetYear, targetMonth },
    doFetch,
  );
  return out?.mode === "month" ? out : null;
}

export async function yearTransits(
  birth: BirthInput,
  start: string,
  doFetch?: typeof fetch,
): Promise<CalendarTransits | null> {
  const out = await fetchTransits(birth, { mode: "year", start }, doFetch);
  return out?.mode === "year" ? out : null;
}

/** Tightest first — the prompt only ever wants the handful that matter. */
export function formatDaily(t: DailyTransits, limit = 8): string {
  const lines = [...t.transits]
    .sort((a, b) => a.orb_deg - b.orb_deg)
    .slice(0, limit)
    .map(
      (h) =>
        `- ${h.summary} — orb ${h.orb_deg.toFixed(2)}°, peaks ${h.peak_local.slice(11, 16)} local, ${h.applying ? "applying" : "separating"}`,
    );
  return lines.length ? lines.join("\n") : "- nothing tight today";
}

export function formatCalendar(t: CalendarTransits, limit = 20): string {
  const lines = [...t.events]
    .sort((a, b) => a.peak_orb_deg - b.peak_orb_deg)
    .slice(0, limit)
    .map(
      (e) =>
        `- ${e.summary} — ${e.start_local.slice(0, 10)} to ${e.end_local.slice(0, 10)}, peaks ${e.peak_local.slice(0, 10)}`,
    );
  return lines.length ? lines.join("\n") : "- nothing of note in this window";
}
