/**
 * Furigana (katakana reading) for each player's kanji name, sourced from the
 * team roster spreadsheet. Used to sort players in true 名簿順 (reading
 * order) rather than by the kanji characters themselves, which don't sort
 * the way the name is actually read. Only covers players who appear on the
 * roster this was pulled from - a name missing here (an alumnus from an
 * older cohort, for instance) falls back to sorting by the kanji name.
 */
export const PLAYER_FURIGANA: Record<string, string> = {
  "熊井 渓人": "クマイ ケイト",
  "鳥井 健太": "トリイ ケンタ",
  "中村 海斗": "ナカムラ カイト",
  "花本 史龍": "ハナモト シリュウ",
  "浜川 舜斗": "ハマカワ シュント",
  "平松 享祐": "ヒラマツ キョウスケ",
  "本間 創": "ホンマ ソウ",
  "村上 直弥": "ムラカミ ナオヤ",
  "安島 莉玖": "アンジマ リク",
  "飯田 翔大": "イイダ カイト",
  "植村 真登": "ウエムラ マナト",
  "遠藤 大成": "エンドウ タイセイ",
  "小河原 陽琉": "オガワラ ヒカル",
  "折田 壮太": "オリタ ソウタ",
  "黒田 然": "クロダ ゼン",
  "佐々木 大輝": "ササキ ダイキ",
  "佐藤 愛斗": "サトウ アイト",
  "橋本 昊太": "ハシモト コウタ",
  "福冨 翔": "フクトミ ショウ",
  "船越 碧": "フナコシ アオ",
  "松田 煌希": "マツダ コウキ",
  "若林 良樹": "ワカバヤシ ヨシキ",
  "石川 浩輝": "イシカワ コウキ",
  "上野山 拳士朗": "ウエノヤマ ケンシロウ",
  "大島 福": "オオシマ フク",
  "神邑 亮佑": "カミムラ リョウスケ",
  "坂本 康太": "サカモト コウタ",
  "楠山 一颯": "スギヤマ イブキ",
  "田中 智稀": "タナカ トモキ",
  "櫨元 優馬": "ハゼモト ユウマ",
  "日向 春空": "ヒナタ ハルア",
  "本宮 優心": "ホンミヤ ユウシン",
  "前川 竜之将": "マエカワ リュウノスケ",
  "松田 祐真": "マツダ ユウマ",
  "村岡 大雅": "ムラオカ タイガ",
  "古川 陽樹": "フルカワ ハルキ",
  "藤岡 孝太郎": "フジオカ コウタロウ",
  "新見 春陽": "ニイミ ハルヒ",
  "大藪 遙斗": "オオヤブ ハルト",
  "寺内 頼": "テラウチ ライ",
  "谷口 僚哉": "タニグチ リョウヤ",
  "栗林 凛太朗": "クリバヤシ リンタロウ",
  "大竹 実吹": "オオタケ ミブキ",
  "斎藤 晴樹": "サイトウ ハルキ",
  "前田 蒼空": "マエダ アオイ",
  "横畑 僚大": "ヨコハタ リョウタ",
};

/** Sorts by furigana reading order when both names are on the roster,
 * falling back to plain kanji comparison for a name that isn't. */
export function compareByRosterName(a: string, b: string): number {
  const readingA = PLAYER_FURIGANA[a] ?? a;
  const readingB = PLAYER_FURIGANA[b] ?? b;
  return readingA.localeCompare(readingB, "ja");
}
