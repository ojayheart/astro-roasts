import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Astro Roasts",
  description: "What it costs to get cosmically roasted.",
};

export default function PricingPage() {
  return (
    <>
      <nav className="fixed top-0 left-0 w-full p-6 md:p-8 flex justify-between items-start z-40 mix-blend-difference pointer-events-none">
        <Link
          href="/"
          className="font-syne font-bold text-xl tracking-tighter uppercase leading-none pointer-events-auto"
        >
          Astro
          <br />
          Roasts
        </Link>
      </nav>

      <main className="min-h-screen bg-void text-ash pt-32 pb-24 px-4 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-syne font-extrabold text-5xl md:text-6xl uppercase leading-[0.9] tracking-tighter mb-12">
            Pricing
          </h1>

          <div className="space-y-8 text-ash/80 text-sm md:text-base font-light leading-relaxed">
            <div className="border border-ash/10 p-8 md:p-12">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-syne font-bold text-2xl md:text-3xl uppercase tracking-tighter">
                  The Roast
                </h2>
                <span className="font-syne font-extrabold text-3xl md:text-4xl text-blood">
                  $9
                </span>
              </div>
              <ul className="space-y-3 text-ash/60">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    Full natal chart calculation via Swiss Ephemeris — planets,
                    houses, aspects to the exact degree
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    A radically honest, surgically precise comedic reading of
                    your entire chart
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    Permanent link to your roast — revisit it whenever you need
                    to be humbled
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>Shareable — inflict it on friends, enemies, exes</span>
                </li>
              </ul>
            </div>

            <p className="text-ash/40 text-xs uppercase tracking-[0.15em]">
              One-time payment. No subscriptions. The cosmos doesn&apos;t do
              recurring billing.
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-ash/10 py-12 px-4 md:px-8 bg-void">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <Link
            href="/"
            className="font-syne font-bold text-2xl tracking-tighter uppercase"
          >
            Astro Roasts
          </Link>
          <div className="flex gap-6 text-xs uppercase tracking-[0.15em] text-ash/40">
            <Link href="/terms" className="hover:text-ash/60 transition-colors">
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
        </div>
      </footer>
    </>
  );
}
