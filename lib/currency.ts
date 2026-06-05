// Currencies that match `currency_options` on the Stripe Price object.
// Keep in sync with the Stripe dashboard — adding a new entry here without
// also adding `currency_options[<code>]` on the Price will make Stripe fall
// back to USD silently.
const SUPPORTED = new Set(["usd", "aud", "nzd", "eur", "gbp", "cad"]);

// ISO 3166-1 alpha-2 country codes for the Eurozone.
const EUROZONE = new Set([
  "AT",
  "BE",
  "HR",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
]);

export function pickCurrencyForCountry(
  country: string | undefined | null,
): string {
  if (!country) return "usd";
  const c = country.trim().toUpperCase();
  if (c === "AU") return "aud";
  if (c === "NZ") return "nzd";
  if (c === "GB") return "gbp";
  if (c === "CA") return "cad";
  if (EUROZONE.has(c)) return "eur";
  return "usd";
}

export function readCountryFromHeaders(headers: Headers): string | undefined {
  const country = headers.get("x-vercel-ip-country");
  return country?.trim() || undefined;
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED.has(code.toLowerCase());
}
