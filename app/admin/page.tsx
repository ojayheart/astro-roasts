import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  getRoastStats,
  getStripeRevenue,
  listRoasts,
  type RoastRow,
} from "@/lib/admin-data";
import LogoutButton from "./LogoutButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  // Stable UTC formatting — avoids server/client locale drift.
  return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-ash/15 p-4">
      <div className="text-[0.6rem] uppercase tracking-[0.2em] text-ash/45">
        {label}
      </div>
      <div
        className={`mt-2 font-syne text-2xl font-bold ${accent ? "text-blood" : "text-ash"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "ready"
      ? "text-emerald-400 border-emerald-400/40"
      : status === "error"
        ? "text-blood border-blood/40"
        : "text-amber-400 border-amber-400/40";
  return (
    <span
      className={`inline-block border ${color} px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em]`}
    >
      {status}
    </span>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(sp.page) > 0 ? Math.floor(Number(sp.page)) : 0;

  const [stats, list, revenue] = await Promise.all([
    getRoastStats(),
    listRoasts({ q, page }),
    getStripeRevenue(),
  ]);

  const revenueEntries = Object.entries(revenue.byCurrency).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const buildHref = (overrides: { q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextPage = overrides.page ?? page;
    if (nextQ) params.set("q", nextQ);
    if (nextPage > 0) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-blood text-[0.65rem] uppercase tracking-[0.4em]">
            Astroroast
          </p>
          <h1 className="font-syne text-2xl font-extrabold uppercase tracking-tight">
            Admin Console
          </h1>
        </div>
        <LogoutButton />
      </div>

      {/* Summary cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Total roasts" value={String(stats.totalRoasts)} />
        <Stat label="Paid" value={String(stats.paid)} accent />
        <Stat label="Unpaid" value={String(stats.unpaid)} />
        <Stat label="Conversion" value={`${stats.conversionPct}%`} />
        <Stat label="Users" value={String(stats.totalUsers)} />
        <Stat label="Last 24h" value={String(stats.last24h)} />
        <Stat label="Last 7d" value={String(stats.last7d)} />
        <Stat label="Last 30d" value={String(stats.last30d)} />
      </section>

      {/* Status + revenue */}
      <section className="grid md:grid-cols-2 gap-3 mb-10">
        <div className="border border-ash/15 p-4">
          <div className="text-[0.6rem] uppercase tracking-[0.2em] text-ash/45 mb-3">
            Roast status
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(stats.statusCounts).length === 0 ? (
              <span className="text-ash/40 text-sm">No roasts yet</span>
            ) : (
              Object.entries(stats.statusCounts).map(([status, c]) => (
                <span key={status} className="text-sm">
                  <StatusBadge status={status} />{" "}
                  <span className="text-ash/70">{c}</span>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="border border-ash/15 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[0.6rem] uppercase tracking-[0.2em] text-ash/45">
              Stripe revenue (net)
            </div>
            <div className="text-[0.55rem] uppercase tracking-[0.15em] text-ash/35">
              {revenue.ok
                ? `${revenue.chargeCount} charges${revenue.capped ? " (capped)" : ""}`
                : "unavailable"}
            </div>
          </div>
          {revenue.ok ? (
            revenueEntries.length === 0 ? (
              <span className="text-ash/40 text-sm">No succeeded charges</span>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {revenueEntries.map(([cur, amt]) => (
                  <div key={cur}>
                    <span className="font-syne text-xl font-bold text-blood">
                      {fmtMoney(amt, cur)}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-ash/40 text-xs leading-relaxed">
              {revenue.error}
              <br />
              Paid counts above come from the database and are accurate
              regardless.
            </p>
          )}
        </div>
      </section>

      {/* Search */}
      <form action="/admin" method="GET" className="mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="flex-1 bg-transparent border border-ash/20 focus:border-blood outline-none px-4 py-2.5 text-sm text-ash transition-colors"
        />
        <button
          type="submit"
          className="border border-ash/20 hover:border-blood hover:text-blood uppercase tracking-[0.2em] text-[0.65rem] px-5 transition-colors"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin"
            className="flex items-center border border-ash/10 hover:border-ash/40 uppercase tracking-[0.2em] text-[0.65rem] px-4 text-ash/60 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Results meta */}
      <div className="flex items-center justify-between mb-2 text-[0.65rem] uppercase tracking-[0.15em] text-ash/40">
        <span>
          {list.total} result{list.total === 1 ? "" : "s"}
          {q ? ` for “${q}”` : ""}
        </span>
        <span>
          Page {list.page + 1} / {list.pageCount}
        </span>
      </div>

      {/* Roasts table */}
      <div className="overflow-x-auto border border-ash/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.6rem] uppercase tracking-[0.15em] text-ash/45 border-b border-ash/15">
              <th className="px-3 py-2.5 font-normal">Name</th>
              <th className="px-3 py-2.5 font-normal">Email</th>
              <th className="px-3 py-2.5 font-normal">DOB</th>
              <th className="px-3 py-2.5 font-normal">Birthplace</th>
              <th className="px-3 py-2.5 font-normal">Signs</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Paid</th>
              <th className="px-3 py-2.5 font-normal">Created</th>
              <th className="px-3 py-2.5 font-normal">Roast</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ash/40">
                  No roasts found.
                </td>
              </tr>
            ) : (
              list.rows.map((r: RoastRow) => (
                <tr
                  key={r.id}
                  className="border-b border-ash/10 hover:bg-ash/[0.03]"
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-2.5 text-ash/70 whitespace-nowrap">
                    {r.email ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-ash/70 whitespace-nowrap">
                    {r.dob}
                  </td>
                  <td className="px-3 py-2.5 text-ash/70 whitespace-nowrap">
                    {r.birthCity}
                  </td>
                  <td className="px-3 py-2.5 text-ash/60 whitespace-nowrap">
                    {[r.sunSign, r.moonSign, r.rising]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    {r.paid ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-ash/30">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-ash/60 whitespace-nowrap">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/roast/${r.id}`}
                      target="_blank"
                      className="text-blood hover:underline"
                    >
                      open ↗
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        {list.page > 0 ? (
          <Link
            href={buildHref({ page: list.page - 1 })}
            className="border border-ash/20 hover:border-blood hover:text-blood uppercase tracking-[0.2em] text-[0.65rem] px-4 py-2 transition-colors"
          >
            ← Prev
          </Link>
        ) : (
          <span />
        )}
        {list.page + 1 < list.pageCount ? (
          <Link
            href={buildHref({ page: list.page + 1 })}
            className="border border-ash/20 hover:border-blood hover:text-blood uppercase tracking-[0.2em] text-[0.65rem] px-4 py-2 transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
