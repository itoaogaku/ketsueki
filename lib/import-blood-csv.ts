import Papa from "papaparse";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getNotionClient, resolveDataSourceId } from "./notion";
import { DORM_OPTIONS } from "./types";

const REQUIRED_COLUMNS = ["選手名", "検査日"];
const METADATA_COLUMNS = new Set(["選手名", "検査日", "寮"]);
const DORM_VALUES = new Set<string>(DORM_OPTIONS);

export interface ImportSummary {
  paramColumns: string[];
  addedProperties: string[];
  created: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  missingDorm: number;
  warnings: string[];
  dryRun: boolean;
  /** true if `maxCreate` cut this call short - call again with the same CSV
   * to continue (already-created rows are skipped via the dedupe check). */
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

/**
 * Imports a CSV of blood-test results into the Notion blood-test database.
 * Shared between the `npm run import:csv` CLI script and the in-app upload
 * page, so both go through the exact same validation/dedupe/write logic.
 *
 * CSV columns: 選手名 + 検査日 (required), 寮 (optional), and any other
 * column is treated as a numeric blood-test parameter and auto-created as a
 * Number property in Notion if it doesn't already exist.
 *
 * `maxCreate` caps how many new pages this call will actually create before
 * returning early (`hasMore: true`) - a large CSV writes one page at a time
 * with a small delay between them to respect Notion's rate limit, which can
 * otherwise run well past a serverless function's time limit. The caller
 * (the /import page) re-invokes with the same CSV until `hasMore` is false;
 * rows already written are recognized via the dedupe check and skipped, so
 * each call just continues where the last one stopped.
 */
export async function importBloodCsv(
  csvText: string,
  { dryRun = false, maxCreate }: { dryRun?: boolean; maxCreate?: number } = {}
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

  // Add any parameter columns that don't exist yet as Number properties.
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const existingProps = new Set(Object.keys(dataSource.properties));
  const addedProperties = paramColumns.filter((c) => !existingProps.has(c));
  if (addedProperties.length > 0 && !dryRun) {
    const properties: Record<string, { type: "number"; number: { format: string } }> = {};
    for (const name of addedProperties) {
      properties[name] = { type: "number", number: { format: "number" } };
    }
    await notion.dataSources.update({ data_source_id: dataSourceId, properties });
  }

  // De-dupe against existing rows (選手名 + 検査日) so re-running the same
  // CSV doesn't create duplicate pages.
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
      const key = dedupeKeyFromPage(result as PageObjectResponse);
      if (key) existingKeys.add(key);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  let created = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  let missingDorm = 0;
  let hasMore = false;

  for (const row of parsed.data) {
    if (!dryRun && maxCreate !== undefined && created >= maxCreate) {
      hasMore = true;
      break;
    }

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
      warnings.push(`${player} / ${date}: 寮の値「${dorm}」は不正です`);
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
        warnings.push(`数値に変換できない値をスキップしました: ${player}/${date}/${col}=${raw}`);
        continue;
      }
      properties[col] = { number: value };
    }

    if (!dryRun) {
      await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
      await sleep(150); // stay comfortably under Notion's rate limit
    }
    created++;
    existingKeys.add(key); // guard against duplicate rows within the same CSV
  }

  return {
    paramColumns,
    addedProperties,
    created,
    skippedDuplicate,
    skippedInvalid,
    missingDorm,
    warnings,
    dryRun,
    hasMore,
  };
}
