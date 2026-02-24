export interface BirthDetails {
  name: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  city: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface RoastData {
  status: "generating" | "ready" | "error";
  name: string;
  sunSign?: string;
  moonSign?: string;
  rising?: string;
  mercury?: string;
  venus?: string;
  mars?: string;
  jupiter?: string;
  saturn?: string;
  teaser?: string;
  sections?: RoastSection[];
  paid: boolean;
  createdAt: number;
  error?: string;
}

export interface RoastSection {
  title: string;
  content: string;
  callout?: string;
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
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  city: string;
}

export interface GenerateResponse {
  id: string;
}
