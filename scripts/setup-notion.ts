/**
 * Creates the Notion database this app reads blood-test data from, under a
 * parent page you already share with your integration.
 *
 * Usage:
 *   1. Create a Notion integration at https://www.notion.so/profile/integrations
 *      and copy its "Internal Integration Secret".
 *   2. In Notion, open (or create) a page for this project and, from its
 *      "..." menu, add a Connection to that integration so it can create
 *      pages/databases under it.
 *   3. Put NOTION_TOKEN=... and NOTION_PARENT_PAGE_ID=... in .env.local
 *      (the page ID is the 32-character id in the page's URL).
 *   4. Run: npm run setup:notion
 *      Optionally add --with-games to also scaffold a starter 試合結果 DB
 *      (skip this if you already have one - just set its id as
 *      NOTION_GAMES_DATABASE_ID instead).
 *
 * The script prints the created database id(s) to add to .env.local as
 * NOTION_BLOOD_DATABASE_ID / NOTION_GAMES_DATABASE_ID.
 */
import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;
const withGames = process.argv.includes("--with-games");

async function main() {
  if (!NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN が設定されていません（.env.local を確認してください）");
  }
  if (!PARENT_PAGE_ID) {
    throw new Error(
      "NOTION_PARENT_PAGE_ID が設定されていません（データベースを作成する親ページのIDを指定してください）"
    );
  }

  const notion = new Client({ auth: NOTION_TOKEN });

  console.log("血液検査データベースを作成しています...");
  const bloodDb = await notion.databases.create({
    parent: { type: "page_id", page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "血液検査データ" } }],
    is_inline: true,
    initial_data_source: {
      properties: {
        選手名: { type: "title", title: {} },
        検査日: { type: "date", date: {} },
        寮: {
          type: "select",
          select: {
            options: [{ name: "1寮生", color: "blue" }, { name: "2寮生", color: "orange" }],
          },
        },
        学年: {
          type: "select",
          select: {
            options: [
              { name: "1年", color: "green" },
              { name: "2年", color: "blue" },
              { name: "3年", color: "yellow" },
              { name: "4年", color: "red" },
            ],
          },
        },
      },
    },
  });
  console.log(`  作成完了: ${bloodDb.id}`);
  console.log(`  → .env.local に NOTION_BLOOD_DATABASE_ID=${bloodDb.id} を追加してください`);
  console.log(
    "  血液検査の項目（Hb、Fe など）は CSV インポート時に自動で列として追加されます。"
  );

  if (withGames) {
    console.log("\n試合結果データベースを作成しています...");
    const gamesDb = await notion.databases.create({
      parent: { type: "page_id", page_id: PARENT_PAGE_ID },
      title: [{ type: "text", text: { content: "試合結果" } }],
      is_inline: true,
      initial_data_source: {
        properties: {
          試合: { type: "title", title: {} },
        },
      },
    });
    if (!("data_sources" in gamesDb) || gamesDb.data_sources.length === 0) {
      throw new Error("試合結果データベースにデータソースが見つかりません");
    }
    // The title property is just a row label; the app reads the game date
    // from the separate `試合日程` date property added below.
    const gamesDataSourceId = gamesDb.data_sources[0].id;
    await notion.dataSources.update({
      data_source_id: gamesDataSourceId,
      properties: {
        試合日程: { type: "date", date: {} },
        対戦相手: { type: "rich_text", rich_text: {} },
        得点: { type: "number", number: { format: "number" } },
        失点: { type: "number", number: { format: "number" } },
        勝敗: {
          type: "select",
          select: {
            options: [
              { name: "勝", color: "green" },
              { name: "負", color: "red" },
              { name: "分", color: "gray" },
            ],
          },
        },
      },
    });
    console.log(`  作成完了: ${gamesDb.id}`);
    console.log(`  → .env.local に NOTION_GAMES_DATABASE_ID=${gamesDb.id} を追加してください`);
  } else {
    console.log(
      "\n試合結果データベースは作成していません。既存のデータベースの ID を NOTION_GAMES_DATABASE_ID に設定してください。"
    );
    console.log("（新規に作成したい場合は --with-games を付けて再実行してください）");
  }
}

main().catch((err) => {
  console.error("セットアップに失敗しました:", err);
  process.exit(1);
});
