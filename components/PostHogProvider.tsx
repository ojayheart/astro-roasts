"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Mounts PostHog browser SDK once on first render. No-ops when keys are
 * absent (local dev / preview deploys without the env). Captures UTM +
 * referrer on first landing — those ride along as super-properties through
 * the whole session, so payment_succeeded keeps the attribution.
 */
export default function PostHogProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (posthog.__loaded) return;

    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: {
        dom_event_allowlist: ["click", "submit"],
      },
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true, email: false },
      },
    });

    // First-touch attribution: capture on initial mount and stick to user
    // for the lifetime of the session — overrides nothing on later visits.
    try {
      const params = new URLSearchParams(window.location.search);
      const attribution: Record<string, string> = {};
      for (const k of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "gclid",
        "fbclid",
        "ttclid",
      ]) {
        const v = params.get(k);
        if (v) attribution[k] = v;
      }
      const ref = document.referrer;
      if (ref) attribution.referrer = ref;
      if (Object.keys(attribution).length > 0) {
        posthog.register(attribution);
      }
    } catch {
      // Attribution is opportunistic — never block load on it.
    }
  }, []);

  return null;
}
