import AstroWheel from "./AstroWheel";

// Landing hero. Server-rendered and visible without JavaScript: the reveal is
// a CSS opacity fade, so the headline and the call to action never wait on a
// script. The wheel hangs off the right edge; the type holds the left.
export default function HeroSection({ price }: { price: string }) {
  return (
    <section className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden px-4 pb-8 pt-28 md:px-12 md:pb-10 md:pt-32 lg:px-16">
      <AstroWheel
        intensity={0.34}
        className="astro-wheel-mask rise pointer-events-none absolute right-[-58vw] top-[38%] h-auto w-[150vw] -translate-y-1/2 text-ash md:right-[-22vw] md:top-1/2 md:w-[min(92vw,128dvh)]"
      />
      {/* Keeps the type legible where it crosses the wheel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void via-void/70 to-transparent md:via-void/40"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end md:justify-center">
        <p
          className="rise mb-6 font-mono text-xs uppercase tracking-[0.2em] text-blood md:mb-8"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          Birth chart roasts
        </p>

        <h1 className="font-syne text-[10.4vw] font-extrabold uppercase leading-[0.84] tracking-tighter md:text-[min(7.4vw,8.5rem)]">
          <span className="rise block md:whitespace-nowrap">
            Stop <br className="md:hidden" />
            blaming
          </span>
          <span
            className="rise text-outline block whitespace-nowrap"
            style={{ "--d": "160ms" } as React.CSSProperties}
          >
            your moon
          </span>
          <span
            className="rise block whitespace-nowrap text-blood"
            style={{ "--d": "320ms" } as React.CSSProperties}
          >
            sign.
          </span>
        </h1>

        <p
          className="rise mt-7 max-w-[30rem] font-quote text-[1.6rem] italic leading-[1.18] text-ash md:mt-10 md:text-[2.1rem]"
          style={{ "--d": "520ms" } as React.CSSProperties}
        >
          Your birth chart, read back to you by someone who isn&apos;t being
          polite about it.
        </p>

        <div
          className="rise mt-8 flex flex-wrap items-center gap-x-8 gap-y-5 md:mt-10"
          style={{ "--d": "680ms" } as React.CSSProperties}
        >
          <a href="#mic" className="cta interactive">
            Roast me
          </a>
          <a
            href="#exhibits"
            className="link-rule interactive font-mono text-xs uppercase tracking-[0.2em] text-ash/80"
          >
            Read the evidence first
          </a>
        </div>
      </div>

      <dl
        className="rise relative z-10 mx-auto mt-12 grid w-full max-w-7xl grid-cols-2 gap-x-6 gap-y-5 border-t border-ash/15 pt-5 md:mt-0 md:grid-cols-4"
        style={{ "--d": "840ms" } as React.CSSProperties}
      >
        {[
          ["The opening", "Free"],
          ["The whole thing", price],
          ["Time to verdict", "Five minutes"],
          ["Sugar coating", "Zero"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash/50">
              {label}
            </dt>
            <dd className="mt-1.5 font-syne text-lg font-bold uppercase leading-none tracking-tight md:text-xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
