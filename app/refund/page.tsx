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

      <main className="min-h-screen bg-void text-ash pt-32 pb-24 px-4 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-syne font-extrabold text-5xl md:text-6xl uppercase leading-[0.9] tracking-tighter mb-12">
            Refund
            <br />
            <span className="text-blood">Policy</span>
          </h1>

          <div className="space-y-8 text-ash/80 text-sm md:text-base font-light leading-relaxed">
            <p className="text-ash/40 text-xs uppercase tracking-[0.15em]">
              Last updated: June 2, 2026
            </p>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                The Short Version
              </h2>
              <p>
                If your roast didn&apos;t generate or something genuinely broke,
                we&apos;ll fix it or refund you. No questions asked.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
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

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                When We Refund
              </h2>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    Your roast failed to generate due to a technical error
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>You were charged but received no roast</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    You were charged multiple times for the same roast
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                When We Don&apos;t
              </h2>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    You didn&apos;t like what your chart said about you —
                    that&apos;s between you and Saturn
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    You entered the wrong birth details — we calculate exactly
                    what you give us
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
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

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
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
