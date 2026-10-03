import { Run, Diagnosis, RunComparison, ReplayJob, Patch } from "@/types/run";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? ""
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

/**
 * Service layer for Black Box.
 * Connects directly to the Node.js backend API (running on port 8000).
 */
export async function getRuns(): Promise<Run[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs`, {
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.warn("Backend API unreachable, using demo run fallback:", error);
  }

  // Graceful fallback for Vercel preview environments
  return [
    {
      id: "run-9a1b2c3d",
      task_id: 1,
      task: "Which department has the highest budget, and what is its budget?",
      task_text: "Which department has the highest budget, and what is its budget?",
      agent_name: "Text2SQL-Agent",
      status: "failed",
      outcome: "fail",
      duration_ms: 1850,
      step_count: 5,
      failure_type: "Logic Inversion (wrong_tool_args)",
      created_at: new Date().toISOString(),
      gold_answer: "Engineering with 900000.0",
      final_answer: "Sales with 250000.0",
    } as any,
  ];
}

export async function getRunById(id: string): Promise<Run | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs/${id}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.warn(`Backend API unreachable for run ${id}:`, error);
  }

  // Demo run fallback
  if (id === "run-9a1b2c3d") {
    return {
      id: "run-9a1b2c3d",
      task_id: 1,
      task: "Which department has the highest budget, and what is its budget?",
      task_text: "Which department has the highest budget, and what is its budget?",
      agent_name: "Text2SQL-Agent",
      status: "failed",
      outcome: "fail",
      duration_ms: 1850,
      step_count: 5,
      failure_type: "Logic Inversion (wrong_tool_args)",
      created_at: new Date().toISOString(),
      gold_answer: "Engineering with 900000.0",
      final_answer: "Sales with 250000.0",
      steps: [
        {
          step_index: 1,
          node_name: "plan",
          status: "success",
          duration_ms: 120,
          latency_ms: 120,
          inputs: { task: "Find highest department budget" },
          outputs: { plan: "Query departments table ordered by budget DESC" },
        },
        {
          step_index: 2,
          node_name: "select_tool",
          status: "success",
          duration_ms: 380,
          latency_ms: 380,
          inputs: { query: "SELECT department, MIN(budget) FROM departments" },
          outputs: { department: "Sales", budget: 250000.0 },
          is_suspect: true,
        },
        {
          step_index: 3,
          node_name: "run_tool",
          status: "success",
          duration_ms: 410,
          latency_ms: 410,
          inputs: { rows: [["Sales", 250000.0]] },
          outputs: { rows: [["Sales", 250000.0]] },
        },
        {
          step_index: 4,
          node_name: "reflect",
          status: "success",
          duration_ms: 85,
          latency_ms: 85,
          inputs: { rows: [["Sales", 250000.0]] },
          outputs: { satisfied: true },
        },
        {
          step_index: 5,
          node_name: "answer",
          status: "failed",
          duration_ms: 320,
          latency_ms: 320,
          inputs: { department: "Sales", budget: 250000.0 },
          outputs: { final_answer: "Sales with $250,000" },
          error: "Answer mismatch: Gold maximum budget is Engineering with $900,000.",
        },
      ],
    } as any;
  }
  return null;
}

export async function getDiagnosis(runId: string): Promise<Diagnosis | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/diagnosis`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.warn(`Backend API unreachable for diagnosis ${runId}:`, error);
  }

  // Demo fallback
  return {
    run_id: runId,
    predicted_step: 2,
    predicted_node: "select_tool",
    root_cause_step_index: 2,
    root_cause_node: "select_tool",
    confidence: 0.94,
    failure_type: "Logic Inversion (wrong_tool_args)",
    explanation: "The agent used MIN(budget) instead of MAX(budget) for a question asking for the highest budget.",
    top_suspicious_steps: [
      { step_index: 2, node_name: "select_tool", confidence: 0.94 },
      { step_index: 3, node_name: "run_tool", confidence: 0.28 },
    ],
    evidence: [],
    downstream_effects: [],
    suggested_patch: { query: "SELECT department, MAX(budget) FROM departments;" },
    created_at: new Date().toISOString(),
  } as any;
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
