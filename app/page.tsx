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

        {/* The Confessional Form */}
        <section
          id="confessional"
          className="relative min-h-[100dvh] w-full py-32 px-4 md:px-12 lg:px-16 bg-void border-t border-ash/10"
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
            {/* Left: Copy */}
            <div className="flex flex-col justify-start lg:sticky lg:top-32">
              <h2 className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] tracking-tighter mb-8">
                Enter the
                <br />
                <span className="text-blood">Archive</span>
              </h2>
              <div className="space-y-8 text-ash/80 text-base font-light leading-relaxed max-w-md">
                <p>
                  Input your exact birth details. Don&apos;t round to the
                  nearest hour to seem more interesting. The Swiss Ephemeris
                  algorithm calculates planets, houses, and aspects to the exact
                  degree.
                </p>
                <p className="pl-5 border-l-2 border-blood text-ash/90">
                  If you don&apos;t know your exact birth time, text your
                  mother. If you&apos;re not speaking to her, that&apos;s your
                  first roast right there.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:pt-4">
              <BirthForm currency={currency} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tagline />
    </>
  );
}
