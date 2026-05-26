"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingAnimation from "@/components/LoadingAnimation";
import TeaserView from "@/components/TeaserView";
import FullRoastView from "@/components/FullRoastView";
import type { ChartPlacement, RoastData } from "@/lib/types";

interface RoastClientProps {
  roastId: string;
  initialData: RoastData;
}

export default function RoastClient({
  roastId,
  initialData,
}: RoastClientProps) {
  const router = useRouter();
  const [data, setData] = useState<RoastData>(initialData);

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

  // Poll while generating (timeout after 3 minutes)
  useEffect(() => {
    if (data.status !== "generating") return;

    const startTime = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;

    const interval = setInterval(async () => {
      // Timeout — pipeline likely not running
      if (Date.now() - startTime > TIMEOUT_MS) {
        setData((prev) => ({ ...prev, status: "error" }));
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
          });
        } else if (json.status === "error") {
          setData((prev) => ({ ...prev, status: "error" }));
        }
      } catch {
        // Network error, keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [data.status, roastId, data.createdAt]);

  // Listen for Paddle checkout success
  useEffect(() => {
    const handlePaddleEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.name === "checkout.completed") {
        router.refresh();
      }
    };
    document.addEventListener("paddle:checkout:completed", handlePaddleEvent);

    // Also listen for postMessage-based events
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "Checkout.Success") {
        router.refresh();
      }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      document.removeEventListener(
        "paddle:checkout:completed",
        handlePaddleEvent,
      );
      window.removeEventListener("message", handleMessage);
    };
  }, [router]);

  // Generating -> loading animation
  if (data.status === "generating") {
    return <LoadingAnimation placements={placements} />;
  }

  // Error state
  if (data.status === "error") {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-blood font-mono text-sm mb-4">
            Something went wrong generating your roast.
          </p>
          <a
            href="/"
            className="text-ash/60 font-mono text-xs underline hover:text-ash transition-colors"
          >
            Try again
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
    />
  );
}
