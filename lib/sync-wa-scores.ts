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

export interface SyncWaScoresSummary {
  totalSourceRows: number;
  /** Rows with a recognized player/date/event/result to work with at all
   * (before checking whether the event is a WA-table-covered one). */
  parsedRows: number;
  /** 駅伝の区間など、WAスコアリングテーブルにない非標準種目としてスキップされた件数。 */
  outOfScope: number;
  /** 対象種目だが記録の形式が読み取れずスキップされた件数。 */
  unparseable: number;
  created: number;
  updated: number;
  dryRun: boolean;
  warnings: string[];
  /** true if `maxWrites` cut this call short - call again with the same
   * arguments (passing this response's `nextOffset` back as `offset`) to
   * continue. Always false for a dry run (dry run only counts, never writes,
   * so there's nothing slow enough to need cutting off). */
  hasMore: boolean;
  /** Index into the full (recomputed every call) list of convertible rows to
   * resume writing from on the next call - see `maxWrites` below. */
  nextOffset: number;
}

/**
 * Reads every row of the 競技結果データベース, converts each recognized
 * standard-distance result into WA (World Athletics) Scoring Tables points
 * (see lib/wa-scoring.ts), and upserts one row per result into the WAスコア
 * database. Shared between the `npm run sync:wa-scores` CLI script and the
 * in-app `/import` page's "WAスコアを同期" button (app/api/sync-wa-scores),
 * for when running the script locally isn't convenient - mirrors how
 * lib/import-blood-csv.ts is shared the same way for the blood-test CSV
 * import.
 *
 * This database holds derived data, not hand-edited data, so unlike the
 * blood-test CSV importer there's no separate create/upsert mode - every
 * matching row's WA得点 is always refreshed to the currently computed value.
 *
 * `maxWrites` caps how many pages a call actually writes (create or update)
 * before returning early (`hasMore: true`) - a large 競技結果DB can need
 * thousands of writes, one Notion page at a time with a small delay between
 * them to respect its rate limit, which runs well past a serverless
 * function's time limit. The caller (the /import page) re-invokes with the
 * same `offset` (this response's `nextOffset`) until `hasMore` is false -
 * this re-reads and re-converts the full 競技結果DB on every call (the
 * `toWrite` list isn't persisted between calls), same tradeoff
 * lib/import-blood-csv.ts makes for the same reason, simplicity over
 * avoiding the redundant reads.
 */
export async function syncWaScores({
  dryRun = false,
  maxWrites,
  offset = 0,
}: { dryRun?: boolean; maxWrites?: number; offset?: number } = {}): Promise<SyncWaScoresSummary> {
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
  const toWrite: { player: string; date: string; event: string; resultText: string; points: number }[] = [];

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
    toWrite.push({ ...row, points: computed.points });
  }

  let created = 0;
  let updated = 0;
  let hasMore = false;
  let nextOffset = toWrite.length;

  if (toWrite.length > 0) {
    const notion = getNotionClient();
    const dataSourceId = await resolveDataSourceId(waScoresDbId);

    const existingPages = await queryAllPages(waScoresDbId);
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

    if (dryRun) {
      for (const row of toWrite) {
        if (existingKeys.has(dedupeKey(row))) updated++;
        else created++;
      }
    } else {
      for (let i = offset; i < toWrite.length; i++) {
        if (maxWrites !== undefined && created + updated >= maxWrites) {
          hasMore = true;
          nextOffset = i;
          break;
        }

        const row = toWrite[i];
        const key = dedupeKey(row);
        const existingPageId = existingKeys.get(key);
        const properties = {
          選手名: { title: [{ text: { content: row.player } }] },
          日付: { date: { start: row.date } },
          競技種目: { select: { name: row.event } },
          競技結果: { rich_text: [{ text: { content: row.resultText } }] },
          WA得点: { number: row.points },
        };

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
    }
  }

  return {
    totalSourceRows: sourcePages.length,
    parsedRows: rawRows.length,
    outOfScope,
    unparseable,
    created,
    updated,
    dryRun,
    warnings,
    hasMore,
    nextOffset,
  };
}
