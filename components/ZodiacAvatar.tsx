import { ZODIAC_PATHS, type ZodiacSign } from "./zodiacPaths";

// Star-sign avatar: the hand-drawn glyph as a fine line in a hairline ring.
// Deliberately flat (no glow, no gradient) so it reads editorial, not app-badge.
export default function ZodiacAvatar({
  sign,
  className = "",
}: {
  sign: ZodiacSign;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-ash/15 text-blood ${className}`}
    >
      <svg viewBox="-7.5 -7.5 15 15" className="h-[50%] w-[50%] overflow-visible">
        <path
          d={ZODIAC_PATHS[sign]}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
