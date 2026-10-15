"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ZodiacAvatar from "./ZodiacAvatar";
import type { ZodiacSign } from "./zodiacPaths";

const ROAST_LINES: {
  quote: string;
  author: string;
  placement: string;
  sign: ZodiacSign;
}[] = [
  {
    quote:
      "Tea and feelings — but the tea's brewed at the temperature of the earth's core. You serve it smiling, then act surprised when someone mentions the burns. Hospitality as siege warfare. The doilies are load-bearing.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "You don't experience feelings. You undergo them, the way buildings undergo demolition. Afterwards you sweep the rubble behind the couch and call it processing.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "Two people stacked in a trench coat — and the scary one got the outside. Visitors knock and the soft one answers through the letterbox. Nobody's been past the hallway since 2019. You call this boundaries; the chart calls it a moat.",
    author: "Noor",
    placement: "Scorpio Rising",
    sign: "Scorpio",
  },
  {
    quote:
      "You text the emotional bomb, then follow up twenty minutes later with “what I meant was—”. The clarification is always longer than the detonation. Forensics could reconstruct your relationships from the edit history alone.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "You've rewritten text messages more times than most people rewrite their CVs. Every draft gets colder, and you call that maturity. Somewhere there's a museum of the warm versions you never sent.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "The 12th-house Venus is writing poetry. Mars is guarding the notebook with a sword. Nobody has read a single stanza in eleven years, and you wonder why people describe you as hard to know. The poems are good — that's the tragedy.",
    author: "Noor",
    placement: "Scorpio Rising",
    sign: "Scorpio",
  },
  {
    quote:
      "Joy has a permit system. Applications are reviewed quarterly by a committee of your worst memories. Approved fun must be completed quietly and is subject to inspection. Saturn signed off on this, and you framed the signature.",
    author: "Delia",
    placement: "Cancer Rising",
    sign: "Cancer",
  },
  {
    quote:
      "A sommelier of your own darkness. You swirl the mood, sniff it, announce the vintage — ah yes, 2014, abandonment with oak notes. Connoisseurship is not the same as healing. But God, the cellar is impressive.",
    author: "Marcus",
    placement: "Scorpio Sun",
    sign: "Scorpio",
  },
  {
    quote:
      "Give her a Capricorn Ascendant so she walks into every room like she's about to chair a meeting, FIVE fire planets so the meeting is secretly a bonfire, an Aries stellium in the 3rd house so her mouth is a flamethrower that thinks it's making polite conversation.",
    author: "Imogen",
    placement: "Aries Sun",
    sign: "Aries",
  },
  {
    quote:
      "Her mind works like a duck: smooth on the surface, paddling FURIOUSLY underneath.",
    author: "Theo",
    placement: "Gemini Sun",
    sign: "Gemini",
  },
];

const ROTATION_MS = 9000;

