import { NextResponse } from "next/server";
import { getAllRuns } from "@/lib/server/runsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await getAllRuns();
    return NextResponse.json(runs);
  } catch (err: any) {
    console.error("GET /api/runs error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch runs" }, { status: 500 });
  }
}
