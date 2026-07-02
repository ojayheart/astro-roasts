"use client";

import { useState } from "react";
import { track } from "@/lib/track";

type ShareState = "idle" | "copied" | "shared";

export default function ShareButton({ roastId }: { roastId: string }) {
  const [state, setState] = useState<ShareState>("idle");

  const handleShare = async () => {
    const url = `${window.location.origin}/roast/${roastId}`;

    // Story-card share: real image into the sheet → "Add to Instagram Story".
    try {
      const res = await fetch(`/roast/${roastId}/story-image`);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "astroroast-story.png", {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Astro Roasts",
            text: "My natal chart got roasted. Yours next. astroroast.com",
          });
          track("share_clicked", { roastId, method: "story_file" });
          setState("shared");
          setTimeout(() => setState("idle"), 2000);
          return;
        }
        // Desktop / no file-share: download the card, then continue to URL share.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "astroroast-story.png";
        a.click();
        URL.revokeObjectURL(a.href);
        track("share_clicked", { roastId, method: "story_download" });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // story card unavailable — fall through to URL share
    }

    const shareData: ShareData = {
      title: "Astro Roasts",
      text: "My natal chart got roasted. Yours next.",
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        track("share_clicked", { roastId, method: "native" });
        setState("shared");
        setTimeout(() => setState("idle"), 2000);
        return;
      } catch (err) {
        // User-cancelled share — silently return; no fallback needed.
        if (err instanceof Error && err.name === "AbortError") return;
        // Other share errors fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      track("share_clicked", { roastId, method: "clipboard" });
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      track("share_clicked", { roastId, method: "execCommand" });
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    }
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
