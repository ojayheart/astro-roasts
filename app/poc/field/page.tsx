import HeroField from "@/components/HeroField";

export const metadata = {
  title: "POC — particle field",
  robots: { index: false, follow: false },
};

// Throwaway preview route. Renders the WebGL particle field behind a static
// copy of the hero headline so we can judge it as branding. NOT linked from
// anywhere and does NOT touch the live hero.
export default function FieldPocPage() {
  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-void">
      {/* The shader POC */}
      <HeroField />

      {/* faint vignette so the type stays legible over the glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(3,3,3,0.6)_100%)]" />

      {/* static copy of the real hero headline */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
        <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center text-center">
          <h1 className="font-syne font-extrabold text-[13vw] md:text-[min(8vw,8.5rem)] leading-[0.85] tracking-tighter uppercase flex flex-col items-center">
            <span className="whitespace-nowrap">Stop blaming</span>
            <span className="whitespace-nowrap text-outline">your moon</span>
            <span className="whitespace-nowrap text-blood">sign.</span>
          </h1>
          <p className="absolute top-full left-1/2 -translate-x-1/2 mt-6 md:mt-8 w-full max-w-md text-sm md:text-base font-light text-ash/70 leading-relaxed">
            A radically honest, surgically precise teardown of your exact natal
            chart. We see your patterns. We know your delusions.
          </p>
        </div>
      </div>

      {/* POC marker */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/40 select-none">
        POC · particle field — not live
      </div>
    </main>
  );
}
