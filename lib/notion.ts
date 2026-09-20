import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { unstable_cache } from "next/cache";
import { enteringYearFromBirthdate, gradeAtDate } from "./grade";
import { normalizeNameForMatching } from "./player-roster";
import { generateSampleBloodData, generateSampleGameResults, generateSampleWaScores } from "./sample-data";
import { parseRaceTimeSeconds } from "./time";
import type {
  BloodDataResponse,
  BloodTestRecord,
  Dorm,
  GameResultRecord,
  GameResultsResponse,
  Grade,
  WaScoreRecord,
  WaScoreResponse,
} from "./types";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOOD_DB_ID = process.env.NOTION_BLOOD_DATABASE_ID;
const GAMES_DB_ID = process.env.NOTION_GAMES_DATABASE_ID;
const MEMBERS_DB_ID = process.env.NOTION_MEMBERS_DATABASE_ID;
const WA_SCORES_DB_ID = process.env.NOTION_WA_SCORES_DATABASE_ID;

export function isBloodNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && BLOOD_DB_ID);
}

export function isGamesNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && GAMES_DB_ID);
}

export function isWaScoresNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && WA_SCORES_DB_ID);
}

export function isMembersNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && MEMBERS_DB_ID);
}

let cachedClient: Client | null = null;

/** Notion API 2025-09-03+ splits each database into "data sources"; this
 * client version's `databases.query`/`databases.update` were replaced by
 * `dataSources.query`/`dataSources.update`, so every read/write goes through
 * a resolved data source id, not the database id itself. */
export function getNotionClient(): Client {
  if (!NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN is not set");
  }
  if (!cachedClient) {
    cachedClient = new Client({ auth: NOTION_TOKEN });
  }
  return cachedClient;
}

const dataSourceIdCache = new Map<string, string>();

export async function resolveDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;

  const notion = getNotionClient();
  const database = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in database) || database.data_sources.length === 0) {
    throw new Error(`Database ${databaseId} has no data sources`);
  }
  const dataSourceId = database.data_sources[0].id;
  dataSourceIdCache.set(databaseId, dataSourceId);
  return dataSourceId;
}

export async function queryAllPages(databaseId: string): Promise<PageObjectResponse[]> {
  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(databaseId);
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const result of res.results) {
      if (result.object === "page" && "properties" in result) {
        pages.push(result as PageObjectResponse);
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

export function getPlainTitle(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title") {
      return prop.title.map((t) => t.plain_text).join("").trim();
    }
  }
  return "";
}

function extractBloodRecord(page: PageObjectResponse): BloodTestRecord {
  const player = getPlainTitle(page);
  let date = "";
  let dorm: Dorm | null = null;
  let grade: Grade | null = null;
  const values: Record<string, number> = {};

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (prop.type === "select" && /寮/.test(name)) {
      const opt = prop.select?.name;
      if (opt === "1寮生" || opt === "2寮生") dorm = opt;
    } else if (prop.type === "select" && /学年/.test(name)) {
      const opt = prop.select?.name;
      if (opt === "1年" || opt === "2年" || opt === "3年" || opt === "4年") grade = opt;
    } else if (prop.type === "number" && typeof prop.number === "number") {
      values[name] = prop.number;
    }
  }

  return { id: page.id, player, date, dorm, grade, values };
}

function extractGameRecord(page: PageObjectResponse): GameResultRecord {
  let date = "";
  let opponent: string | null = null;
  const metrics: Record<string, number> = {};
  const labels: Record<string, string> = {};

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (prop.type === "number" && typeof prop.number === "number") {
      metrics[name] = prop.number;
    } else if (prop.type === "select" && prop.select?.name) {
      labels[name] = prop.select.name;
      if (/相手|対戦/.test(name)) opponent = prop.select.name;
    } else if (prop.type === "status" && prop.status?.name) {
      labels[name] = prop.status.name;
    } else if (prop.type === "rich_text") {
      const text = prop.rich_text.map((t) => t.plain_text).join("");
      if (text) {
        labels[name] = text;
        if (/相手|対戦/.test(name)) opponent = text;
        const seconds = parseRaceTimeSeconds(text);
        if (seconds !== null) metrics[`${name}（秒）`] = seconds;
      }
    } else if (prop.type === "title") {
      const text = prop.title.map((t) => t.plain_text).join("");
      if (text) labels[name] = text;
    }
  }

  return { id: page.id, date, opponent, metrics, labels };
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ja"));
}

