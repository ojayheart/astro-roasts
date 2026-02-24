export interface CityData {
  lat: number;
  lon: number;
  tz: string;
}

export const CITIES: Record<string, CityData> = {
  // New Zealand
  "Wellington, New Zealand": {
    lat: -41.2866,
    lon: 174.7762,
    tz: "Pacific/Auckland",
  },
  "Auckland, New Zealand": {
    lat: -36.8485,
    lon: 174.7633,
    tz: "Pacific/Auckland",
  },
  "Christchurch, New Zealand": {
    lat: -43.5321,
    lon: 172.6362,
    tz: "Pacific/Auckland",
  },
  "Dunedin, New Zealand": {
    lat: -45.8788,
    lon: 170.5028,
    tz: "Pacific/Auckland",
  },
  "Hamilton, New Zealand": {
    lat: -37.787,
    lon: 175.2793,
    tz: "Pacific/Auckland",
  },
  "Tauranga, New Zealand": {
    lat: -37.6878,
    lon: 176.1651,
    tz: "Pacific/Auckland",
  },
  "Napier, New Zealand": {
    lat: -39.4928,
    lon: 176.912,
    tz: "Pacific/Auckland",
  },
  "Nelson, New Zealand": {
    lat: -41.2706,
    lon: 173.284,
    tz: "Pacific/Auckland",
  },
  "Queenstown, New Zealand": {
    lat: -45.0312,
    lon: 168.6626,
    tz: "Pacific/Auckland",
  },
  "Palmerston North, New Zealand": {
    lat: -40.3523,
    lon: 175.6082,
    tz: "Pacific/Auckland",
  },
  "Rotorua, New Zealand": {
    lat: -38.1368,
    lon: 176.2497,
    tz: "Pacific/Auckland",
  },
  "Whangarei, New Zealand": {
    lat: -35.7275,
    lon: 174.3166,
    tz: "Pacific/Auckland",
  },
  "New Plymouth, New Zealand": {
    lat: -39.0556,
    lon: 174.0752,
    tz: "Pacific/Auckland",
  },
  "Invercargill, New Zealand": {
    lat: -46.4132,
    lon: 168.3538,
    tz: "Pacific/Auckland",
  },
  // Australia
  "Sydney, Australia": { lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
  "Melbourne, Australia": {
    lat: -37.8136,
    lon: 144.9631,
    tz: "Australia/Melbourne",
  },
  "Brisbane, Australia": {
    lat: -27.4698,
    lon: 153.0251,
    tz: "Australia/Brisbane",
  },
  "Perth, Australia": { lat: -31.9505, lon: 115.8605, tz: "Australia/Perth" },
  "Adelaide, Australia": {
    lat: -34.9285,
    lon: 138.6007,
    tz: "Australia/Adelaide",
  },
  "Gold Coast, Australia": {
    lat: -28.0167,
    lon: 153.4,
    tz: "Australia/Brisbane",
  },
  "Canberra, Australia": { lat: -35.2809, lon: 149.13, tz: "Australia/Sydney" },
  "Hobart, Australia": { lat: -42.8821, lon: 147.3272, tz: "Australia/Hobart" },
  "Darwin, Australia": { lat: -12.4634, lon: 130.8456, tz: "Australia/Darwin" },
  // UK & Ireland
  "London, UK": { lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
  "Edinburgh, UK": { lat: 55.9533, lon: -3.1883, tz: "Europe/London" },
  "Manchester, UK": { lat: 53.4808, lon: -2.2426, tz: "Europe/London" },
  "Dublin, Ireland": { lat: 53.3498, lon: -6.2603, tz: "Europe/Dublin" },
  "Glasgow, UK": { lat: 55.8642, lon: -4.2518, tz: "Europe/London" },
  "Birmingham, UK": { lat: 52.4862, lon: -1.8904, tz: "Europe/London" },
  // Europe
  "Paris, France": { lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
  "Berlin, Germany": { lat: 52.52, lon: 13.405, tz: "Europe/Berlin" },
  "Amsterdam, Netherlands": {
    lat: 52.3676,
    lon: 4.9041,
    tz: "Europe/Amsterdam",
  },
  "Rome, Italy": { lat: 41.9028, lon: 12.4964, tz: "Europe/Rome" },
  "Madrid, Spain": { lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" },
  "Lisbon, Portugal": { lat: 38.7223, lon: -9.1393, tz: "Europe/Lisbon" },
  "Barcelona, Spain": { lat: 41.3874, lon: 2.1686, tz: "Europe/Madrid" },
  "Vienna, Austria": { lat: 48.2082, lon: 16.3738, tz: "Europe/Vienna" },
  "Prague, Czech Republic": { lat: 50.0755, lon: 14.4378, tz: "Europe/Prague" },
  "Copenhagen, Denmark": {
    lat: 55.6761,
    lon: 12.5683,
    tz: "Europe/Copenhagen",
  },
  "Stockholm, Sweden": { lat: 59.3293, lon: 18.0686, tz: "Europe/Stockholm" },
  "Oslo, Norway": { lat: 59.9139, lon: 10.7522, tz: "Europe/Oslo" },
  "Helsinki, Finland": { lat: 60.1699, lon: 24.9384, tz: "Europe/Helsinki" },
  "Zurich, Switzerland": { lat: 47.3769, lon: 8.5417, tz: "Europe/Zurich" },
  "Athens, Greece": { lat: 37.9838, lon: 23.7275, tz: "Europe/Athens" },
  "Istanbul, Turkey": { lat: 41.0082, lon: 28.9784, tz: "Europe/Istanbul" },
  // North America
  "New York, USA": { lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  "Los Angeles, USA": {
    lat: 34.0522,
    lon: -118.2437,
    tz: "America/Los_Angeles",
  },
  "Chicago, USA": { lat: 41.8781, lon: -87.6298, tz: "America/Chicago" },
  "Houston, USA": { lat: 29.7604, lon: -95.3698, tz: "America/Chicago" },
  "San Francisco, USA": {
    lat: 37.7749,
    lon: -122.4194,
    tz: "America/Los_Angeles",
  },
  "Seattle, USA": { lat: 47.6062, lon: -122.3321, tz: "America/Los_Angeles" },
  "Miami, USA": { lat: 25.7617, lon: -80.1918, tz: "America/New_York" },
  "Denver, USA": { lat: 39.7392, lon: -104.9903, tz: "America/Denver" },
  "Austin, USA": { lat: 30.2672, lon: -97.7431, tz: "America/Chicago" },
  "Boston, USA": { lat: 42.3601, lon: -71.0589, tz: "America/New_York" },
  "Toronto, Canada": { lat: 43.6532, lon: -79.3832, tz: "America/Toronto" },
  "Vancouver, Canada": {
    lat: 49.2827,
    lon: -123.1207,
    tz: "America/Vancouver",
  },
  "Montreal, Canada": { lat: 45.5017, lon: -73.5673, tz: "America/Toronto" },
  "Mexico City, Mexico": {
    lat: 19.4326,
    lon: -99.1332,
    tz: "America/Mexico_City",
  },
  // South America
  "Sao Paulo, Brazil": {
    lat: -23.5505,
    lon: -46.6333,
    tz: "America/Sao_Paulo",
  },
  "Buenos Aires, Argentina": {
    lat: -34.6037,
    lon: -58.3816,
    tz: "America/Argentina/Buenos_Aires",
  },
  "Bogota, Colombia": { lat: 4.711, lon: -74.0721, tz: "America/Bogota" },
  "Lima, Peru": { lat: -12.0464, lon: -77.0428, tz: "America/Lima" },
  "Santiago, Chile": { lat: -33.4489, lon: -70.6693, tz: "America/Santiago" },
  // Asia
  "Tokyo, Japan": { lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  "Beijing, China": { lat: 39.9042, lon: 116.4074, tz: "Asia/Shanghai" },
  "Shanghai, China": { lat: 31.2304, lon: 121.4737, tz: "Asia/Shanghai" },
  "Hong Kong": { lat: 22.3193, lon: 114.1694, tz: "Asia/Hong_Kong" },
  Singapore: { lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore" },
  "Mumbai, India": { lat: 19.076, lon: 72.8777, tz: "Asia/Kolkata" },
  "Delhi, India": { lat: 28.7041, lon: 77.1025, tz: "Asia/Kolkata" },
  "Bangkok, Thailand": { lat: 13.7563, lon: 100.5018, tz: "Asia/Bangkok" },
  "Seoul, South Korea": { lat: 37.5665, lon: 126.978, tz: "Asia/Seoul" },
  "Dubai, UAE": { lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" },
  "Taipei, Taiwan": { lat: 25.033, lon: 121.5654, tz: "Asia/Taipei" },
  "Kuala Lumpur, Malaysia": {
    lat: 3.139,
    lon: 101.6869,
    tz: "Asia/Kuala_Lumpur",
  },
  "Jakarta, Indonesia": { lat: -6.2088, lon: 106.8456, tz: "Asia/Jakarta" },
  "Manila, Philippines": { lat: 14.5995, lon: 120.9842, tz: "Asia/Manila" },
  // Africa
  "Cape Town, South Africa": {
    lat: -33.9249,
    lon: 18.4241,
    tz: "Africa/Johannesburg",
  },
  "Johannesburg, South Africa": {
    lat: -26.2041,
    lon: 28.0473,
    tz: "Africa/Johannesburg",
  },
  "Nairobi, Kenya": { lat: -1.2921, lon: 36.8219, tz: "Africa/Nairobi" },
  "Cairo, Egypt": { lat: 30.0444, lon: 31.2357, tz: "Africa/Cairo" },
  "Lagos, Nigeria": { lat: 6.5244, lon: 3.3792, tz: "Africa/Lagos" },
  // Pacific
  "Honolulu, USA": { lat: 21.3069, lon: -157.8583, tz: "Pacific/Honolulu" },
  "Suva, Fiji": { lat: -18.1416, lon: 178.4419, tz: "Pacific/Fiji" },
};

const cityNames = Object.keys(CITIES);

export function searchCities(query: string): string[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return cityNames
    .filter((name) => name.toLowerCase().includes(lower))
    .slice(0, 8);
}

export function getCityData(cityName: string): CityData | null {
  return CITIES[cityName] || null;
}
