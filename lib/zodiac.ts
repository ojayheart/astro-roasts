// Shared zodiac glyph map. Render glyphs with the self-hosted symbols font
// (see SignGlyph) — never with per-OS symbol-font stacks, which tofu on
// Android/Windows.
export const ZODIAC_GLYPHS: Record<string, string> = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};

export function zodiacGlyph(sign: string): string {
  return ZODIAC_GLYPHS[sign] || "";
}
