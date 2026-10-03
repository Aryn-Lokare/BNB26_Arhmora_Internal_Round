import { NextRequest, NextResponse } from "next/server";
import { compareRuns } from "@/lib/server/replayService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const origId = searchParams.get("orig") || "run-9a1b2c3d";
    const repId = searchParams.get("rep") || "run-4f81c9a0";

    const comparison = await compareRuns(origId, repId);
    if (!comparison) {
      return NextResponse.json({ error: "Runs could not be compared" }, { status: 404 });
    }

    return NextResponse.json(comparison);
  } catch (err: any) {
    console.error("GET /api/compare error:", err);
    return NextResponse.json({ error: err.message || "Comparison failed" }, { status: 500 });
  }
}
