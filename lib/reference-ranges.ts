/**
 * Reference ranges for coloring out-of-range values in the wide tables
 * (red = above `high`, blue = below `low`). The base low/high values are
 * extracted directly from the source spreadsheets' own conditional
 * formatting rules (which key off the male 基準値(M) column regardless of
 * the player's sex - this reproduces that same convention rather than
 * introducing a per-player sex field). Parameters not listed here (A-LY,
 * 乳び) had no such rule in the source data and are shown uncolored.
 *
 * These base low/high values are intentionally left as-is (they're the
 * team's existing clinical thresholds) - see SEVERITY_TIERS below for the
 * 3-level severity bands built outward from them.
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

/**
 * 3-level severity bands built outward from each REFERENCE_RANGES boundary
 * (level 1 starts exactly at that boundary; [moderate, severe] below give
 * where level 2 and level 3 begin). Values for the markers most relevant to
 * monitoring a male long-distance running squad are grounded in
 * sports-medicine literature on that population specifically; everything
 * else uses a proportional widening of the existing clinical range as a
 * general-purpose severity gradient, since no athlete-specific staged
 * cutoffs exist for those markers. See the per-entry notes.
 *
 * high: [moderate, severe] - value must exceed these to reach that level.
 * low: [moderate, severe] - value must fall below these to reach that level.
 */
