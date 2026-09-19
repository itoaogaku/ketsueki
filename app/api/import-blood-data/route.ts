import { NextRequest, NextResponse } from "next/server";
import { importBloodCsv } from "@/lib/import-blood-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
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
    const csvText = await file.text();
    const summary = await importBloodCsv(csvText, { dryRun });
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to import blood-test CSV", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
