import { getCityData } from "./cities.ts";

export interface ResolvedBirthLocation {
  city: string;
  lat: number;
  lon: number;
  tz: string;
  knownCoordinates: boolean;
}

export function normalizeBirthLocation(city: string): string {
  return city.trim().replace(/\s+/g, " ");
}

export function resolveBirthLocation(city: string): ResolvedBirthLocation {
  const normalizedCity = normalizeBirthLocation(city);
  const cityData = getCityData(normalizedCity);

  if (cityData) {
    return {
      city: normalizedCity,
      lat: cityData.lat,
      lon: cityData.lon,
      tz: cityData.tz,
      knownCoordinates: true,
    };
  }

  return {
    city: normalizedCity,
    lat: 0,
    lon: 0,
    tz: "UTC",
    knownCoordinates: false,
  };
}

export function buildFreeformChartContext(input: {
  name: string;
  date: string;
  time: string | null;
  city: string;
}): string {
  return [
    `Name: ${input.name}`,
    `Birth date: ${input.date}`,
    `Birth time: ${input.time || "unknown"}`,
    `Birth location: ${input.city}`,
    "",
    "The user entered this birth location as free text, so exact coordinates and timezone were not verified against the built-in city database.",
    "Do not mention houses, Ascendant, Midheaven, chart ruler, exact degrees, or time-sensitive angles unless the supplied location can be resolved elsewhere from context.",
    "Use the supplied date, optional time, and location text as the basis for a comedic astrology roast. Keep the reading honest about uncertainty without becoming an error message.",
  ].join("\n");
}
