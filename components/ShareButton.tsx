"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { shareStoryCard, type ShareOutcome } from "@/lib/share-story";

type ShareState = "idle" | "copied" | "shared";

const METHOD_BY_OUTCOME: Record<Exclude<ShareOutcome, "aborted">, string> = {
  shared: "story_file",
  shared_url: "native",
  downloaded: "story_download",
  copied: "clipboard",
};

export default function ShareButton({ roastId }: { roastId: string }) {
  const [state, setState] = useState<ShareState>("idle");

  const handleShare = async () => {
    const outcome = await shareStoryCard(roastId);
    if (outcome === "aborted") return;

    track("share_clicked", { roastId, method: METHOD_BY_OUTCOME[outcome] });
    setState(outcome === "copied" ? "copied" : "shared");
    setTimeout(() => setState("idle"), 2000);
  };

  const label =
    state === "copied"
      ? "Link copied"
      : state === "shared"
        ? "Shared"
        : "Share roast";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-live="polite"
      className="interactive px-6 py-3 min-h-[44px] border border-ash/20 bg-void text-ash font-mono text-xs uppercase tracking-[0.15em] hover:border-blood hover:text-blood active:border-blood active:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300"
    >
      {label}
    </button>
  );
}
