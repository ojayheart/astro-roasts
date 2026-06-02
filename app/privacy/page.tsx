import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Astro Roasts",
  description: "How we handle your birth data and personal information.",
};

export default function PrivacyPage() {
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
            Privacy
            <br />
            <span className="text-blood">Policy</span>
          </h1>

          <div className="space-y-8 text-ash/80 text-sm md:text-base font-light leading-relaxed">
            <p className="text-ash/40 text-xs uppercase tracking-[0.15em]">
              Last updated: June 2, 2026
            </p>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                Entertainment-Only Product
              </h2>
              <p>
                Astro Roast is a one-time comedic digital entertainment product
                operated by Nebula Limited. We use birth details only to
                calculate chart positions and generate a humorous roast. We do
                not use this data to make decisions about people, provide
                predictions, provide professional advice, or infer eligibility
                for any regulated service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                1. What We Collect
              </h2>
              <p>We collect the minimum data needed to generate your roast:</p>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Birth data:</strong> date, time, and location — used
                    to calculate your natal chart
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Name:</strong> used in your roast (first name only)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Payment data:</strong> processed entirely by Paddle
                    — we never see your card details
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                2. How We Use It
              </h2>
              <p>Your birth data is used exclusively to:</p>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    Calculate your natal chart (Swiss Ephemeris astronomical
                    data)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>Generate your personalised comedic reading</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    Store your roast so you can access it via your link
                  </span>
                </li>
              </ul>
              <p>
                We do not sell, share, or use your data for advertising. We do
                not build profiles. We do not track you across the web.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                3. Data Storage
              </h2>
              <p>
                Your roast and birth data are stored on Vercel&apos;s
                infrastructure (encrypted at rest). Roasts are accessible via
                their unique URL. We do not use cookies for tracking.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                4. Third Parties
              </h2>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Paddle:</strong> payment processing (merchant of
                    record). See{" "}
                    <a
                      href="https://www.paddle.com/legal/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blood hover:underline"
                    >
                      Paddle&apos;s Privacy Policy
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Vercel:</strong> hosting and data storage
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blood mt-1">*</span>
                  <span>
                    <strong>Anthropic:</strong> AI text generation (birth data
                    sent as part of chart interpretation prompt)
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                5. Your Rights
              </h2>
              <p>
                You can request deletion of your data at any time by emailing{" "}
                <a
                  href="mailto:hello@astroroast.com"
                  className="text-blood hover:underline"
                >
                  hello@astroroast.com
                </a>
                . We will delete your roast and associated birth data within 30
                days.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                6. Children
              </h2>
              <p>
                This Service is not intended for anyone under 18. We do not
                knowingly collect data from minors.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                7. Changes
              </h2>
              <p>
                We may update this policy. Changes will be posted on this page
                with an updated date.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-syne font-bold text-xl uppercase tracking-tighter">
                8. Contact
              </h2>
              <p>
                Questions about your data? Email{" "}
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
            <Link href="/terms" className="hover:text-ash/60 transition-colors">
              Terms
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
