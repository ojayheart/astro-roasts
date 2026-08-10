/**
 * Recompute-and-invalidate for a corrected birth record.
 *
 * A birth time moved by ten minutes moves the ascendant and every house cusp,
 * so every chart cached off the old details is wrong from that moment on: the
 * wheel on the roast page, the bi-wheel a duo draws, and the witty per-element
 * lines written against them.
 *
 * The rule is overwrite, never blank. `roasts.chart_json` is replaced with the
 * freshly cast chart in the same write, so a paid roast never renders an empty
 * circle while a recompute is pending — if the cast fails, nothing is touched
 * at all and the old chart keeps drawing. Only `chart_annotations` is cleared,
 * because that is the artefact the existing queue knows how to rebuild: the
 * same "stale, not cached" treatment `queueChartAnnotationsIfReady` already
 * gives duo roasts holding solo-keyed lines.
 *
 * Kept free of the db client and of the runner call, in the shape of
 * `lib/account-api.ts`, so the tests exercise it without Neon and without
 * network.
 */

import type { NatalChart } from "./types.ts";

export type BirthDetails = {
  dob: string;
  birthTime: string | null;
  birthCity: string;
};

/** Everything `computeChart` needs. Structurally a `ChartSubject`. */
export type BirthSubject = BirthDetails & { name: string };

/** One roast that may hold a chart cast from this user's birth details. */
export type CachedRoast = {
  id: string;
  userId: string;
  chartJson: NatalChart | null;
  subjectCharts: NatalChart[] | null;
  chartAnnotations: unknown;
};

export type SubjectRow = {
  roastId: string;
  userId: string;
  position: number;
};

/** A single roast's worth of writes. Absent fields are left as they are. */
export type RoastChartRefresh = {
  roastId: string;
  chartJson?: NatalChart;
  subjectCharts?: NatalChart[];
  /** Cached wheel copy describes the old chart — drop it and requeue. */
  clearAnnotations: boolean;
};

/**
 * True when the correction actually changes the chart. A PUT that resends the
 * same details is a no-op, and a no-op must not pay for a runner cast or
 * requeue a model call for the annotations.
 */
export function birthDetailsChanged(
  before: BirthDetails | null | undefined,
  after: BirthDetails,
): boolean {
  if (!before) return true;
  return (
    before.dob !== after.dob ||
    (before.birthTime ?? null) !== (after.birthTime ?? null) ||
    before.birthCity !== after.birthCity
  );
}

/**
 * Which slot of a roast's chart cache belongs to this user, or null when the
 * roast holds no chart of theirs.
 *
 * Mirrors `/api/chart`: subjects in position order when there are any, the
 * owner alone otherwise. A group roast someone else owns still counts if the
 * user is one of its subjects — their chart sits in `subject_charts`.
 */
export function chartSlotFor(
  userId: string,
  roast: CachedRoast,
  subjects: SubjectRow[],
): number | null {
  const rows = subjects
    .filter((s) => s.roastId === roast.id)
    .sort((a, b) => a.position - b.position);

  if (!rows.length) return roast.userId === userId ? 0 : null;

  const slot = rows.findIndex((s) => s.userId === userId);
  return slot === -1 ? null : slot;
}

/**
 * The writes a fresh chart implies, one entry per roast that actually changes.
 * A roast with nothing cached yet is skipped — there is no stale artefact to
 * correct, and `/api/chart` will cast it from the corrected row on first view.
 */
export function planChartRefresh(
  userId: string,
  roasts: CachedRoast[],
  subjects: SubjectRow[],
  fresh: NatalChart,
): RoastChartRefresh[] {
  const out: RoastChartRefresh[] = [];

  for (const roast of roasts) {
    const slot = chartSlotFor(userId, roast, subjects);
    if (slot === null) continue;

    const plan: RoastChartRefresh = {
      roastId: roast.id,
      clearAnnotations: false,
    };

    // chart_json is person 1's chart on every roast that has one.
    if (slot === 0 && roast.chartJson) plan.chartJson = fresh;

    const cached = roast.subjectCharts;
    if (Array.isArray(cached) && cached.length > slot) {
      plan.subjectCharts = cached.map((c, i) => (i === slot ? fresh : c));
    }

    if (!plan.chartJson && !plan.subjectCharts) continue;
    plan.clearAnnotations = Boolean(roast.chartAnnotations);
    out.push(plan);
  }

  return out;
}

export type RefreshPorts = {
  /** Every roast the user could hold a chart in, plus the subject rows. */
  cachedCharts: (
    userId: string,
  ) => Promise<{ roasts: CachedRoast[]; subjects: SubjectRow[] }>;
  /** `computeChart` — one runner round-trip, null on any failure. */
  cast: (subject: BirthSubject) => Promise<NatalChart | null>;
  applyRefresh: (plan: RoastChartRefresh) => Promise<void>;
  /** `queueChartAnnotationsIfReady` — decides for itself whether to send. */
  queueAnnotations: (roastId: string) => Promise<boolean>;
};

export type RefreshResult = {
  recomputed: boolean;
  refreshed: string[];
  requeued: string[];
};

/**
 * Cast the corrected chart once, then rewrite every cache that held the old
 * one. Never throws and never leaves a roast chart-less: a failed cast returns
 * `recomputed: false` with nothing written.
 */
export async function refreshChartsAfterBirthChange(
  userId: string,
  subject: BirthSubject,
  ports: RefreshPorts,
): Promise<RefreshResult> {
  const empty: RefreshResult = {
    recomputed: false,
    refreshed: [],
    requeued: [],
  };

  const { roasts, subjects } = await ports.cachedCharts(userId);
  if (!roasts.length) return empty;

  const fresh = await ports.cast(subject);
  if (!fresh) return empty;

  const plans = planChartRefresh(userId, roasts, subjects, fresh);
  const refreshed: string[] = [];
  const requeued: string[] = [];

  for (const plan of plans) {
    await ports.applyRefresh(plan);
    refreshed.push(plan.roastId);
    // Only a roast whose lines were just dropped needs rebuilding; the queue
    // still applies its own paid/full-text gates before spending anything.
    if (plan.clearAnnotations && (await ports.queueAnnotations(plan.roastId))) {
      requeued.push(plan.roastId);
    }
  }

  return { recomputed: true, refreshed, requeued };
}
