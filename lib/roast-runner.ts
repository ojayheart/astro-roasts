import type { PersonInput } from "./group";

export interface RoastRunnerPayload {
  roastId: string;
  name: string;
  gender: string;
  date: string;
  time: string | null;
  birthPlace: string;
  hasBirthTime: boolean;
}

export interface ChartPlacements {
  sunSign: string;
  moonSign: string;
  rising: string | null;
  mercurySign: string;
  venusSign: string;
  marsSign: string;
  jupiterSign: string;
  saturnSign: string;
}

const PLACEMENT_FIELDS = {
  Sun: "sunSign",
  Moon: "moonSign",
  Ascendant: "rising",
  Mercury: "mercurySign",
  Venus: "venusSign",
  Mars: "marsSign",
  Jupiter: "jupiterSign",
  Saturn: "saturnSign",
} as const;

const SIGN_PATTERN =
  "Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces";

export function buildRoastRunnerPayload(input: {
  roastId: string;
  name: string;
  gender: string;
  date: string;
  time: string | null;
  birthPlace: string;
}): RoastRunnerPayload {
  return {
    roastId: input.roastId,
    name: input.name,
    gender: input.gender,
    date: input.date,
    time: input.time,
    birthPlace: input.birthPlace,
    hasBirthTime: !!input.time,
  };
}

export function extractMarkedSection(raw: string, marker: string): string {
  const start = `---${marker}_START---`;
  const end = `---${marker}_END---`;

  if (!raw.includes(start) || !raw.includes(end)) {
    return "";
  }

  return raw.split(start)[1].split(end)[0].trim();
}

export function extractRoastBlock(raw: string): string {
  const roast = extractMarkedSection(raw, "ROAST");

  if (!roast) {
    return raw;
  }

  return `---ROAST_START---\n${roast}\n---ROAST_END---`;
}

export function extractChartPlacements(chartData: string): ChartPlacements {
  const placements: ChartPlacements = {
    sunSign: "",
    moonSign: "",
    rising: null,
    mercurySign: "",
    venusSign: "",
    marsSign: "",
    jupiterSign: "",
    saturnSign: "",
  };

  for (const [label, field] of Object.entries(PLACEMENT_FIELDS)) {
    const regex = new RegExp(
      `^\\s*${label}\\s+\\d{2}°\\d{2}'\\s+(${SIGN_PATTERN})\\b`,
      "m",
    );
    const sign = chartData.match(regex)?.[1] || "";

    if (field === "rising") {
      placements.rising = sign || null;
    } else {
      placements[field] = sign;
    }
  }

  return placements;
}

export interface GroupRoastRunnerPayload {
  roastId: string;
  mode: "group";
  relationship: "couple" | "family";
  people: Array<PersonInput & { hasBirthTime: boolean }>;
}

export function buildGroupRunnerPayload(input: {
  roastId: string;
  relationship: "couple" | "family";
  people: PersonInput[];
}): GroupRoastRunnerPayload {
  return {
    roastId: input.roastId,
    mode: "group",
    relationship: input.relationship,
    people: input.people.map((p) => ({ ...p, hasBirthTime: !!p.time })),
  };
}

export function extractGroupCharts(raw: string, peopleCount: number): string[] {
  return Array.from({ length: peopleCount }, (_, i) =>
    extractMarkedSection(raw, `CHART_${i + 1}`),
  );
}
