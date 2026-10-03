import { Run, Diagnosis, RunComparison, ReplayJob, Patch } from "@/types/run";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Service layer for Black Box.
 * Connects directly to the Node.js backend API (running on port 8000).
 */
export async function getRuns(): Promise<Run[]> {
  const res = await fetch(`${API_BASE_URL}/api/runs`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch runs: ${res.statusText}`);
  }
  return res.json();
}

export async function getRunById(id: string): Promise<Run | null> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch run ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function getDiagnosis(runId: string): Promise<Diagnosis | null> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/diagnosis`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch diagnosis for ${runId}: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerReplay(
  runId: string,
  checkpointStep: number,
  patch: Patch
): Promise<ReplayJob> {
  const res = await fetch(`${API_BASE_URL}/api/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_id: runId,
      checkpoint_step: checkpointStep,
      patch,
    }),
  });
  if (!res.ok) {
    throw new Error(`Replay failed: ${res.statusText}`);
  }
  return res.json();
}

export async function getRunComparison(
  originalId: string,
  replayedId: string
): Promise<RunComparison | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/compare?orig=${encodeURIComponent(originalId)}&rep=${encodeURIComponent(replayedId)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to compare runs: ${res.statusText}`);
  }
  return res.json();
}
