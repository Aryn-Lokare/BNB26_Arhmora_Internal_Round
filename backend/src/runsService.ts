import fs from "fs";
import path from "path";
import { query } from "./db.js";

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
 * Seed flagship runs for demo if not already in DB
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
        latency_ms: 120,
        duration_ms: 120,
        checkpoint_id: "ckpt-9a1b-0",
        state_snapshot: { task: "What is the highest department budget?", step_idx: 1 },
        failure_probability: 0.02,
        is_suspect: false,
        is_suspicious: false,
        status: "success",
      },
      {
        step_idx: 1,
        step_index: 1,
        node: "plan",
        node_name: "plan",
        input: { task: "What is the highest department budget?", step_idx: 1 },
        inputs: { task: "What is the highest department budget?", step_idx: 1 },
        output: { plan: ["find max budget in departments table", "return the number"], step_idx: 2 },
        outputs: { plan: ["find max budget in departments table", "return the number"], step_idx: 2 },
        latency_ms: 380,
        duration_ms: 380,
        checkpoint_id: "ckpt-9a1b-1",
        state_snapshot: { plan: ["find max budget in departments table"], step_idx: 2 },
        failure_probability: 0.05,
        is_suspect: false,
        is_suspicious: false,
        status: "success",
      },
      {
        step_idx: 2,
        step_index: 2,
        node: "select_tool",
        node_name: "select_tool",
        tool_name: "run_sql",
        input: { task: "What is the highest department budget?", step_idx: 2 },
        inputs: { task: "What is the highest department budget?", step_idx: 2 },
        output: {
          pending_call: {
            tool: "run_sql",
            args: { query: "SELECT MIN(budget) FROM departments" },
          },
        },
        outputs: {
          pending_call: {
            tool: "run_sql",
            args: { query: "SELECT MIN(budget) FROM departments" },
          },
        },
        latency_ms: 410,
        duration_ms: 410,
        checkpoint_id: "ckpt-9a1b-2",
        state_snapshot: { pending_call: { tool: "run_sql" }, step_idx: 3 },
        failure_probability: 0.94,
        is_suspect: true,
        is_suspicious: true,
        status: "failed",
      },
      {
        step_idx: 3,
        step_index: 3,
        node: "run_tool",
        node_name: "run_tool",
        tool_name: "run_sql",
        input: { pending_call: { tool: "run_sql", args: { query: "SELECT MIN(budget) FROM departments" } } },
        inputs: { pending_call: { tool: "run_sql", args: { query: "SELECT MIN(budget) FROM departments" } } },
        output: { scratchpad: [{ result: { columns: ["min"], rows: [[250000.0]] } }] },
        outputs: { scratchpad: [{ result: { columns: ["min"], rows: [[250000.0]] } }] },
        latency_ms: 85,
        duration_ms: 85,
        checkpoint_id: "ckpt-9a1b-3",
        state_snapshot: { rows: [[250000.0]], step_idx: 4 },
        failure_probability: 0.28,
        is_suspect: false,
        is_suspicious: false,
        status: "failed",
      },
      {
        step_idx: 4,
        step_index: 4,
        node: "reflect",
        node_name: "reflect",
        input: { iteration: 0, scratchpad: [{ result: { rows: [[250000.0]] } }] },
        inputs: { iteration: 0, scratchpad: [{ result: { rows: [[250000.0]] } }] },
        output: { done: true, iteration: 1 },
        outputs: { done: true, iteration: 1 },
        latency_ms: 320,
        duration_ms: 320,
        checkpoint_id: "ckpt-9a1b-4",
        state_snapshot: { done: true, step_idx: 5 },
        failure_probability: 0.35,
        is_suspect: false,
        is_suspicious: false,
        status: "failed",
      },
      {
        step_idx: 5,
        step_index: 5,
        node: "answer",
        node_name: "answer",
        input: { scratchpad: [{ result: { rows: [[250000.0]] } }] },
        inputs: { scratchpad: [{ result: { rows: [[250000.0]] } }] },
        output: { answer: "250000.0" },
        outputs: { answer: "250000.0" },
        latency_ms: 525,
        duration_ms: 525,
        checkpoint_id: "ckpt-9a1b-5",
        state_snapshot: { answer: "250000.0", step_idx: 6 },
        failure_probability: 0.12,
        is_suspect: false,
        is_suspicious: false,
        status: "failed",
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
    failure_type: "none",
    parent_run_id: "run-9a1b2c3d",
    forked_at_step: 2,
    patch: { query: "SELECT MAX(budget) FROM departments" },
    llm_calls: 2,
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
        output: { schema: "departments..." },
        outputs: { schema: "departments..." },
        latency_ms: 0,
        duration_ms: 0,
        checkpoint_id: "ckpt-9a1b-0",
        status: "success",
      },
      {
        step_idx: 1,
        step_index: 1,
        node: "plan",
        node_name: "plan",
        input: { task: "What is the highest department budget?", step_idx: 1 },
        inputs: { task: "What is the highest department budget?", step_idx: 1 },
        output: { plan: ["find max budget in departments table"] },
        outputs: { plan: ["find max budget in departments table"] },
        latency_ms: 0,
        duration_ms: 0,
        checkpoint_id: "ckpt-9a1b-1",
        status: "success",
      },
      {
        step_idx: 2,
        step_index: 2,
        node: "select_tool",
        node_name: "select_tool",
        tool_name: "run_sql",
        input: { task: "What is the highest department budget?", step_idx: 2 },
        inputs: { task: "What is the highest department budget?", step_idx: 2 },
        output: {
          pending_call: { tool: "run_sql", args: { query: "SELECT MAX(budget) FROM departments" } },
        },
        outputs: {
          pending_call: { tool: "run_sql", args: { query: "SELECT MAX(budget) FROM departments" } },
        },
        latency_ms: 320,
        duration_ms: 320,
        checkpoint_id: "ckpt-4f81-2",
        status: "success",
      },
      {
        step_idx: 3,
        step_index: 3,
        node: "run_tool",
        node_name: "run_tool",
        tool_name: "run_sql",
        input: { pending_call: { tool: "run_sql" } },
        inputs: { pending_call: { tool: "run_sql" } },
        output: { scratchpad: [{ result: { columns: ["max"], rows: [[900000.0]] } }] },
        outputs: { scratchpad: [{ result: { columns: ["max"], rows: [[900000.0]] } }] },
        latency_ms: 60,
        duration_ms: 60,
        checkpoint_id: "ckpt-4f81-3",
        status: "success",
      },
      {
        step_idx: 4,
        step_index: 4,
        node: "reflect",
        node_name: "reflect",
        input: { iteration: 0 },
        inputs: { iteration: 0 },
        output: { done: true, iteration: 1 },
        outputs: { done: true, iteration: 1 },
        latency_ms: 280,
        duration_ms: 280,
        checkpoint_id: "ckpt-4f81-4",
        status: "success",
      },
      {
        step_idx: 5,
        step_index: 5,
        node: "answer",
        node_name: "answer",
        input: { scratchpad: [{ result: { rows: [[900000.0]] } }] },
        inputs: { scratchpad: [{ result: { rows: [[900000.0]] } }] },
        output: { answer: "900000.0" },
        outputs: { answer: "900000.0" },
        latency_ms: 250,
        duration_ms: 250,
        checkpoint_id: "ckpt-4f81-5",
        status: "success",
      },
    ],
  },
];

