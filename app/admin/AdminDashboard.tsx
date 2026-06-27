"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./admin.module.css";

type Tab = "roasts" | "buyers" | "money";
type Filter = "all" | "unsent" | "errors" | "unpaid";

type RoastItem = {
  id: string;
  name: string;
  email: string | null;
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  status: string;
  paid: boolean;
  emailSent: boolean;
  createdAt: string;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function when(iso: string | number) {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("roasts");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  }

  return (
    <div className={styles.shell}>
      <div className={styles.rowTop}>
        <strong>AstroRoast Admin</strong>
        <button className={styles.chip} onClick={logout}>
          Log out
        </button>
      </div>
      <div className={styles.tabs}>
        {(["roasts", "buyers", "money"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "roasts" && <RoastsTab />}
      {tab === "buyers" && <BuyersTab />}
      {tab === "money" && <MoneyTab />}
    </div>
  );
}

function RoastsTab() {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<RoastItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/roasts?filter=${filter}`);
    const data = await res.json();
    setRows(data.roasts ?? []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resendAll() {
    if (!confirm("Resend the roast email to ALL unsent buyers?")) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filter: "unsent" }),
    });
    const data = await res.json();
    const sent = (data.results ?? []).filter(
      (r: { sent: boolean }) => r.sent,
    ).length;
    setMsg(`Sent ${sent} / ${data.results?.length ?? 0}`);
    setBusy(false);
    load();
  }

  const FILTERS: Filter[] = ["all", "unsent", "errors", "unpaid"];
  const labels: Record<Filter, string> = {
    all: "All",
    unsent: "Paid · not emailed",
    errors: "Errors",
    unpaid: "Unpaid",
  };

  return (
    <>
      <div className={styles.chips}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {labels[f]}
          </button>
        ))}
      </div>
      {filter === "unsent" && rows.length > 0 && (
        <button className={styles.button} onClick={resendAll} disabled={busy}>
          {busy ? "Sending…" : `Resend all (${rows.length})`}
        </button>
      )}
      {msg && <div className={styles.muted}>{msg}</div>}
      {rows.map((r) => (
        <div key={r.id} className={styles.row}>
          <div
            className={styles.rowTop}
            onClick={() => setOpen(open === r.id ? null : r.id)}
          >
            <div>
              <div className={styles.name}>{r.name}</div>
              <div className={styles.meta}>
                {[r.sunSign, r.moonSign, r.rising]
                  .filter(Boolean)
                  .join(" · ") || "—"}{" "}
                · {when(r.createdAt)}
              </div>
            </div>
            <div className={styles.dots}>
              <span
                className={`${styles.dot} ${r.paid ? styles.dotOn : ""}`}
                title="paid"
              />
              <span
                className={`${styles.dot} ${r.emailSent ? styles.dotOn : r.paid ? styles.dotWarn : ""}`}
                title="emailed"
              />
            </div>
          </div>
          {open === r.id && <RoastDetail id={r.id} onChange={load} />}
        </div>
      ))}
      {rows.length === 0 && <div className={styles.muted}>No roasts.</div>}
    </>
  );
}

function RoastDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/roasts?id=${id}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [id]);

  async function act(path: string, label: string) {
    if (!confirm(`${label} for this roast?`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roastId: id }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `${label} ✓` : `Failed: ${data.error ?? res.status}`);
    onChange();
  }

  if (!detail) return <div className={styles.muted}>Loading…</div>;
  const d = detail as Record<string, string | null>;
  return (
    <div>
      <div className={styles.meta}>
        {d.email ?? "no email"} · {d.gender ?? "—"} · {d.dob}{" "}
        {d.birthTime ?? ""} · {d.birthCity}
      </div>
      <div className={styles.meta}>status: {d.status}</div>
      {d.title && (
        <div className={styles.detailText}>
          <strong>{d.title}</strong>
        </div>
      )}
      {d.fullText && <div className={styles.detailText}>{d.fullText}</div>}
      {d.validationNotes && (
        <div className={styles.muted}>QA: {d.validationNotes}</div>
      )}
      <div className={styles.actions}>
        <button
          className={styles.chip}
          disabled={busy}
          onClick={() => act("resend", "Resend email")}
        >
          Resend email
        </button>
        <button
          className={styles.chip}
          disabled={busy}
          onClick={() => act("regenerate", "Regenerate")}
        >
          Regenerate
        </button>
      </div>
      {msg && <div className={styles.muted}>{msg}</div>}
    </div>
  );
}

function BuyersTab() {
  const [rows, setRows] = useState<
    {
      userId: string;
      name: string;
      email: string | null;
      firstPaidAt: string;
      roastIds: string[];
      amount: number | null;
      currency: string | null;
    }[]
  >([]);
  useEffect(() => {
    fetch("/api/admin/buyers")
      .then((r) => r.json())
      .then((d) => setRows(d.buyers ?? []));
  }, []);
  return (
    <>
      {rows.map((b) => (
        <div key={b.userId} className={styles.row}>
          <div className={styles.name}>{b.name}</div>
          <div className={styles.meta}>
            {b.email ?? "no email"} · {when(b.firstPaidAt)} ·{" "}
            {b.amount != null && b.currency ? money(b.amount, b.currency) : "—"}{" "}
            · {b.roastIds.length} roast{b.roastIds.length > 1 ? "s" : ""}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className={styles.muted}>No buyers yet.</div>}
    </>
  );
}

function MoneyTab() {
  const [data, setData] = useState<
    | {
        byCurrency: {
          currency: string;
          last30d: number;
          allTime: number;
          count: number;
        }[];
        recent: {
          amount: number;
          currency: string;
          created: number;
          roastId: string | null;
          status: string;
        }[];
      }
    | { error: string }
    | null
  >(null);
  useEffect(() => {
    fetch("/api/admin/money")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className={styles.muted}>Loading…</div>;
  if ("error" in data)
    return <div className={styles.error}>Stripe error: {data.error}</div>;

  return (
    <>
      {data.byCurrency.map((c) => (
        <div key={c.currency} className={styles.row}>
          <div className={styles.name}>{c.currency.toUpperCase()}</div>
          <div className={styles.meta}>
            Last 30d: {money(c.last30d, c.currency)} · All-time:{" "}
            {money(c.allTime, c.currency)} · {c.count} sales
          </div>
        </div>
      ))}
      <div className={styles.muted} style={{ margin: "12px 0 6px" }}>
        Recent payments
      </div>
      {data.recent.map((p, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.rowTop}>
            <span>{money(p.amount, p.currency)}</span>
            <span className={styles.muted}>{when(p.created)}</span>
          </div>
        </div>
      ))}
      {data.byCurrency.length === 0 && (
        <div className={styles.muted}>No payments yet.</div>
      )}
    </>
  );
}
