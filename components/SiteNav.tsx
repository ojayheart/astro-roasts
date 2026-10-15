"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Fixed top nav shared by every page. `disclaimers` shows the landing page's
// right-hand microcopy block. Once the page scrolls, a void scrim (gradient +
// masked blur) fades in behind it so content never collides with the logo.
export default function SiteNav({
  disclaimers = false,
}: {
  disclaimers?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 pointer-events-none">
      <div
        aria-hidden
        className={`nav-scrim absolute inset-x-0 top-0 h-32 md:h-40 transition-opacity duration-500 ease-out ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      <nav
        aria-label="Primary"
        className="relative flex justify-between items-start gap-6 px-4 md:px-12 lg:px-16 pt-5 md:pt-8"
      >
        <Link
          href="/"
          aria-label="Astro Roasts home"
          className="interactive font-syne font-bold text-xl tracking-tighter uppercase leading-none pointer-events-auto rounded-sm transition-colors hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-4 focus-visible:ring-offset-void"
        >
          Astro
          <br />
          Roasts
        </Link>
        {disclaimers && (
          <div className="font-mono text-[11px] md:text-xs leading-relaxed tracking-[0.2em] uppercase text-right text-ash/60">
            * Zero Sugar Coating
            <br />* Mild Emotional Damage
          </div>
        )}
      </nav>
    </header>
  );
}