/**
 * Load raw dataset runs from blackbox/dataset/raw
 */
function loadLocalDatasetRuns(): NormalizedRun[] {
  const datasetDir = path.resolve(__dirname, "../../blackbox/dataset/raw");
  if (!fs.existsSync(datasetDir)) return [];

  const files = fs.readdirSync(datasetDir).filter((f) => f.endsWith(".json")).slice(0, 30);
  const runs: NormalizedRun[] = [];

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(datasetDir, file), "utf-8"));
      const isFailed = raw.status === "failed" || raw.status === "fail";

      const steps: NormalizedStep[] = (raw.steps || []).map((s: any, idx: number) => {
        const isSuspect = s.failure_label === 1 || s.step_id === raw.failure_step_id;
        return {
          step_idx: idx,
          step_index: idx,
          node: s.action || s.step_type || `node_${idx}`,
          node_name: s.action || s.step_type || `node_${idx}`,
          tool_name: s.action,
          input: s.input || {},
          inputs: s.input || {},
          output: s.output || null,
          outputs: s.output || null,
          latency_ms: s.duration_ms || 250,
          duration_ms: s.duration_ms || 250,
          checkpoint_id: s.checkpoint_id || `chk-${idx}`,
          state_snapshot: s.state_after || s.state_before,
          failure_probability: isSuspect ? 0.91 : 0.05,
          is_suspect: isSuspect,
          is_suspicious: isSuspect,
          status: s.status || (isSuspect ? "failed" : "success"),
        };
      });

      runs.push({
        id: raw.run_id,
        task_id: parseInt(raw.run_id.replace(/\D/g, ""), 10) || 0,
        task_text: `Execute workflow for ${raw.task_type || "agent task"}`,
        task: `Execute workflow for ${raw.task_type || "agent task"}`,
        agent_name: raw.agent_name || "AgentWorker-v1",
        gold_answer: "verified_state",
        final_answer: JSON.stringify(raw.final_output || {}),
        outcome: isFailed ? "fail" : "success",
        status: isFailed ? "failed" : "success",
        failure_type: raw.failure_type || (isFailed ? "Runtime Error" : "none"),
        injected_step: raw.failure_step_id ? parseInt(raw.failure_step_id.replace(/\D/g, ""), 10) : null,
        parent_run_id: null,
        forked_at_step: null,
        patch: null,
        llm_calls: steps.length,
        cached_calls: 0,
        split: "dataset",
        created_at: raw.start_time || new Date().toISOString(),
        duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
        step_count: steps.length,
        steps,
      });
    } catch (e) {
      // Skip corrupt files
    }
  }

  return runs;
}

