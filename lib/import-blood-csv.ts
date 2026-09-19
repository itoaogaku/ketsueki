import Papa from "papaparse";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getNotionClient, resolveDataSourceId } from "./notion";
import { DORM_OPTIONS, GRADE_OPTIONS } from "./types";

const REQUIRED_COLUMNS = ["選手名", "検査日"];
const METADATA_COLUMNS = new Set(["選手名", "検査日", "寮", "学年"]);
const DORM_VALUES = new Set<string>(DORM_OPTIONS);
// "高校生" marks a test taken before the player enrolled (recruiting-era data) -
// kept in Notion for reference but outside the 1-4年 dashboard filters.
const HIGH_SCHOOL_GRADE = "高校生";
const GRADE_VALUES = new Set<string>([...GRADE_OPTIONS, HIGH_SCHOOL_GRADE]);

export interface ImportSummary {
  paramColumns: string[];
  addedProperties: string[];
  /** Total data rows in the CSV (valid + invalid) - constant across every
   * batch of a multi-round import, so the caller can derive how many rows
   * are duplicates as `totalRows - created - updated - skippedInvalid` once
   * `created`/`updated` are summed across rounds (see the note on
   * `skippedDuplicate` below). */
  totalRows: number;
  created: number;
  /** Only set when `mode: "upsert"` - existing rows whose properties were
   * overwritten with this CSV's values, instead of being left untouched. */
  updated: number;
  /** Only meaningful for a single, non-batched call (e.g. dry runs, or the
   * CLI script). A batched call re-scans the whole file from row one every
   * round, so a row already written by an earlier round of the SAME import
   * shows up here again - across many rounds this massively overcounts. The
   * /import page derives the true total instead; this field is kept only
   * for the CLI's single-pass summary. */
  skippedDuplicate: number;
  skippedInvalid: number;
  missingDorm: number;
  warnings: string[];
  dryRun: boolean;
  mode: "create" | "upsert";
  /** true if `maxCreate` cut this call short - call again with the same CSV
   * to continue (already-written rows are recognized and skipped/updated). */
  hasMore: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildProperties(
  player: string,
  date: string,
  row: Record<string, string>,
  paramColumns: string[],
  warnings: string[]
): { properties: Record<string, unknown>; missingDorm: boolean } {
  const dorm = row["寮"]?.trim();
  if (dorm && !DORM_VALUES.has(dorm)) {
    warnings.push(`${player} / ${date}: 寮の値「${dorm}」は不正です`);
  }
  const grade = row["学年"]?.trim();
  if (grade && !GRADE_VALUES.has(grade)) {
    warnings.push(`${player} / ${date}: 学年の値「${grade}」は不正です`);
  }

  const properties: Record<string, unknown> = {
    選手名: { title: [{ text: { content: player } }] },
    検査日: { date: { start: date } },
  };
  if (dorm && DORM_VALUES.has(dorm)) {
    properties["寮"] = { select: { name: dorm } };
  }
  if (grade && GRADE_VALUES.has(grade)) {
    properties["学年"] = { select: { name: grade } };
  }
  for (const col of paramColumns) {
    const raw = row[col]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isNaN(value)) {
      warnings.push(`数値に変換できない値をスキップしました: ${player}/${date}/${col}=${raw}`);
      continue;
    }
    properties[col] = { number: value };
  }

  return { properties, missingDorm: !dorm };
}

/**
 * Imports a CSV of blood-test results into the Notion blood-test database.
 * Shared between the `npm run import:csv` CLI script and the in-app upload
 * page, so both go through the exact same validation/dedupe/write logic.
 *
 * CSV columns: 選手名 + 検査日 (required), 寮・学年 (optional), and any other
 * column is treated as a numeric blood-test parameter and auto-created as a
 * Number property in Notion if it doesn't already exist.
 *
 * `mode: "create"` (default) skips rows that already exist. `mode: "upsert"`
 * instead overwrites the existing page's properties with this row's values -
 * used to backfill columns (e.g. 学年) onto rows a previous import already
 * created without them.
 *
 * `maxCreate` caps how many pages this call will actually write (create or
 * update) before returning early (`hasMore: true`) - a large CSV writes one
 * page at a time with a small delay between them to respect Notion's rate
 * limit, which can otherwise run well past a serverless function's time
 * limit. The caller (the /import page) re-invokes with the same CSV until
 * `hasMore` is false; already-written rows are recognized via the dedupe
 * check and skipped or updated, so each call just continues where the last
 * one stopped.
 */
