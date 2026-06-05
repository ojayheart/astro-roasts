import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";
import NoiseOverlay from "@/components/NoiseOverlay";
import CustomCursor from "@/components/CustomCursor";

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

export const metadata: Metadata = {
  title: "Astro Roasts | Radical Cosmic Honesty",
  description:
    "A radically honest, surgically precise teardown of your exact natal chart. Swiss Ephemeris. Zero sugar coating.",
  openGraph: {
    title: "Astro Roasts",
    description: "Stop blaming your moon sign.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${syne.variable} ${dmMono.variable} font-mono text-ash bg-void selection:bg-blood selection:text-void antialiased`}
      >
        <NoiseOverlay />
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