/**
 * Fetch all runs combined from Postgres DB, local dataset, and memory store
 */
export async function getAllRuns(): Promise<NormalizedRun[]> {
  const allRuns: NormalizedRun[] = [...SEED_RUNS];

  // 1. Fetch from PostgreSQL
  try {
    const dbRuns = await query<any>(
      `SELECT r.*, COUNT(s.step_idx) as actual_steps 
       FROM runs r 
       LEFT JOIN steps s ON r.id = s.run_id 
       GROUP BY r.id 
       ORDER BY r.created_at DESC`
    );

    for (const r of dbRuns) {
      if (!allRuns.some((existing) => existing.id === r.id)) {
        const isFail = r.outcome === "fail" || r.outcome === "failed";
        allRuns.push({
          id: r.id,
          task_id: r.task_id || 0,
          task_text: r.task_text || "Agent Execution Task",
          task: r.task_text || "Agent Execution Task",
          agent_name: "Text2SQL-ReAct-Agent",
          gold_answer: r.gold_answer,
          final_answer: r.final_answer,
          outcome: r.outcome,
          status: isFail ? "failed" : r.forked_at_step ? "replayed" : "success",
          failure_type: r.fault_type || (isFail ? "Logic Error" : "none"),
          injected_step: r.injected_step,
          parent_run_id: r.parent_run_id,
          forked_at_step: r.forked_at_step,
          patch: r.patch,
          llm_calls: r.llm_calls || 4,
          cached_calls: r.cached_calls || 0,
          split: r.split || "live",
          created_at: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at),
          duration_ms: 1500,
          step_count: Number(r.actual_steps) || 5,
          steps: [],
        });
      }
    }
  } catch (err) {
    console.warn("[Backend DB] Postgres runs fetch failed, relying on dataset:", err);
  }

  // 2. Add local dataset runs
  const localRuns = loadLocalDatasetRuns();
  for (const lr of localRuns) {
    if (!allRuns.some((existing) => existing.id === lr.id)) {
      allRuns.push(lr);
    }
  }

  // 3. Add session replayed runs
  for (const replayed of replayedRunsStore.values()) {
    const idx = allRuns.findIndex((r) => r.id === replayed.id);
    if (idx >= 0) allRuns[idx] = replayed;
    else allRuns.unshift(replayed);
  }

  return allRuns;
}

