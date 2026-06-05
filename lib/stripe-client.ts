"use client";

import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

let cached: Promise<StripeJs | null> | null = null;

export function getStripeJs(): Promise<StripeJs | null> {
  if (cached) return cached;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key) {
    console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing");
    cached = Promise.resolve(null);
    return cached;
  }
  cached = loadStripe(key);
  return cached;
}
