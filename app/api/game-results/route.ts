import { NextResponse } from "next/server";
import { fetchGameResults } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchGameResults();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch game results", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
