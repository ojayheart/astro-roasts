import BirthForm from "@/components/BirthForm";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import SpecimenSection from "@/components/SpecimenSection";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteNav disclaimers />

      <main id="main">
        <HeroSection />
        <ManifestoSection />
        <SpecimenSection />

        {/* The Confessional Form */}
        <section
          id="confessional"
          className="relative min-h-[100dvh] w-full py-32 px-4 md:px-12 lg:px-16 bg-void border-t border-ash/10"
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
            {/* Left: Copy */}
            <div className="flex flex-col justify-start lg:sticky lg:top-32">
              <h2 className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] tracking-tighter mb-8">
                Enter the
                <br />
                <span className="text-blood">Archive</span>
              </h2>
              <div className="space-y-8 text-ash/80 text-base font-light leading-relaxed max-w-md">
                <p>
                  Add your birth details and we&apos;ll calculate the chart
                  before writing the roast. Exact time gives sharper houses and
                  rising sign. A guess still works; the universe will know.
                </p>
                <p>
                  Astro Roast is a one-time comedic digital entertainment
                  product. It does not predict the future, claim supernatural
                  accuracy, or provide medical, legal, financial, psychological,
                  or other professional advice.
                </p>
                <p className="pl-5 border-l-2 border-blood text-ash/90">
                  Don&apos;t know your birth time? Leave it blank or text the
                  person who kept the records. Either answer says something.
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
