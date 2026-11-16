import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy | Astro Roasts",
  description: "How we handle your birth data and personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />

      <main className="min-h-screen bg-void px-5 pb-28 pt-32 text-ash md:px-12 md:pt-40 lg:px-16">
        <div className="rise mx-auto max-w-3xl">
          <h1 className="mb-12 font-syne text-[clamp(2.25rem,9vw,4.75rem)] font-extrabold uppercase leading-[0.88] tracking-tighter">
            Privacy
            <br />
            <span className="text-blood">Policy</span>
          </h1>

          <div className="space-y-10 text-base leading-relaxed text-ash/80 md:text-lg">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ash/50">
              Last updated: June 2, 2026
            </p>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
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

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                1. What We Collect
              </h2>
              <p>We collect the minimum data needed to generate your roast:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Birth data:</strong> date, time, and location — used
                    to calculate your natal chart
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Name:</strong> used in your roast (first name only)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Payment data:</strong> processed entirely by Stripe
                    — we never see your card details
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                2. How We Use It
              </h2>
              <p>Your birth data is used exclusively to:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    Calculate your natal chart (Swiss Ephemeris astronomical
                    data)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>Generate your personalised comedic reading</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
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

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                3. Data Storage
              </h2>
              <p>
                Your roast and birth data are stored on Vercel&apos;s
                infrastructure (encrypted at rest). Roasts are accessible via
                their unique URL. We do not use cookies for tracking.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                4. Third Parties
              </h2>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Stripe:</strong> payment processing. See{" "}
                    <a
                      href="https://stripe.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blood hover:underline"
                    >
                      Stripe&apos;s Privacy Policy
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Vercel:</strong> hosting and data storage
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-blood" />
                  <span>
                    <strong>Anthropic:</strong> AI text generation (birth data
                    sent as part of chart interpretation prompt)
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
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

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                6. Children
              </h2>
              <p>
                This Service is not intended for anyone under 18. We do not
                knowingly collect data from minors.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
                7. Changes
              </h2>
              <p>
                We may update this policy. Changes will be posted on this page
                with an updated date.
              </p>
            </section>

            <section className="space-y-4 border-t border-ash/15 pt-8">
              <h2 className="font-syne text-xl font-extrabold uppercase tracking-tight text-ash md:text-2xl">
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

      <SiteFooter />
    </>
  );
}
