"use client";

import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const ROAST_LINES = [
  {
    quote:
      "Tea and feelings — but the tea's brewed at the temperature of the earth's core.",
    author: "Sierra, Cancer Rising",
  },
  {
    quote: "You don't experience feelings. You undergo them.",
    author: "Wiktor, Scorpio Stellium",
  },
  {
    quote:
      "Two people stacked in a trench coat — and the scary one got the outside.",
    author: "Sage, Scorpio Rising",
  },
  {
    quote: "You don't communicate. You detonate meaning.",
    author: "Sierra, Cancer Rising",
  },
  {
    quote: "You don't date — you conduct emotional archaeology.",
    author: "Wiktor, Scorpio Stellium",
  },
  {
    quote: "Mercury in Scorpio doesn't make small talk. It makes incisions.",
    author: "Sage, Scorpio Rising",
  },
  {
    quote:
      "You text the emotional bomb, then follow up twenty minutes later with “what I meant was—”.",
    author: "Sierra, Cancer Rising",
  },
  {
    quote: "You burn like radioactive material, not like a campfire.",
    author: "Wiktor, Scorpio Stellium",
  },
  {
    quote:
      "The 12th-house Venus is writing poetry. Mars is guarding the notebook with a sword.",
    author: "Sage, Scorpio Rising",
  },
  {
    quote:
      "You talk the way satellites transmit — huge range, no idea if anyone's receiving.",
    author: "Sierra, Cancer Rising",
  },
  {
    quote:
      "You've rewritten text messages more times than most people rewrite their CVs.",
    author: "Wiktor, Scorpio Stellium",
  },
  {
    quote: "Joy has a permit system.",
    author: "Sage, Scorpio Rising",
  },
  {
    quote: "Stop apologising for the weather system and let it rain.",
    author: "Sierra, Cancer Rising",
  },
  {
    quote: "A sommelier of your own darkness.",
    author: "Wiktor, Scorpio Stellium",
  },
  {
    quote: "And for the love of God, tell someone about the textiles.",
    author: "Sage, Scorpio Rising",
  },
];

export default function ManifestoSection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % ROAST_LINES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

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

    // Form section reveal
    gsap.from("#confessional h2", {
      scrollTrigger: { trigger: "#confessional", start: "top 70%" },
      y: 50,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
    });

    gsap.from("#confessional p", {
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

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section id="manifesto" className="relative h-[300vh] w-full bg-void">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4">
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
            <div className="relative min-h-[12rem] md:min-h-[16rem] flex items-center justify-center">
              {ROAST_LINES.map((t, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 flex flex-col items-center justify-center px-2 text-xl md:text-3xl normal-case font-normal font-mono leading-snug transition-opacity duration-700 ease-in-out ${
                    i === active
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  &ldquo;{t.quote}&rdquo;
                  <div className="mt-6 text-sm uppercase tracking-[0.15em] text-blood font-syne font-bold">
                    — {t.author}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center justify-center gap-3">
              {ROAST_LINES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === active ? "w-8 bg-blood" : "w-1.5 bg-ash/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
