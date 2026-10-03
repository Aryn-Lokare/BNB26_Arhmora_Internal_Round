import { query, getPool } from "./db";

export interface NormalizedStep {
  step_idx: number;
  step_index: number;
  node: string;
  node_name: string;
  tool_name?: string;
  input: Record<string, any>;
  inputs: Record<string, any>;
  output: Record<string, any> | null;
  outputs: Record<string, any> | null;
  error?: string | null;
  latency_ms: number;
  duration_ms: number;
  checkpoint_id?: string | null;
  state_snapshot?: Record<string, any> | null;
  state_delta?: Record<string, any>;
  failure_probability?: number;
  is_suspect?: boolean;
  is_suspicious?: boolean;
  status: string;
}

export interface NormalizedRun {
  id: string;
  task_id: number;
  task_text: string;
  task: string;
  agent_name: string;
  gold_answer?: string | null;
  final_answer?: string | null;
  outcome: string;
  status: string;
  failure_type?: string | null;
  injected_step?: number | null;
  parent_run_id?: string | null;
  forked_at_step?: number | null;
  patch?: Record<string, any> | null;
  llm_calls: number;
  cached_calls: number;
  split?: string | null;
  created_at: string;
  duration_ms: number;
  step_count: number;
  steps: NormalizedStep[];
  diagnosis?: any;
}

// In-memory registry for newly created replays during session
const replayedRunsStore: Map<string, NormalizedRun> = new Map();

/**
 * Seed flagship runs for demo if not in DB or if DB is offline
 */
