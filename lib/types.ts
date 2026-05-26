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
