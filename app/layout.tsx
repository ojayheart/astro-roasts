import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono, Noto_Sans_Symbols_2 } from "next/font/google";
import "./globals.css";
import NoiseOverlay from "@/components/NoiseOverlay";
import CustomCursor from "@/components/CustomCursor";
import PostHogProvider from "@/components/PostHogProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500"],
  display: "swap",
});

// Zodiac glyphs (♈–♓) — self-hosted so every platform draws the same mark
// instead of falling back to OS symbol fonts (tofu on Android/Windows).
const notoSymbols = Noto_Sans_Symbols_2({
  subsets: ["symbols"],
  variable: "--font-symbols",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://astroroast.com",
  ),
  title: "Astro Roasts | Radical Cosmic Honesty",
  description:
    "A radically honest, surgically precise teardown of your exact natal chart. Swiss Ephemeris. Zero sugar coating.",
  openGraph: {
    title: "Astro Roasts",
    description: "Stop blaming your moon sign.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030303",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${syne.variable} ${dmMono.variable} ${notoSymbols.variable} font-mono text-ash bg-void selection:bg-blood selection:text-void antialiased`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-ash focus:text-void focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.2em]"
        >
          Skip to content
        </a>
        <PostHogProvider />
        <NoiseOverlay />
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
