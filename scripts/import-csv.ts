/**
 * Imports a CSV of blood-test results into the Notion blood-test database.
 *
 * CSV columns:
 *   選手名   (required) - player name, matches the database's title property
 *   検査日   (required) - test date, "YYYY-MM-DD"
 *   寮       (optional but recommended) - "1寮生" or "2寮生": which dorm the
 *            player was living in AT THE TIME OF THIS TEST (dorm assignments
 *            change over time, so this is recorded per row, not per player)
 *   ...any other column is treated as a numeric blood-test parameter
 *      (e.g. Hb, Fe, CK) and is created as a Number property in Notion
 *      automatically if it doesn't already exist.
 *
 * Usage:
 *   npm run import:csv -- data/blood-data.csv
 *   npm run import:csv -- data/blood-data.csv --dry-run   (preview only)
 */
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOOD_DB_ID = process.env.NOTION_BLOOD_DATABASE_ID;
const DORM_VALUES = new Set(["1寮生", "2寮生"]);
const REQUIRED_COLUMNS = ["選手名", "検査日"];
const METADATA_COLUMNS = new Set(["選手名", "検査日", "寮"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const csvPath = args.find((a) => !a.startsWith("--")) ?? "data/blood-data.csv";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!NOTION_TOKEN) throw new Error("NOTION_TOKEN が設定されていません");
  if (!BLOOD_DB_ID) throw new Error("NOTION_BLOOD_DATABASE_ID が設定されていません");

  const csvText = readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    console.warn("CSV解析中に警告があります:", parsed.errors.slice(0, 5));
  }

  const columns = parsed.meta.fields ?? [];
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      throw new Error(`CSVに必須列「${col}」がありません`);
    }
  }
  const paramColumns = columns.filter((c) => !METADATA_COLUMNS.has(c));
  console.log(`検査項目として扱う列: ${paramColumns.join(", ")}`);

  const notion = new Client({ auth: NOTION_TOKEN });
  const database = await notion.databases.retrieve({ database_id: BLOOD_DB_ID });
  if (!("data_sources" in database) || database.data_sources.length === 0) {
    throw new Error("指定したデータベースにデータソースが見つかりません");
  }
  const dataSourceId = database.data_sources[0].id;

  // Add any parameter columns that don't exist yet as Number properties.
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const existingProps = new Set(Object.keys(dataSource.properties));
  const missing = paramColumns.filter((c) => !existingProps.has(c));
  if (missing.length > 0) {
    console.log(`Notion側に未定義の検査項目を追加します: ${missing.join(", ")}`);
    if (!dryRun) {
      const properties: Record<string, { type: "number"; number: { format: string } }> = {};
      for (const name of missing) {
        properties[name] = { type: "number", number: { format: "number" } };
      }
      await notion.dataSources.update({ data_source_id: dataSourceId, properties });
    }
  }

  // Build a de-dupe set from existing rows (選手名 + 検査日) so re-running the
  // same CSV doesn't create duplicate pages.
  const existingKeys = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const result of res.results) {
      if (result.object !== "page" || !("properties" in result)) continue;
      const page = result as PageObjectResponse;
      const key = dedupeKeyFromPage(page);
      if (key) existingKeys.add(key);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  let created = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  let missingDorm = 0;

  for (const row of parsed.data) {
    const player = row["選手名"]?.trim();
    const date = row["検査日"]?.trim();
    if (!player || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      skippedInvalid++;
      continue;
    }

    const key = `${player}__${date}`;
    if (existingKeys.has(key)) {
      skippedDuplicate++;
      continue;
    }

    const dorm = row["寮"]?.trim();
    if (dorm && !DORM_VALUES.has(dorm)) {
      console.warn(`行を確認してください（${player} / ${date}）: 寮の値「${dorm}」は不正です`);
    }
    if (!dorm) missingDorm++;

    const properties: Record<string, unknown> = {
      選手名: { title: [{ text: { content: player } }] },
      検査日: { date: { start: date } },
    };
    if (dorm && DORM_VALUES.has(dorm)) {
      properties["寮"] = { select: { name: dorm } };
    }
    for (const col of paramColumns) {
      const raw = row[col]?.trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isNaN(value)) {
        console.warn(`数値に変換できない値をスキップしました: ${player}/${date}/${col}=${raw}`);
        continue;
      }
      properties[col] = { number: value };
    }

    if (dryRun) {
      console.log(`[dry-run] 作成予定: ${player} / ${date}`);
    } else {
      await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
      await sleep(350); // stay comfortably under Notion's rate limit
    }
    created++;
  }

  console.log("\n--- 完了 ---");
  console.log(`${dryRun ? "作成予定" : "作成"}: ${created}件`);
  console.log(`重複のためスキップ: ${skippedDuplicate}件`);
  console.log(`不正な行のためスキップ: ${skippedInvalid}件`);
  if (missingDorm > 0) console.log(`寮が未記入の行: ${missingDorm}件`);
}

function dedupeKeyFromPage(page: PageObjectResponse): string | null {
  let player = "";
  let date = "";
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title") {
      player = prop.title.map((t) => t.plain_text).join("").trim();
    } else if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    }
  }
  return player && date ? `${player}__${date}` : null;
}

main().catch((err) => {
  console.error("インポートに失敗しました:", err);
  process.exit(1);
});
