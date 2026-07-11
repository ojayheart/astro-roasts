/**
 * Funnel event registry. One source of truth so all `track()` calls in the
 * codebase land in PostHog with consistent names + property shapes. Adding
 * new event types here forces every call site to provide the right
 * properties (or compile error).
 *
 * Use:
 *   import { track } from "@/lib/track";
 *   track("paywall_button_clicked", { roastId, currency: "nzd" });
 *
 * Server-side capture is intentionally out of scope. Server events that
 * matter go through Sentry breadcrumbs / PostHog server SDK if we ever add
 * it. Browser-side events alone cover the conversion funnel.
 */

import posthog from "posthog-js";

export interface EventMap {
  birth_form_opened: Record<string, never>;
  birth_form_submitted: {
    mode?: string;
    hasEmail: boolean;
    hasBirthTime: boolean;
    peopleCount?: number;
  };
  roast_generation_started: { roastId: string };
  roast_generation_finished: { roastId: string; durationMs?: number };
  loading_abandoned: { roastId: string; lastPct: number; elapsedMs: number };
  teaser_viewed: { roastId: string };
  paywall_button_clicked: { roastId: string };
  checkout_modal_opened: { roastId: string };
  checkout_intent_loaded: {
    roastId: string;
    amount: number;
    currency: string;
  };
  checkout_intent_failed: { roastId: string; error: string };
  express_checkout_clicked: { roastId: string; method?: string };
  card_checkout_submitted: { roastId: string };
  payment_succeeded: { roastId: string };
  payment_failed: { roastId: string; error: string };
  share_clicked: { roastId: string; method: string };
  share_to_unlock_clicked: { roastId: string };
  share_to_unlock_shared: { roastId: string; method: string };
  unlock_via_share_succeeded: { roastId: string };
  unlock_via_share_failed: { roastId: string; reason: string };
}

type EventName = keyof EventMap;

export function track<E extends EventName>(name: E, props: EventMap[E]) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  try {
    posthog.capture(name, props as Record<string, unknown>);
  } catch {
    // Tracking is fire-and-forget. Never break the UX over an analytics
    // hiccup.
  }
}

/**
 * Identify a user once they hand us an email. distinct_id = email so
 * anonymous sessions merge with the paid account. PostHog person-profiles
 * are "identified_only" so anonymous traffic doesn't burn person quota.
 */
export function identifyByEmail(
  email: string,
  traits?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  try {
    posthog.identify(email, traits);
  } catch {
    /* swallow */
  }
}
