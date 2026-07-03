import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { getRoastUser } from "@/lib/roast-response";
import { storyQuote } from "@/lib/story-quote";

export const runtime = "nodejs";

const VOID = "#030303";
const ASH = "#e5e5e5";
const BLOOD = "#ff2a00";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [syne, dmMono] = await Promise.all([
    readFile(new URL("../Syne-ExtraBold.ttf", import.meta.url)),
    readFile(new URL("../DMMono-Regular.ttf", import.meta.url)),
  ]);

  let names = ["Subject unknown"];
  let quote = storyQuote({ goldLine: null, teaser: null, fullText: null });
  let big3: { label: string; value: string }[] = [];

  try {
    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, id),
      with: { user: true, subjects: { with: { user: true } } },
    });
    if (roast?.status === "ready") {
      names = roast.subjects?.length
        ? [...roast.subjects]
            .sort((a, b) => a.position - b.position)
            .map((s) => s.user.name)
        : [getRoastUser(roast).name];
      quote = storyQuote(roast);
      big3 = [
        { label: "SUN", value: roast.sunSign ?? "" },
        { label: "MOON", value: roast.moonSign ?? "" },
        { label: "RISING", value: roast.rising ?? "" },
      ].filter((p) => p.value);
    }
  } catch {
    // brand-only card
  }

  const nameLine = names.join(" & ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: VOID,
        padding: "120px 88px 100px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 24,
          height: 24,
          backgroundColor: BLOOD,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontFamily: "DM Mono",
          fontSize: 30,
          letterSpacing: "0.25em",
          color: BLOOD,
          textTransform: "uppercase",
        }}
      >
        <div style={{ width: 80, height: 3, backgroundColor: BLOOD }} />
        Case file — {nameLine.length > 24 ? "Astro Roasts" : nameLine}
      </div>

      <div
        style={{
          fontFamily: "Syne",
          fontSize: quote.length > 90 ? 64 : 84,
          lineHeight: 1.15,
          color: ASH,
          letterSpacing: "-0.02em",
          display: "flex",
        }}
      >
        "{quote}"
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {big3.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 56,
              borderTop: "1px solid rgba(229,229,229,0.15)",
              paddingTop: 40,
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
                    fontSize: 22,
                    letterSpacing: "0.2em",
                    color: BLOOD,
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    fontFamily: "Syne",
                    fontSize: 40,
                    color: ASH,
                    textTransform: "uppercase",
                  }}
                >
                  {p.value}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontFamily: "DM Mono",
            fontSize: 26,
            letterSpacing: "0.2em",
            color: "rgba(229,229,229,0.6)",
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>@astroroasted · DM ROAST</span>
          <span>astroroast.com</span>
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Syne", data: syne, weight: 800, style: "normal" },
        { name: "DM Mono", data: dmMono, weight: 400, style: "normal" },
      ],
    },
  );
}
