"use client";

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
  // Paid → full roast
  if (initialData.paid) {
    return (
      <FullRoastView
        name={initialData.name}
        sunSign={initialData.sunSign}
        moonSign={initialData.moonSign}
        rising={initialData.rising}
        mercury={initialData.mercurySign}
        venus={initialData.venusSign}
        mars={initialData.marsSign}
        jupiter={initialData.jupiterSign}
        saturn={initialData.saturnSign}
        fullText={initialData.fullText}
        callouts={initialData.callouts}
        roastId={roastId}
      />
    );
  }

  // Unpaid → teaser + paywall
  return (
    <>
      <TeaserView
        name={initialData.name}
        sunSign={initialData.sunSign}
        moonSign={initialData.moonSign}
        rising={initialData.rising}
        teaser={initialData.teaser}
        roastId={roastId}
      />
      <PaywallCTA roastId={roastId} />
    </>
  );
}
