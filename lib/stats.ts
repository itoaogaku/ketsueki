import { GRADE_OPTIONS } from "./types";
import type { BloodTestRecord, Grade } from "./types";

/** Japanese academic year (April-March): a date in Jan-Mar belongs to the
 * academic year that started the previous April. */
export function academicYear(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

// 実業団には学年番号がない（大学の学年という概念の外側にいるため）ので
// キーを持たせない - enteringAcademicYearはこの場合undefinedを受けて
// nullを返す。
const GRADE_NUMBER: Partial<Record<Grade, number>> = { "1年": 1, "2年": 2, "3年": 3, "4年": 4 };

/** The academic year a player entered the university, derived from one of
 * their graded records (e.g. 3年 tested during the 2025 academic year
 * entered in 2023). null for a record with no grade, a grade with no
 * associated year number (高校生・実業団), or no grade at all - those don't
 * say anything about entering year. */
export function enteringAcademicYear(record: BloodTestRecord): number | null {
  if (!record.grade) return null;
  const gradeNumber = GRADE_NUMBER[record.grade];
  if (gradeNumber === undefined) return null;
  return academicYear(record.date) - (gradeNumber - 1);
}

export interface ComparisonGroup {
  key: string;
  label: string;
  match: (r: BloodTestRecord) => boolean;
}

export interface DateNormalizationEntry {
  date: string;
  playerCount: number;
  /** "anchor" = a main testing day on its own; "merged" = folded into a
   * nearby anchor date (e.g. a handful of players tested late/make-up);
   * "excluded" = too far from any anchor day to treat as the same round. */
  status: "anchor" | "merged" | "excluded";
  mergedInto?: string;
}

export interface DateNormalization {
  /** original date -> the anchor date its records should be counted under.
   * Only contains entries for dates that are kept (anchor or merged); an
   * excluded date has no entry. */
  toAnchor: Map<string, string>;
  entries: DateNormalizationEntry[];
}

/**
 * A few testing rounds needed a manual call the player-count threshold
 * can't make on its own:
 * - 2022年4月18〜23日 was one round spread across several low-turnout days;
 *   2022-04-26 (1 player) is 8 days out, just past the automatic ±7-day
 *   window, so it's named explicitly.
 * - 2023-07-24 (30 players) fell just under the 40-player anchor threshold.
 * - 2026-05-10 / 2026-07-04 are the女子選手用ダッシュボード（/joshi）の基準日 -
 *   女子チームは人数が少なく、40人という閾値に自動で届かないため。
 * Naming a date here promotes it to an anchor even under the threshold, and
 * every other date within `windowDays` still folds into it automatically -
 * so 2022-04-19〜23 don't need to be listed, only the explicit 04-26.
 */
export const MANUAL_ANCHOR_DATES = ["2022-04-18", "2023-07-24", "2026-05-10", "2026-07-04"];
export const MANUAL_DATE_MERGES: Record<string, string> = {
  "2022-04-26": "2022-04-18",
};

/**
 * Groups test dates around "main testing days" so a handful of players who
 * tested late (a make-up day for whoever missed the main round) don't show
 * up as their own thin, misleading data point. A date with at least
 * `anchorMinPlayers` distinct players tested, or named in `manualAnchors`,
 * is an anchor; any other date within `windowDays` of the nearest anchor -
 * or named in `manualMerges` - is folded into it; anything further out is
 * dropped from date-based comparisons entirely.
 */
export function buildDateNormalization(
  records: BloodTestRecord[],
  {
    anchorMinPlayers = 40,
    windowDays = 7,
    manualAnchors = MANUAL_ANCHOR_DATES,
    manualMerges = MANUAL_DATE_MERGES,
  }: {
    anchorMinPlayers?: number;
    windowDays?: number;
    manualAnchors?: string[];
    manualMerges?: Record<string, string>;
  } = {}
): DateNormalization {
  const playersByDate = new Map<string, Set<string>>();
  for (const r of records) {
    if (!playersByDate.has(r.date)) playersByDate.set(r.date, new Set());
    playersByDate.get(r.date)!.add(r.player);
  }
  const allDates = Array.from(playersByDate.keys()).sort();
  const toMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const manualAnchorSet = new Set(manualAnchors);
  const anchors = allDates.filter(
    (d) => playersByDate.get(d)!.size >= anchorMinPlayers || manualAnchorSet.has(d)
  );
  const anchorTimes = anchors.map(toMs);

  const toAnchor = new Map<string, string>();
  const entries: DateNormalizationEntry[] = [];
  for (const d of allDates) {
    const playerCount = playersByDate.get(d)!.size;
    if (anchors.includes(d)) {
      toAnchor.set(d, d);
      entries.push({ date: d, playerCount, status: "anchor" });
      continue;
    }
    if (manualMerges[d]) {
      toAnchor.set(d, manualMerges[d]);
      entries.push({ date: d, playerCount, status: "merged", mergedInto: manualMerges[d] });
      continue;
    }
    const t = toMs(d);
    let bestAnchor: string | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const dist = Math.abs(t - anchorTimes[i]);
      if (dist <= windowDays * 86400000 && dist < bestDist) {
        bestAnchor = anchors[i];
        bestDist = dist;
      }
    }
    if (bestAnchor) {
      toAnchor.set(d, bestAnchor);
      entries.push({ date: d, playerCount, status: "merged", mergedInto: bestAnchor });
    } else {
      entries.push({ date: d, playerCount, status: "excluded" });
    }
  }
  return { toAnchor, entries };
}

/** Per-exact-test-date (not monthly) average of `parameter` for each group
 * (e.g. dorm or grade), for a chart/table that lines up group averages on
 * the actual days blood was drawn rather than a monthly bucket. When
 * `dateNormalization` is given, each record's date is folded onto its
 * anchor date (or dropped if excluded) before bucketing. */
export function computeGroupComparisonByDate(
  records: BloodTestRecord[],
  parameter: string,
  groups: ComparisonGroup[],
  dateNormalization?: DateNormalization
): Record<string, unknown>[] {
  const periods = new Set<string>();
  const perGroup = new Map<string, Map<string, number[]>>(groups.map((g) => [g.key, new Map()]));

  for (const r of records) {
    const value = r.values[parameter];
    if (typeof value !== "number") continue;
    const date = dateNormalization ? dateNormalization.toAnchor.get(r.date) : r.date;
    if (!date) continue; // excluded by the date normalization
    for (const g of groups) {
      if (!g.match(r)) continue;
      const byDate = perGroup.get(g.key)!;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(value);
    }
    periods.add(date);
  }

  return Array.from(periods)
    .sort()
    .map((period) => {
      const row: Record<string, unknown> = { period };
      for (const g of groups) {
        const values = perGroup.get(g.key)!.get(period);
        row[g.key] = values && values.length > 0 ? round(values.reduce((s, v) => s + v, 0) / values.length, 2) : undefined;
      }
      return row;
    });
}

export const DORM_COMPARISON_GROUPS: ComparisonGroup[] = [
  { key: "1寮生", label: "1寮生", match: (r) => r.dorm === "1寮生" },
  { key: "2寮生", label: "2寮生", match: (r) => r.dorm === "2寮生" },
];

export const GRADE_COMPARISON_GROUPS: ComparisonGroup[] = GRADE_OPTIONS.map((g) => ({
  key: g,
  label: g,
  match: (r) => r.grade === g,
}));

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