/** 選手名 -> 生年月日 (ISO yyyy-mm-dd) from the 部員データベース, keyed by
 * normalized name (see normalizeNameForMatching). Only players registered
 * there get a computed grade; anyone else falls back to the grade
 * hand-entered on their own blood-test row (unchanged, previous
 * behaviour). */
async function fetchMemberBirthdates(): Promise<Map<string, string>> {
  const pages = await queryAllPages(MEMBERS_DB_ID!);
  const map = new Map<string, string>();
  for (const page of pages) {
    const name = getPlainTitle(page);
    if (!name) continue;
    for (const [propName, prop] of Object.entries(page.properties)) {
      if (prop.type === "date" && prop.date?.start && /生年月日/.test(propName)) {
        map.set(normalizeNameForMatching(name), prop.date.start.slice(0, 10));
        break;
      }
    }
  }
  return map;
}

/** Replaces each record's grade with one computed from the player's
 * birthdate (in the 部員データベース) and the record's own test date,
 * rather than trusting the 学年 hand-entered on that individual blood-test
 * row - which drifts out of date as a player advances a year and older
 * rows don't get updated, causing the grade shown next to a player's name
 * to silently stop matching reality.
 *
 * Also returns each matched player's entering year (so a "what grade are
 * they *right now*" question can be answered directly with gradeAtDate,
 * rather than by finding their most recent test record - which reads as
 * their grade at whatever the last time they happened to be tested, and
 * understates their grade for anyone who missed the most recent round),
 * and reports which players couldn't be matched to the 部員データベース at
 * all (typo, different name formatting, not yet added to the roster) - for
 * them this silently falls back to the old per-row 学年 behaviour, which is
 * easy to mistake for the new logic "not working" unless it's surfaced.
 *
 * Takes the already-fetched birthdate map rather than fetching it itself, so
 * the caller can run that Notion round trip concurrently with the blood-data
 * one instead of waiting for it to finish first. */
function applyComputedGrades(
  records: BloodTestRecord[],
  birthdates: Map<string, string>
): {
  records: BloodTestRecord[];
  enteringYearByPlayer: Record<string, number>;
  unmatchedPlayers: string[];
} {
  const enteringYearByKey = new Map<string, number>();
  const enteringYearByPlayer: Record<string, number> = {};
  const latestUnmatchedDate = new Map<string, string>();
  const graded = records.map((r) => {
    const key = normalizeNameForMatching(r.player);
    const birthdate = birthdates.get(key);
    if (!birthdate) {
      const prev = latestUnmatchedDate.get(r.player);
      if (!prev || r.date > prev) latestUnmatchedDate.set(r.player, r.date);
      return r;
    }
    let enteringYear = enteringYearByKey.get(key);
    if (enteringYear === undefined) {
      enteringYear = enteringYearFromBirthdate(birthdate);
      enteringYearByKey.set(key, enteringYear);
    }
    enteringYearByPlayer[r.player] = enteringYear;
    return { ...r, grade: gradeAtDate(enteringYear, r.date) };
  });

  // A graduated/inactive player simply not being in the roster database is
  // expected and not worth flagging - only an unmatched player who was
  // tested recently (and so is presumably still active) points at a real
  // mismatch worth fixing. "Recent" is relative to the newest test date in
  // the dataset, not the server clock, so this keeps working correctly
  // during an off-season gap in testing.
  const UNMATCHED_RECENCY_WINDOW_DAYS = 400;
  const daysBetween = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
  const newestOverallDate = records.reduce((max, r) => (r.date > max ? r.date : max), "");
  const unmatchedPlayers = uniqueSorted(
    Array.from(latestUnmatchedDate.entries())
      .filter(
        ([, date]) => daysBetween(date, newestOverallDate) <= UNMATCHED_RECENCY_WINDOW_DAYS
      )
      .map(([player]) => player)
  );

  return { records: graded, enteringYearByPlayer, unmatchedPlayers };
}

/** Fetching every row from Notion (paginated, several round trips) gets
 * slower as the database grows, so the result is cached for a minute rather
 * than re-fetched on every page view - a fresh import shows up within that
 * window rather than instantly. This wraps the function (not the page/route)
 * so it only runs at request time, never during `next build`, which in this
 * project's sandboxed dev environment has no route to api.notion.com. */
