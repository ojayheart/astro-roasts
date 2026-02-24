"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function ManifestoSection() {
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
          <div className="manifesto-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-0 text-2xl md:text-5xl normal-case font-normal font-mono">
            &ldquo;It told me my fear of intimacy is masked as high standards. I
            cried, paid $5, and cried again.&rdquo;
            <div className="mt-6 text-sm uppercase tracking-[0.15em] text-blood font-syne font-bold">
              — Anonymous, Virgo Sun
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
