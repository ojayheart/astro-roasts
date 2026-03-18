import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Astro Roasts",
  description: "Terms and conditions for Astro Roasts.",
};

export default function TermsPage() {
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
            Terms of
            <br />
            <span className="text-blood">Service</span>
          </h1>

          <div className="space-y-8 text-ash/80 text-sm md:text-base font-light leading-relaxed">
            <p className="text-ash/40 text-xs uppercase tracking-[0.15em]">
              Last updated: March 18, 2026
            </p>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                1. What This Is
              </h2>
              <p>
                Astro Roasts (&quot;the Service&quot;) is an entertainment
                product operated by Oliver Hart (&quot;we&quot;, &quot;us&quot;).
                We generate comedic natal chart readings based on your birth
                data. This is entertainment, not professional astrological,
                psychological, medical, or financial advice.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                2. Eligibility
              </h2>
              <p>
                You must be at least 18 years old to use this Service. By
                purchasing a roast, you confirm you meet this requirement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                3. What You Get
              </h2>
              <p>
                When you purchase a roast, we calculate your natal chart using
                Swiss Ephemeris astronomical data and generate a comedic reading
                of your chart. You receive a permanent, shareable link to your
                roast.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                4. Payments
              </h2>
              <p>
                All payments are processed by Paddle, our merchant of record.
                Paddle handles billing, tax collection, and payment processing.
                Prices are displayed in your local currency where possible.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                5. Refunds
              </h2>
              <p>
                See our{" "}
                <Link href="/refund" className="text-blood hover:underline">
                  Refund Policy
                </Link>
                .
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                6. Your Data
              </h2>
              <p>
                We collect your birth date, time, and location solely to
                calculate your natal chart. See our{" "}
                <Link href="/privacy" className="text-blood hover:underline">
                  Privacy Policy
                </Link>{" "}
                for full details.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                7. Content Disclaimer
              </h2>
              <p>
                Roasts are AI-generated comedy based on astrological positions.
                They are intentionally exaggerated for comedic effect. We are not
                responsible for hurt feelings, existential crises, or the
                unsettling accuracy of your reading.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                8. Intellectual Property
              </h2>
              <p>
                The roast content generated for you is yours to share. The Astro
                Roasts brand, website design, and underlying technology remain
                our property.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                9. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, Astro Roasts shall not
                be liable for any indirect, incidental, or consequential damages
                arising from your use of the Service. Our total liability is
                limited to the amount you paid for your roast.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                10. Changes
              </h2>
              <p>
                We may update these terms. Continued use of the Service after
                changes constitutes acceptance.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                11. Contact
              </h2>
              <p>
                Questions? Email{" "}
                <a
                  href="mailto:hello@astroroast.com"
                  className="text-blood hover:underline"
                >
                  hello@astroroast.com
                </a>
              </p>
            </section>
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
            <Link
              href="/pricing"
              className="hover:text-ash/60 transition-colors"
            >
              Pricing
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