const SEED_RUNS: NormalizedRun[] = [
  {
    id: "run-9a1b2c3d",
    task_id: 0,
    task_text: "What is the highest department budget?",
    task: "What is the highest department budget?",
    agent_name: "Text2SQL-ReAct-Agent",
    gold_answer: "900000.0",
    final_answer: "250000.0",
    outcome: "fail",
    status: "failed",
    failure_type: "Logic Inversion (wrong_tool_args)",
    injected_step: 2,
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 4,
    cached_calls: 0,
    split: "test",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    duration_ms: 1840,
    step_count: 6,
    steps: [
      {
        step_idx: 0,
        step_index: 0,
        node: "schema",
        node_name: "schema",
        input: { task: "What is the highest department budget?", step_idx: 0 },
        inputs: { task: "What is the highest department budget?", step_idx: 0 },
        output: {
          schema: "departments(id integer, name text, budget numeric)\nemployees(id integer, name text, salary numeric, dept_id integer)\nprojects(id integer, name text, budget numeric, dept_id integer)",
        },
        outputs: {
          schema: "departments(id integer, name text, budget numeric)\nemployees(id integer, name text, salary numeric, dept_id integer)\nprojects(id integer, name text, budget numeric, dept_id integer)",
        },
        error: null,
        latency_ms: 120,
        duration_ms: 120,
        checkpoint_id: "cp-0-schema",
        status: "success",
        is_suspect: false,
      },
      {
        step_idx: 1,
        step_index: 1,
        node: "plan",
        node_name: "plan",
        input: { task: "What is the highest department budget?", step_idx: 1 },
        inputs: { task: "What is the highest department budget?", step_idx: 1 },
        output: { plan: "Find highest department budget using aggregate query ordered descending" },
        outputs: { plan: "Find highest department budget using aggregate query ordered descending" },
        error: null,
        latency_ms: 380,
        duration_ms: 380,
        checkpoint_id: "cp-1-plan",
        status: "success",
        is_suspect: false,
      },
      {
        step_idx: 2,
        step_index: 2,
        node: "select_tool",
        node_name: "select_tool",
        input: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        inputs: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        output: {
          name: "sql_db_query",
          arguments: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        },
        outputs: {
          name: "sql_db_query",
          arguments: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        },
        error: null,
        latency_ms: 410,
        duration_ms: 410,
        checkpoint_id: "cp-2-select_tool",
        status: "success",
        is_suspect: true,
        is_suspicious: true,
        failure_probability: 0.94,
      },
      {
        step_idx: 3,
        step_index: 3,
        node: "run_tool",
        node_name: "run_tool",
        input: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        inputs: { query: "SELECT department, MIN(budget) FROM departments GROUP BY department LIMIT 1;" },
        output: { rows: [{ department: "Sales", budget: 250000.0 }] },
        outputs: { rows: [{ department: "Sales", budget: 250000.0 }] },
        error: null,
        latency_ms: 85,
        duration_ms: 85,
        checkpoint_id: "cp-3-run_tool",
        status: "success",
        is_suspect: false,
      },
      {
        step_idx: 4,
        step_index: 4,
        node: "reflect",
        node_name: "reflect",
        input: { rows: [{ department: "Sales", budget: 250000.0 }] },
        inputs: { rows: [{ department: "Sales", budget: 250000.0 }] },
        output: { satisfied: true, note: "Found department with lowest budget ($250,000) and assumed satisfied" },
        outputs: { satisfied: true, note: "Found department with lowest budget ($250,000) and assumed satisfied" },
        error: null,
        latency_ms: 320,
        duration_ms: 320,
        checkpoint_id: "cp-4-reflect",
        status: "success",
        is_suspect: false,
      },
      {
        step_idx: 5,
        step_index: 5,
        node: "answer",
        node_name: "answer",
        input: { department: "Sales", budget: 250000.0 },
        inputs: { department: "Sales", budget: 250000.0 },
        output: { final_answer: "The department with the highest budget is Sales with $250,000." },
        outputs: { final_answer: "The department with the highest budget is Sales with $250,000." },
        error: "Gold SQL assertion failed: Expected $900,000.0 (Engineering), got $250,000.0 (Sales)",
        latency_ms: 525,
        duration_ms: 525,
        checkpoint_id: "cp-5-answer",
        status: "failed",
        is_suspect: false,
      },
    ],
  },
  {
    id: "run-4f81c9a0",
    task_id: 0,
    task_text: "What is the highest department budget?",
    task: "What is the highest department budget?",
    agent_name: "Text2SQL-ReAct-Agent",
    gold_answer: "900000.0",
    final_answer: "900000.0",
    outcome: "success",
    status: "replayed",
    failure_type: null,
    injected_step: null,
    parent_run_id: "run-9a1b2c3d",
    forked_at_step: 2,
    patch: { query: "SELECT department, MAX(budget) FROM departments GROUP BY department LIMIT 1;" },
    llm_calls: 3,
    cached_calls: 2,
    split: "test",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    duration_ms: 910,
    step_count: 6,
    steps: [
      {
        step_idx: 0,
        step_index: 0,
        node: "schema",
        node_name: "schema",
        input: { task: "What is the highest department budget?", step_idx: 0 },
        inputs: { task: "What is the highest department budget?", step_idx: 0 },
        output: { schema: "departments, employees, projects" },
        outputs: { schema: "departments, employees, projects" },
        error: null,
        latency_ms: 0,
        duration_ms: 0,
        checkpoint_id: "cp-0-schema",
        status: "replayed",
      },
      {
        step_idx: 1,
        step_index: 1,
        node: "plan",
        node_name: "plan",
        input: { task: "What is the highest department budget?", step_idx: 1 },
        inputs: { task: "What is the highest department budget?", step_idx: 1 },
        output: { plan: "Reused from checkpoint" },
        outputs: { plan: "Reused from checkpoint" },
        error: null,
        latency_ms: 0,
        duration_ms: 0,
        checkpoint_id: "cp-1-plan",
        status: "replayed",
      },
      {
        step_idx: 2,
        step_index: 2,
        node: "select_tool",
        node_name: "select_tool",
        input: { query: "SELECT department, MAX(budget) FROM departments GROUP BY department LIMIT 1;" },
        inputs: { query: "SELECT department, MAX(budget) FROM departments GROUP BY department LIMIT 1;" },
        output: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        outputs: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        error: null,
        latency_ms: 320,
        duration_ms: 320,
        checkpoint_id: "cp-2-select_tool-replayed",
        status: "success",
      },
      {
        step_idx: 3,
        step_index: 3,
        node: "run_tool",
        node_name: "run_tool",
        input: { query: "SELECT department, MAX(budget) FROM departments" },
        inputs: { query: "SELECT department, MAX(budget) FROM departments" },
        output: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        outputs: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        error: null,
        latency_ms: 60,
        duration_ms: 60,
        checkpoint_id: "cp-3-run_tool-replayed",
        status: "success",
      },
      {
        step_idx: 4,
        step_index: 4,
        node: "reflect",
        node_name: "reflect",
        input: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        inputs: { rows: [{ department: "Engineering", budget: 900000.0 }] },
        output: { satisfied: true },
        outputs: { satisfied: true },
        error: null,
        latency_ms: 280,
        duration_ms: 280,
        checkpoint_id: "cp-4-reflect-replayed",
        status: "success",
      },
      {
        step_idx: 5,
        step_index: 5,
        node: "answer",
        node_name: "answer",
        input: { department: "Engineering", budget: 900000.0 },
        inputs: { department: "Engineering", budget: 900000.0 },
        output: { final_answer: "The department with the highest budget is Engineering with $900,000." },
        outputs: { final_answer: "The department with the highest budget is Engineering with $900,000." },
        error: null,
        latency_ms: 250,
        duration_ms: 250,
        checkpoint_id: "cp-5-answer-replayed",
        status: "success",
      },
    ],
  },
];

