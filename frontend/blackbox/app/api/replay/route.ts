import { NextRequest, NextResponse } from "next/server";
import { executeReplay } from "@/lib/server/replayService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { run_id, checkpoint_step, patch } = body;
    if (!run_id) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    const result = await executeReplay({
      run_id,
      checkpoint_step: checkpoint_step ?? 2,
      patch: patch || {},
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST /api/replay error:", err);
    return NextResponse.json({ error: err.message || "Replay failed" }, { status: 500 });
  }
}
