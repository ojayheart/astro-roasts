// Hand-drawn zodiac glyphs as stroke paths in a 10×10 box centred on 0,0.
// Shared by the hero wheel and the testimonial avatars so the mark is ownable
// and renders identically everywhere (no font fallback).

export const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

export const ZODIAC_PATHS: Record<ZodiacSign, string> = {
  Aries:
    "M-4 -0.5 C-5.2 -5 0 -5.5 0 -1 C0 -5.5 5.2 -5 4 -0.5 M0 -1 L0 5",
  Taurus:
    "M-4.5 -4.5 C-3.5 -1.2 3.5 -1.2 4.5 -4.5 M0 -1.4 A2.9 2.9 0 1 0 0.01 -1.4",
  Gemini:
    "M-4.2 -4 C-1.5 -2.8 1.5 -2.8 4.2 -4 M-4.2 4 C-1.5 2.8 1.5 2.8 4.2 4 M-1.8 -3.2 L-1.8 3.2 M1.8 -3.2 L1.8 3.2",
  Cancer:
    "M-2.4 -0.3 A1.4 1.4 0 1 1 -2.39 -0.3 M-2.4 -3.1 C0.5 -4.6 3.6 -3.6 4.6 -1.2 M2.4 0.3 A1.4 1.4 0 1 1 2.39 0.3 M2.4 3.1 C-0.5 4.6 -3.6 3.6 -4.6 1.2",
  Leo:
    "M-2.3 3.4 A1.7 1.7 0 1 1 -2.29 3.4 M-0.8 1.3 C-2.2 -1.8 -0.6 -4.6 1.8 -4.6 C4.6 -4.6 4.8 -1.4 2.6 1.2 C1.4 2.7 1.9 4.6 4.3 4.1",
  Virgo:
    "M-4.6 -3.4 L-4.6 3.4 M-4.6 -1.8 C-4.6 -4.2 -1.6 -4.2 -1.6 -1.8 L-1.6 3.4 M-1.6 -1.8 C-1.6 -4.2 1.4 -4.2 1.4 -1.8 L1.4 1.8 C1.4 4.6 4.8 4.4 4.4 1.4 C4 -0.4 1.8 1.6 0.9 4.8",
  Libra:
    "M-4.6 3.4 L4.6 3.4 M-4.6 0.9 L-1.7 0.9 C-3.6 -3.8 3.6 -3.8 1.7 0.9 L4.6 0.9",
  Scorpio:
    "M-4.6 -3.4 L-4.6 3.4 M-4.6 -1.8 C-4.6 -4.2 -1.6 -4.2 -1.6 -1.8 L-1.6 3.4 M-1.6 -1.8 C-1.6 -4.2 1.4 -4.2 1.4 -1.8 L1.4 2.6 C1.4 4.4 3 4.6 4.6 3.4 M3.1 2.5 L4.6 3.4 L3.9 5",
  Sagittarius:
    "M-4.2 4.2 L4.2 -4.2 M0.4 -4.2 L4.2 -4.2 L4.2 -0.4 M-3.4 -0.6 L0.6 3.4",
  Capricorn:
    "M-4.6 -3.6 L-2.6 3.2 L-0.6 -3.2 C-0.2 -0.8 0.6 2.2 2.6 3 C4.6 3.8 5 0.8 3.2 0.8 C1.6 0.8 1 3.4 -0.2 4.8",
  Aquarius:
    "M-4.6 -0.8 L-2.3 -2.6 L0 -0.8 L2.3 -2.6 L4.6 -0.8 M-4.6 2.8 L-2.3 1 L0 2.8 L2.3 1 L4.6 2.8",
  Pisces:
    "M-4 -4.6 C-1.4 -2 -1.4 2 -4 4.6 M4 -4.6 C1.4 -2 1.4 2 4 4.6 M-2.4 0 L2.4 0",
};
