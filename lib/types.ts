export interface BirthDetails {
  name: string;
  email?: string;
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  city: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface RoastData {
  id: string;
  name: string;
  email?: string;
  sunSign: string;
  moonSign: string;
  rising: string;
  mercurySign: string;
  venusSign: string;
  marsSign: string;
  jupiterSign: string;
  saturnSign: string;
  teaser: string;
  fullText: string;
  callouts: string[];
  paid: boolean;
  createdAt: string;
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
  city: string;
}
