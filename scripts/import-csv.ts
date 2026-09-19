/**
 * Imports a CSV of blood-test results into the Notion blood-test database.
 *
 * CSV columns:
 *   選手名   (required) - player name, matches the database's title property
 *   検査日   (required) - test date, "YYYY-MM-DD"
 *   寮       (optional but recommended) - "1寮生" or "2寮生": which dorm the
 *            player was living in AT THE TIME OF THIS TEST (dorm assignments
 *            change over time, so this is recorded per row, not per player)
 *   学年     (optional) - "1年"〜"4年": which grade at the time of this test
 *   ...any other column is treated as a numeric blood-test parameter
 *      (e.g. Hb, Fe, CK) and is created as a Number property in Notion
 *      automatically if it doesn't already exist.
 *
 * Usage:
 *   npm run import:csv -- data/blood-data.csv
 *   npm run import:csv -- data/blood-data.csv --dry-run   (preview only)
 *   npm run import:csv -- data/blood-data.csv --upsert    (also overwrite
 *     already-imported rows with this CSV's values, e.g. to backfill 学年)
 *
 * The same logic is also available from the deployed app itself at
 * /import (a browser upload page), for when running this locally isn't
 * convenient - see lib/import-blood-csv.ts.
 */
import { readFileSync } from "node:fs";
import { importBloodCsv } from "../lib/import-blood-csv";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const mode = args.includes("--upsert") ? "upsert" : "create";
const csvPath = args.find((a) => !a.startsWith("--")) ?? "data/blood-data.csv";

async function main() {
  const csvText = readFileSync(csvPath, "utf-8");
  const summary = await importBloodCsv(csvText, { dryRun, mode });

  console.log(`検査項目として扱う列: ${summary.paramColumns.join(", ")}`);
  if (summary.addedProperties.length > 0) {
    console.log(`Notion側に未定義の検査項目を追加します: ${summary.addedProperties.join(", ")}`);
  }
  for (const w of summary.warnings) console.warn(w);

  console.log("\n--- 完了 ---");
  console.log(`${dryRun ? "作成予定" : "作成"}: ${summary.created}件`);
  if (mode === "upsert") console.log(`${dryRun ? "更新予定" : "更新"}: ${summary.updated}件`);
  console.log(`重複のためスキップ: ${summary.skippedDuplicate}件`);
  console.log(`不正な行のためスキップ: ${summary.skippedInvalid}件`);
  if (summary.missingDorm > 0) console.log(`寮が未記入の行: ${summary.missingDorm}件`);
}

main().catch((err) => {
  console.error("インポートに失敗しました:", err);
  process.exit(1);
});
