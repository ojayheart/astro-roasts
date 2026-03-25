"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingAnimation from "@/components/LoadingAnimation";
import TeaserView from "@/components/TeaserView";
import FullRoastView from "@/components/FullRoastView";
import type { RoastData } from "@/lib/types";

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

  // Poll while generating
  useEffect(() => {
    if (data.status !== "generating") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/roast/${roastId}`);
        const json = await res.json();

        if (json.status === "ready") {
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
    return <LoadingAnimation />;
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
        mercury={data.mercurySign}
        venus={data.venusSign}
        mars={data.marsSign}
        jupiter={data.jupiterSign}
        saturn={data.saturnSign}
        fullText={data.fullText}
        callouts={data.callouts}
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
