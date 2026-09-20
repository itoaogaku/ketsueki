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
  /** Resolved directly from a title/rich_text/people 選手 property - null
   * when it's a relation instead, in which case `playerRelationId` names the
   * linked page (e.g. in 部員データベース) whose own title is the player's
   * name, resolved separately (see resolvePlayerNames) since that needs its
   * own Notion API calls the per-row extraction here can't make. */
  player: string | null;
  playerRelationId: string | null;
  date: string;
  event: string;
  resultText: string;
}

/** Auto-detects the 選手, date, 種目, and 結果 columns of one 競技結果DB row,
 * whatever they're actually named or typed - mirrors extractGameRecord
 * (lib/notion.ts)'s own type+name-based detection rather than assuming a
 * fixed schema, since this reads an existing database this app didn't
 * create. Deliberately does NOT assume the 選手 column is the database's
 * title property (Notion's mandatory title property here turned out to
 * hold the competition/meet name instead, e.g. "第46回神奈川マラソン", not
 * the athlete) - it can be a title, a plain text column, a relation to
 * another database (e.g. 部員データベース), or a Person column, and this
 * handles all four by property *name* instead. */
function extractRawResultRow(page: PageObjectResponse): RawResultRow | null {
  let player: string | null = null;
  let playerRelationId: string | null = null;
  let date = "";
  let event = "";
  let resultText = "";

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (/選手/.test(name)) {
      if (prop.type === "title") player = prop.title.map((t) => t.plain_text).join("").trim();
      else if (prop.type === "rich_text") player = prop.rich_text.map((t) => t.plain_text).join("").trim();
      else if (prop.type === "relation" && prop.relation.length > 0) playerRelationId = prop.relation[0].id;
      else if (prop.type === "people" && prop.people.length > 0) {
        const person = prop.people[0];
        player = "name" in person ? (person.name ?? null) : null;
      }
    } else if (/種目/.test(name)) {
      if (prop.type === "select" && prop.select?.name) event = prop.select.name;
      else if (prop.type === "rich_text") event = prop.rich_text.map((t) => t.plain_text).join("");
    } else if (/結果|記録|タイム/.test(name)) {
      if (prop.type === "rich_text") resultText = prop.rich_text.map((t) => t.plain_text).join("");
      else if (prop.type === "number" && typeof prop.number === "number") resultText = String(prop.number);
    }
  }

  if ((!player && !playerRelationId) || !date || !event || !resultText) return null;
  return { player, playerRelationId, date, event, resultText };
}

/** Resolves each row's `playerRelationId` (a 部員データベース page id, say)
 * to that page's own title, fetching each *distinct* linked page once
 * (there are far fewer players than result rows) rather than once per row.
 * Rows whose 選手 column already held a plain name need no resolution. */
async function resolvePlayerNames(
  rows: RawResultRow[]
): Promise<{ player: string; date: string; event: string; resultText: string }[]> {
  const relationIds = Array.from(
    new Set(rows.filter((r) => r.playerRelationId).map((r) => r.playerRelationId!))
  );

  const nameById = new Map<string, string>();
  if (relationIds.length > 0) {
    const notion = getNotionClient();
    // There are far fewer distinct players than result rows (dozens, not
    // thousands), so these are looked up with some concurrency rather than
    // one at a time - sequential lookups here were adding enough time to
    // risk the serverless function's time limit on their own, on top of the
    // (unavoidably sequential, cursor-paginated) source database read.
    const CONCURRENCY = 8;
    for (let i = 0; i < relationIds.length; i += CONCURRENCY) {
      const batch = relationIds.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (id) => {
          const linkedPage = await notion.pages.retrieve({ page_id: id });
          if ("properties" in linkedPage) {
            nameById.set(id, getPlainTitle(linkedPage as PageObjectResponse));
          }
        })
      );
    }
  }

  const resolved: { player: string; date: string; event: string; resultText: string }[] = [];
  for (const row of rows) {
    const player = row.player ?? (row.playerRelationId ? nameById.get(row.playerRelationId) : undefined);
    if (!player) continue; // couldn't resolve the relation - skip rather than write a blank name
    resolved.push({ player, date: row.date, event: row.event, resultText: row.resultText });
  }
  return resolved;
}

function dedupeKey(row: { player: string; date: string; event: string }): string {
  return `${row.player}__${row.date}__${row.event}`;
}

/** One 競技結果DB row already converted to WA得点. Whether a matching row
 * already exists in the WAスコア database is deliberately NOT resolved here
 * (see prepareWaScoreSync's doc comment) - writeWaScoreBatch figures that
 * out per batch instead. */
export interface PreparedWaRow {
  player: string;
  date: string;
  event: string;
  resultText: string;
  points: number;
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
 * Reads every row of the 競技結果データベース and converts each recognized
 * standard-distance result into WA (World Athletics) Scoring Tables points
 * (see lib/wa-scoring.ts) - a read-only pass over the *source* database only
 * (no writes, and no reading of the WAスコア database), used both for a
 * "内容を確認" dry-run preview and as the first step of an actual sync, whose
 * caller (writeWaScoreBatch) needs the same `rows` list to write from.
 *
 * This deliberately does NOT check which rows already exist in the WAスコア
 * database - it used to (via one queryAllPages of that database), but that
 * database only grows across repeated syncs, and once it held a few thousand
 * rows that read alone was slow enough to make even this read-only step
 * time out. writeWaScoreBatch checks existence itself, scoped to just the
 * rows in the batch it's about to write, instead.
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

  const sourcePages = await queryAllPages(process.env.NOTION_GAMES_DATABASE_ID!);
  const extractedRows = sourcePages.map(extractRawResultRow).filter((r): r is RawResultRow => r !== null);
  const rawRows = await resolvePlayerNames(extractedRows);

  let outOfScope = 0;
  let unparseable = 0;
  const warnings: string[] = [];
  const rows: PreparedWaRow[] = [];

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
    rows.push({ ...row, points: computed.points });
  }

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
 * Writes one batch of already-`prepareWaScoreSync`-converted rows to the
 * WAスコア database - create if no matching row (same 選手名 + 日付 + 競技種目)
 * exists yet there, otherwise update it. Existence is checked with a single
 * filtered query scoped to just this batch's rows (an OR of up to
 * `rows.length` exact-match conditions), not by reading the whole WAスコア
 * database - see prepareWaScoreSync's doc comment for why. The caller
 * controls batch size purely by how many `rows` it passes, to stay under a
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

  const existingKeys = new Map<string, string>();
  const filterResponse = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 100,
    filter: {
      or: rows.map((row) => ({
        and: [
          { property: "選手名", title: { equals: row.player } },
          { property: "日付", date: { equals: row.date } },
          { property: "競技種目", select: { equals: row.event } },
        ],
      })),
    } as Parameters<typeof notion.dataSources.query>[0]["filter"],
  });
  for (const result of filterResponse.results) {
    if (result.object !== "page" || !("properties" in result)) continue;
    const page = result as PageObjectResponse;
    const player = getPlainTitle(page);
    let date = "";
    let event = "";
    for (const [name, prop] of Object.entries(page.properties)) {
      if (prop.type === "date" && prop.date?.start) date = prop.date.start.slice(0, 10);
      else if (prop.type === "select" && /種目/.test(name)) event = prop.select?.name ?? "";
    }
    if (player && date && event) existingKeys.set(dedupeKey({ player, date, event }), page.id);
  }

  for (const row of rows) {
    const existingPageId = existingKeys.get(dedupeKey(row));
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

  return { created, updated };
}
