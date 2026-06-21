import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing | Astro Roasts",
  description: "What it costs to get cosmically roasted.",
};

export default function PricingPage() {
  return (
    <>
      <SiteNav />

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
                  $5
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

            <div className="border border-ash/10 p-8">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter mb-4">
                Entertainment Only
              </h2>
              <p>
                Astro Roast is a one-time comedic digital entertainment product.
                The roast is generated from user-provided birth details and
                astronomical chart calculations, then delivered instantly via a
                unique web URL. It is not predictive guidance, psychic advice,
                medical advice, legal advice, financial advice, therapy, or any
                other regulated or professional service.
              </p>
            </div>

            <p className="text-ash/40 text-xs uppercase tracking-[0.15em]">
              One-time payment. No subscriptions. The cosmos doesn&apos;t do
              recurring billing.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
