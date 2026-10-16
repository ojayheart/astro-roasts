"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// The origin story. Editorial brutalist voice — Syne display + DM Mono body,
// void/blood/ash palette. Reveal-on-scroll is guarded per reduce-motion via
// gsap.matchMedia (CSS can't kill JS timelines).
export default function AboutSection() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const reveals = gsap.utils.toArray<HTMLElement>("#about .about-reveal");
      reveals.forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 85%" },
          y: 32,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
        });
      });
    });

    return () => {
      mm.revert();
    };
  }, []);

  return (
    <section
      id="about"
      ref={rootRef}
      className="relative w-full py-32 px-4 md:px-12 lg:px-16 bg-void border-t border-ash/10 overflow-hidden"
    >
      {/* faint warmth bleeding up from the bruise */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(26,5,0,0.7)_0%,rgba(3,3,3,0)_60%)]" />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <p className="about-reveal font-mono text-xs tracking-[0.3em] uppercase text-blood mb-6">
          * The Origin
        </p>
        <h2 className="about-reveal font-syne font-extrabold text-4xl md:text-6xl lg:text-7xl uppercase leading-[0.9] tracking-tighter mb-12">
          Born on a
          <br />
          <span className="text-blood">yurt floor.</span>
        </h2>

        {/* Narrative */}
        <div className="space-y-7 font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
          <p className="about-reveal">
            Astro Roast was born after a shared meal, sitting on the floor of
            our friends&apos; yurt, reading each other&apos;s birth charts.
          </p>
          <p className="about-reveal">
            Originally we were refining the readings for another project — a
            cyclical calendar tool — but then we got{" "}
            <span className="text-ash">slightly sidetracked.</span>
          </p>
          <p className="about-reveal">
            One reading felt so accurate, so brutally honest, it had us in
            stitches.
          </p>
        </div>

        {/* Pull-quote 1 */}
        <blockquote className="about-reveal callout my-12 pl-6 pr-4 py-6 border-l-2 border-blood">
          <p className="font-mono text-lg md:text-2xl text-ash leading-snug">
            &ldquo;This sounds more like a roast than a reading.&rdquo;
          </p>
          <cite className="mt-4 block not-italic font-syne font-bold text-xs uppercase tracking-[0.15em] text-blood">
            — A friend, mid-meal
          </cite>
        </blockquote>

        <p className="about-reveal font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
          It didn&apos;t take us long to wonder: what would a{" "}
          <span className="text-ash">roast</span> sound like based on
          someone&apos;s astrology?
        </p>

        {/* Beat */}
        <p className="about-reveal font-syne font-extrabold text-3xl md:text-5xl uppercase tracking-tighter leading-[0.95] my-12">
          Astro Roast
          <br />
          <span className="text-outline">was born.</span>
        </p>

        <p className="about-reveal font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
          The wild thing? The roasts felt{" "}
          <span className="text-ash">even more accurate</span> than the
          readings. To the point that a friend&apos;s partner messaged us:
        </p>

        {/* Pull-quote 2 */}
        <blockquote className="about-reveal callout my-12 pl-6 pr-4 py-6 border-l-2 border-blood">
          <p className="font-mono text-lg md:text-2xl text-ash leading-snug">
            &ldquo;That&apos;s the most accurate thing I&apos;ve ever read about
            him.&rdquo;
          </p>
          <cite className="mt-4 block not-italic font-syne font-bold text-xs uppercase tracking-[0.15em] text-blood">
            — A friend&apos;s partner
          </cite>
        </blockquote>

        <p className="about-reveal font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
          Long story short: everyone wanted one. Olly made a website.{" "}
          <span className="text-ash">Now you can have one too.</span>
        </p>

        {/* The fine print — taken literally */}
        <div className="about-reveal teaser-block mt-20 pl-6 py-8 pr-4">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-blood mb-5">
            * The Fine Print
          </p>
          <div className="space-y-6 font-mono text-sm md:text-base font-light leading-relaxed text-ash/75">
            <p>
              This started as a way of having fun with friends. But it quietly
              did something else — it let us connect in unexpected ways.
            </p>
            <p>
              Those quirks we all have, that our friends know we have, that we
              pretend don&apos;t exist because they feel a little tender — they
              were suddenly out in the open. Playful. Funny. Held lightly.
            </p>
            <p>
              You have to know someone pretty well to see their quirks. And when
              you stop tip-toeing around them and embrace them instead, they can
              deepen a relationship. Reflected back at us, they help us
              understand ourselves better.
            </p>
          </div>
        </div>

        {/* Metaphor specimens — rendered like roast lines */}
        <div className="about-reveal mt-16 space-y-8">
          <p className="font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
            Whether you learn your inner world is —
          </p>
          <p className="font-mono text-lg md:text-2xl italic text-ash leading-snug pl-6 border-l border-ash/20">
            &ldquo;a research library that is convinced it hasn&apos;t been
            organised properly&rdquo;
          </p>
          <p className="font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
            — or that you&apos;ve —
          </p>
          <p className="font-mono text-lg md:text-2xl italic text-ash leading-snug pl-6 border-l border-ash/20">
            &ldquo;spent the last thirty years perfecting the art of suffering
            beautifully&rdquo;
          </p>
          <p className="font-mono text-base md:text-lg font-light leading-relaxed text-ash/80">
            — the right metaphor lets you take your weirdness with a bit of
            lightness.
          </p>
        </div>

        {/* Close + CTA */}
        <p className="about-reveal font-syne font-extrabold text-2xl md:text-4xl uppercase tracking-tighter leading-[0.95] mt-20 mb-10">
          Spirituality takes itself
          <br />
          <span className="text-blood">far too seriously.</span>
          <br />
          So let&apos;s have a bit of fun.
        </p>

        <Link
          href="/#mic"
          className="interactive group inline-flex items-center gap-3 font-syne font-bold text-sm uppercase tracking-[0.15em] text-void bg-ash px-8 py-4 hover:bg-blood hover:text-ash transition-colors duration-300"
        >
          Get your Astro Roast
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
