import { Run, RunComparison, Diagnosis } from "@/types/run";

export const MOCK_RUNS: Run[] = [
  {
    id: "run-9a1b2c3d",
    task_id: 0,
    task_text: "What is the highest department budget?",
    gold_answer: "900000.0",
    final_answer: "250000.0",
    outcome: "fail",
    failure_type: "wrong_tool_args",
    injected_step: 2,
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 4,
    cached_calls: 0,
    split: "test",
    created_at: "2026-10-03T18:42:10.000Z",
    duration_ms: 1840,
    step_count: 6,
    steps: [
      {
        step_idx: 0,
        node: "schema",
        input: { task: "What is the highest department budget?", step_idx: 0 },
        output: {
          schema: "departments(id integer, name text, budget numeric)\nemployees(id integer, name text, salary numeric, dept_id integer)\nprojects(id integer, name text, budget numeric, dept_id integer)",
          step_idx: 1,
        },
        latency_ms: 120,
        tokens: 45,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-0",
        state_snapshot: {
          task: "What is the highest department budget?",
          schema: "departments(id integer, name text, budget numeric)...",
          step_idx: 1,
        },
        failure_probability: 0.02,
        is_suspect: false,
      },
      {
        step_idx: 1,
        node: "plan",
        input: {
          task: "What is the highest department budget?",
          schema: "departments(id integer, name text, budget numeric)...",
          step_idx: 1,
        },
        output: {
          plan: ["find max budget in departments table", "return the number"],
          step_idx: 2,
        },
        latency_ms: 380,
        tokens: 120,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-1",
        state_snapshot: {
          plan: ["find max budget in departments table", "return the number"],
          step_idx: 2,
        },
        failure_probability: 0.05,
        is_suspect: false,
      },
      {
        step_idx: 2,
        node: "select_tool",
        input: {
          task: "What is the highest department budget?",
          plan: ["find max budget in departments table", "return the number"],
          scratchpad: [],
          step_idx: 2,
        },
        output: {
          pending_call: {
            tool: "run_sql",
            args: { query: "SELECT MIN(budget) FROM departments" },
          },
          step_idx: 3,
        },
        latency_ms: 410,
        tokens: 165,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-2",
        state_snapshot: {
          pending_call: {
            tool: "run_sql",
            args: { query: "SELECT MIN(budget) FROM departments" },
          },
          step_idx: 3,
        },
        failure_probability: 0.94,
        is_suspect: true,
      },
      {
        step_idx: 3,
        node: "run_tool",
        input: {
          pending_call: {
            tool: "run_sql",
            args: { query: "SELECT MIN(budget) FROM departments" },
          },
          step_idx: 3,
        },
        output: {
          scratchpad: [
            {
              iter: 0,
              call: {
                tool: "run_sql",
                args: { query: "SELECT MIN(budget) FROM departments" },
              },
              result: { columns: ["min"], rows: [[250000.0]] },
              error: null,
            },
          ],
          step_idx: 4,
        },
        latency_ms: 85,
        tokens: 0,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-3",
        state_snapshot: {
          scratchpad: [
            {
              iter: 0,
              call: { tool: "run_sql", args: { query: "SELECT MIN(budget) FROM departments" } },
              result: { columns: ["min"], rows: [[250000.0]] },
            },
          ],
          step_idx: 4,
        },
        failure_probability: 0.28,
        is_suspect: false,
      },
      {
        step_idx: 4,
        node: "reflect",
        input: {
          task: "What is the highest department budget?",
          scratchpad: [{ result: { rows: [[250000.0]] } }],
          iteration: 0,
          step_idx: 4,
        },
        output: {
          done: true,
          iteration: 1,
          step_idx: 5,
        },
        latency_ms: 320,
        tokens: 95,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-4",
        state_snapshot: { done: true, iteration: 1, step_idx: 5 },
        failure_probability: 0.35,
        is_suspect: false,
      },
      {
        step_idx: 5,
        node: "answer",
        input: {
          task: "What is the highest department budget?",
          scratchpad: [{ result: { rows: [[250000.0]] } }],
          step_idx: 5,
        },
        output: {
          answer: "250000.0",
          step_idx: 6,
        },
        latency_ms: 525,
        tokens: 40,
        retries: 0,
        checkpoint_id: "ckpt-9a1b-5",
        state_snapshot: { answer: "250000.0", step_idx: 6 },
        failure_probability: 0.12,
        is_suspect: false,
      },
    ],
    diagnosis: {
      run_id: "run-9a1b2c3d",
      predicted_step: 2,
      predicted_node: "select_tool",
      confidence: 0.94,
      failure_type: "wrong_tool_args",
      explanation:
        "The agent generated a SQL query using the aggregate MIN(budget) when the user question explicitly asked for the 'highest' budget (requiring MAX). This poisoned the scratchpad with the lowest budget, causing downstream reflection and answer steps to assert a false value.",
      evidence: [
        {
          id: "ev-1",
          label: "Prompt vs Tool Query Inversion",
          observed: "SELECT MIN(budget) FROM departments",
          expected: "SELECT MAX(budget) FROM departments",
          confidence_impact: "+58% confidence",
        },
        {
          id: "ev-2",
          label: "Result Deviation from Ground Truth",
          observed: "Row result 250000.0 (Delta -650000.0 vs gold 900000.0)",
          expected: "Value matching department maximum 900000.0",
          confidence_impact: "+26% confidence",
        },
        {
          id: "ev-3",
          label: "Subsequent Node Pass-through",
          observed: "Step 4 accepted 250000 without cross-checking superlative constraint",
          expected: "Reflect node requesting re-query with MAX()",
          confidence_impact: "+10% confidence",
        },
      ],
      downstream_effects: [
        "Step 3: run_tool executed incorrect query, returning 250000",
        "Step 4: reflect terminated loop prematurely based on flawed row",
        "Step 5: answer emitted 250000 instead of 900000, failing gold SQL check",
      ],
      suggested_patch: {
        pending_call: {
          tool: "run_sql",
          args: { query: "SELECT MAX(budget) FROM departments" },
        },
      },
      created_at: "2026-10-03T18:42:12.000Z",
    },
  },
  {
    id: "run-4f81c9a0",
    task_id: 0,
    task_text: "What is the highest department budget?",
    gold_answer: "900000.0",
    final_answer: "900000.0",
    outcome: "success",
    failure_type: "none",
    parent_run_id: "run-9a1b2c3d",
    forked_at_step: 2,
    patch: {
      pending_call: {
        tool: "run_sql",
        args: { query: "SELECT MAX(budget) FROM departments" },
      },
    },
    llm_calls: 2,
    cached_calls: 2,
    split: "test",
    created_at: "2026-10-03T18:43:05.000Z",
    duration_ms: 910,
    step_count: 6,
    steps: [
      {
        step_idx: 0,
        node: "schema",
        input: { task: "What is the highest department budget?", step_idx: 0 },
        output: { schema: "departments(id integer, name text, budget numeric)...", step_idx: 1 },
        latency_ms: 0, // Reused from checkpoint!
        checkpoint_id: "ckpt-9a1b-0",
        state_snapshot: { step_idx: 1 },
        is_suspect: false,
      },
      {
        step_idx: 1,
        node: "plan",
        input: { task: "What is the highest department budget?", step_idx: 1 },
        output: { plan: ["find max budget in departments table"], step_idx: 2 },
        latency_ms: 0, // Reused from checkpoint!
        checkpoint_id: "ckpt-9a1b-1",
        state_snapshot: { step_idx: 2 },
        is_suspect: false,
      },
      {
        step_idx: 2,
        node: "select_tool",
        input: { task: "What is the highest department budget?", step_idx: 2 },
        output: {
          pending_call: { tool: "run_sql", args: { query: "SELECT MAX(budget) FROM departments" } },
          step_idx: 3,
        },
        latency_ms: 320,
        checkpoint_id: "ckpt-4f81-2",
        state_snapshot: { step_idx: 3 },
        is_suspect: false,
      },
      {
        step_idx: 3,
        node: "run_tool",
        input: { pending_call: { tool: "run_sql" } },
        output: { scratchpad: [{ result: { columns: ["max"], rows: [[900000.0]] } }] },
        latency_ms: 60,
        checkpoint_id: "ckpt-4f81-3",
        state_snapshot: { step_idx: 4 },
        is_suspect: false,
      },
      {
        step_idx: 4,
        node: "reflect",
        input: { iteration: 0 },
        output: { done: true, iteration: 1 },
        latency_ms: 280,
        checkpoint_id: "ckpt-4f81-4",
        state_snapshot: { step_idx: 5 },
        is_suspect: false,
      },
      {
        step_idx: 5,
        node: "answer",
        input: { scratchpad: [{ result: { rows: [[900000.0]] } }] },
        output: { answer: "900000.0" },
        latency_ms: 250,
        checkpoint_id: "ckpt-4f81-5",
        state_snapshot: { answer: "900000.0", step_idx: 6 },
        is_suspect: false,
      },
    ],
  },
  {
    id: "run-e2a87b14",
    task_id: 1,
    task_text: "What is the average salary in the Engineering department?",
    gold_answer: "142500.0",
    final_answer: "142500.0",
    outcome: "success",
    failure_type: "none",
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 4,
    cached_calls: 1,
    split: "train",
    created_at: "2026-10-03T17:30:15.000Z",
    duration_ms: 1620,
    step_count: 6,
    steps: [],
  },
  {
    id: "run-b73f910a",
    task_id: 4,
    task_text: "How many active projects does the Marketing department have?",
    gold_answer: "3.0",
    final_answer: "0.0",
    outcome: "fail",
    failure_type: "tool_empty",
    injected_step: 3,
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 5,
    cached_calls: 0,
    split: "train",
    created_at: "2026-10-03T16:15:40.000Z",
    duration_ms: 2150,
    step_count: 6,
    steps: [],
  },
  {
    id: "run-c38d41e9",
    task_id: 7,
    task_text: "What is 15% of the HR department's budget?",
    gold_answer: "52500.0",
    final_answer: "52500.0",
    outcome: "success",
    failure_type: "none",
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 5,
    cached_calls: 2,
    split: "train",
    created_at: "2026-10-03T15:45:00.000Z",
    duration_ms: 1980,
    step_count: 7,
    steps: [],
  },
  {
    id: "run-719b5d20",
    task_id: 11,
    task_text: "What is the salary of the lead of project Comet?",
    gold_answer: "175000.0",
    final_answer: "null",
    outcome: "fail",
    failure_type: "bad_plan",
    injected_step: 1,
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 3,
    cached_calls: 0,
    split: "unseen",
    created_at: "2026-10-03T14:20:10.000Z",
    duration_ms: 1410,
    step_count: 4,
    steps: [],
  },
  {
    id: "run-55f01e88",
    task_id: 14,
    task_text: "How much higher is the average salary in Sales than in HR?",
    gold_answer: "18200.0",
    final_answer: "18200.0",
    outcome: "success",
    failure_type: "none",
    parent_run_id: null,
    forked_at_step: null,
    patch: null,
    llm_calls: 6,
    cached_calls: 3,
    split: "train",
    created_at: "2026-10-03T13:10:00.000Z",
    duration_ms: 2450,
    step_count: 8,
    steps: [],
  },
];

