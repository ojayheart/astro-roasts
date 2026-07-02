import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { getRoastUser } from "@/lib/roast-response";
import { pullQuote } from "@/lib/story-quote";

export const alt = "Astro Roasts — case file";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VOID = "#030303";
const ASH = "#e5e5e5";
const BLOOD = "#ff2a00";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // fs read, not fetch — node runtime can't fetch file: URLs; the new URL()
  // reference also makes the bundler trace the .ttf into the deployment.
  const [syne, dmMono] = await Promise.all([
    readFile(new URL("./Syne-ExtraBold.ttf", import.meta.url)),
    readFile(new URL("./DMMono-Regular.ttf", import.meta.url)),
  ]);

  let name = "Subject unknown";
  let big3: { label: string; value: string }[] = [];
  let quote = pullQuote(null);

  try {
    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, id),
      with: { user: true, subjects: { with: { user: true } } },
    });
    if (roast?.status === "ready") {
      name = getRoastUser(roast).name;
      big3 = [
        { label: "SUN", value: roast.sunSign ?? "" },
        { label: "MOON", value: roast.moonSign ?? "" },
        { label: "RISING", value: roast.rising ?? "" },
      ].filter((p) => p.value);
      quote = pullQuote(roast.teaser ?? roast.fullText);
    }
  } catch {
    // Fall through to the brand-only card.
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: VOID,
        padding: "56px 64px",
        position: "relative",
      }}
    >
      {/* corner mark */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 16,
          height: 16,
          backgroundColor: BLOOD,
        }}
      />

      {/* eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontFamily: "DM Mono",
          fontSize: 22,
          letterSpacing: "0.25em",
          color: BLOOD,
          textTransform: "uppercase",
        }}
      >
        <div style={{ width: 64, height: 2, backgroundColor: BLOOD }} />
        Case file — Astro Roasts
      </div>

      {/* name */}
      <div
        style={{
          fontFamily: "Syne",
          fontSize: name.length > 14 ? 96 : 128,
          color: ASH,
          textTransform: "uppercase",
          letterSpacing: "-0.04em",
          lineHeight: 0.9,
          display: "flex",
        }}
      >
        {name}
      </div>

      {/* quote */}
      <div
        style={{
          fontFamily: "DM Mono",
          fontSize: 30,
          lineHeight: 1.4,
          color: "rgba(229,229,229,0.75)",
          maxWidth: 980,
          display: "flex",
        }}
      >
        “{quote}”
      </div>

      {/* big three */}
      <div
        style={{
          display: "flex",
          gap: 64,
          borderTop: "1px solid rgba(229,229,229,0.15)",
          paddingTop: 32,
        }}
      >
        {big3.map((p) => (
          <div
            key={p.label}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                fontFamily: "DM Mono",
                fontSize: 18,
                letterSpacing: "0.2em",
                color: BLOOD,
              }}
            >
              {p.label}
            </div>
            <div
              style={{
                fontFamily: "Syne",
                fontSize: 36,
                color: ASH,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}
            >
              {p.value}
            </div>
          </div>
        ))}
        <div
          style={{
            marginLeft: "auto",
            alignSelf: "flex-end",
            fontFamily: "DM Mono",
            fontSize: 18,
            letterSpacing: "0.2em",
            color: "rgba(229,229,229,0.4)",
            textTransform: "uppercase",
          }}
        >
          astroroast.com
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Syne", data: syne, weight: 800, style: "normal" },
        { name: "DM Mono", data: dmMono, weight: 400, style: "normal" },
      ],
    },
  );
}
