import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import {
  formatPrice,
  pickCurrencyForCountry,
  readCountryFromHeaders,
} from "@/lib/currency";

export const metadata: Metadata = {
  title: "Pricing | Astro Roasts",
  description: "What it costs to get cosmically roasted.",
};

export default async function PricingPage() {
  const currency = pickCurrencyForCountry(
    readCountryFromHeaders(await headers()),
  );

  return (
    <>
      <SiteNav />

      <main
        id="main"
        className="min-h-screen bg-void px-4 pb-24 pt-36 text-ash md:px-12 md:pt-44 lg:px-16"
      >
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-blood">
            Pricing
          </p>
          <div className="grid gap-y-10 border-b border-ash/15 pb-14 lg:grid-cols-12 lg:items-end">
            <h1 className="font-syne text-[clamp(2.5rem,6vw,5.75rem)] font-extrabold uppercase leading-[0.86] tracking-tighter lg:col-span-8">
              One roast.
              <br />
              <span className="text-outline">One price.</span>
            </h1>
            <div className="lg:col-span-4 lg:text-right">
              <div className="font-syne text-[clamp(4.5rem,11vw,9rem)] font-extrabold leading-[0.8] tracking-tighter text-blood">
                {formatPrice(500, currency)}
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-ash/55">
                Once. The opening is free.
              </p>
            </div>
          </div>

          <ul className="text-base leading-relaxed text-ash/80 md:text-lg">
            {[
              [
                "Free preview first",
                "The chart wheel and the opening of the reading, before you pay anything.",
              ],
              [
                "Your full birth chart",
                "Worked out to the minute you arrived.",
              ],
              [
                "The whole reading",
                "A radically honest, surgically precise comedic reading of your entire chart.",
              ],
              [
                "A permanent link",
                "Revisit it whenever you need to be humbled.",
              ],
              ["Shareable", "Inflict it on friends, enemies, exes."],
            ].map(([title, text]) => (
              <li
                key={title}
                className="grid gap-x-10 gap-y-2 border-b border-ash/15 py-6 md:grid-cols-12 md:items-baseline md:py-7"
              >
                <h2 className="font-syne text-xl font-extrabold uppercase leading-none tracking-tighter text-ash md:col-span-4 md:text-2xl">
                  {title}
                </h2>
                <p className="max-w-xl md:col-span-8">{text}</p>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <Link href="/#mic" className="cta interactive">
              Roast me
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-ash/50">
              One-time payment. No subscriptions. The cosmos doesn&apos;t do
              recurring billing.
            </p>
          </div>

          <div className="mt-20 grid gap-x-10 gap-y-4 border-t border-ash/15 pt-8 md:grid-cols-12">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ash/55 md:col-span-4">
              Entertainment only
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-ash/65 md:col-span-8 md:text-base">
              Astro Roast is a one-time comedic digital entertainment product.
              The roast is generated from user-provided birth details and
              astronomical chart calculations, then delivered instantly via a
              unique web URL. It is not predictive guidance, psychic advice,
              medical advice, legal advice, financial advice, therapy, or any
              other regulated or professional service.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
