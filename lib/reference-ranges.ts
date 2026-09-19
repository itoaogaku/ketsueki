/**
 * Reference ranges for coloring out-of-range values in the grade-view table
 * (red = above `high`, blue = below `low`). Extracted directly from the
 * source spreadsheets' own conditional formatting rules (which key off the
 * male 基準値(M) column regardless of the player's sex - this reproduces
 * that same convention rather than introducing a per-player sex field).
 * Parameters not listed here (A-LY, 乳び) had no such rule in the source
 * data and are shown uncolored.
 */
export const REFERENCE_RANGES: Record<string, { low?: number; high?: number }> = {
  "フェリチン(Ferritin) (※フェリチン精密)": { low: 13.0, high: 277.0 },
  "Hb（ヘモグロビン量）": { low: 13.5, high: 17.5 },
  "ヘマトクリット値（Hematocrit)": { low: 39.7, high: 52.4 },
  "Fe（血清鉄）": { low: 50.0, high: 200.0 },
  "UIBC(不飽和鉄結合能)": { low: 104.0, high: 259.0 },
  "TIBC(総鉄結合能)": { low: 270.0, high: 425.0 },
  "TSAT(トランスフェリン飽和度）": { low: 0.2, high: 0.3 },
  "MCV（平均赤血球容積）": { low: 85.0, high: 102.0 },
  "MCH（平均赤血球血色素量）": { low: 28.0, high: 34.0 },
  "MCHC（平均赤血球血色素濃度）": { low: 30.2, high: 35.1 },
  "網赤血球数": { low: 4.0, high: 19.0 },
  "CK（クレアチンキナーゼ）": { low: 60.0, high: 270.0 },
  "BUN（尿素窒素）": { low: 8.0, high: 20.0 },
  "コルチゾール（Cortisol）": { low: 3.7, high: 19.4 },
  "GOT/AST": { low: 10.0, high: 40.0 },
  "Cr（クレアチ二ン）": { low: 0.61, high: 1.04 },
  "K（カリウム）": { low: 3.5, high: 5.0 },
  "Na（血清ナトリウム）": { low: 137.0, high: 147.0 },
  "Cl（血清クロール）": { low: 98.0, high: 108.0 },
  "尿酸": { low: 3.0, high: 7.0 },
  "ALP(アルカリホスファターゼ）": { low: 100.0, high: 325.0 },
  "Ca(血清カルシウム)": { low: 8.4, high: 10.4 },
  "LDH（乳酸脱水素酵素）": { low: 120.0, high: 240.0 },
  "総蛋白": { low: 6.7, high: 8.3 },
  "テストステロン": { low: 8.8, high: 31.7 },
  "亜鉛": { low: 80.0, high: 130.0 },
  "ビタミンD": { low: 30.0 },
  "白血球数": { low: 40.0, high: 80.0 },
  "赤血球数": { low: 430.0, high: 570.0 },
  "血小板数": { low: 12.0, high: 40.0 },
  Neutro: { low: 42.0, high: 73.0 },
  Baso: { low: 0.0, high: 2.0 },
  Eosino: { low: 0.0, high: 6.0 },
  Lympho: { low: 18.0, high: 59.0 },
  Mono: { low: 0.0, high: 8.0 },
  トランスフェリン: { low: 190.0, high: 300.0 },
};

/** "high" (red), "low" (blue), or null if within range / no reference known. */
export function classifyValue(paramName: string, value: number): "high" | "low" | null {
  const range = REFERENCE_RANGES[paramName];
  if (!range) return null;
  if (range.high !== undefined && value > range.high) return "high";
  if (range.low !== undefined && value < range.low) return "low";
  return null;
}
