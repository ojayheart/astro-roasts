"use client";

import { useState, useEffect, useRef } from "react";
import LoadingAnimation from "@/components/LoadingAnimation";
import TeaserView from "@/components/TeaserView";
import FullRoastView from "@/components/FullRoastView";
import type { ChartPlacement, NatalChart, RoastData } from "@/lib/types";
import { track } from "@/lib/track";

interface RoastClientProps {
  roastId: string;
  initialData: RoastData;
}

export default function RoastClient({
  roastId,
  initialData,
}: RoastClientProps) {
  const [data, setData] = useState<RoastData>(initialData);
  const [chart, setChart] = useState<NatalChart | null>(null);
  const loadingStartedAt = useRef<number>(0);
  const finishedFiredRef = useRef(false);
  const teaserFiredRef = useRef(false);
  const chartFetchedRef = useRef(false);

  // Fast second call: fetch the deterministic natal chart so the loading
  // screen can draw the d3 wheel while the slow roast generates. Fire-and-
  // forget — {chart:null} just means the chart-less fallback layout.
  useEffect(() => {
    if (data.status !== "generating") return;
    if (chartFetchedRef.current) return;
    chartFetchedRef.current = true;

    fetch("/api/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roastId }),
    })
      .then((res) => res.json())
      .then((json: { chart?: NatalChart | null }) => {
        if (json.chart) setChart(json.chart);
      })
      .catch(() => {
        // Fallback layout handles it.
      });
  }, [data.status, roastId]);

  // Track abandonment: if the tab unloads while still in `generating`, fire
  // a beacon so we can see the drop-off shape in PostHog. We can't use a
  // promise-based capture here — the page is gone — so rely on PostHog's
  // built-in pageleave + a snapshot event from a beforeunload listener.
  useEffect(() => {
    if (data.status !== "generating") return;
    if (loadingStartedAt.current === 0) {
      loadingStartedAt.current = Date.now();
    }
    const handler = () => {
      track("loading_abandoned", {
        roastId,
        lastPct: data.stagePct ?? 0,
        elapsedMs: Date.now() - loadingStartedAt.current,
      });
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [data.status, data.stagePct, roastId]);

  // Fire generation_finished exactly once when status flips to "ready".
  useEffect(() => {
    if (data.status === "ready" && !finishedFiredRef.current) {
      finishedFiredRef.current = true;
      localStorage.setItem("ar_has_roast", "1");
      track("roast_generation_finished", {
        roastId,
        durationMs: loadingStartedAt.current
          ? Date.now() - loadingStartedAt.current
          : undefined,
      });
    }
  }, [data.status, roastId]);

  // Fire teaser_viewed exactly once when the unpaid teaser becomes visible.
  useEffect(() => {
    if (data.status === "ready" && !data.paid && !teaserFiredRef.current) {
      teaserFiredRef.current = true;
      track("teaser_viewed", { roastId });
    }
  }, [data.status, data.paid, roastId]);

  const placements: ChartPlacement[] = [
    { planet: "Sun", sign: data.sunSign },
    { planet: "Moon", sign: data.moonSign },
    { planet: "Asc", sign: data.rising },
    { planet: "Mercury", sign: data.mercurySign || "" },
    { planet: "Venus", sign: data.venusSign || "" },
    { planet: "Mars", sign: data.marsSign || "" },
    { planet: "Jupiter", sign: data.jupiterSign || "" },
    { planet: "Saturn", sign: data.saturnSign || "" },
  ].filter((placement) => placement.sign);

  // Poll while generating (3 minutes of *foreground* time). Backgrounded tabs
  // don't accrue toward the timeout — otherwise a 4-minute coffee break with
  // the tab hidden would flip a finished roast into a permanent error state.
  useEffect(() => {
    if (data.status !== "generating") return;

    const TIMEOUT_MS = 3 * 60 * 1000;
    let foregroundMs = 0;
    let lastVisible = Date.now();
    let cancelled = false;

    const onVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        lastVisible = now;
      } else {
        foregroundMs += now - lastVisible;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const finalCheck = async () => {
      try {
        const res = await fetch(`/api/roast/${roastId}`);
        const json = await res.json();
        if (json.status === "ready") {
          if (!cancelled) {
            setData({
              id: roastId,
              name: json.name,
              status: "ready",
              sunSign: json.sunSign || "",
              moonSign: json.moonSign || "",
              rising: json.rising || "",
              mercurySign: json.mercurySign || "",
              venusSign: json.venusSign || "",
              marsSign: json.marsSign || "",
              jupiterSign: json.jupiterSign || "",
              saturnSign: json.saturnSign || "",
              teaser: json.teaser || "",
              fullText: json.fullText || "",
              callouts: json.callouts || [],
              paid: json.paid || false,
              createdAt: data.createdAt,
              stagePct: 100,
            });
            return;
          }
        }
      } catch {
        // Swallow; we're about to flip to error anyway.
      }
      if (!cancelled) setData((prev) => ({ ...prev, status: "error" }));
    };

    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = foregroundMs + (Date.now() - lastVisible);
      if (elapsed > TIMEOUT_MS) {
        clearInterval(interval);
        await finalCheck();
        return;
      }

      try {
        const res = await fetch(`/api/roast/${roastId}`);
        const json = await res.json();

        if (json.status === "ready" || json.status === "generating") {
          setData({
            id: roastId,
            name: json.name,
            status: json.status,
            sunSign: json.sunSign || "",
            moonSign: json.moonSign || "",
            rising: json.rising || "",
            mercurySign: json.mercurySign || "",
            venusSign: json.venusSign || "",
            marsSign: json.marsSign || "",
            jupiterSign: json.jupiterSign || "",
            saturnSign: json.saturnSign || "",
            teaser: json.teaser || "",
            fullText: json.fullText || "",
            callouts: json.callouts || [],
            paid: json.paid || false,
            createdAt: data.createdAt,
            stagePct:
              json.status === "ready" ? 100 : Number(json.stagePct ?? 0),
          });
        } else if (json.status === "error") {
          setData((prev) => ({ ...prev, status: "error" }));
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [data.status, roastId, data.createdAt]);

  // After Stripe payment the buyer lands here with `?paid=1`. Stripe also
  // appends `session_id` (hosted Checkout) or `payment_intent` (embedded flow).
  // We confirm that id SERVER-SIDE and flip `paid` immediately — this is the
  // delivery path for buyers who left no email and don't depend on the async
  // webhook. The poll is a fallback when neither id is present.
  useEffect(() => {
    if (data.paid) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;

    const sessionId = params.get("session_id");
    const paymentIntentId = params.get("payment_intent");

    let cancelled = false;
    const startTime = Date.now();
    const TIMEOUT_MS = 60 * 1000;

    const reveal = () => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, paid: true }));
      track("payment_succeeded", { roastId });
    };

    // Webhook-independent confirmation via the Stripe id in the URL.
    (async () => {
      if (!sessionId && !paymentIntentId) return;
      try {
        const res = await fetch("/api/verify-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roastId, sessionId, paymentIntentId }),
        });
        const json = await res.json();
        if (json.paid) reveal();
      } catch {
        // Fall back to the poll below.
      }
    })();

    const interval = setInterval(async () => {
      if (cancelled || Date.now() - startTime > TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/roast/${roastId}`);
        const json = await res.json();
        if (json.paid) {
          clearInterval(interval);
          reveal();
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [data.paid, roastId]);

  // Generating -> loading animation
  if (data.status === "generating") {
    return (
      <LoadingAnimation
        placements={placements}
        targetPct={data.stagePct ?? 0}
        chart={chart}
      />
    );
  }

  // Error state
  if (data.status === "error") {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-blood font-mono text-sm mb-4">
            We couldn&apos;t finish this roast. The chart data is safe; the
            writer just lost the thread.
          </p>
          <a
            href="/"
            className="text-ash/60 font-mono text-xs underline hover:text-ash transition-colors"
          >
            Start a new roast
          </a>
        </div>
      </div>
    );
  }

  // Paid -> full roast
  if (data.paid) {
    return (
      <FullRoastView
        name={data.name}
        sunSign={data.sunSign}
        moonSign={data.moonSign}
        rising={data.rising}
        mercury={data.mercurySign || ""}
        venus={data.venusSign || ""}
        mars={data.marsSign || ""}
        jupiter={data.jupiterSign || ""}
        saturn={data.saturnSign || ""}
        fullText={data.fullText || ""}
        callouts={data.callouts || []}
        roastId={roastId}
        subjectNames={data.subjectNames}
        extraPlacements={data.extraPlacements}
      />
    );
  }

  // Unpaid -> teaser + scroll-triggered paywall (handled inside TeaserView)
  return (
    <TeaserView
      name={data.name}
      sunSign={data.sunSign}
      moonSign={data.moonSign}
      rising={data.rising}
      teaser={data.teaser}
      roastId={roastId}
      subjectNames={data.subjectNames}
      extraPlacements={data.extraPlacements}
      amountMinorUnits={data.amountMinorUnits}
    />
  );
}
