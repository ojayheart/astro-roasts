/**
 * Daily and forecast generation for the subscription app.
 *
 * Transits come from the runner's transits.py; the writing goes through
 * lib/roast-model.ts (metered API, cached voice block) — never the claude CLI.
 * Monthly and yearly fan out through the Batch API.
 */

import {
  collectBatch,
  complete,
  submitBatch,
  type BatchItem,
  type Deps,
} from "./roast-model.ts";
import {
  dailyTransits,
  formatCalendar,
  formatDaily,
  monthTransits,
  yearTransits,
  type BirthInput,
  type CalendarTransits,
  type DailyTransits,
} from "./transits.ts";

export type DailyRoast = {
  title: string;
  goldLine: string;
  body: string;
};

export type Forecast = {
  title: string;
  body: string;
  highlights: string[];
  avoid: string[];
};

const DAILY_FORMAT = `Write today's roast for this person. One tight paragraph, 90-140 words, in your voice. Read the transits below as pressure on their natal chart, not as horoscope filler. Nothing generic — if it would apply to anyone, cut it.

Output EXACTLY:
TITLE: <five words or fewer>
GOLD: <one sentence, the line that would land as a phone notification>
BODY:
<the paragraph>`;

const FORECAST_FORMAT = `Write the forecast for this window. Three to five short paragraphs, in your voice. The transits below are intervals — say when the pressure lands and what it does to them, not what it means abstractly.

Output EXACTLY:
TITLE: <six words or fewer>
HIGHLIGHTS:
- <up to four, one line each>
AVOID:
- <up to three, one line each>
BODY:
<the prose>`;

export function buildDailyPrompt(t: DailyTransits): string {
  return `${t.name}, ${t.date} (${t.tz})${t.has_birth_time ? "" : " — no birth time, so no houses, Ascendant, MC or chart ruler"}.

Today's transits, tightest first:
${formatDaily(t)}`;
}

export function buildForecastPrompt(t: CalendarTransits): string {
  return `${t.name}, ${t.start} to ${t.end} (${t.tz})${t.has_birth_time ? "" : " — no birth time, so no houses, Ascendant, MC or chart ruler"}.

Transit windows, tightest first:
${formatCalendar(t)}`;
}

function section(raw: string, label: string): string {
  const match = raw.match(
    new RegExp(`(?:^|\\n)${label}:[ \\t]*\\n?([\\s\\S]*?)(?=\\n[A-Z]{4,}:|$)`),
  );
  return (match?.[1] ?? "").trim();
}

function bullets(raw: string, label: string): string[] {
  return section(raw, label)
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function parseDaily(raw: string): DailyRoast {
  return {
    title: section(raw, "TITLE"),
    goldLine: section(raw, "GOLD"),
    body: section(raw, "BODY"),
  };
}

export function parseForecast(raw: string): Forecast {
  return {
    title: section(raw, "TITLE"),
    body: section(raw, "BODY"),
    highlights: bullets(raw, "HIGHLIGHTS"),
    avoid: bullets(raw, "AVOID"),
  };
}

export type GenerateOptions = {
  birth: BirthInput;
  voicePreset?: string;
};

export async function generateDaily(
  { birth, voicePreset }: GenerateOptions,
  date: string,
  deps: Deps = {},
): Promise<{ roast: DailyRoast; transits: DailyTransits } | null> {
  const transits = await dailyTransits(birth, date, deps.fetch);
  if (!transits) return null;

  const { text } = await complete(
    {
      prompt: buildDailyPrompt(transits),
      system: DAILY_FORMAT,
      voice: { hasBirthTime: transits.has_birth_time, voicePreset },
      maxTokens: 1024,
    },
    deps,
  );
  return { roast: parseDaily(text), transits };
}

export async function generateForecast(
  { birth, voicePreset }: GenerateOptions,
  period:
    | { kind: "month"; year: number; month: number }
    | { kind: "year"; start: string },
  deps: Deps = {},
): Promise<{ forecast: Forecast; transits: CalendarTransits } | null> {
  const transits =
    period.kind === "month"
      ? await monthTransits(birth, period.year, period.month, deps.fetch)
      : await yearTransits(birth, period.start, deps.fetch);
  if (!transits) return null;

  const { text } = await complete(
    {
      prompt: buildForecastPrompt(transits),
      system: FORECAST_FORMAT,
      voice: { hasBirthTime: transits.has_birth_time, voicePreset },
    },
    deps,
  );
  return { forecast: parseForecast(text), transits };
}

export type ForecastJob = {
  customId: string;
  transits: CalendarTransits;
  voicePreset?: string;
};

/** Monthly and yearly cohorts — 50% off, and neither is latency-bound. */
export function forecastBatchItems(jobs: ForecastJob[]): BatchItem[] {
  return jobs.map((job) => ({
    customId: job.customId,
    prompt: buildForecastPrompt(job.transits),
    system: FORECAST_FORMAT,
    voice: {
      hasBirthTime: job.transits.has_birth_time,
      voicePreset: job.voicePreset,
    },
  }));
}

export async function submitForecastBatch(
  jobs: ForecastJob[],
  deps: Deps = {},
): Promise<{ batchId: string; model: string }> {
  return submitBatch(forecastBatchItems(jobs), deps);
}

export async function collectForecastBatch(
  batchId: string,
  deps: Deps = {},
): Promise<{ customId: string; forecast?: Forecast; error?: string }[]> {
  const results = await collectBatch(batchId, deps);
  return results.map((r) =>
    "text" in r
      ? { customId: r.customId, forecast: parseForecast(r.text) }
      : { customId: r.customId, error: r.error },
  );
}
