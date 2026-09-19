/** Groups blood-test parameters into the same categories the source
 * spreadsheets used, for the grade-view table's row grouping. */
export const PARAMETER_CATEGORIES: { category: string; params: string[] }[] = [
  {
    category: "貧血関連項目",
    params: [
      "フェリチン(Ferritin) (※フェリチン精密)",
      "Hb（ヘモグロビン量）",
      "ヘマトクリット値（Hematocrit)",
      "Fe（血清鉄）",
      "UIBC(不飽和鉄結合能)",
      "TIBC(総鉄結合能)",
      "TSAT(トランスフェリン飽和度）",
      "MCV（平均赤血球容積）",
      "MCH（平均赤血球血色素量）",
      "MCHC（平均赤血球血色素濃度）",
      "網赤血球数",
    ],
  },
  {
    category: "疲労感関連項目",
    params: ["CK（クレアチンキナーゼ）", "BUN（尿素窒素）", "コルチゾール（Cortisol）", "GOT/AST"],
  },
  {
    category: "脱水関連項目",
    params: ["Cr（クレアチ二ン）", "K（カリウム）", "Na（血清ナトリウム）", "Cl（血清クロール）", "尿酸"],
  },
  {
    category: "疲労骨折関連項目",
    params: ["ALP(アルカリホスファターゼ）", "Ca(血清カルシウム)"],
  },
  {
    category: "溶血性貧血・その他",
    params: ["LDH（乳酸脱水素酵素）", "総蛋白", "テストステロン", "亜鉛", "ビタミンD"],
  },
  {
    category: "血球算定・その他",
    params: [
      "白血球数",
      "赤血球数",
      "血小板数",
      "Neutro",
      "Baso",
      "Eosino",
      "Lympho",
      "Mono",
      "A-LY",
      "乳び",
      "トランスフェリン",
    ],
  },
];

/** Orders `parameters` by the category table above, appending anything not
 * listed there (e.g. a brand-new column) under "その他" at the end so new
 * data never silently disappears from the table. */
export function orderParametersByCategory(
  parameters: string[]
): { category: string; params: string[] }[] {
  const available = new Set(parameters);
  const grouped = PARAMETER_CATEGORIES.map(({ category, params }) => ({
    category,
    params: params.filter((p) => available.has(p)),
  })).filter((g) => g.params.length > 0);

  const known = new Set(PARAMETER_CATEGORIES.flatMap((g) => g.params));
  const leftover = parameters.filter((p) => !known.has(p));
  if (leftover.length > 0) grouped.push({ category: "その他", params: leftover });

  return grouped;
}
