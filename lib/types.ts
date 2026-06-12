export interface BirthDetails {
  name: string;
  email?: string;
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  placeName: string;
  countryName: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface RoastData {
  id: string;
  name: string;
  email?: string;
  status: "generating" | "ready" | "error";
  sunSign: string;
  moonSign: string;
  rising: string;
  mercurySign?: string;
  venusSign?: string;
  marsSign?: string;
  jupiterSign?: string;
  saturnSign?: string;
  teaser: string;
  fullText?: string;
  callouts?: string[];
  paid: boolean;
  createdAt?: string;
  stagePct?: number;
}

export interface ChartPlacement {
  planet: string;
  sign: string;
}

export interface HumorProfile {
  voice: string; // voice preset name
  burnRatio: string; // e.g. "3:1"
  crueltyCeiling: number; // 1-5
  warmthFloor: number; // 1-5
  secondPersonDensity: "low" | "medium" | "high";
  specificity: number; // 1-5
  escalationDepth: number; // 1-5
  encryptionLevel: number; // 1-5
  pratchettReversals: number; // 0-5
  emphasisStyle: "italics" | "CAPS" | "mixed";
  astroJargon: number; // 1-5
  pronouns: string;
}

export interface MetaphorPalette {
  centralTension: string;
  throughline: string;
  probableWorld: string;
  publicMask: string;
  privateMachinery: string;
  freshConstraint?: string;
}

export interface RoastAnalysis {
  spine: string[]; // 3-5 tightest aspects
  centralParadox: string;
  humorProfile: HumorProfile;
  metaphorPalette: MetaphorPalette;
}

export interface ValidationScore {
  dimension: string;
  score: number;
  notes: string;
}

export interface ChartData {
  formatted_output: string;
  sun_sign: string;
  moon_sign: string;
  rising_sign: string;
  mercury_sign: string;
  venus_sign: string;
  mars_sign: string;
  jupiter_sign: string;
  saturn_sign: string;
  planets: Record<
    string,
    { sign: string; house: number; deg_str: string; retrograde: boolean }
  >;
}

export interface GenerateRequest {
  name: string;
  email?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM, optional (no birth time mode)
  placeName: string;
  countryName: string;
}

// ─── Fast natal chart JSON (natal_chart.py --json via runner /chart) ────────

export type ZodiacSign =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export type AspectType =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "quincunx"
  | "opposition";

export interface ChartPoint {
  lon: number; // absolute ecliptic longitude 0-360
  sign: ZodiacSign;
  degInSign: number; // 0-30
}

export interface NatalPlanet extends ChartPoint {
  name: string; // "Sun" … "Pluto", "Chiron", "N.Node", "S.Node", "Lilith"
  house: number | null; // null when birth time unknown
  retrograde: boolean;
  speed: number;
}

export interface NatalAspect {
  a: string; // may be "Ascendant" / "MC"
  b: string;
  type: AspectType;
  orb: number;
  strength: 1 | 2 | 3 | 4 | 5;
}

export interface NatalConfiguration {
  type: string;
  planets: string[];
  detail: string;
}

export interface NatalChart {
  schema: 1;
  name: string;
  birth: {
    date: string;
    time: string | null;
    timeKnown: boolean;
    utc: string;
    tz: string;
    lat: number;
    lon: number;
    dayOfWeek: string;
    moonPhase: string;
    moonPhaseAngle: number;
    sect: "day" | "night" | null;
    chartRuler: {
      modern: string;
      traditional: string;
      ascendantSign: ZodiacSign;
    } | null;
    houseSystem: string;
  };
  planets: NatalPlanet[];
  angles: {
    ascendant: ChartPoint;
    mc: ChartPoint;
    partOfFortune: (ChartPoint & { house: number | null }) | null;
  } | null; // null entirely when timeKnown=false
  houses: number[] | null; // 12 absolute cusp longitudes, index 0 = house 1
  aspects: NatalAspect[];
  elements: Record<"Fire" | "Earth" | "Air" | "Water", string[]>;
  modalities: Record<"Cardinal" | "Fixed" | "Mutable", string[]>;
  stelliums: {
    bySign: Record<string, string[]>;
    byHouse: Record<string, string[]>;
  };
  configurations: NatalConfiguration[];
}

export type ChartResponse = { chart: NatalChart | null };
