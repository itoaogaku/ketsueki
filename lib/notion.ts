import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { unstable_cache } from "next/cache";
import { enteringYearFromBirthdate, gradeAtDate } from "./grade";
import { generateSampleBloodData, generateSampleGameResults } from "./sample-data";
import type {
  BloodDataResponse,
  BloodTestRecord,
  Dorm,
  GameResultRecord,
  GameResultsResponse,
  Grade,
} from "./types";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOOD_DB_ID = process.env.NOTION_BLOOD_DATABASE_ID;
const GAMES_DB_ID = process.env.NOTION_GAMES_DATABASE_ID;
const MEMBERS_DB_ID = process.env.NOTION_MEMBERS_DATABASE_ID;

export function isBloodNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && BLOOD_DB_ID);
}

export function isGamesNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && GAMES_DB_ID);
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

function getPlainTitle(page: PageObjectResponse): string {
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

/** Matches a race time written as text, e.g. "13:47.76" or "9:16.68" -
 * minutes:seconds(.hundredths). Times are recorded this way (not as a
 * Number property) in the 競技結果DB, so they land in `labels` like any
 * other text unless parsed into seconds here for numeric use (charts,
 * correlation). Non-time text in the same column (e.g. "途中棄権" for a
 * DNF) simply doesn't match and is left as a label only. */
const RACE_TIME_PATTERN = /^(\d{1,3}):([0-5]\d)(?:\.(\d+))?$/;

function parseRaceTimeSeconds(text: string): number | null {
  const m = RACE_TIME_PATTERN.exec(text.trim());
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  const fraction = m[3] ? Number(`0.${m[3]}`) : 0;
  return Math.round((minutes * 60 + seconds + fraction) * 100) / 100;
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

/** The 部員データベース and 血液検査データベース were filled in by hand at
 * different times, so the same player's name can carry a full-width space
 * (「村上　直弥」) in one and a half-width space (「村上 直弥」) in the other -
 * collapsing every run of whitespace (either kind) to a single half-width
 * space before matching means that difference doesn't break the lookup. */
function normalizeNameForMatching(name: string): string {
  return name.replace(/[　\s]+/g, " ").trim();
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
 * to silently stop matching reality. */
async function applyComputedGrades(records: BloodTestRecord[]): Promise<BloodTestRecord[]> {
  const birthdates = await fetchMemberBirthdates();
  const enteringYearByPlayer = new Map<string, number>();
  return records.map((r) => {
    const key = normalizeNameForMatching(r.player);
    const birthdate = birthdates.get(key);
    if (!birthdate) return r;
    let enteringYear = enteringYearByPlayer.get(key);
    if (enteringYear === undefined) {
      enteringYear = enteringYearFromBirthdate(birthdate);
      enteringYearByPlayer.set(key, enteringYear);
    }
    return { ...r, grade: gradeAtDate(enteringYear, r.date) };
  });
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
    const pages = await queryAllPages(BLOOD_DB_ID!);
    let records = pages
      .map(extractBloodRecord)
      .filter((r) => r.date && r.player)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (isMembersNotionConfigured()) {
      records = await applyComputedGrades(records);
    }
    return buildBloodResponse(records, "notion");
  },
  ["blood-data"],
  { revalidate: 60 }
);

function buildBloodResponse(
  records: BloodTestRecord[],
  source: BloodDataResponse["source"]
): BloodDataResponse {
  const parameters = new Set<string>();
  records.forEach((r) => Object.keys(r.values).forEach((k) => parameters.add(k)));
  return {
    records,
    players: uniqueSorted(records.map((r) => r.player)),
    parameters: uniqueSorted(parameters),
    source,
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
