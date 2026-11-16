import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Refund Policy | Astro Roasts",
  description: "Our refund policy for Astro Roasts.",
};

export default function RefundPage() {
  return (
    <>
      <SiteNav />

      <main className="min-h-screen bg-void px-5 pb-28 pt-32 text-ash md:px-12 md:pt-40 lg:px-16">
        <div className="rise mx-auto max-w-3xl">
          <h1 className="mb-12 font-syne text-[clamp(2.25rem,9vw,4.75rem)] font-extrabold uppercase leading-[0.88] tracking-tighter">
            Refund
            <br />
            <span className="text-blood">Policy</span>
          </h1>

          <div className="space-y-10 text-base leading-relaxed text-ash/80 md:text-lg">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ash/50">
              Last updated: June 2, 2026
            </p>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                The Short Version
              </h2>
              <p>
                If your roast didn&apos;t generate or something genuinely broke,
                we&apos;ll fix it or refund you. No questions asked.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                What You Purchased
              </h2>
              <p>
                Astro Roast is a one-time comedic digital entertainment product
                delivered through a unique web URL. It is not predictive
                guidance, psychic advice, medical advice, legal advice,
                financial advice, therapy, or any other regulated or
                professional service.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                When We Refund
              </h2>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    Your roast failed to generate due to a technical error
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>You were charged but received no roast</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    You were charged multiple times for the same roast
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                When We Don&apos;t
              </h2>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    You didn&apos;t like what your chart said about you —
                    that&apos;s between you and Saturn
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    You entered the wrong birth details — we calculate exactly
                    what you give us
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                How to Request
              </h2>
              <p>
                Email{" "}
                <a
                  href="mailto:hello@astroroast.com"
                  className="text-blood hover:underline"
                >
                  hello@astroroast.com
                </a>{" "}
                with your roast link and a brief description of the issue.
                We&apos;ll respond within 48 hours.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                Timeframe
              </h2>
              <p>
                Refund requests must be made within 14 days of purchase. Refunds
                are issued via Stripe and typically appear on the original card
                within 5-10 business days.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
