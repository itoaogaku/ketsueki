export type Dorm = "1寮生" | "2寮生";

export const DORM_OPTIONS: Dorm[] = ["1寮生", "2寮生"];

/** One blood-test record for one player on one date. */
export interface BloodTestRecord {
  id: string;
  player: string;
  date: string; // ISO yyyy-mm-dd
  dorm: Dorm | null;
  /** blood parameter name -> numeric value, e.g. { "Hb": 15.2, "Fe": 88 } */
  values: Record<string, number>;
}

/** One game result record. */
export interface GameResultRecord {
  id: string;
  date: string; // ISO yyyy-mm-dd
  opponent: string | null;
  /** metric name -> numeric value, e.g. { "得点": 5, "失点": 3 } */
  metrics: Record<string, number>;
  /** free-text/select fields kept for display (result, etc.) */
  labels: Record<string, string>;
}

export interface BloodDataResponse {
  records: BloodTestRecord[];
  players: string[];
  parameters: string[];
  source: "notion" | "sample";
}

export interface GameResultsResponse {
  records: GameResultRecord[];
  metrics: string[];
  labels: string[];
  source: "notion" | "sample";
}

export interface TrendPoint {
  period: string; // yyyy-MM
  average: number;
  count: number;
  [key: string]: unknown;
}

export interface CorrelationResult {
  parameter: string;
  metric: string;
  r: number | null;
  n: number;
  points: { x: number; y: number; player: string; date: string }[];
}
