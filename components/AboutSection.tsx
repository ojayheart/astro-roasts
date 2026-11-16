import Link from "next/link";

// The origin story. Syne display, body grotesk for sentences, Bodoni italic
// for the quotes. Reveals are CSS opacity only, so the page reads without
// JavaScript and the text never slides.
export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative w-full overflow-hidden bg-void px-5 pb-28 pt-32 md:px-12 md:pt-40 lg:px-16"
    >
      {/* faint warmth bleeding up from the bruise */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(26,5,0,0.7)_0%,rgba(3,3,3,0)_60%)]" />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <p className="rise mb-6 font-mono text-xs uppercase tracking-[0.2em] text-blood">
          The origin
        </p>
        <h1 className="rise mb-12 font-syne text-[clamp(2.25rem,8.5vw,4rem)] font-extrabold uppercase leading-[0.88] tracking-tighter" style={{ "--d": "120ms" } as React.CSSProperties}>
          Born on a
          <br />
          <span className="text-blood">yurt floor.</span>
        </h1>

        {/* Narrative */}
        <div className="rise space-y-6 text-lg leading-relaxed text-ash/80 md:text-xl" style={{ "--d": "240ms" } as React.CSSProperties}>
          <p className="on-view">
            Astro Roast was born after a shared meal, sitting on the floor of
            our friends&apos; yurt, reading each other&apos;s birth charts.
          </p>
          <p className="on-view">
            Originally we were refining the readings for another project — a
            cyclical calendar tool — but then we got{" "}
            <span className="text-ash">slightly sidetracked.</span>
          </p>
          <p className="on-view">
            One reading felt so accurate, so brutally honest, it had us in
            stitches.
          </p>
        </div>

        {/* Pull-quote 1 */}
        <blockquote className="on-view my-14 border-y border-ash/15 py-8">
          <p className="font-quote text-[1.75rem] italic leading-[1.15] text-ash md:text-[2.5rem]">
            &ldquo;This sounds more like a roast than a reading.&rdquo;
          </p>
          <cite className="mt-5 block font-mono text-xs uppercase not-italic tracking-[0.2em] text-blood">
            — A friend, mid-meal
          </cite>
        </blockquote>

        <p className="on-view text-lg leading-relaxed text-ash/80 md:text-xl">
          It didn&apos;t take us long to wonder: what would a{" "}
          <span className="text-ash">roast</span>{" "}
          sound like based on
          someone&apos;s astrology?
        </p>

        {/* Beat */}
        <p className="on-view font-syne font-extrabold text-3xl md:text-5xl uppercase tracking-tighter leading-[0.95] my-12">
          Astro Roast
          <br />
          <span className="text-outline">was born.</span>
        </p>

        <p className="on-view text-lg leading-relaxed text-ash/80 md:text-xl">
          The wild thing? The roasts felt{" "}
          <span className="text-ash">even more accurate</span>{" "}
          than the
          readings. To the point that a friend&apos;s partner messaged us:
        </p>

        {/* Pull-quote 2 */}
        <blockquote className="on-view my-14 border-y border-ash/15 py-8">
          <p className="font-quote text-[1.75rem] italic leading-[1.15] text-ash md:text-[2.5rem]">
            &ldquo;That&apos;s the most accurate thing I&apos;ve ever read about
            him.&rdquo;
          </p>
          <cite className="mt-5 block font-mono text-xs uppercase not-italic tracking-[0.2em] text-blood">
            — A friend&apos;s partner
          </cite>
        </blockquote>

        <p className="on-view text-lg leading-relaxed text-ash/80 md:text-xl">
          Long story short: everyone wanted one. Olly made a website.{" "}
          <span className="text-ash">Now you can have one too.</span>
        </p>

        {/* The fine print — taken literally */}
        <div className="on-view teaser-block mt-20 pl-6 py-8 pr-4">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-blood">
            The fine print
          </p>
          <div className="space-y-5 text-base leading-relaxed text-ash/80 md:text-lg">
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
        <div className="on-view mt-16 space-y-8">
          <p className="text-lg leading-relaxed text-ash/80 md:text-xl">
            Whether you learn your inner world is —
          </p>
          <p className="border-l border-blood pl-6 font-quote text-2xl italic leading-[1.2] text-ash md:text-[2rem]">
            &ldquo;a research library that is convinced it hasn&apos;t been
            organised properly&rdquo;
          </p>
          <p className="text-lg leading-relaxed text-ash/80 md:text-xl">
            — or that you&apos;ve —
          </p>
          <p className="border-l border-blood pl-6 font-quote text-2xl italic leading-[1.2] text-ash md:text-[2rem]">
            &ldquo;spent the last thirty years perfecting the art of suffering
            beautifully&rdquo;
          </p>
          <p className="text-lg leading-relaxed text-ash/80 md:text-xl">
            — the right metaphor lets you take your weirdness with a bit of
            lightness.
          </p>
        </div>

        {/* Close + CTA */}
        <p className="on-view font-syne font-extrabold text-2xl md:text-4xl uppercase tracking-tighter leading-[0.95] mt-20 mb-10">
          Spirituality takes itself
          <br />
          <span className="text-blood">far too seriously.</span>
          <br />
          So let&apos;s have a bit of fun.
        </p>

        <Link
          href="/#mic"
          className="cta interactive"
        >
          Get your Astro Roast
        </Link>
      </div>
    </section>
  );
}
