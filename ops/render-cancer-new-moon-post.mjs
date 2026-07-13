import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outputDir = join(root, "public", "ig", "cancer-new-moon-2026");
const WIDTH = 1080;
const HEIGHT = 1080;
const VOID = "#030303";
const ASH = "#e5e5e5";
const BLOOD = "#ff2a00";
const MUTED = "#666666";

const slides = [
  {
    kind: "hero",
    eyebrow: "CANCER NEW MOON · 14 JUL 2026",
    lines: [
      ["YOU LEARNED", ASH],
      ["TO READ", ASH],
      ["THE ROOM", BLOOD],
      ["BEFORE YOU", ASH],
      ["LEARNED TO", ASH],
      ["READ YOURSELF.", BLOOD],
    ],
  },
  {
    kind: "body",
    eyebrow: "THE SURVIVAL SKILL",
    lines: [
      ["You could detect a change", ASH],
      ["in someone’s breathing from", ASH],
      ["three suburbs away.", BLOOD],
      ["", ASH],
      ["But ask how you feel and", ASH],
      ["suddenly the system is down", ASH],
      ["for maintenance.", BLOOD],
    ],
  },
  {
    kind: "body",
    eyebrow: "MERCURY RETROGRADE IN CANCER",
    lines: [
      ["Old emotional sentences return:", ASH],
      ["", ASH],
      ["“I’m fine.”", BLOOD],
      ["“Don’t worry about me.”", BLOOD],
      ["“It’s not a big deal.”", BLOOD],
      ["", ASH],
      ["Family heirlooms. Nobody wants", ASH],
      ["them. They don’t match the sofa.", ASH],
    ],
  },
  {
    kind: "question",
    eyebrow: "THE ACTUAL QUESTION",
    lines: [
      ["WHAT FEELS", ASH],
      ["LIKE HOME", BLOOD],
      ["NOW?", BLOOD],
    ],
    note: [
      "Not automatically where you grew up.",
      "The place your nervous system finally",
      "takes its shoes off.",
    ],
  },
  {
    kind: "body",
    eyebrow: "THE INTENTION",
    lines: [
      ["This New Moon isn’t asking", ASH],
      ["you to become unbothered.", ASH],
      ["", ASH],
      ["It’s asking you to become safe", BLOOD],
      ["enough to be honest before a", BLOOD],
      ["feeling turns into a three-day", ASH],
      ["administrative process.", ASH],
    ],
  },
  {
    kind: "body",
    eyebrow: "A REASONABLE TIMELINE",
    lines: [
      ["You do not need to heal your", ASH],
      ["entire bloodline by Tuesday.", BLOOD],
      ["", ASH],
      ["Just notice which feelings are", ASH],
      ["yours — and which ones you’ve", ASH],
      ["been storing for other people", ASH],
      ["in containers with no lids.", BLOOD],
    ],
  },
  {
    kind: "hero",
    eyebrow: "THE SOFTER REVOLUTION",
    lines: [
      ["THE STARS", ASH],
      ["AREN’T ASKING", ASH],
      ["YOU TO STOP", ASH],
      ["CARING.", BLOOD],
      ["INCLUDE", ASH],
      ["YOURSELF.", BLOOD],
    ],
  },
  {
    kind: "hero",
    eyebrow: "ONE SMALL NEW MOON REQUEST",
    lines: [
      ["ANSWER YOUR", ASH],
      ["FEELINGS", BLOOD],
      ["BEFORE THEY", ASH],
      ["START A", ASH],
      ["GROUP CHAT.", BLOOD],
    ],
    cta: "DM ROAST  →  ASTROROAST.COM",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textLines(lines, { x, y, size, leading, family, weight = 400 }) {
  return lines
    .map(([text, color], index) => {
      if (!text) return "";
      return `<text x="${x}" y="${y + index * leading}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${family === "Syne" ? -2.5 : -0.8}">${escapeXml(text)}</text>`;
    })
    .join("\n");
}

function createSlideSvg(slide, index, fonts) {
  const hero = slide.kind === "hero" || slide.kind === "question";
  const content = hero
    ? textLines(slide.lines, {
        x: 88,
        y: slide.kind === "question" ? 320 : 268,
        size: slide.kind === "question" ? 112 : 91,
        leading: slide.kind === "question" ? 106 : 86,
        family: "Syne",
        weight: 800,
      })
    : textLines(slide.lines, {
        x: 88,
        y: 300,
        size: 45,
        leading: 68,
        family: "DM Mono",
      });

  const note = slide.note
    ? slide.note
        .map(
          (line, noteIndex) =>
            `<text x="88" y="${760 + noteIndex * 54}" fill="${noteIndex === slide.note.length - 1 ? BLOOD : ASH}" font-family="DM Mono" font-size="34" letter-spacing="-0.5">${escapeXml(line)}</text>`,
        )
        .join("\n")
    : "";

  const cta = slide.cta
    ? `<text x="88" y="925" fill="${BLOOD}" font-family="DM Mono" font-size="30" letter-spacing="1.2">${escapeXml(slide.cta)}</text>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style>
      @font-face { font-family: "Syne"; src: url("data:font/ttf;base64,${fonts.syne}"); font-weight: 800; }
      @font-face { font-family: "DM Mono"; src: url("data:font/ttf;base64,${fonts.mono}"); font-weight: 400; }
    </style>
    <radialGradient id="ember" cx="92%" cy="8%" r="62%">
      <stop offset="0" stop-color="#220700" stop-opacity="0.65"/>
      <stop offset="1" stop-color="${VOID}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${VOID}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ember)"/>
  <circle cx="1005" cy="76" r="118" fill="none" stroke="${BLOOD}" stroke-width="1" opacity="0.16"/>
  <circle cx="1042" cy="42" r="82" fill="${VOID}" opacity="0.95"/>
  <text x="88" y="90" fill="${BLOOD}" font-family="DM Mono" font-size="20" letter-spacing="3">${escapeXml(slide.eyebrow)}</text>
  <text x="930" y="90" fill="${MUTED}" font-family="DM Mono" font-size="18" letter-spacing="2">${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}</text>
  ${content}
  ${note}
  ${cta}
  <line x1="88" y1="987" x2="992" y2="987" stroke="#1f1f1f" stroke-width="1"/>
  <text x="88" y="1028" fill="${MUTED}" font-family="DM Mono" font-size="17" letter-spacing="2">@ASTROROASTED</text>
  <text x="841" y="1028" fill="${MUTED}" font-family="DM Mono" font-size="17" letter-spacing="2">ASTROROAST.COM</text>
</svg>`;
}

async function render() {
  const [syne, mono] = await Promise.all([
    readFile(join(root, "app", "roast", "[id]", "Syne-ExtraBold.ttf")),
    readFile(join(root, "app", "roast", "[id]", "DMMono-Regular.ttf")),
  ]);
  const fonts = {
    syne: syne.toString("base64"),
    mono: mono.toString("base64"),
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    slides.map(async (slide, index) => {
      const svg = createSlideSvg(slide, index, fonts);
      const output = join(outputDir, `${String(index + 1).padStart(2, "0")}.jpg`);
      await sharp(Buffer.from(svg))
        .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
        .toFile(output);
    }),
  );
}

await render();