export const fetchBloodData = unstable_cache(
  async (): Promise<BloodDataResponse> => {
    if (!isBloodNotionConfigured()) {
      const records = generateSampleBloodData();
      return buildBloodResponse(records, "sample");
    }
    // Independent Notion round trips - run concurrently rather than
    // waiting for the (paginated, possibly several-request) blood fetch to
    // finish before even starting the members one.
    const [pages, birthdates] = await Promise.all([
      queryAllPages(BLOOD_DB_ID!),
      isMembersNotionConfigured() ? fetchMemberBirthdates() : Promise.resolve(null),
    ]);
    let records = pages
      .map(extractBloodRecord)
      .filter((r) => r.date && r.player)
      .sort((a, b) => a.date.localeCompare(b.date));
    let unmatchedGradePlayers: string[] | undefined;
    let playerEnteringYear: Record<string, number> | undefined;
    if (birthdates) {
      const result = applyComputedGrades(records, birthdates);
      records = result.records;
      unmatchedGradePlayers = result.unmatchedPlayers;
      playerEnteringYear = result.enteringYearByPlayer;
    }
    return buildBloodResponse(records, "notion", unmatchedGradePlayers, playerEnteringYear);
  },
  ["blood-data"],
  { revalidate: 60 }
);

function buildBloodResponse(
  records: BloodTestRecord[],
  source: BloodDataResponse["source"],
  unmatchedGradePlayers?: string[],
  playerEnteringYear?: Record<string, number>
): BloodDataResponse {
  const parameters = new Set<string>();
  records.forEach((r) => Object.keys(r.values).forEach((k) => parameters.add(k)));
  return {
    records,
    players: uniqueSorted(records.map((r) => r.player)),
    parameters: uniqueSorted(parameters),
    source,
    unmatchedGradePlayers,
    playerEnteringYear,
  };
}

export const fetchGameResults = unstable_cache(
  async (): Promise<GameResultsResponse> => {
    if (!isGamesNotionConfigured()) {
      const records = generateSampleGameResults();
      return buildGameResponse(records, "sample");
    }
    const pages = await queryAllPages(GAMES_DB_ID!);
    const records = pages
      .map(extractGameRecord)
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    return buildGameResponse(records, "notion");
  },
  ["game-results"],
  { revalidate: 60 }
);

function buildGameResponse(
  records: GameResultRecord[],
  source: GameResultsResponse["source"]
): GameResultsResponse {
  const metrics = new Set<string>();
  const labels = new Set<string>();
  records.forEach((r) => {
    Object.keys(r.metrics).forEach((k) => metrics.add(k));
    Object.keys(r.labels).forEach((k) => labels.add(k));
  });
  return {
    records,
    metrics: uniqueSorted(metrics),
    labels: uniqueSorted(labels),
    source,
  };
}

function extractWaScoreRecord(page: PageObjectResponse): WaScoreRecord | null {
  const player = getPlainTitle(page);
  let date = "";
  let event = "";
  let resultText = "";
  let points: number | null = null;

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (prop.type === "select" && /種目/.test(name)) {
      event = prop.select?.name ?? "";
    } else if (prop.type === "rich_text" && /結果/.test(name)) {
      resultText = prop.rich_text.map((t) => t.plain_text).join("");
    } else if (prop.type === "number" && /得点|points/i.test(name) && typeof prop.number === "number") {
      points = prop.number;
    }
  }

  if (!player || !date || points === null) return null;
  return { id: page.id, player, date, event, resultText, points };
}

/** Reads pre-computed WA得点 rows from the WAスコア database that
 * scripts/sync-wa-scores.ts populates from the 競技結果データベース (see
 * lib/wa-scoring.ts) - not computed live here, since the source 競技結果 DB's
 * 種目/結果 column names aren't standardized enough for the app itself to
 * reliably auto-detect and convert on every request. */
export const fetchWaScores = unstable_cache(
  async (): Promise<WaScoreResponse> => {
    if (!isWaScoresNotionConfigured()) {
      const records = generateSampleWaScores();
      return buildWaScoreResponse(records, "sample");
    }
    const pages = await queryAllPages(WA_SCORES_DB_ID!);
    const records = pages
      .map(extractWaScoreRecord)
      .filter((r): r is WaScoreRecord => r !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    return buildWaScoreResponse(records, "notion");
  },
  ["wa-scores"],
  { revalidate: 60 }
);

function buildWaScoreResponse(
  records: WaScoreRecord[],
  source: WaScoreResponse["source"]
): WaScoreResponse {
  return {
    records,
    players: uniqueSorted(records.map((r) => r.player)),
    source,
  };
}
