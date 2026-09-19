import { NextResponse } from "next/server";
import { fetchBloodData } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchBloodData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch blood data", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
