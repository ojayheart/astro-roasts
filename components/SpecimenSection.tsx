import SignGlyph from "./SignGlyph";
import Redacted from "./Redacted";

// The product, shown before the form: one real-shaped dossier excerpt so a
// visitor knows exactly what a roast looks like before entering the archive.
export default function SpecimenSection() {
  return (
    <section
      aria-labelledby="specimen-heading"
      className="relative w-full py-28 md:py-40 px-4 md:px-12 lg:px-16 bg-void border-t border-ash/10"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
        {/* Left rail */}
        <div className="lg:col-span-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-blood mb-6 flex items-center gap-4">
            <span className="w-12 h-px bg-blood" />
            Exhibit
          </p>
          <h2
            id="specimen-heading"
            className="font-syne font-extrabold text-4xl md:text-5xl uppercase leading-[0.9] tracking-tighter mb-8"
          >
            One file,
            <br />
            <span className="text-outline">unsealed.</span>
          </h2>
          <p className="text-ash/70 text-base font-light leading-relaxed max-w-sm">
            Every roast reads like this: your exact placements, named and
            cross-examined. The redactions lift when the file is yours.
          </p>
        </div>

        {/* The specimen card */}
        <div className="lg:col-span-8 lg:pl-8">
          <article className="relative border border-ash/15 bg-void p-6 md:p-10 overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 bg-blood" />

            {/* Stamp */}
            <div
              aria-hidden="true"
              className="absolute top-6 right-4 md:top-8 md:right-8 rotate-[8deg] border-2 border-blood/70 text-blood/70 font-syne font-extrabold uppercase tracking-[0.2em] text-xs px-3 py-1.5 select-none"
            >
              Specimen
            </div>

            {/* Subject row — right padding keeps the stamp clear of the data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pr-24 md:pr-36 text-xs tracking-[0.2em] uppercase text-ash/60 font-light border-b border-ash/10 pb-6 mb-8">
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Subject
                </span>
                <span className="text-ash font-medium">Wiktor</span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Sun
                </span>
                <span className="text-ash font-medium">
                  Scorpio <SignGlyph sign="Scorpio" />
                </span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Moon
                </span>
                <span className="text-ash font-medium">
                  Cancer <SignGlyph sign="Cancer" />
                </span>
              </div>
              <div>
                <span className="block text-blood mb-1.5 text-[10px] font-bold">
                  Rising
                </span>
                <span className="text-ash font-medium">
                  Capricorn <SignGlyph sign="Capricorn" />
                </span>
              </div>
            </div>

            {/* Excerpt */}
            <div className="space-y-6 text-lg md:text-xl text-ash/90 font-light leading-relaxed">
              <p>
                Mercury in Scorpio doesn&apos;t make small talk. It makes
                incisions. You&apos;ve rewritten text messages more times than
                most people rewrite their CVs, and every draft gets colder —
                somewhere there&apos;s a museum of the warm versions you never
                sent.
              </p>
              <p>
                <Redacted text="The Saturn square is where it gets personal. Joy has a permit system, applications reviewed quarterly by a committee of your worst memories, and the eighth house keeps minutes of every meeting you swore you'd forgotten." />
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-ash/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/40">
                Case 0034 · 14 pages · unlocked by subject
              </span>
              <a
                href="#confessional"
                className="interactive inline-flex items-center justify-center px-6 py-3 min-h-[44px] bg-ash text-void font-syne font-bold text-sm uppercase tracking-[0.1em] hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300"
              >
                Open your own file
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