export default function ManifestoSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  // Auto-rotate carousel — paused when off-screen, when user opts out via the
  // pause button, or under prefers-reduced-motion.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;

    const el = carouselRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    io.observe(el);

    const id = setInterval(() => {
      if (!visibleRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      setActive((i) => (i + 1) % ROAST_LINES.length);
    }, ROTATION_MS);

    return () => {
      clearInterval(id);
      io.disconnect();
    };
  }, [paused]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    // Scroll-scrub manifesto text only when reduce-motion is off.
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const manifestoTexts = gsap.utils.toArray<HTMLElement>(".manifesto-text");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#manifesto",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });
      manifestoTexts.forEach((text, i) => {
        if (i !== 0) {
          tl.to(text, { opacity: 1, duration: 1 }, "+=0.5");
        }
        if (i !== manifestoTexts.length - 1) {
          tl.to(text, { opacity: 0, duration: 1 }, "+=1");
        }
      });

      gsap.from("#confessional h2", {
        scrollTrigger: { trigger: "#confessional", start: "top 70%" },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });

      gsap.from("#confessional .confessional-eyebrow", {
        scrollTrigger: { trigger: "#confessional", start: "top 60%" },
        y: 30,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
      });

      gsap.from("#confessional form > div", {
        scrollTrigger: { trigger: "#confessional form", start: "top 70%" },
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
      });
    });

    // Under reduce-motion: skip the scroll-scrub and just show all manifesto
    // text statically. Leave only the final text visible.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      const manifestoTexts = gsap.utils.toArray<HTMLElement>(".manifesto-text");
      manifestoTexts.forEach((text, i) => {
        gsap.set(text, { opacity: i === manifestoTexts.length - 1 ? 1 : 0 });
      });
    });

    return () => {
      mm.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      id="manifesto"
      ref={sectionRef}
      className="relative h-[200vh] md:h-[300vh] w-full bg-void"
    >
      <div className="sticky top-0 h-[100dvh] w-full flex items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(26,5,0,0.8)_0%,rgba(3,3,3,1)_70%)] opacity-50" />

        <div className="relative z-10 w-full max-w-5xl mx-auto text-center font-syne font-bold text-4xl md:text-7xl uppercase tracking-tight leading-[1.1]">
          <div className="manifesto-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-100">
            Your therapist is
            <br />
            <span className="text-outline">too nice.</span>
          </div>
          <div className="manifesto-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-0">
            Co-star is
            <br />
            <span className="text-outline">too vague.</span>
          </div>
          <div className="manifesto-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-0">
            The cosmos is
            <br />
            <span className="text-blood">neither.</span>
          </div>
          <div className="manifesto-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-0">
            <div
              ref={carouselRef}
              role="region"
              aria-label="Sample roast lines"
              aria-roledescription="carousel"
              className="relative min-h-[32rem] sm:min-h-[26rem] md:min-h-[24rem] flex items-center justify-center"
            >
              {ROAST_LINES.map((t, i) => (
                <figure
                  key={i}
                  aria-hidden={i !== active}
                  className={`absolute inset-0 m-0 flex items-center justify-center px-1 normal-case font-normal tracking-normal transition-[opacity,transform] duration-700 ease-out ${
                    i === active
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                >
                  <div className="testimonial-card w-full max-w-2xl rounded-[28px] p-6 text-left md:p-8">
                    <figcaption className="flex items-center gap-3.5">
                      <ZodiacAvatar sign={t.sign} className="h-12 w-12" />
                      <div className="min-w-0">
                        <div className="font-syne text-base font-bold leading-tight text-ash">
                          {t.author}
                        </div>
                        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ash/50">
                          {t.placement}
                        </div>
                      </div>
                    </figcaption>
                    <blockquote className="mt-5 text-[17px] leading-relaxed text-pretty text-ash/90 md:mt-6 md:text-xl md:leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                  </div>
                </figure>
              ))}
            </div>

            <div
              role="tablist"
              aria-label="Roast line"
              className="mt-8 flex items-center justify-center"
            >
              {ROAST_LINES.map((_, i) => (
                // 24px+ hit area; the visible pill is the inner span.
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Show roast line ${i + 1} of ${ROAST_LINES.length}`}
                  onClick={() => setActive(i)}
                  className="interactive group h-8 min-w-6 px-[9px] flex items-center justify-center focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={`block h-1.5 rounded-full transition-all duration-500 ease-out group-focus-visible:ring-2 group-focus-visible:ring-blood group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-void ${
                      i === active
                        ? "w-8 bg-blood"
                        : "w-1.5 bg-ash/30 group-hover:bg-ash/70"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className="interactive font-mono text-[11px] tracking-[0.2em] uppercase text-ash/60 hover:text-blood focus-visible:outline-none focus-visible:text-blood focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-blood transition-colors min-h-[44px] px-3"
              >
                {paused ? "Play roast lines" : "Pause roast lines"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
