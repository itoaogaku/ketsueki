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
  const points: CorrelationResult["points"] = [];

  for (const game of gameRecords) {
    const metricValue = game.metrics[metric];
    if (typeof metricValue !== "number") continue;
    const gameTime = new Date(`${game.date}T00:00:00Z`).getTime();
    const windowStart = gameTime - windowDays * 86400000;

    const relevant = bloodRecords.filter((r) => {
      if (dorm && dorm !== "all" && r.dorm !== dorm) return false;
      const value = r.values[parameter];
      if (typeof value !== "number") return false;
      const t = new Date(`${r.date}T00:00:00Z`).getTime();
      return t >= windowStart && t <= gameTime;
    });
    if (relevant.length === 0) continue;

    const avg =
      relevant.reduce((s, r) => s + r.values[parameter], 0) / relevant.length;
    points.push({
      x: round(avg, 2),
      y: metricValue,
      player: `チーム平均(n=${relevant.length})`,
      date: game.date,
    });
  }

  const r = pearsonCorrelation(
    points.map((p) => p.x),
    points.map((p) => p.y)
  );

  return { parameter, metric, r: r === null ? null : round(r, 3), n: points.length, points };
}

/** Scans every parameter x metric combination and ranks by |r|, to surface
 * the strongest candidate relationships automatically. */
export function computeAllCorrelations(
  bloodRecords: BloodTestRecord[],
  gameRecords: GameResultRecord[],
  parameters: string[],
  metrics: string[],
  options?: { dorm?: Dorm | "all"; windowDays?: number }
): CorrelationResult[] {
  const results: CorrelationResult[] = [];
  for (const parameter of parameters) {
    for (const metric of metrics) {
      const result = computeCorrelation(bloodRecords, gameRecords, {
        parameter,
        metric,
        dorm: options?.dorm,
        windowDays: options?.windowDays,
      });
      if (result.r !== null) results.push(result);
    }
  }
  return results.sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
