"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import LoadingAnimation from "@/components/LoadingAnimation";
import TeaserView from "@/components/TeaserView";
import FullRoastView from "@/components/FullRoastView";
import PaywallCTA from "@/components/PaywallCTA";
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
  const [data, setData] = useState(initialData);
  const [showLoading, setShowLoading] = useState(
    initialData.status === "generating",
  );
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollForRoast = useCallback(async () => {
    try {
      const res = await fetch(`/api/roast/${roastId}`);
      if (!res.ok) return;
      const json = await res.json();

      if (json.status === "ready") {
        setData((prev) => ({ ...prev, ...json, status: "ready" }));
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch {
      // Silently retry on next poll
    }
  }, [roastId]);

  // Poll while generating
  useEffect(() => {
    if (data.status === "generating") {
      pollingRef.current = setInterval(pollForRoast, 2000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [data.status, pollForRoast]);

  // Listen for Lemon Squeezy payment success
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.event === "Checkout.Success") {
        // Payment succeeded — reload to get paid data from server
        router.refresh();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false);
  }, []);

  // State: generating → show loading
  if (data.status === "generating" || showLoading) {
    // If data has arrived but loading animation is still playing
    if (data.status === "ready" && showLoading) {
      return <LoadingAnimation onComplete={handleLoadingComplete} />;
    }
    return <LoadingAnimation />;
  }

  // State: ready, paid → full roast
  if (data.status === "ready" && data.paid) {
    return (
      <FullRoastView
        name={data.name}
        sunSign={data.sunSign || ""}
        moonSign={data.moonSign || ""}
        rising={data.rising || ""}
        mercury={data.mercury || ""}
        venus={data.venus || ""}
        mars={data.mars || ""}
        jupiter={data.jupiter || ""}
        saturn={data.saturn || ""}
        sections={data.sections || []}
        roastId={roastId}
      />
    );
  }

  // State: ready, not paid → teaser + paywall
  return (
    <>
      <TeaserView
        name={data.name}
        sunSign={data.sunSign || ""}
        moonSign={data.moonSign || ""}
        rising={data.rising || ""}
        teaser={data.teaser || ""}
        sectionHeaders={
          (data as unknown as { sectionHeaders?: string[] }).sectionHeaders ||
          []
        }
        roastId={roastId}
      />
      <PaywallCTA roastId={roastId} />
    </>
  );
}
