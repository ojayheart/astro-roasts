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
        : "Send it on";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-live="polite"
      className="interactive group inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-[0.2em] text-ash/80"
    >
      <span className="link-rule group-hover:text-blood">{label}</span>
    </button>
  );
}
