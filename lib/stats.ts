import type {
  BloodTestRecord,
  CorrelationResult,
  Dorm,
  GameResultRecord,
  TrendPoint,
} from "./types";

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "yyyy-MM"
}

/** Japanese academic year (April-March): a date in Jan-Mar belongs to the
 * academic year that started the previous April. */
export function academicYear(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export interface TrendFilter {
  parameter: string;
  dorm?: Dorm | "all";
  players?: string[]; // empty/undefined = all
}

/** Monthly average of one blood parameter, optionally filtered by dorm/players. */
export function computeTrend(
  records: BloodTestRecord[],
  { parameter, dorm, players }: TrendFilter
): TrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const r of records) {
    if (dorm && dorm !== "all" && r.dorm !== dorm) continue;
    if (players && players.length > 0 && !players.includes(r.player)) continue;
    const value = r.values[parameter];
    if (typeof value !== "number") continue;
    const key = monthKey(r.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(value);
  }
  return Array.from(buckets.entries())
    .map(([period, values]) => ({
      period,
      average: round(values.reduce((s, v) => s + v, 0) / values.length, 2),
      count: values.length,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/** Same trend split into per-dorm series, for side-by-side comparison. */
export function computeDormComparison(
  records: BloodTestRecord[],
  parameter: string,
  players?: string[]
): { period: string; "1寮生"?: number; "2寮生"?: number; [key: string]: unknown }[] {
  const periods = new Set<string>();
  const dorm1 = computeTrend(records, { parameter, dorm: "1寮生", players });
  const dorm2 = computeTrend(records, { parameter, dorm: "2寮生", players });
  dorm1.forEach((p) => periods.add(p.period));
  dorm2.forEach((p) => periods.add(p.period));

  const map1 = new Map(dorm1.map((p) => [p.period, p.average]));
  const map2 = new Map(dorm2.map((p) => [p.period, p.average]));

  return Array.from(periods)
    .sort()
    .map((period) => ({
      period,
      "1寮生": map1.get(period),
      "2寮生": map2.get(period),
    }));
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
 * Groups test dates around "main testing days" so a handful of players who
 * tested late (a make-up day for whoever missed the main round) don't show
 * up as their own thin, misleading data point. A date with at least
 * `anchorMinPlayers` distinct players tested is an anchor; any other date
 * within `windowDays` of the nearest anchor is folded into it; anything
 * further out is dropped from date-based comparisons entirely.
 */
export function buildDateNormalization(
  records: BloodTestRecord[],
  { anchorMinPlayers = 40, windowDays = 7 }: { anchorMinPlayers?: number; windowDays?: number } = {}
): DateNormalization {
  const playersByDate = new Map<string, Set<string>>();
  for (const r of records) {
    if (!playersByDate.has(r.date)) playersByDate.set(r.date, new Set());
    playersByDate.get(r.date)!.add(r.player);
  }
  const allDates = Array.from(playersByDate.keys()).sort();
  const toMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const anchors = allDates.filter((d) => playersByDate.get(d)!.size >= anchorMinPlayers);
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

export const GRADE_COMPARISON_GROUPS: ComparisonGroup[] = ["1年", "2年", "3年", "4年"].map(
  (g) => ({ key: g, label: g, match: (r) => r.grade === g })
);

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null; // too few points to mean anything
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return num / Math.sqrt(denomX * denomY);
}

export interface CorrelationOptions {
  parameter: string;
  metric: string;
  dorm?: Dorm | "all";
  /** How many days before each game to average the blood parameter over. */
  windowDays?: number;
}

/** Blood records relevant to one game's pre-game window, still carrying
 * their full `values` map so every parameter can be read back out without
 * re-scanning or re-parsing dates per parameter. */
interface GameWindow {
  game: GameResultRecord;
  relevant: BloodTestRecord[];
}

/** Groups blood records into each game's `windowDays`-before window once, so
 * `parameter` can vary afterward without re-filtering `bloodRecords` (and
 * re-parsing every date) for every parameter x metric combination - the
 * window only depends on (dorm, windowDays, game date), never on which
 * parameter is being correlated. */
function computeGameWindows(
  bloodRecords: BloodTestRecord[],
  gameRecords: GameResultRecord[],
  { dorm, windowDays = 7 }: { dorm?: Dorm | "all"; windowDays?: number }
): GameWindow[] {
  const dormFiltered =
    dorm && dorm !== "all" ? bloodRecords.filter((r) => r.dorm === dorm) : bloodRecords;
  const dated = dormFiltered
    .map((r) => ({ r, t: new Date(`${r.date}T00:00:00Z`).getTime() }))
    .sort((a, b) => a.t - b.t);
  const times = dated.map((d) => d.t);

  return gameRecords.map((game) => {
    const gameTime = new Date(`${game.date}T00:00:00Z`).getTime();
    const windowStart = gameTime - windowDays * 86400000;
    // times is sorted ascending, so the matching range is a contiguous slice.
    let lo = lowerBound(times, windowStart);
    const hi = upperBound(times, gameTime);
    const relevant: BloodTestRecord[] = [];
    for (; lo < hi; lo++) relevant.push(dated[lo].r);
    return { game, relevant };
  });
}

function lowerBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function correlateFromWindows(
  windows: GameWindow[],
  parameter: string,
  metric: string
): CorrelationResult {
  const points: CorrelationResult["points"] = [];
  for (const { game, relevant } of windows) {
    const metricValue = game.metrics[metric];
    if (typeof metricValue !== "number") continue;
    const values = relevant
      .map((r) => r.values[parameter])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) continue;
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    points.push({
      x: round(avg, 2),
      y: metricValue,
      player: `チーム平均(n=${values.length})`,
      date: game.date,
    });
  }

  const r = pearsonCorrelation(
    points.map((p) => p.x),
    points.map((p) => p.y)
  );

  return { parameter, metric, r: r === null ? null : round(r, 3), n: points.length, points };
}

/**
 * Pairs each game with the average of `parameter` across blood tests taken
 * in the `windowDays` before that game (optionally filtered by dorm), then
 * correlates that team-condition proxy against the game's `metric`.
 */
export function computeCorrelation(
  bloodRecords: BloodTestRecord[],
  gameRecords: GameResultRecord[],
  { parameter, metric, dorm, windowDays = 7 }: CorrelationOptions
): CorrelationResult {
  const windows = computeGameWindows(bloodRecords, gameRecords, { dorm, windowDays });
  return correlateFromWindows(windows, parameter, metric);
}

/** Scans every parameter x metric combination and ranks by |r|, to surface
 * the strongest candidate relationships automatically. Builds each game's
 * pre-game blood-record window once (independent of parameter/metric) and
 * reuses it across the whole scan, rather than re-filtering all blood
 * records for every parameter x metric pair. */
export function computeAllCorrelations(
  bloodRecords: BloodTestRecord[],
  gameRecords: GameResultRecord[],
  parameters: string[],
  metrics: string[],
  options?: { dorm?: Dorm | "all"; windowDays?: number }
): CorrelationResult[] {
  const windows = computeGameWindows(bloodRecords, gameRecords, options ?? {});
  const results: CorrelationResult[] = [];
  for (const parameter of parameters) {
    for (const metric of metrics) {
      const result = correlateFromWindows(windows, parameter, metric);
      if (result.r !== null) results.push(result);
    }
  }
  return results.sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
