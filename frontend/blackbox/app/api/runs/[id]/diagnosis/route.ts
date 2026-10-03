import { NextRequest, NextResponse } from "next/server";
import { getDiagnosisForRun } from "@/lib/server/diagnosisService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const diagnosis = await getDiagnosisForRun(id);
    if (!diagnosis) {
      return NextResponse.json({ error: `Diagnosis for run ${id} not found` }, { status: 404 });
    }
    return NextResponse.json(diagnosis);
  } catch (err: any) {
    console.error("GET /api/runs/[id]/diagnosis error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate diagnosis" }, { status: 500 });
  }
}
