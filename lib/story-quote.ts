// Opening sentences of the teaser, clipped — enough bite to make the card
// land, never enough to spoil the read. Accumulates sentences so a one-word
// opener ("Right.") never ships alone.
export function pullQuote(teaser: string | null): string {
  if (!teaser) return "The chart has been read. Proceed carefully.";
  // Whole-teaser sentence stream — stylistic micro-paragraph openers
  // ("Right. So.") shouldn't cap the quote.
  const flat = teaser.replace(/\s+/g, " ").trim();
  const sentences = flat.split(/(?<=[.!?])\s/);
  let quote = "";
  for (const s of sentences) {
    quote = quote ? `${quote} ${s}` : s;
    if (quote.length >= 60) break;
  }
  quote = quote.trim();
  if (quote.length <= 140) return quote;
  const cut = quote.slice(0, 140);
  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd() + "…";
}

export function storyQuote(roast: {
  goldLine: string | null;
  teaser: string | null;
  fullText: string | null;
}): string {
  return roast.goldLine || pullQuote(roast.teaser ?? roast.fullText);
}
