/**
 * Story-card share cascade, shared by ShareButton and the share-to-unlock
 * paywall. Tries, in order:
 *   1. navigator.share with the story PNG file (mobile — IG Story target)
 *   2. download the PNG, then navigator.share with the URL (desktop)
 *   3. clipboard copy of the roast URL
 * Returns how far the user actually got so callers can react (unlock, label).
 */

export type ShareOutcome =
  | "shared" // share sheet resolved with the story file
  | "shared_url" // share sheet resolved with URL only (card downloaded first)
  | "downloaded" // card downloaded, no share sheet available
  | "copied" // URL copied to clipboard
  | "aborted"; // user dismissed the share sheet

export async function shareStoryCard(roastId: string): Promise<ShareOutcome> {
  const url = `${window.location.origin}/roast/${roastId}`;
  let downloaded = false;

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
        return "shared";
      }
      // Desktop / no file-share: download the card, then continue to URL share.
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "astroroast-story.png";
      a.click();
      URL.revokeObjectURL(a.href);
      downloaded = true;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
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
      return downloaded ? "shared_url" : "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return downloaded ? "downloaded" : "aborted";
      }
      // Other share errors fall through to clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
  return downloaded ? "downloaded" : "copied";
}
