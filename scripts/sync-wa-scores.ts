/**
 * Reads every row of the 競技結果データベース, converts each recognized
 * standard-distance result (5000m, 10000m, ハーフマラソン, マラソン, 3000m -
 * see lib/wa-scoring.ts for the full alias list) into WA (World Athletics)
 * Scoring Tables points, and upserts one row per result into the WAスコア
 * database (選手名・日付・競技種目・競技結果・WA得点). The actual logic lives in
 * lib/sync-wa-scores.ts, shared with the in-app `/import` page's "WAスコアを
 * 同期" button (app/api/sync-wa-scores) for anyone who'd rather click a
 * button on the deployed site than run a command locally.
 *
 * 駅伝の区間など、WAテーブルにない非標準距離の結果はスキップされ、WAスコア
 * データベースには反映されません（チームの方針により対象外）。
 *
 * Usage:
 *   1. First create the WAスコア database once:
 *        npm run setup:notion -- --with-wa-scores
 *      (or use an existing database with the same 5 columns - 選手名 title,
 *      日付 date, 競技種目 select/rich_text, 競技結果 rich_text, WA得点 number)
 *      and put its id in .env.local as NOTION_WA_SCORES_DATABASE_ID.
 *   2. Run: npm run sync:wa-scores
 *      Re-run any time 競技結果 has new rows, or after 種目/結果 データが
 *      修正された場合 - this always overwrites each row's WA得点 with a
 *      freshly computed value (this database holds derived data, not
 *      hand-edited data, so there's no "don't overwrite my edits" concern
 *      the way there is for the blood-test CSV importer).
 *      Add --dry-run to preview counts without writing anything.
 */
import { syncWaScores } from "../lib/sync-wa-scores";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("競技結果データベースを読み込み、WAスコアを計算しています...");
  const summary = await syncWaScores({ dryRun });

  for (const w of summary.warnings) console.warn(`  ${w}`);
  console.log(
    `\n${summary.totalSourceRows}件中 ${summary.parsedRows}件から選手名・日付・種目・結果を取得しました`
  );
  console.log(
    `変換結果: 対象 ${summary.created + summary.updated}件 / 対象外(非標準種目) ${summary.outOfScope}件 / 記録形式不明 ${summary.unparseable}件`
  );
  console.log(`\n--- 完了 ---`);
  console.log(`${dryRun ? "作成予定" : "作成"}: ${summary.created}件`);
  console.log(`${dryRun ? "更新予定" : "更新"}: ${summary.updated}件`);
}

main().catch((err) => {
  console.error("WAスコアの同期に失敗しました:", err);
  process.exit(1);
});
