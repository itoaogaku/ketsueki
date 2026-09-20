import { NextRequest, NextResponse } from "next/server";
import { prepareWaScoreSync, writeWaScoreBatch, type PreparedWaRow } from "@/lib/sync-wa-scores";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function checkSecret(body: { secret?: string }): boolean {
  const importSecret = process.env.IMPORT_SECRET;
  return !importSecret || body.secret === importSecret;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!checkSecret(body)) {
      return NextResponse.json({ error: "パスコードが正しくありません" }, { status: 401 });
    }

    if (body.mode === "write") {
      const rows = body.rows as PreparedWaRow[] | undefined;
      if (!Array.isArray(rows)) {
        return NextResponse.json({ error: "rows が指定されていません" }, { status: 400 });
      }
      const result = await writeWaScoreBatch(rows);
      return NextResponse.json({ result });
    }

    // mode: "prepare" (default) - read-only, also used for the dry-run preview.
    const result = await prepareWaScoreSync();
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Failed to sync WA scores", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
