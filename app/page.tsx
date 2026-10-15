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
          className="relative min-h-[100dvh] w-full py-24 md:py-32 px-4 md:px-12 lg:px-16 bg-void"
        >
          {/* Hairline divider: fades out at the edges, with a blood tick on
              the content's left edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ash/15 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 px-4 md:px-12 lg:px-16"
          >
            <div className="max-w-6xl mx-auto">
              <div className="h-px w-12 bg-blood" />
            </div>
          </div>
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
            {/* Left: Copy */}
            <div className="flex flex-col justify-start lg:sticky lg:top-32">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-blood mb-6">
                Exhibit A: you
              </p>
              <h2 className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] tracking-tighter text-balance mb-8 md:mb-10">
                Hold still.
                <br />
                <span className="text-blood">This will sting.</span>
              </h2>
              <div className="space-y-8 text-ash/80 text-base font-light leading-relaxed max-w-md text-pretty">
                <p>
                  Give exact details and we map where every planet was the
                  minute you arrived. That&apos;s more
                  attention than anyone has ever paid you. Don&apos;t round to
                  the nearest hour to seem more interesting.
                </p>
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
