export type RunOutcome = "success" | "fail" | "failed" | "passed" | "running" | "replayed";

export type FailureType =
  | "wrong_tool_args"
  | "bad_plan"
  | "tool_empty"
  | "corrupted_result"
  | "premature_stop"
  | "runtime_error"
  | "Logic Inversion"
  | "none"
  | string;

export interface TraceStep {
  step_idx: number;
  node: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error?: string | null;
  latency_ms: number;
  tokens?: number;
  retries?: number;
  checkpoint_id?: string | null;
  state_snapshot?: Record<string, any> | null;
  failure_probability?: number;
  is_suspect?: boolean;

  // Optional convenience aliases
  step_index?: number;
  node_name?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any> | null;
  duration_ms?: number;
  is_suspicious?: boolean;
  tool_name?: string;
  status?: string;
  state_delta?: Record<string, any>;
}

export interface EvidenceItem {
  id: string;
  label: string;
  observed: string;
  expected: string;
  confidence_impact: string;
  title?: string;
  type?: string;
  details?: string;
  score?: number;
}

export interface SuspiciousStepRanking {
  step_index: number;
  node_name: string;
  confidence: number;
}

export interface Diagnosis {
  run_id: string;
  predicted_step: number;
  predicted_node: string;
  confidence: number;
  failure_type: FailureType;
  explanation: string;
  evidence: EvidenceItem[];
  downstream_effects: string[];
  suggested_patch: Record<string, any>;
  created_at: string;

  root_cause_step_index?: number;
  root_cause_node?: string;
  top_suspicious_steps?: SuspiciousStepRanking[];
}

export interface Checkpoint {
  checkpoint_id: string;
  step_idx: number;
  node: string;
  created_at?: string;
  channel_values: Record<string, any>;
}

export interface Patch {
  target_step?: number;
  step_index?: number;
  patch_type: string;
  content?: Record<string, any>;
  payload?: Record<string, any>;
  description?: string;
}

export interface ReplayJob {
  id?: string;
  job_id?: string;
  parent_run_id?: string;
  original_run_id?: string;
  forked_at_step?: number;
  forked_step?: number;
  patch?: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  result_run_id?: string;
  replayed_run_id?: string;
  steps_skipped?: number;
  steps_reused?: number;
  steps_executed: number;
  compute_saved_pct: number;
  created_at: string;
}

export interface Run {
  id: string;
  task_id: number;
  task_text: string;
  gold_answer?: string | null;
  final_answer?: string | null;
  outcome: RunOutcome;
  failure_type?: FailureType;
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
  steps: TraceStep[]; // Always guaranteed array
  diagnosis?: Diagnosis | null;

  task?: string;
  agent_name?: string;
  status?: string;
}

export interface StepDiff {
  step_idx: number;
  step_index?: number;
  node: string;
  node_name?: string;
  status: "reused" | "diverged" | "re-executed" | "identical" | string;
  change_type?: "identical" | "diverged" | "modified";
  summary?: string;
  original_output?: any;
  replayed_output?: any;
  original_step?: TraceStep;
  replayed_step?: TraceStep;
  original_error?: string | null;
  replayed_error?: string | null;
  state_diff?: Record<string, { before: any; after: any }>;
}

export interface RunComparison {
  original_run: Run;
  replayed_run: Run;
  divergence_step: number;
  divergence_step_index?: number;
  steps_skipped: number;
  compute_saved_pct: number;
  diagnosis_validated: boolean;
  step_diffs: StepDiff[];
  summary_changes?: string[];
}