export async function importBloodCsv(
  csvText: string,
  {
    dryRun = false,
    mode = "create",
    maxCreate,
  }: { dryRun?: boolean; mode?: "create" | "upsert"; maxCreate?: number } = {}
): Promise<ImportSummary> {
  const bloodDbId = process.env.NOTION_BLOOD_DATABASE_ID;
  if (!bloodDbId) throw new Error("NOTION_BLOOD_DATABASE_ID が設定されていません");

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const warnings: string[] = [];
  if (parsed.errors.length > 0) {
    warnings.push(
      `CSV解析中に警告があります: ${parsed.errors
        .slice(0, 5)
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  const columns = parsed.meta.fields ?? [];
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      throw new Error(`CSVに必須列「${col}」がありません`);
    }
  }
  const paramColumns = columns.filter((c) => !METADATA_COLUMNS.has(c));

  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(bloodDbId);

  // Add any parameter columns that don't exist yet as Number properties, and
  // 寮/学年 as Select properties (with their known options) if the CSV uses
  // them but the database predates that column - e.g. 学年 was added to the
  // schema after some databases were already created from CSVs without it.
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const existingProps = new Set(Object.keys(dataSource.properties));
  const numberProperties = paramColumns.filter((c) => !existingProps.has(c));

  const missingSelectProps: Record<string, { type: "select"; select: { options: { name: string }[] } }> =
    {};
  if (columns.includes("寮") && !existingProps.has("寮")) {
    missingSelectProps["寮"] = { type: "select", select: { options: DORM_OPTIONS.map((name) => ({ name })) } };
  }
  if (columns.includes("学年") && !existingProps.has("学年")) {
    missingSelectProps["学年"] = {
      type: "select",
      select: { options: [...GRADE_OPTIONS, HIGH_SCHOOL_GRADE].map((name) => ({ name })) },
    };
  }
  // Shown to the caller as "properties about to be added" - kept separate
  // from `numberProperties` below so building the Number-type payload can't
  // accidentally re-list (and overwrite as Number) a Select property here.
  const addedProperties = [...numberProperties, ...Object.keys(missingSelectProps)];

  if ((numberProperties.length > 0 || Object.keys(missingSelectProps).length > 0) && !dryRun) {
    const properties: Record<
      string,
      | { type: "number"; number: { format: string } }
      | { type: "select"; select: { options: { name: string }[] } }
    > = { ...missingSelectProps };
    for (const name of numberProperties) {
      properties[name] = { type: "number", number: { format: "number" } };
    }
    await notion.dataSources.update({ data_source_id: dataSourceId, properties });
  }

  // De-dupe against existing rows (選手名 + 検査日), keeping each row's page
  // id too so `mode: "upsert"` can update it directly.
  const existingKeys = new Map<string, string>();
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
      if (key) existingKeys.set(key, page.id);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Split valid/invalid up front so `skippedInvalid` (and therefore
  // `totalRows`) is the same on every round regardless of where `maxCreate`
  // cuts a given call off - unlike the main loop below, this always scans
  // the complete file.
  const validRows: { player: string; date: string; row: Record<string, string> }[] = [];
  let skippedInvalid = 0;
  for (const row of parsed.data) {
    const player = row["選手名"]?.trim();
    const date = row["検査日"]?.trim();
    if (!player || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      skippedInvalid++;
    } else {
      validRows.push({ player, date, row });
    }
  }
  const totalRows = parsed.data.length;

  let created = 0;
  let updated = 0;
  let skippedDuplicate = 0;
  let missingDorm = 0;
  let hasMore = false;

  for (const { player, date, row } of validRows) {
    if (!dryRun && maxCreate !== undefined && created + updated >= maxCreate) {
      hasMore = true;
      break;
    }

    const key = `${player}__${date}`;
    const existingPageId = existingKeys.get(key);

    if (existingPageId && mode === "create") {
      skippedDuplicate++;
      continue;
    }

    const { properties, missingDorm: rowMissingDorm } = buildProperties(
      player,
      date,
      row,
      paramColumns,
      warnings
    );

    if (existingPageId) {
      // mode === "upsert"
      if (!dryRun) {
        await notion.pages.update({
          page_id: existingPageId,
          properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
        });
        await sleep(150);
      }
      updated++;
      continue;
    }

    if (rowMissingDorm) missingDorm++;
    if (!dryRun) {
      const page = await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
      existingKeys.set(key, page.id);
      await sleep(150); // stay comfortably under Notion's rate limit
    } else {
      existingKeys.set(key, "dry-run");
    }
    created++;
  }

  return {
    paramColumns,
    addedProperties,
    totalRows,
    created,
    updated,
    skippedDuplicate,
    skippedInvalid,
    missingDorm,
    warnings,
    dryRun,
    mode,
    hasMore,
  };
}