/**
 * Fetch a single run by ID with all of its steps
 */
export async function getRunById(id: string): Promise<NormalizedRun | null> {
  // Check memory store first
  if (replayedRunsStore.has(id)) {
    return replayedRunsStore.get(id)!;
  }

  // Check seed runs
  const seed = SEED_RUNS.find((r) => r.id === id);
  if (seed) return seed;

  // Check Postgres DB
  try {
    const dbRun = (await query<any>("SELECT * FROM runs WHERE id = $1", [id]))[0];
    if (dbRun) {
      const dbSteps = await query<any>(
        "SELECT * FROM steps WHERE run_id = $1 ORDER BY step_idx ASC",
        [id]
      );

      const isFail = dbRun.outcome === "fail" || dbRun.outcome === "failed";
      const steps: NormalizedStep[] = dbSteps.map((s) => ({
        step_idx: s.step_idx,
        step_index: s.step_idx,
        node: s.node,
        node_name: s.node,
        tool_name: s.input?.pending_call?.tool || s.node,
        input: s.input || {},
        inputs: s.input || {},
        output: s.output || null,
        outputs: s.output || null,
        error: s.error,
        latency_ms: s.latency_ms || 200,
        duration_ms: s.latency_ms || 200,
        checkpoint_id: s.checkpoint_id,
        state_snapshot: s.state_snapshot,
        failure_probability: s.error ? 0.95 : 0.05,
        is_suspect: !!s.error,
        is_suspicious: !!s.error,
        status: s.error ? "failed" : "success",
      }));

      return {
        id: dbRun.id,
        task_id: dbRun.task_id || 0,
        task_text: dbRun.task_text || "Agent Task",
        task: dbRun.task_text || "Agent Task",
        agent_name: "Text2SQL-ReAct-Agent",
        gold_answer: dbRun.gold_answer,
        final_answer: dbRun.final_answer,
        outcome: dbRun.outcome,
        status: isFail ? "failed" : dbRun.forked_at_step ? "replayed" : "success",
        failure_type: dbRun.fault_type || (isFail ? "Logic Error" : "none"),
        injected_step: dbRun.injected_step,
        parent_run_id: dbRun.parent_run_id,
        forked_at_step: dbRun.forked_at_step,
        patch: dbRun.patch,
        llm_calls: dbRun.llm_calls || steps.length,
        cached_calls: dbRun.cached_calls || 0,
        split: dbRun.split,
        created_at: dbRun.created_at?.toISOString ? dbRun.created_at.toISOString() : String(dbRun.created_at),
        duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0) || 1200,
        step_count: steps.length,
        steps,
      };
    }
  } catch (err) {
    console.warn(`[Backend DB] Fetch single run failed for ${id}:`, err);
  }

  // Check raw dataset file
  const datasetDir = path.resolve(__dirname, "../../blackbox/dataset/raw");
  const filePath = path.join(datasetDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const localRuns = loadLocalDatasetRuns();
    const found = localRuns.find((r) => r.id === id);
    if (found) return found;
  }

  return null;
}

export function saveReplayedRun(run: NormalizedRun) {
  replayedRunsStore.set(run.id, run);
}
