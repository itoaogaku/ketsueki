import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { generateSampleBloodData, generateSampleGameResults } from "./sample-data";
import type {
  BloodDataResponse,
  BloodTestRecord,
  Dorm,
  GameResultRecord,
  GameResultsResponse,
} from "./types";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOOD_DB_ID = process.env.NOTION_BLOOD_DATABASE_ID;
const GAMES_DB_ID = process.env.NOTION_GAMES_DATABASE_ID;

export function isBloodNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && BLOOD_DB_ID);
}

export function isGamesNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && GAMES_DB_ID);
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
  const values: Record<string, number> = {};

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      date = prop.date.start.slice(0, 10);
    } else if (prop.type === "select" && /寮/.test(name)) {
      const opt = prop.select?.name;
      if (opt === "1軍寮" || opt === "2軍寮") dorm = opt;
    } else if (prop.type === "number" && typeof prop.number === "number") {
      values[name] = prop.number;
    }
  }

  return { id: page.id, player, date, dorm, values };
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

export async function fetchBloodData(): Promise<BloodDataResponse> {
  if (!isBloodNotionConfigured()) {
    const records = generateSampleBloodData();
    return buildBloodResponse(records, "sample");
  }
  const pages = await queryAllPages(BLOOD_DB_ID!);
  const records = pages
    .map(extractBloodRecord)
    .filter((r) => r.date && r.player)
    .sort((a, b) => a.date.localeCompare(b.date));
  return buildBloodResponse(records, "notion");
}

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

export async function fetchGameResults(): Promise<GameResultsResponse> {
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
}

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
