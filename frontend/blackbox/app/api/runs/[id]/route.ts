import { NextRequest, NextResponse } from "next/server";
import { getRunById } from "@/lib/server/runsService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = await getRunById(id);
    if (!run) {
      return NextResponse.json({ error: `Run ${id} not found` }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (err: any) {
    console.error("GET /api/runs/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch run" }, { status: 500 });
  }
}
