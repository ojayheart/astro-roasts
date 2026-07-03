import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refund" },
];

// Site footer shared by every page. `tagline` adds the landing page's
// entertainment-only line under the legal links.
export default function SiteFooter({ tagline = false }: { tagline?: boolean }) {
  return (
    <footer className="w-full border-t border-ash/10 py-12 px-4 md:px-8 bg-void">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <Link
          href="/"
          className="font-syne font-bold text-2xl tracking-tighter uppercase"
        >
          Astro Roasts
        </Link>
        <div className="flex flex-col items-center md:items-end gap-4">
          <div className="flex gap-6 text-xs uppercase tracking-[0.15em] text-ash/40">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-ash/60 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
          {tagline && (
            <div className="text-xs uppercase tracking-[0.15em] text-ash/40 text-center md:text-right">
              &copy; 2026 Astro Roasts.
              <br />
              For entertainment purposes only, though we both know it&apos;s
              uncomfortably useful.
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
