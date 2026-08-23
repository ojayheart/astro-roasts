const ROAST_LABELS = /^(TITLE|TEASER|FULL|CALLOUTS):[ \t]*/gm;

/**
 * Split a labelled roast block into its sections plus any unlabelled preamble.
 * Order-independent on purpose: the model sometimes emits FULL before TEASER,
 * and a positional regex then lets FULL swallow the TEASER section, which
 * strands the hook at the end of the paid roast.
 */
function splitLabelledSections(content: string): {
  sections: Record<string, string>;
  preamble: string;
} {
  const matches = [...content.matchAll(ROAST_LABELS)];
  if (matches.length === 0) return { sections: {}, preamble: content.trim() };

  const sections: Record<string, string> = {};
  matches.forEach((match, i) => {
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    sections[match[1]] = content.slice(start, end).trim();
  });

  return { sections, preamble: content.slice(0, matches[0].index!).trim() };
}

/**
 * Parse the structured roast output (---ROAST_START--- markers).
 * Falls back to plain prose if markers missing.
 */
export function parseRoastOutput(raw: string): {
  title: string;
  teaser: string;
  fullText: string;
  callouts: string;
} {
  const hasStructured =
    raw.includes("---ROAST_START---") && raw.includes("---ROAST_END---");

  if (hasStructured) {
    const content = raw
      .split("---ROAST_START---")[1]
      .split("---ROAST_END---")[0]
      .trim();

    const { sections, preamble } = splitLabelledSections(content);
    const hasLabels = Object.keys(sections).length > 0;

    if (hasLabels) {
      // The teaser is paywall copy only. Never let it reach fullText.
      const fullText = sections.FULL || preamble || sections.TEASER || "";
      return {
        title: sections.TITLE || "",
        teaser: sections.TEASER || "",
        fullText,
        callouts: sections.CALLOUTS || "",
      };
    }

    // Group runner emits bare prose between the markers without
    // TITLE:/TEASER:/FULL: labels — treat the whole block as the roast
    // rather than shipping an empty "ready" roast.
    const contentParagraphs = content.split("\n\n");
    return {
      title: "",
      teaser:
        contentParagraphs.length > 3
          ? contentParagraphs.slice(0, 3).join("\n\n")
          : contentParagraphs[0] || "",
      fullText: content,
      callouts: "",
    };
  }

  const mainText = raw.split("---CALLOUTS---")[0].trim();
  const calloutsRaw = raw.split("---CALLOUTS---")[1]?.trim() || "";
  const paragraphs = mainText.split("\n\n");

  return {
    title: "",
    teaser:
      paragraphs.length > 3
        ? paragraphs.slice(0, 3).join("\n\n")
        : paragraphs[0] || "",
    fullText: mainText,
    callouts: calloutsRaw,
  };
}
