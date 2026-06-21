import { zodiacGlyph } from "@/lib/zodiac";

// Zodiac glyph rendered with the self-hosted Noto Sans Symbols 2 subset
// (--font-symbols, loaded in layout.tsx) so every platform draws the same
// mark instead of falling back to OS symbol fonts.
export default function SignGlyph({
  sign,
  className,
}: {
  sign: string;
  className?: string;
}) {
  const glyph = zodiacGlyph(sign);
  if (!glyph) return null;
  // U+FE0E forces text presentation — without it iOS/macOS render the
  // zodiac codepoints as emoji squares regardless of font-family.
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ fontFamily: "var(--font-symbols)" }}
    >
      {`${glyph}\uFE0E`}
    </span>
  );
}
