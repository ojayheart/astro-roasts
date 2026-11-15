import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refund" },
];

const FOCUS =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-4 focus-visible:ring-offset-void";

// Site footer shared by every page. `tagline` adds the landing page's
// entertainment-only line. The outlined wordmark runs off the bottom edge.
export default function SiteFooter({ tagline = false }: { tagline?: boolean }) {
  return (
    <footer className="relative w-full overflow-hidden bg-void px-4 pt-14 md:px-12 md:pt-16 lg:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ash/15 to-transparent"
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-quote text-2xl italic leading-tight text-ash md:text-3xl">
            Stop blaming your moon sign.
          </p>
          <a
            href="https://www.instagram.com/astroroasted/"
            target="_blank"
            rel="noopener noreferrer"
            className={`link-rule interactive mt-6 inline-block font-mono text-xs uppercase tracking-[0.2em] text-ash/70 ${FOCUS}`}
          >
            @astroroasted on Instagram
          </a>
        </div>
        <div className="flex flex-col gap-5 md:items-end">
          <ul className="-mx-3 flex flex-wrap font-mono text-xs uppercase tracking-[0.2em] text-ash/60 md:justify-end">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`interactive inline-block px-3 py-2 transition-colors hover:text-ash ${FOCUS}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="max-w-md font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-ash/50 md:text-right">
            &copy; 2026 Astro Roasts.
            {tagline && (
              <>
                <br />
                For entertainment purposes only, though we both know it&apos;s
                uncomfortably useful.
              </>
            )}
          </p>
        </div>
      </div>
      <Link
        href="/"
        aria-label="Astro Roasts home"
        className={`wordmark-outline interactive mx-auto mt-12 block w-full max-w-7xl whitespace-nowrap font-syne text-[8.2vw] font-extrabold uppercase leading-[0.8] tracking-tighter transition-colors hover:text-blood/20 md:text-[7.6vw] xl:text-[7rem] -mb-[0.12em] ${FOCUS}`}
      >
        Astro Roasts
      </Link>
    </footer>
  );
}
