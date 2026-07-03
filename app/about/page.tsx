import type { Metadata } from "next";
import AboutSection from "@/components/AboutSection";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About | Astro Roasts",
  description:
    "Born on a yurt floor. How a birth-chart reading turned into a roast.",
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />

      <main id="main" className="min-h-screen bg-void text-ash">
        <AboutSection />
      </main>

      <SiteFooter />
    </>
  );
}
