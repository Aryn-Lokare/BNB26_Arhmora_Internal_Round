# Black Box: A Flight Recorder for AI Agents

**Product Requirements Document** | Version 0.1 | Status: Draft

---

## 1. Overview

AI agents solve tasks through long chains of model calls, tool calls, retrieved context, and changing state. A run can contain many correct steps and still fail because of a single bad intermediate decision. Traditional traces show *what happened* but not *which step was responsible*.

**Black Box** is an AI-powered debugging system that records agent executions, learns what failure-causing steps look like, points to the most likely culprit step when a new run fails, and lets developers test a fix by replaying from a checkpoint instead of re-running the whole task.

## 2. Problem Statement

| Pain point | Today | With Black Box |
| --- | --- | --- |
| Finding the bad step | Manually read thousands of trace lines | Ranked list of suspect steps with evidence |
| Testing a fix | Re-run the entire task, paying for every step again | Resume from the checkpoint just before the suspect step |
| Knowing if the diagnosis is right | Guesswork | Counterfactual replay: if fixing the step fixes the run, the diagnosis is confirmed |
| Trusting the tool | No measurement | Reported localization accuracy on known and unseen failures |

## 3. Goals and Non-Goals

### Goals

1. Capture complete, structured execution history for successful and failed agent runs.
2. Train a model that ranks the steps of a failed run by likelihood of being the root cause.
3. Explain each diagnosis with evidence drawn from the execution history.
4. Support checkpointed replay and alternative execution (change a step, resume, observe the outcome).
5. Compare two runs to show where and why they diverged.
6. Demonstrate, with numbers, that the diagnosis works on known failures and generalizes to unseen ones.

### Non-Goals (v1)

- Building a high-performing agent. The agent is a test subject, not the product.
- Real-time production monitoring, alerting, or multi-tenant SaaS features.
- Supporting every agent framework. v1 targets LangGraph agents.
- Automatically generating fixes with guaranteed correctness. v1 suggests and tests fixes; a human approves them.

## 4. Users and Use Cases

**Primary user: AI/agent developer** who maintains a tool-using agent and needs to find why runs fail.

| Use case | Flow |
| --- | --- |
| Debug a failed run | Open run, see suspect step highlighted with evidence, replay with a fix, view the diff |
| Evaluate the debugger | Open the metrics page, review localization accuracy and fix success rate |
| Compare runs | Pick two runs, see the first point of divergence and the outcome change |

## 5. Scope and Requirements

### 5.1 Test-subject agent

A LangGraph SQL data-analysis agent over a Postgres database. It plans, writes SQL, runs tools (`run_sql`, `calculator`), reflects, and answers. Each node execution is a numbered step. Success is determined automatically by comparing the answer to a gold value computed from a gold SQL query.

### 5.2 Feature requirements

| ID | Feature | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| F1 | **Execution Data** | Record every step: node, input, output, error, latency, LLM calls (real and cached), checkpoint ID, state snapshot. Label each run success or fail. | Any run can be reconstructed step by step from the database. |
| F2 | **Failure Diagnosis** | Train an XGBoost model on per-step features. For a failed run, score and rank all steps. | The ranked list is produced for every failed run in under 2 seconds. |
| F3 | **Failure Explanation** | Show the top contributing features for the flagged step and how it differs from the same step type in successful runs. | Each diagnosis shows at least three evidence items with values. |
| F4 | **Checkpointed Replay** | Restore the state just before step *k* in a new thread and resume without re-executing steps before *k*. | Steps before *k* are not executed in the replay; step counts are logged. |
| F5 | **Alternative Execution** | Apply a patch at the suspect step (override its output, or add a hint) and resume. Record the result as a linked run. | The replay run stores its parent run, fork step, and patch. |
| F6 | **Trace Comparison** | Step-aligned diff of two runs: first divergence, changed steps, outcome change. | Diff view highlights the first divergent step. |
| F7 | **Model Evaluation** | Report localization accuracy, generalization to unseen failures, fix success rate, and compute saved. | Metrics are produced by one script and shown on a dashboard page. |

### 5.3 Fault injection (data generation)

To obtain ground truth, the system injects exactly one fault per run at a known step. Fault types:

| Fault | Target node | Effect |
| --- | --- | --- |
| `bad_plan` | plan | Misleading sub-steps |
| `wrong_tool_args` | select_tool | Wrong filter, aggregate, or literal in the SQL |
| `tool_empty` | run_tool | Empty result |
| `corrupted_result` | run_tool | Numbers perturbed in the tool result |
| `premature_stop` | reflect | Agent decides it is done too early |

Only injected runs that actually fail are labeled as failures with a known root cause. Injected runs the agent recovers from are kept as ordinary successes. Naturally failing clean runs are kept as a separate test set.

