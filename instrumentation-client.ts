import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { buildSentryInitOptions } from "./lib/sentry-config";

Sentry.init(
  buildSentryInitOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    nodeEnv: process.env.NODE_ENV,
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Next 16 calls this for every CWV metric. Pipe to PostHog so we can
// correlate LCP/INP/CLS against conversion rate. PostHog gracefully
// no-ops when not initialised, so no guard needed for env-less builds.
export function onRequest() {
  // Sentry/transaction hook placeholder for future server timing — keeping
  // exported so Next 16 doesn't strip it; we use the metric hook below.
}

interface NextWebVitalsMetric {
  id: string;
  name: string;
  label: "web-vital" | "custom";
  value: number;
  startTime?: number;
  attribution?: Record<string, unknown>;
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label !== "web-vital") return;
  if (!posthog.__loaded) return;
  try {
    posthog.capture("web_vital", {
      metric: metric.name,
      value: metric.value,
      id: metric.id,
      ...(metric.attribution || {}),
    });
  } catch {
    /* swallow */
  }
}
