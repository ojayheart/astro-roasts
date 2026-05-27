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
