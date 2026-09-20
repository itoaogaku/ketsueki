/**
 * Reads every row of the 競技結果データベース, converts each recognized
 * standard-distance result (5000m, 10000m, ハーフマラソン, マラソン, 3000m -
 * see lib/wa-scoring.ts for the full alias list) into WA (World Athletics)
 * Scoring Tables points, and upserts one row per result into the WAスコア
 * database (選手名・日付・競技種目・競技結果・WA得点).
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
 *
 * The source 競技結果DB's column names aren't hardcoded here beyond a name
 * pattern (種目/結果), matching how the rest of this app auto-detects
 * columns by type + name rather than requiring an exact schema - see
 * extractGameRecord in lib/notion.ts for the same convention.
 */
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  getNotionClient,
  getPlainTitle,
  isGamesNotionConfigured,
  queryAllPages,
  resolveDataSourceId,
} from "../lib/notion";
import { computeWaPoints, resolveWaDiscipline } from "../lib/wa-scoring";

const WA_SCORES_DB_ID = process.env.NOTION_WA_SCORES_DATABASE_ID;
const dryRun = process.argv.includes("--dry-run");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RawResultRow {
  player: string;
  date: string;
  event: string;
  resultText: string;
}

/** Auto-detects the title (player), date, 種目, and 結果 columns of one
 * 競技結果DB row, whatever they're actually named - mirrors extractGameRecord
 * (lib/notion.ts)'s own type+name-based detection rather than assuming a
 * fixed schema, since this reads an existing database this script didn't
 * create. */
function extractRawResultRow(page: PageObjectResponse): RawResultRow | null {
  const player = getPlainTitle(page);
  let date = "";
  let event = "";
  let resultText = "";

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (/種目/.test(name)) {
      if (prop.type === "select" && prop.select?.name) event = prop.select.name;
      else if (prop.type === "rich_text") event = prop.rich_text.map((t) => t.plain_text).join("");
    } else if (/結果|記録|タイム/.test(name)) {
      if (prop.type === "rich_text") resultText = prop.rich_text.map((t) => t.plain_text).join("");
      else if (prop.type === "number" && typeof prop.number === "number") resultText = String(prop.number);
    }
  }

  if (!player || !date || !event || !resultText) return null;
  return { player, date, event, resultText };
}

function dedupeKey(row: { player: string; date: string; event: string }): string {
  return `${row.player}__${row.date}__${row.event}`;
}

async function main() {
  if (!isGamesNotionConfigured()) {
    throw new Error(
      "NOTION_TOKEN / NOTION_GAMES_DATABASE_ID が設定されていません（変換元の競技結果データベースが必要です）"
    );
  }
  if (!WA_SCORES_DB_ID) {
    throw new Error(
      "NOTION_WA_SCORES_DATABASE_ID が設定されていません（先に npm run setup:notion -- --with-wa-scores を実行するか、既存DBのIDを設定してください）"
    );
  }

  console.log("競技結果データベースを読み込んでいます...");
  const sourcePages = await queryAllPages(process.env.NOTION_GAMES_DATABASE_ID!);
  const rawRows = sourcePages
    .map(extractRawResultRow)
    .filter((r): r is RawResultRow => r !== null);
  console.log(`  ${sourcePages.length}件中 ${rawRows.length}件から選手名・日付・種目・結果を取得しました`);

  let outOfScope = 0; // 駅伝区間など、WAテーブルにない種目
  let unparseable = 0; // 種目は対象だが記録の形式が読み取れない
  const toWrite: { player: string; date: string; event: string; resultText: string; points: number }[] = [];

  for (const row of rawRows) {
    if (!resolveWaDiscipline(row.event)) {
      outOfScope++;
      continue;
    }
    const computed = computeWaPoints(row.event, row.resultText);
    if (!computed) {
      unparseable++;
      console.warn(`  記録の形式が読み取れずスキップ: ${row.player} / ${row.date} / ${row.event} / 「${row.resultText}」`);
      continue;
    }
    toWrite.push({ ...row, points: computed.points });
  }

  console.log(`\n変換結果: 対象 ${toWrite.length}件 / 対象外(非標準種目) ${outOfScope}件 / 記録形式不明 ${unparseable}件`);

  if (toWrite.length === 0) {
    console.log("書き込む行がないため終了します。");
    return;
  }

  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(WA_SCORES_DB_ID);

  console.log("\nWAスコアデータベースの既存行を確認しています...");
  const existingPages = await queryAllPages(WA_SCORES_DB_ID);
  const existingKeys = new Map<string, string>();
  for (const page of existingPages) {
    const player = getPlainTitle(page);
    let date = "";
    let event = "";
    for (const [name, prop] of Object.entries(page.properties)) {
      if (prop.type === "date" && prop.date?.start) date = prop.date.start.slice(0, 10);
      else if (prop.type === "select" && /種目/.test(name)) event = prop.select?.name ?? "";
    }
    if (player && date && event) existingKeys.set(dedupeKey({ player, date, event }), page.id);
  }

  let created = 0;
  let updated = 0;
  for (const row of toWrite) {
    const key = dedupeKey(row);
    const existingPageId = existingKeys.get(key);
    const properties = {
      選手名: { title: [{ text: { content: row.player } }] },
      日付: { date: { start: row.date } },
      競技種目: { select: { name: row.event } },
      競技結果: { rich_text: [{ text: { content: row.resultText } }] },
      WA得点: { number: row.points },
    };

    if (dryRun) {
      if (existingPageId) updated++;
      else created++;
      continue;
    }

    if (existingPageId) {
      await notion.pages.update({
        page_id: existingPageId,
        properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
      });
      updated++;
    } else {
      await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
      created++;
    }
    await sleep(150); // Notionのレート制限に配慮
  }

  console.log(`\n--- 完了 ---`);
  console.log(`${dryRun ? "作成予定" : "作成"}: ${created}件`);
  console.log(`${dryRun ? "更新予定" : "更新"}: ${updated}件`);
}

main().catch((err) => {
  console.error("WAスコアの同期に失敗しました:", err);
  process.exit(1);
});
