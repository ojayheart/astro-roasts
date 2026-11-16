import Link from "next/link";
import SiteNav from "@/components/SiteNav";

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="flex min-h-[100dvh] flex-col justify-center bg-void px-5 py-28 text-ash md:px-12 lg:px-16">
        <div className="rise mx-auto w-full max-w-7xl">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-blood">
            404 · no such case file
          </p>
          <h1 className="font-syne text-[clamp(2rem,7vw,5rem)] font-extrabold uppercase leading-[0.9] tracking-tighter">
            Nothing here.
            <br />
            <span className="text-outline">Not even Saturn.</span>
          </h1>
          <p className="mt-7 max-w-[30rem] font-quote text-2xl italic leading-[1.2] text-ash md:text-[1.75rem]">
            The link is wrong or the page has moved. Your chart is still out
            there.
          </p>
          <Link href="/#mic" className="cta interactive mt-9">
            Roast me
          </Link>
        </div>
      </main>
    </>
  );
}
