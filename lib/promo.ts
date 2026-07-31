/**
 * Promo codes. Defined server-side only, in the ROAST_PROMO_CODES env var, as
 * a comma-separated list of `CODE:percentOff` pairs:
 *
 *   ROAST_PROMO_CODES="OLIVER:100,PRESS:100,FRIENDS:50"
 *
 * 100 means free — those never touch Stripe at all; /api/redeem-code flips the
 * roast to paid directly. Anything less is applied to the PaymentIntent amount
 * server-side, so a tampered client can't discount its own checkout.
 */

// Stripe rejects charges below ~$0.50 in most currencies. A discount that
// lands under this can't be collected, so we treat it as free rather than
// failing at the card step.
export const STRIPE_MIN_MINOR_UNITS = 50;

export interface Promo {
  code: string;
  percentOff: number;
}

/** Parse the env var into CODE -> percentOff. Invalid entries are skipped. */
export function parsePromoCodes(
  raw: string | undefined | null,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw) return out;

  for (const entry of raw.split(",")) {
    const [rawCode, rawPct] = entry.split(":");
    const code = rawCode?.trim().toUpperCase();
    const pct = Number(rawPct?.trim());
    if (!code) continue;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
    out.set(code, pct);
  }
  return out;
}

/** Look up a user-supplied code. Case- and whitespace-insensitive. */
export function lookupPromo(
  input: unknown,
  raw: string | undefined | null = process.env.ROAST_PROMO_CODES,
): Promo | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  if (!code || code.length > 40) return null;

  const percentOff = parsePromoCodes(raw).get(code);
  if (percentOff === undefined) return null;
  return { code, percentOff };
}

/** Discounted amount, rounded to whole minor units, never below zero. */
export function applyDiscount(
  amountMinorUnits: number,
  percentOff: number,
): number {
  const discounted = Math.round(amountMinorUnits * (1 - percentOff / 100));
  return Math.max(0, discounted);
}

/**
 * True when the code wipes out the charge — either 100% off, or a discount
 * that leaves less than Stripe will accept.
 */
export function isFreeAfterDiscount(
  amountMinorUnits: number,
  percentOff: number,
): boolean {
  return applyDiscount(amountMinorUnits, percentOff) < STRIPE_MIN_MINOR_UNITS;
}