// Normalize and enrich each run for seamless UI rendering
MOCK_RUNS.forEach((run) => {
  run.task = run.task || run.task_text;
  run.agent_name = run.agent_name || "Text2SQL-ReAct-Agent";
  run.status = run.status || (run.outcome === "fail" ? "failed" : run.outcome === "success" ? (run.forked_at_step !== null ? "replayed" : "success") : run.outcome);
  run.steps = run.steps || [];

  run.steps.forEach((step) => {
    step.step_index = step.step_index ?? step.step_idx;
    step.node_name = step.node_name ?? step.node;
    step.tool_name = step.tool_name ?? (step.input?.pending_call?.tool || step.output?.pending_call?.tool);
    step.inputs = step.inputs ?? step.input;
    step.outputs = step.outputs ?? step.output;
    step.duration_ms = step.duration_ms ?? step.latency_ms;
    step.is_suspicious = step.is_suspicious ?? step.is_suspect;
    step.status = step.status ?? (step.is_suspect ? "failed" : step.step_idx === 3 && run.outcome === "fail" ? "failed" : "success");
    step.failure_probability = step.failure_probability ?? (step.is_suspect ? 0.94 : 0.05);
  });

  if (run.diagnosis) {
    run.diagnosis.root_cause_step_index = run.diagnosis.root_cause_step_index ?? run.diagnosis.predicted_step;
    run.diagnosis.root_cause_node = run.diagnosis.root_cause_node ?? run.diagnosis.predicted_node;
    run.diagnosis.top_suspicious_steps = [
      { step_index: 2, node_name: "select_tool", confidence: 0.94 },
      { step_index: 3, node_name: "run_tool", confidence: 0.28 },
      { step_index: 1, node_name: "plan", confidence: 0.05 },
    ];
    run.diagnosis.evidence.forEach((ev) => {
      ev.title = ev.title ?? ev.label;
      ev.type = ev.type ?? "Logical Deviation";
      ev.details = ev.details ?? `${ev.observed} (Expected: ${ev.expected})`;
      ev.score = ev.score ?? 0.88;
    });
  }
});