export async function getAllRuns(): Promise<NormalizedRun[]> {
  const p = getPool();
  if (p) {
    try {
      const dbRuns = await query<any>(
        "SELECT id, task_id, task_text, gold_answer, final_answer, outcome, injected_step, fault_type, " +
        "parent_run_id, forked_at_step, patch, llm_calls, cached_calls, split, created_at " +
        "FROM runs ORDER BY created_at DESC LIMIT 50"
      );
      if (dbRuns.length > 0) {
        return dbRuns.map((r) => ({
          id: r.id,
          task_id: r.task_id,
          task_text: r.task_text,
          task: r.task_text,
          agent_name: "Text2SQL-Agent",
          gold_answer: r.gold_answer,
          final_answer: r.final_answer,
          outcome: r.outcome,
          status: r.outcome === "fail" ? "failed" : r.outcome,
          failure_type: r.fault_type,
          injected_step: r.injected_step,
          parent_run_id: r.parent_run_id,
          forked_at_step: r.forked_at_step,
          patch: r.patch,
          llm_calls: r.llm_calls || 1,
          cached_calls: r.cached_calls || 0,
          split: r.split,
          created_at: r.created_at,
          duration_ms: 1250,
          step_count: 5,
          steps: [],
        }));
      }
    } catch (e) {
      console.warn("DB query failed, using in-memory store:", e);
    }
  }

  // Combine replayed runs store and seed runs
  const combined = [...replayedRunsStore.values(), ...SEED_RUNS];
  const unique = Array.from(new Map(combined.map((r) => [r.id, r])).values());
  return unique;
}

export async function getRunById(runId: string): Promise<NormalizedRun | null> {
  if (replayedRunsStore.has(runId)) {
    return replayedRunsStore.get(runId)!;
  }

  const seed = SEED_RUNS.find((r) => r.id === runId);
  if (seed) return seed;

  const p = getPool();
  if (p) {
    try {
      const rows = await query<any>("SELECT * FROM runs WHERE id = $1", [runId]);
      if (rows.length > 0) {
        const r = rows[0];
        const stepRows = await query<any>("SELECT * FROM steps WHERE run_id = $1 ORDER BY step_idx", [runId]);
        return {
          id: r.id,
          task_id: r.task_id,
          task_text: r.task_text,
          task: r.task_text,
          agent_name: "Text2SQL-Agent",
          gold_answer: r.gold_answer,
          final_answer: r.final_answer,
          outcome: r.outcome,
          status: r.outcome === "fail" ? "failed" : r.outcome,
          failure_type: r.fault_type,
          injected_step: r.injected_step,
          parent_run_id: r.parent_run_id,
          forked_at_step: r.forked_at_step,
          patch: r.patch,
          llm_calls: r.llm_calls || 1,
          cached_calls: r.cached_calls || 0,
          split: r.split,
          created_at: r.created_at,
          duration_ms: 1200,
          step_count: stepRows.length,
          steps: stepRows.map((s, idx) => ({
            step_idx: s.step_idx ?? idx,
            step_index: s.step_idx ?? idx,
            node: s.node,
            node_name: s.node,
            input: s.input || {},
            inputs: s.input || {},
            output: s.output || {},
            outputs: s.output || {},
            error: s.error,
            latency_ms: s.latency_ms || 200,
            duration_ms: s.latency_ms || 200,
            checkpoint_id: s.checkpoint_id,
            status: s.error ? "failed" : "success",
            is_suspect: Boolean(s.error || s.step_idx === r.injected_step),
          })),
        };
      }
    } catch (e) {
      console.warn("DB getRunById failed:", e);
    }
  }

  return null;
}

export function saveReplayedRun(run: NormalizedRun) {
  replayedRunsStore.set(run.id, run);
}
