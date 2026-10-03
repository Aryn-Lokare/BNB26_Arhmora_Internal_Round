import { Run, Diagnosis, RunComparison, ReplayJob, Patch } from "@/types/run";
import {
  MOCK_RUNS,
  MOCK_RUN_DETAIL_FAILED,
  MOCK_RUN_DETAIL_REPLAYED,
  MOCK_DIAGNOSIS_FAILED,
  MOCK_COMPARISON,
} from "./mockData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Service layer for Black Box.
 * Connects to live FastAPI backend if available, otherwise falls back gracefully
 * to realistic flight recorder mock data for seamless demo presentation.
 */
export async function getRuns(): Promise<Run[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs`, { next: { revalidate: 10 } });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info("[BlackBox API] Backend unavailable, using local flight recorder store:", err);
  }
  return MOCK_RUNS;
}

export async function getRunById(id: string): Promise<Run | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs/${id}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info(`[BlackBox API] Fetch failed for run ${id}, checking mock data:`, err);
  }

  if (id === MOCK_RUN_DETAIL_FAILED.id) return MOCK_RUN_DETAIL_FAILED;
  if (id === MOCK_RUN_DETAIL_REPLAYED.id) return MOCK_RUN_DETAIL_REPLAYED;

  const found = MOCK_RUNS.find((r) => r.id === id);
  return found || null;
}

export async function getDiagnosis(runId: string): Promise<Diagnosis | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/diagnosis`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info(`[BlackBox API] Diagnosis fetch failed for ${runId}, falling back to ML model mock:`, err);
  }

  if (runId === MOCK_DIAGNOSIS_FAILED.run_id || runId === "run-9a1b2c3d") {
    return MOCK_DIAGNOSIS_FAILED;
  }
  return null;
}

export async function triggerReplay(
  runId: string,
  checkpointStep: number,
  patch: Patch
): Promise<ReplayJob> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, checkpoint_step: checkpointStep, patch }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info("[BlackBox API] Replay engine API call failed, simulating local replay execution:", err);
  }

  // Realistic mock replay job response
  return {
    job_id: `job-${Date.now().toString(36)}`,
    original_run_id: runId,
    forked_step: checkpointStep,
    status: "completed",
    replayed_run_id: MOCK_RUN_DETAIL_REPLAYED.id,
    compute_saved_pct: 33.3,
    steps_reused: 2,
    steps_executed: 4,
    created_at: new Date().toISOString(),
  };
}

export async function getRunComparison(originalId: string, replayedId: string): Promise<RunComparison | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/compare?orig=${originalId}&rep=${replayedId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.info("[BlackBox API] Comparison endpoint unavailable, using step diff model:", err);
  }

  if (originalId === MOCK_RUN_DETAIL_FAILED.id || originalId === "run-9a1b2c3d") {
    return MOCK_COMPARISON;
  }
  return null;
}
