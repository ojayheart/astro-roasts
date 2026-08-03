import { resolveBirthLocation } from "./location";
import type { NatalChart } from "./types";

/**
 * Everything needed to cast one person's chart. Matches the columns on `users`
 * that both the roast owner and each roast_subject carry.
 */
export type ChartSubject = {
  name: string;
  dob: string;
  birthTime: string | null;
  birthCity: string;
};

/**
 * Normalise common country abbreviations to the full names Open-Meteo returns,
 * so "Wellington, NZ" / "London, UK" / "New York, USA" still match instead of
 * silently failing.
 */
const COUNTRY_ABBR: Record<string, string> = {
  nz: "new zealand",
  us: "united states",
  usa: "united states",
  uk: "united kingdom",
  uae: "united arab emirates",
  cz: "czechia",
  au: "australia",
  // People type their country in their own language, but the API is queried
  // with language=en and answers "Germany". Without these, "Eberbach,
  // Deutschland" scores the French Eberbach-Seltz level with the German one
  // and takes whichever the API ranked first.
  deutschland: "germany",
  österreich: "austria",
  osterreich: "austria",
  schweiz: "switzerland",
  suisse: "switzerland",
  españa: "spain",
  espana: "spain",
  brasil: "brazil",
  italia: "italy",
  nederland: "netherlands",
  polska: "poland",
  sverige: "sweden",
  norge: "norway",
  danmark: "denmark",
  suomi: "finland",
  méxico: "mexico",
  türkiye: "turkey",
  turkiye: "turkey",
  ελλάδα: "greece",
  aotearoa: "new zealand",
};

type Coordinates = { lat: number; lon: number; tz: string };

/**
 * Built-in city list first, Open-Meteo geocoding fallback for everywhere else
 * (free, returns lat/lon + IANA timezone). Returns null when the place can't be
 * resolved at all.
 */
type GeoHit = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
  population?: number;
};

/**
 * Open-Meteo indexes city names per language. Searching "Wien" in English
 * returns two hamlets in Missouri and Wisconsin — Vienna is only called Wien in
 * the German index. The country someone typed is the best available hint at
 * which index their city name lives in.
 */
const COUNTRY_LANG: Record<string, string> = {
  germany: "de",
  austria: "de",
  switzerland: "de",
  spain: "es",
  mexico: "es",
  argentina: "es",
  brazil: "pt",
  portugal: "pt",
  italy: "it",
  france: "fr",
  netherlands: "nl",
  poland: "pl",
  turkey: "tr",
  greece: "el",
  sweden: "sv",
  norway: "no",
  denmark: "da",
  finland: "fi",
  russia: "ru",
  japan: "ja",
  china: "zh",
  korea: "ko",
};

async function geocode(query: string, language: string): Promise<GeoHit[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=${language}&format=json`,
    { signal: AbortSignal.timeout(4000) },
  );
  if (!res.ok) return [];
  const geo = (await res.json()) as { results?: GeoHit[] };
  return geo.results ?? [];
}

/** Loose two-way containment — "United States" should match "united states america". */
function looselyMatches(candidate: string | undefined, typed: string): boolean {
  const c = (candidate ?? "").toLowerCase();
  if (!c || !typed) return false;
  return c.includes(typed) || typed.includes(c);
}

export async function resolveCoordinates(
  birthCity: string,
): Promise<Coordinates | null> {
  const { lat, lon, tz, knownCoordinates } = resolveBirthLocation(birthCity);
  if (knownCoordinates) return { lat, lon, tz };

  const [cityPartRaw, ...rest] = birthCity.split(",");
  const cityPart = cityPartRaw?.trim();
  if (!cityPart) return null;

  const countryRaw = rest.join(",").trim().toLowerCase();
  const countryPart = COUNTRY_ABBR[countryRaw] ?? countryRaw;

  const language = COUNTRY_LANG[countryPart] ?? "en";

  // Open-Meteo matches city names, not "City State" strings — "Springfield
  // Missouri" returns nothing while "Springfield" returns three. Fall back to
  // the first token and use the dropped words to disambiguate.
  const tokens = cityPart.split(/\s+/).filter(Boolean);
  let candidates = await geocode(cityPart, language);
  let qualifiers: string[] = [];
  if (!candidates.length && tokens.length > 1) {
    candidates = await geocode(tokens[0], language);
    qualifiers = tokens.slice(1).map((t) => t.toLowerCase());
  }
  // Country hint was wrong, or the name only exists in the English index.
  if (!candidates.length && language !== "en") {
    candidates = await geocode(cityPart, "en");
  }
  if (!candidates.length) return null;

  // Rank: a hit matching both the typed region and country beats one matching
  // either, which beats the API's own ordering. Picks Springfield, Missouri
  // over Springfield, Illinois. Population breaks ties, because someone who
  // types a bare city name means the city, not the hamlet that shares its name.
  // The wheel is decorative, so a best-effort chart still beats no chart.
  // A non-English index answers in its own language ("Deutschland", not
  // "Germany"), so match against what the user typed as well as the English
  // form the alias table produced.
  const countryForms = [countryPart, countryRaw].filter(Boolean);

  const score = (r: GeoHit) => {
    let s = 0;
    if (countryForms.some((c) => looselyMatches(r.country, c))) s += 2;
    if (qualifiers.some((q) => looselyMatches(r.admin1, q))) s += 2;
    if (qualifiers.some((q) => looselyMatches(r.country, q))) s += 1;
    return s;
  };
  const hit = [...candidates].sort(
    (a, b) => score(b) - score(a) || (b.population ?? 0) - (a.population ?? 0),
  )[0];
  if (!hit?.latitude || !hit.longitude || !hit.timezone) return null;

  return { lat: hit.latitude, lon: hit.longitude, tz: hit.timezone };
}

/** Split "HH:MM" into hour/minute, or hour null when the birth time is unknown. */
export function parseBirthTime(birthTime: string | null): {
  hour: number | null;
  minute: number;
} {
  if (!birthTime) return { hour: null, minute: 0 };
  const [h, m] = birthTime.split(":").map(Number);
  if (!Number.isInteger(h)) return { hour: null, minute: 0 };
  return { hour: h, minute: Number.isInteger(m) ? m : 0 };
}

/**
 * Cast one person's chart via the runner's deterministic natal_chart.py --json
 * (no LLM, ~1s). Returns null on any failure — every caller treats a missing
 * chart as "render the chart-less layout", never as an error worth surfacing.
 */
export async function computeChart(
  subject: ChartSubject,
): Promise<NatalChart | null> {
  const [year, month, day] = subject.dob.split("-").map(Number);
  if (!year || !month || !day) return null;

  const runnerUrl = process.env.ROAST_RUNNER_URL;
  const runnerSecret = process.env.ROAST_RUNNER_SECRET;
  if (!runnerUrl || !runnerSecret) return null;

  const coords = await resolveCoordinates(subject.birthCity);
  if (!coords) return null;

  const { hour, minute } = parseBirthTime(subject.birthTime);

  const chartRes = await fetch(`${runnerUrl}/chart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runnerSecret}`,
    },
    body: JSON.stringify({
      name: subject.name,
      year,
      month,
      day,
      hour,
      minute,
      lat: coords.lat,
      lon: coords.lon,
      tz: coords.tz,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!chartRes.ok) return null;

  const chart = (await chartRes.json()) as NatalChart;
  return chart?.schema === 1 ? chart : null;
}
