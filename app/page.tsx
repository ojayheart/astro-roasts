import { headers } from "next/headers";
import BirthForm from "@/components/BirthForm";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { pickCurrencyForCountry, readCountryFromHeaders } from "@/lib/currency";

export default async function Home() {
  // Same geo → currency mapping the payment routes use, so the price shown
  // matches the price charged instead of a hardcoded euro symbol.
  const currency = pickCurrencyForCountry(
    readCountryFromHeaders(await headers()),
  );

  return (
    <>
      <SiteNav disclaimers />

      <main id="main">
        <HeroSection />
        <ManifestoSection />

        {/* Take-the-mic form */}
        <section
          id="mic"
          className="relative min-h-[100dvh] w-full py-24 md:py-32 px-4 md:px-12 lg:px-16 bg-void"
        >
          {/* Hairline divider: fades out at the edges, with a blood tick on
              the content's left edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ash/15 to-transparent"
          />
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-10 text-center md:mb-12">
              <p className="mic-eyebrow mb-5 font-mono text-xs uppercase tracking-[0.2em] text-blood">
                Take the mic
              </p>
              <h2 className="font-syne text-4xl font-extrabold uppercase leading-[0.9] tracking-tighter text-balance md:text-5xl">
                Hold still.
                <br />
                <span className="text-blood">This will sting.</span>
              </h2>
            </div>
            <div className="mx-auto w-full max-w-xl">
              <BirthForm currency={currency} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tagline />
    </>
  );
}
