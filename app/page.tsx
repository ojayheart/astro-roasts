import BirthForm from "@/components/BirthForm";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full p-6 md:p-8 flex justify-between items-start z-40 mix-blend-difference pointer-events-none">
        <div className="font-syne font-bold text-xl tracking-tighter uppercase leading-none">
          Astro
          <br />
          Roasts
        </div>
        <div className="text-xs tracking-[0.15em] uppercase text-right opacity-60">
          * Swiss Ephemeris calculations
          <br />* Comedy, not advice
        </div>
      </nav>

      <HeroSection />
      <ManifestoSection />

      {/* The Confessional Form */}
      <section
        id="confessional"
        className="relative min-h-screen w-full py-32 px-4 md:px-12 lg:px-16 bg-void border-t border-ash/10"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Left: Copy */}
          <div className="flex flex-col justify-start lg:sticky lg:top-32">
            <h2 className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] tracking-tighter mb-8">
              Enter the
              <br />
              <span className="text-blood">Archive</span>
            </h2>
            <div className="space-y-8 text-ash/60 text-sm md:text-base font-light leading-relaxed max-w-md">
              <p>
                Add your birth details and we&apos;ll calculate the chart before
                writing the roast. Exact time gives sharper houses and rising
                sign. A guess still works; the universe will know.
              </p>
              <p>
                Astro Roast is a one-time comedic digital entertainment product.
                It does not predict the future, claim supernatural accuracy, or
                provide medical, legal, financial, psychological, or other
                professional advice.
              </p>
              <p className="pl-5 border-l-2 border-blood text-ash/90">
                Don&apos;t know your birth time? Leave it blank or text the
                person who kept the records. Either answer says something.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:pt-4">
            <BirthForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-ash/10 py-12 px-4 md:px-8 bg-void">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-syne font-bold text-2xl tracking-tighter uppercase">
            Astro Roasts
          </div>
          <div className="flex flex-col items-center md:items-end gap-4">
            <div className="flex gap-6 text-xs uppercase tracking-[0.15em] text-ash/40">
              <Link
                href="/pricing"
                className="hover:text-ash/60 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/terms"
                className="hover:text-ash/60 transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-ash/60 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/refund"
                className="hover:text-ash/60 transition-colors"
              >
                Refund
              </Link>
            </div>
            <div className="text-xs uppercase tracking-[0.15em] text-ash/40 text-center md:text-right">
              &copy; 2026 Astro Roasts.
              <br />
              For entertainment purposes only, though we both know it&apos;s
              uncomfortably useful.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
