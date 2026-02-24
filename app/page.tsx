import BirthForm from "@/components/BirthForm";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";

export default function Home() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full p-6 md:p-8 flex justify-between items-start z-40 mix-blend-difference pointer-events-none">
        <div className="font-syne font-bold text-xl tracking-tighter uppercase leading-none">
          Astro
          <br />
          Roasts
        </div>
        <div className="text-xs tracking-[0.15em] uppercase text-right opacity-60">
          * Swiss Ephemeris Data
          <br />* Zero Sugar Coating
        </div>
      </nav>

      <HeroSection />
      <ManifestoSection />

      {/* The Confessional Form */}
      <section
        id="confessional"
        className="relative min-h-screen w-full py-24 px-4 md:px-8 bg-void border-t border-ash/10"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
          {/* Left: Copy */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            <h2 className="font-syne font-extrabold text-5xl md:text-7xl uppercase leading-none tracking-tighter mb-8">
              Enter the
              <br />
              <span className="text-blood">Archive</span>
            </h2>
            <div className="space-y-6 text-ash/70 text-sm md:text-base font-light leading-relaxed">
              <p>
                Input your exact birth details. Don&apos;t round to the nearest
                hour to seem more interesting. The Swiss Ephemeris algorithm
                calculates planets, houses, and aspects to the exact degree.
              </p>
              <p className="pl-4 border-l border-blood text-ash">
                If you don&apos;t know your exact birth time, text your mother.
                If you&apos;re not speaking to her, that&apos;s your first roast
                right there.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-7">
            <BirthForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-ash/10 py-12 px-4 md:px-8 bg-void">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-syne font-bold text-2xl tracking-tighter uppercase">
            Astro Roasts
          </div>
          <div className="text-xs uppercase tracking-[0.15em] text-ash/40 text-center md:text-right">
            &copy; 2025 Astro Roasts.
            <br />
            For entertainment purposes only, though we both know it&apos;s true.
          </div>
        </div>
      </footer>
    </>
  );
}
