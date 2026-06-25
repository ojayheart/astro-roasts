import Link from "next/link";

// Fixed top nav shared by every page. `disclaimers` shows the landing page's
// right-hand microcopy block.
export default function SiteNav({
  disclaimers = false,
}: {
  disclaimers?: boolean;
}) {
  return (
    <nav className="fixed top-0 left-0 w-full p-6 md:p-8 flex justify-between items-start z-40 mix-blend-difference pointer-events-none">
      <Link
        href="/"
        className="font-syne font-bold text-xl tracking-tighter uppercase leading-none pointer-events-auto"
      >
        Astro
        <br />
        Roasts
      </Link>
      {disclaimers && (
        <div className="text-xs tracking-[0.15em] uppercase text-right opacity-60">
          * Swiss Ephemeris Data
          <br />* Zero Sugar Coating
        </div>
      )}
    </nav>
  );
}
