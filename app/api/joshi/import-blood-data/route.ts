import { NextRequest, NextResponse } from "next/server";
import { importBloodCsv } from "@/lib/import-blood-csv";
import { JOSHI_COOKIE_NAME, joshiSessionToken } from "@/lib/joshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 女子用血液検査DB（NOTION_WOMEN_BLOOD_DATABASE_ID）へのCSVインポート。
 * /joshi の合言葉でログイン済み（proxy.ts と同じCookie）でなければ拒否する -
 * 男子側の /import や /api/import-blood-data からは女子用DBに書き込めない。 */
export async function POST(request: NextRequest) {
  try {
    const token = joshiSessionToken();
    if (!token || request.cookies.get(JOSHI_COOKIE_NAME)?.value !== token) {
      return NextResponse.json({ error: "女子用ページにログインしてください" }, { status: 401 });
    }

    const formData = await request.formData();

    const importSecret = process.env.IMPORT_SECRET;
    if (importSecret && formData.get("secret") !== importSecret) {
      return NextResponse.json({ error: "パスコードが正しくありません" }, { status: 401 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSVファイルが見つかりません" }, { status: 400 });
    }

    const dryRun = formData.get("dryRun") === "true";
    const mode = formData.get("mode") === "upsert" ? "upsert" : "create";
    const maxCreateRaw = formData.get("maxCreate");
    const maxCreate = typeof maxCreateRaw === "string" ? Number(maxCreateRaw) : undefined;
    const offsetRaw = formData.get("offset");
    const offset = typeof offsetRaw === "string" ? Number(offsetRaw) : undefined;
    const csvText = await file.text();
    const summary = await importBloodCsv(csvText, { dryRun, mode, maxCreate, offset, target: "women" });
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to import women's blood-test CSV", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
