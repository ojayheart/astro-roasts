"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#exhibits", label: "Samples" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

const FOCUS =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-4 focus-visible:ring-offset-void";

// Fixed top nav shared by every page. Once the page scrolls, a void scrim
// (gradient + masked blur) fades in behind it so content never collides with
// the logo.
export default function SiteNav() {
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
        className="relative flex justify-between items-center gap-6 px-4 md:px-12 lg:px-16 pt-5 md:pt-8"
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
        <div className="pointer-events-auto flex items-center gap-7 font-mono text-xs uppercase tracking-[0.2em]">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`interactive hidden py-2 text-ash/65 transition-colors hover:text-ash sm:inline-block ${FOCUS}`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/#mic"
            className={`interactive border-b border-blood py-2 text-blood transition-colors hover:border-ash hover:text-ash ${FOCUS}`}
          >
            Roast me
          </Link>
        </div>
      </nav>
    </header>
  );
}
