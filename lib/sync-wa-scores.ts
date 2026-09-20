import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  getNotionClient,
  getPlainTitle,
  isGamesNotionConfigured,
  isWaScoresNotionConfigured,
  queryAllPages,
  resolveDataSourceId,
} from "./notion";
import { computeWaPoints, resolveWaDiscipline } from "./wa-scoring";

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
 * fixed schema, since this reads an existing database this app didn't
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

/** One 競技結果DB row already converted to WA得点, along with whichever
 * WAスコアDB page (if any) it should overwrite - resolved once during
 * `prepareWaScoreSync` so `writeWaScoreBatch` never has to re-read either
 * database to figure this out. */
export interface PreparedWaRow {
  player: string;
  date: string;
  event: string;
  resultText: string;
  points: number;
  existingPageId: string | null;
}

export interface PrepareWaSyncResult {
  totalSourceRows: number;
  /** Rows with a recognized player/date/event/result to work with at all
   * (before checking whether the event is a WA-table-covered one). */
  parsedRows: number;
  /** 駅伝の区間など、WAスコアリングテーブルにない非標準種目としてスキップされた件数。 */
  outOfScope: number;
  /** 対象種目だが記録の形式が読み取れずスキップされた件数。 */
  unparseable: number;
  warnings: string[];
  rows: PreparedWaRow[];
}

/**
 * Reads every row of the 競技結果データベース, converts each recognized
 * standard-distance result into WA (World Athletics) Scoring Tables points
 * (see lib/wa-scoring.ts), and checks each one against the WAスコア
 * database's existing rows - a read-only pass (no writes), so it's used both
 * for a "内容を確認" dry run and as the first step of an actual sync, whose
 * caller (writeWaScoreBatch) needs the same `rows` list to write from.
 *
 * Doing this once and having the caller batch `rows` itself (rather than
 * re-deriving it inside every batched write call, the way
 * lib/import-blood-csv.ts's CSV importer re-scans its whole file every
 * round) matters here because the source 競技結果DB is read in full every
 * time - for a large database that's dozens of Notion API round trips, which
 * repeated on every one of many small write batches added up to blowing
 * past a serverless function's time limit even with few writes per batch.
 */
export async function prepareWaScoreSync(): Promise<PrepareWaSyncResult> {
  if (!isGamesNotionConfigured()) {
    throw new Error(
      "NOTION_TOKEN / NOTION_GAMES_DATABASE_ID が設定されていません（変換元の競技結果データベースが必要です）"
    );
  }
  if (!isWaScoresNotionConfigured()) {
    throw new Error(
      "NOTION_WA_SCORES_DATABASE_ID が設定されていません（先に npm run setup:notion -- --with-wa-scores を実行するか、既存DBのIDを設定してください）"
    );
  }
  const waScoresDbId = process.env.NOTION_WA_SCORES_DATABASE_ID!;

  const sourcePages = await queryAllPages(process.env.NOTION_GAMES_DATABASE_ID!);
  const rawRows = sourcePages.map(extractRawResultRow).filter((r): r is RawResultRow => r !== null);

  let outOfScope = 0;
  let unparseable = 0;
  const warnings: string[] = [];
  const converted: { player: string; date: string; event: string; resultText: string; points: number }[] = [];

  for (const row of rawRows) {
    if (!resolveWaDiscipline(row.event)) {
      outOfScope++;
      continue;
    }
    const computed = computeWaPoints(row.event, row.resultText);
    if (!computed) {
      unparseable++;
      warnings.push(
        `記録の形式が読み取れずスキップ: ${row.player} / ${row.date} / ${row.event} / 「${row.resultText}」`
      );
      continue;
    }
    converted.push({ ...row, points: computed.points });
  }

  const existingKeys = new Map<string, string>();
  if (converted.length > 0) {
    const existingPages = await queryAllPages(waScoresDbId);
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
  }

  const rows: PreparedWaRow[] = converted.map((row) => ({
    ...row,
    existingPageId: existingKeys.get(dedupeKey(row)) ?? null,
  }));

  return {
    totalSourceRows: sourcePages.length,
    parsedRows: rawRows.length,
    outOfScope,
    unparseable,
    warnings,
    rows,
  };
}

/**
 * Writes one batch of already-`prepareWaScoreSync`-resolved rows to the
 * WAスコア database (create if `existingPageId` is null, otherwise update
 * that page) - no re-reading of either database, so the caller controls
 * batch size purely by how many `rows` it passes, to stay under a
 * serverless function's time limit (see app/api/sync-wa-scores/route.ts and
 * the /import page for how the browser slices `PrepareWaSyncResult.rows`
 * into batches across repeated calls).
 */
export async function writeWaScoreBatch(
  rows: PreparedWaRow[]
): Promise<{ created: number; updated: number }> {
  if (!isWaScoresNotionConfigured()) {
    throw new Error("NOTION_WA_SCORES_DATABASE_ID が設定されていません");
  }
  const waScoresDbId = process.env.NOTION_WA_SCORES_DATABASE_ID!;

  let created = 0;
  let updated = 0;
  if (rows.length === 0) return { created, updated };

  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(waScoresDbId);

  for (const row of rows) {
    const properties = {
      選手名: { title: [{ text: { content: row.player } }] },
      日付: { date: { start: row.date } },
      競技種目: { select: { name: row.event } },
      競技結果: { rich_text: [{ text: { content: row.resultText } }] },
      WA得点: { number: row.points },
    };

    if (row.existingPageId) {
      await notion.pages.update({
        page_id: row.existingPageId,
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

  return { created, updated };
}
