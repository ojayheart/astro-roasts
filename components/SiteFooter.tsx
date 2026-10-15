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
// entertainment-only line under the legal links.
export default function SiteFooter({ tagline = false }: { tagline?: boolean }) {
  return (
    <footer className="relative w-full py-14 md:py-16 px-4 md:px-12 lg:px-16 bg-void">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ash/15 to-transparent"
      />
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
        <Link
          href="/"
          className={`interactive font-syne font-bold text-2xl tracking-tighter uppercase leading-none transition-colors hover:text-blood ${FOCUS}`}
        >
          Astro Roasts
        </Link>
        <div className="flex flex-col items-center md:items-end gap-5">
          <ul className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-1 font-mono text-xs uppercase tracking-[0.2em] text-ash/60">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`interactive inline-block py-2 transition-colors hover:text-ash ${FOCUS}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {tagline && (
            <p className="max-w-md md:max-w-xl font-mono text-[11px] leading-relaxed uppercase tracking-[0.2em] text-ash/55 text-center md:text-right text-balance">
              &copy; 2026 Astro Roasts.
              <br />
              For entertainment purposes only, though we both know it&apos;s
              uncomfortably useful.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
