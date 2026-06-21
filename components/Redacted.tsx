// FOIA-style redaction: most words become solid bars, a few stay legible as
// the tease. Deterministic per word index/length — no Math.random, so server
// and client render identically.
function isVisible(index: number, word: string): boolean {
  // Keep the opening words readable, then let ~1 in 4 through.
  if (index < 4) return true;
  return (index * 7 + word.length * 3) % 9 === 0;
}

export default function Redacted({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span aria-label="Redacted until unlocked" role="text">
      {words.map((word, i) =>
        isVisible(i, word) ? (
          <span key={i}>{word} </span>
        ) : (
          <span key={i} aria-hidden="true" className="select-none">
            <span className="bg-ash/75 text-transparent">{word}</span>{" "}
          </span>
        ),
      )}
    </span>
  );
}