## 6. System Architecture

```
Next.js dashboard  ->  Node.js API  ->  Neon Postgres  <-  Python worker
                                                           (LangGraph agent, fault
                                                            injector, recorder,
                                                            replay, XGBoost)
```

| Component | Technology | Responsibility |
| --- | --- | --- |
| Dashboard | Next.js | Run list, timeline, evidence panel, replay form, diff view, metrics |
| API | Node.js | Read runs, steps, diagnoses, diffs, metrics; create replay jobs |
| Database | Neon Postgres | Debugger tables, LangGraph checkpoints, agent data schema (read-only role) |
| Worker | Python, LangGraph, XGBoost | Run the agent, record traces, inject faults, train, replay |
| LLM | Groq API (swappable) | Agent reasoning at temperature 0 with prompt-hash caching |

**Data model:** `runs`, `steps`, `step_features`, `diagnoses`, `metrics`, `replay_jobs` (see `schema.sql`). The agent's own data lives in a separate `company` schema, accessed through a read-only role.

**Replay jobs:** the API inserts a `replay_jobs` row; the worker polls, executes the replay, writes the linked run, and updates the job status.

## 7. Diagnosis Model

- **Unit of prediction:** one row per step; label `is_root_cause` is 1 only for the injected step in a run that failed.
- **Features (examples):** node type, step position, tool error flag, empty-result flag, output size, row count, latency, retries, SQL structure (joins, filters), numeric magnitude of results, deviation from peer steps in successful runs, whether the final answer is supported by this step's result.
- **Algorithm:** XGBoost with class-imbalance weighting.
- **Explanation:** per-feature contributions from XGBoost's built-in contribution output for the top-ranked step.
- **Splits:** by task (never by step) into train and test; one fault type is held out entirely as an unseen-failure set.

## 8. Evaluation Plan and Success Metrics

| Metric | Definition | Initial target |
| --- | --- | --- |
| Top-1 localization | Share of failed test runs where the true root-cause step is ranked first | Beat both baselines clearly |
| Top-3 localization | True step within the top three | Beat both baselines clearly |
| Unseen-failure generalization | Top-1 and top-3 on the held-out fault type | Report honestly; expect lower than seen faults |
| Baselines | Random step; first step with an error or empty result | Must be reported alongside the model |
| Fix success rate | Failures that become successes after replaying from the diagnosed step | Report with and without a correct diagnosis |
| Compute saved | Steps not re-executed versus a full rerun | Report average percentage |
| Cross-agent check (stretch) | Apply the trained model to traces from a second, different LangGraph agent | Report as a generalization result |

Numeric targets are to be set after the first baseline results; the commitment in v1 is to measure and publish all metrics above.

## 9. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M1 | Environment and agent | Neon schema applied; smoke test passes; agent passes a reasonable share of clean tasks |
| M2 | Recorder | Runs and steps written to Neon for clean runs |
| M3 | Replay verified | Fork from a checkpoint, patch, resume; earlier steps not re-executed |
| M4 | Data generation | Hundreds of labeled runs across five fault types, with splits assigned |
| M5 | Model and explanations | XGBoost trained; diagnoses with evidence stored |
| M6 | Evaluation | Metrics table produced by a single script |
| M7 | API and dashboard | Timeline, evidence, replay, diff, metrics pages working |
| M8 | Demo | Rehearsed walkthrough of one failed run end to end |

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| LLM non-determinism breaks replay | Replays differ for unrelated reasons | Temperature 0; cache LLM calls by prompt hash |
| Too few or repetitive tasks | Model memorizes tasks | Enlarge seed data and task templates; split by task |
| Injected faults are absorbed by the agent | Noisy labels | Label as failures only runs that actually fail |
| Synthetic faults differ from real failures | Weak real-world claim | Keep natural failures as a separate test set; try a second agent |
| Free-tier LLM rate limits | Slow data generation | Retry with backoff; rely on caching; run in batches |
| Framework API changes | Code breaks on upgrade | Pin LangGraph and related versions |
| Neon compute pauses when idle | Slow first query during demo | Warm up the database before presenting |
| Small models produce invalid JSON | Agent steps fail for trivial reasons | Use a larger model; parse defensively |

## 11. Deliverables

1. Working code: agent, recorder, fault injector, replay engine, model training.
2. Dashboard with timeline, suspect highlight, evidence, replay, diff, and metrics views.
3. Evaluation report with the metrics in section 8.
4. Short demo and presentation.

## 12. Open Questions

- Which Groq model gives the best balance of accuracy and rate limits for this agent?
- How large should the seed database and task set be before data generation starts?
- Is a second agent (prebuilt LangGraph `create_agent`) in scope for the time available?
- Which replay patch types matter most for the demo: output override, hint injection, or both?