export const MOCK_COMPARISON_RUN_9A1B: RunComparison = {
  original_run: MOCK_RUNS[0],
  replayed_run: MOCK_RUNS[1],
  divergence_step: 2,
  divergence_step_index: 2,
  steps_skipped: 2,
  compute_saved_pct: 33.3,
  diagnosis_validated: true,
  summary_changes: [
    "Step 2: Corrected SQL query to aggregate MAX(budget) instead of MIN(budget)",
    "Step 3: Database execution returned correct department row ($900,000.0)",
    "Steps 0–1: Checkpoint state directly reused without LLM invocation (0 latency)",
    "Verification: Output flipped from FAILED to PASSED with gold truth match",
  ],
  step_diffs: [
    {
      step_idx: 0,
      step_index: 0,
      node: "schema",
      node_name: "schema",
      status: "reused",
      change_type: "identical",
      summary: "State preserved from checkpoint. Schema inspection skipped.",
      original_output: { tables_loaded: 3 },
      replayed_output: { tables_loaded: 3 },
      original_step: MOCK_RUNS[0].steps![0],
      replayed_step: MOCK_RUNS[1].steps![0],
    },
    {
      step_idx: 1,
      step_index: 1,
      node: "plan",
      node_name: "plan",
      status: "reused",
      change_type: "identical",
      summary: "State preserved from checkpoint. Planning graph skipped.",
      original_output: { plan: ["find max budget in departments table"] },
      replayed_output: { plan: ["find max budget in departments table"] },
      original_step: MOCK_RUNS[0].steps![1],
      replayed_step: MOCK_RUNS[1].steps![1],
    },
    {
      step_idx: 2,
      step_index: 2,
      node: "select_tool",
      node_name: "select_tool",
      status: "diverged",
      change_type: "diverged",
      summary: "Patched query args injected: SELECT MAX(budget) FROM departments",
      original_output: {
        pending_call: { tool: "run_sql", args: { query: "SELECT MIN(budget) FROM departments" } },
      },
      replayed_output: {
        pending_call: { tool: "run_sql", args: { query: "SELECT MAX(budget) FROM departments" } },
      },
      original_step: MOCK_RUNS[0].steps![2],
      replayed_step: MOCK_RUNS[1].steps![2],
      state_diff: {
        query: {
          before: "SELECT MIN(budget) FROM departments",
          after: "SELECT MAX(budget) FROM departments",
        },
      },
    },
    {
      step_idx: 3,
      step_index: 3,
      node: "run_tool",
      node_name: "run_tool",
      status: "re-executed",
      change_type: "modified",
      summary: "SQL engine returned maximum budget $900,000.0 instead of $250,000.0",
      original_output: { rows: [[250000.0]] },
      replayed_output: { rows: [[900000.0]] },
      original_step: MOCK_RUNS[0].steps![3],
      replayed_step: MOCK_RUNS[1].steps![3],
      state_diff: {
        rows: { before: [[250000.0]], after: [[900000.0]] },
      },
    },
    {
      step_idx: 4,
      step_index: 4,
      node: "reflect",
      node_name: "reflect",
      status: "re-executed",
      change_type: "modified",
      summary: "Reflection verified output satisfies question constraints",
      original_output: { done: true, iteration: 1 },
      replayed_output: { done: true, iteration: 1 },
      original_step: MOCK_RUNS[0].steps![4],
      replayed_step: MOCK_RUNS[1].steps![4],
    },
    {
      step_idx: 5,
      step_index: 5,
      node: "answer",
      node_name: "answer",
      status: "re-executed",
      change_type: "modified",
      summary: "Final output validated against gold truth: 900000.0",
      original_output: { answer: "250000.0" },
      replayed_output: { answer: "900000.0" },
      original_step: MOCK_RUNS[0].steps![5],
      replayed_step: MOCK_RUNS[1].steps![5],
      state_diff: {
        answer: { before: "250000.0", after: "900000.0" },
      },
    },
  ],
};

export const MOCK_RUN_DETAIL_FAILED = MOCK_RUNS[0];
export const MOCK_RUN_DETAIL_REPLAYED = MOCK_RUNS[1];
export const MOCK_DIAGNOSIS_FAILED = MOCK_RUNS[0].diagnosis!;
export const MOCK_COMPARISON = MOCK_COMPARISON_RUN_9A1B;

