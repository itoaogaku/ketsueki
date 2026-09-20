import { NextRequest, NextResponse } from "next/server";
import { syncWaScores } from "@/lib/sync-wa-scores";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const importSecret = process.env.IMPORT_SECRET;
    if (importSecret && body.secret !== importSecret) {
      return NextResponse.json({ error: "パスコードが正しくありません" }, { status: 401 });
    }

    const dryRun = body.dryRun === true;
    const summary = await syncWaScores({ dryRun });
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to sync WA scores", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
