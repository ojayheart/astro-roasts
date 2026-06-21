import type { ReactNode } from "react";

// Roast prose uses *asterisk emphasis*. Render it as italics instead of
// leaking raw asterisks into the reading.
export function renderEmphasis(text: string): ReactNode[] {
  const parts = text.split(/\*([^*\n]+)\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={i}>{part}</em> : <span key={i}>{part}</span>,
  );
}

export function stripEmphasis(text: string): string {
  return text.replace(/\*([^*\n]+)\*/g, "$1");
}
