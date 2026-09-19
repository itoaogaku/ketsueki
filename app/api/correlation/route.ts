import { NextRequest, NextResponse } from "next/server";
import { fetchBloodData, fetchGameResults } from "@/lib/notion";
import { computeAllCorrelations, computeCorrelation } from "@/lib/stats";
import type { Dorm } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parameter = searchParams.get("parameter");
    const metric = searchParams.get("metric");
    const dormParam = searchParams.get("dorm") as Dorm | "all" | null;
    const windowDays = Number(searchParams.get("windowDays") ?? 7);

    const [blood, games] = await Promise.all([fetchBloodData(), fetchGameResults()]);

    if (parameter && metric) {
      const result = computeCorrelation(blood.records, games.records, {
        parameter,
        metric,
        dorm: dormParam ?? "all",
        windowDays,
      });
      return NextResponse.json({ result });
    }

    const ranked = computeAllCorrelations(
      blood.records,
      games.records,
      blood.parameters,
      games.metrics,
      { dorm: dormParam ?? "all", windowDays }
    );
    return NextResponse.json({ ranked });
  } catch (error) {
    console.error("Failed to compute correlation", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
