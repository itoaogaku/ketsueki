export type Dorm = "1寮生" | "2寮生";

export const DORM_OPTIONS: Dorm[] = ["1寮生", "2寮生"];

export type Grade = "1年" | "2年" | "3年" | "4年" | "実業団";

// 実業団は日付から自動計算されない（卒業後、大学の学年という概念が
// 存在しないため）- 血液検査データベースのその選手の行に手入力し、
// lib/notion.tsのapplyComputedGradesがそれを上書きしないようにしている。
export const GRADE_OPTIONS: Grade[] = ["実業団", "4年", "3年", "2年", "1年"];

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

/** One race result converted to WA (World Athletics) Scoring Tables points -
 * from the WAスコア Notion database that scripts/sync-wa-scores.ts populates
 * from the 競技結果データベース, not computed live in the app (see
 * lib/wa-scoring.ts for the conversion itself). */
export interface WaScoreRecord {
  id: string;
  player: string;
  date: string; // ISO yyyy-mm-dd
  event: string; // 競技種目, e.g. "5000m"
  resultText: string; // 競技結果 as originally recorded, e.g. "13:47.76"
  points: number; // WA得点
}

export interface WaScoreResponse {
  records: WaScoreRecord[];
  players: string[];
  source: "notion" | "sample";
}

