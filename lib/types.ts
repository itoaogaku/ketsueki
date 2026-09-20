export type Dorm = "1寮生" | "2寮生";

export const DORM_OPTIONS: Dorm[] = ["1寮生", "2寮生"];

export type Grade = "1年" | "2年" | "3年" | "4年";

export const GRADE_OPTIONS: Grade[] = ["1年", "2年", "3年", "4年"];

/** One blood-test record for one player on one date. */
export interface BloodTestRecord {
  id: string;
  player: string;
  date: string; // ISO yyyy-mm-dd
  dorm: Dorm | null;
  grade: Grade | null;
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
  /** Players with blood-test records whose name didn't match anyone in the
   * 部員データベース (only populated when that database is configured) -
   * their grade falls back to whatever is hand-entered on their own
   * blood-test rows, which can be stale. Surfaced so a name mismatch (typo,
   * missing roster entry) can be spotted and fixed at the source instead of
   * silently producing a wrong grade. */
  unmatchedGradePlayers?: string[];
  /** 選手名 -> the academic year they entered university, for players
   * matched to the 部員データベース. Lets a UI compute "what grade are they
   * *right now*" directly (via lib/grade.ts's gradeAtDate) instead of
   * reading whatever grade their most recent test record happened to show -
   * which understates a player's grade if they weren't tested in the
   * latest round. */
  playerEnteringYear?: Record<string, number>;
}

export interface GameResultsResponse {
  records: GameResultRecord[];
  metrics: string[];
  labels: string[];
  source: "notion" | "sample";
}

