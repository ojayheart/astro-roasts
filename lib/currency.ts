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

/**
 * Format an amount in minor units for display. Locale is pinned to en-US so
 * the server-rendered string and the client hydration match exactly; only the
 * currency varies. `narrowSymbol` keeps NZD/AUD/CAD as plain "$5" rather than
 * "NZ$5" — same number everywhere, local symbol.
 */
export function formatPrice(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  const code = (isSupportedCurrency(currency) ? currency : "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${code} ${major.toFixed(Number.isInteger(major) ? 0 : 2)}`;
  }
}