export const SEVERITY_TIERS: Record<string, { low?: [number, number]; high?: [number, number] }> = {
  // Iron deficiency staging in athletes (Sim M, et al. "Iron considerations
  // for the athlete: a narrative review." Eur J Appl Physiol. 2019;
  // 119:1463-1478; AIS/ASADA iron deficiency position stand): ferritin
  // <20 ng/mL marks iron-deficient erythropoiesis (paired with low TSAT),
  // <12 ng/mL marks iron deficiency anaemia. The team's own low=13 axis
  // already sits inside that range, so both extra levels land just below it.
  "フェリチン(Ferritin) (※フェリチン精密)": { low: [10, 6], high: [400, 600] },
  // WHO haemoglobin anaemia grading, adult male (Hb <13.0 g/dL = anaemia;
  // 11.0-12.9 mild, 8.0-10.9 moderate, <8.0 severe). The team's axis (13.5)
  // is slightly stricter than WHO's cutoff; level 2/3 follow the WHO
  // mild/moderate boundary (12.0) and moderate/severe boundary (11.0).
  "Hb（ヘモグロビン量）": { low: [12.0, 11.0], high: [18.5, 20.0] },
  // Tracks Hb (Hct is roughly 3x Hb) for the same WHO-anaemia-derived slope.
  "ヘマトクリット値（Hematocrit)": { low: [36.0, 33.0], high: [54.0, 57.0] },
  "Fe（血清鉄）": { low: [35, 20], high: [250, 300] },
  "UIBC(不飽和鉄結合能)": { low: [80, 60], high: [300, 340] },
  "TIBC(総鉄結合能)": { low: [240, 210], high: [460, 500] },
  // TSAT <16% is the paired criterion for iron-deficient erythropoiesis in
  // the same IOC/AIS staging referenced above; <10% is markedly reduced
  // iron availability to the marrow.
  "TSAT(トランスフェリン飽和度）": { low: [0.16, 0.1], high: [0.45, 0.6] },
  "MCV（平均赤血球容積）": { low: [80, 75], high: [108, 115] },
  "MCH（平均赤血球血色素量）": { low: [26, 24], high: [36, 38] },
  "MCHC（平均赤血球血色素濃度）": { low: [28, 26], high: [36.5, 38] },
  "網赤血球数": { low: [2, 1], high: [25, 35] },
  // Brancaccio P, et al. "Biochemical markers of muscular damage." Clin
  // Chem Lab Med. 2010;48:757-767 - flags concern around 5x the upper
  // limit of normal (270 x 5 ≈ 1350, rounded to 1000 here since endurance
  // training alone can push CK into the high hundreds without harm).
  // >5000 U/L is the commonly cited diagnostic threshold for exertional
  // rhabdomyolysis (e.g. Tietze DC, Borchers J. Curr Sports Med Rep. 2014).
  "CK（クレアチンキナーゼ）": { high: [1000, 5000] },
  "BUN（尿素窒素）": { low: [6, 4], high: [25, 30] },
  "コルチゾール（Cortisol）": { low: [2.5, 1.5], high: [25, 30] },
  "GOT/AST": { low: [8, 6], high: [80, 150] },
  "Cr（クレアチ二ン）": { low: [0.5, 0.4], high: [1.3, 1.6] },
  // Standard clinical critical values for potassium (independent of sport):
  // <2.5 or >6.0 mmol/L carries a real arrhythmia risk.
  "K（カリウム）": { low: [3.0, 2.5], high: [5.5, 6.0] },
  // Exercise-associated hyponatraemia (Hew-Butler T, et al. 3rd
  // International EAH Consensus Development Conference, Clin J Sport Med.
  // 2015): <130 mmol/L is clinically significant EAH; CNS symptoms
  // (cerebral oedema) become a real risk below 120 mmol/L.
  "Na（血清ナトリウム）": { low: [130, 120], high: [150, 155] },
  "Cl（血清クロール）": { low: [94, 90], high: [112, 116] },
  "尿酸": { low: [2.5, 2.0], high: [8.5, 10.0] },
  "ALP(アルカリホスファターゼ）": { low: [80, 60], high: [400, 500] },
  "Ca(血清カルシウム)": { low: [8.0, 7.5], high: [10.8, 11.5] },
  "LDH（乳酸脱水素酵素）": { low: [100, 80], high: [300, 400] },
  "総蛋白": { low: [6.3, 6.0], high: [8.8, 9.5] },
  "テストステロン": { low: [6, 4], high: [35, 40] },
  "亜鉛": { low: [65, 50], high: [150, 180] },
  // Endocrine Society Clinical Practice Guideline (Holick MF, et al. J Clin
  // Endocrinol Metab. 2011;96:1911-1930): <20 ng/mL deficient (the team's
  // own axis, 30, already matches the "insufficient" cutoff); <10 ng/mL is
  // commonly cited as severe deficiency (Holick MF. N Engl J Med.
  // 2007;357:266-281), relevant here for bone-stress-injury risk.
  "ビタミンD": { low: [20, 10] },
  "白血球数": { low: [30, 20], high: [100, 130] },
  "赤血球数": { low: [400, 370], high: [600, 650] },
  "血小板数": { low: [10, 8], high: [45, 50] },
  Neutro: { low: [30, 20], high: [80, 90] },
  Baso: { high: [3, 4] },
  Eosino: { high: [10, 15] },
  Lympho: { low: [15, 10], high: [65, 75] },
  Mono: { high: [10, 13] },
  トランスフェリン: { low: [170, 150], high: [330, 360] },
};

export type SeverityDirection = "high" | "low";

export interface Severity {
  direction: SeverityDirection;
  /** 1 = at least at the base reference boundary, 3 = past the severe cutoff. */
  level: 1 | 2 | 3;
}

/** "high" (red), "low" (blue), or null if within range / no reference known. */
export function classifyValue(paramName: string, value: number): SeverityDirection | null {
  const range = REFERENCE_RANGES[paramName];
  if (!range) return null;
  if (range.high !== undefined && value > range.high) return "high";
  if (range.low !== undefined && value < range.low) return "low";
  return null;
}

/** Same as classifyValue, but also grades how far out of range the value is. */
export function classifySeverity(paramName: string, value: number): Severity | null {
  const direction = classifyValue(paramName, value);
  if (!direction) return null;

  const tier = SEVERITY_TIERS[paramName]?.[direction];
  if (!tier) return { direction, level: 1 };

  const [moderate, severe] = tier;
  if (direction === "high") {
    if (value > severe) return { direction, level: 3 };
    if (value > moderate) return { direction, level: 2 };
  } else {
    if (value < severe) return { direction, level: 3 };
    if (value < moderate) return { direction, level: 2 };
  }
  return { direction, level: 1 };
}
