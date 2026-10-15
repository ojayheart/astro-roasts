import BirthForm from "@/components/BirthForm";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
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
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-blood mb-5">
                Exhibit A: you
              </p>
              <h2 className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] tracking-tighter mb-8">
                Let&apos;s see
                <br />
                <span className="text-blood">the damage.</span>
              </h2>
              <div className="space-y-8 text-ash/80 text-base font-light leading-relaxed max-w-md">
                <p>
                  Give exact details and the Swiss Ephemeris places every
                  planet, house and aspect to the degree. That&apos;s more
                  attention than anyone has ever paid you. Don&apos;t round to
                  the nearest hour to seem more interesting.
                </p>
                <ul className="space-y-2.5 font-mono text-xs uppercase tracking-[0.12em] text-ash/60">
                  {[
                    "Free teaser first. Pay once you've flinched.",
                    "Maths first, insults second. A couple of minutes.",
                    "No subscription. No 7am texts about Mercury.",
                  ].map((line) => (
                    <li key={line} className="flex gap-3">
                      <span aria-hidden className="text-blood">
                        ✦
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="pl-5 border-l-2 border-blood text-ash/90 text-lg leading-snug">
                  Don&apos;t know your birth time? Text your mum. She&apos;ll
                  reply with the minute, the weather and every hour of labour,
                  itemised. Not speaking to her? That&apos;s your free teaser.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:pt-4">
              <BirthForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tagline />
    </>
  );
}
