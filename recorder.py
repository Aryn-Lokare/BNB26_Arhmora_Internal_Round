"""Flight Recorder – captures structured execution traces and persists them to Neon Postgres.

Public API
----------
    run_and_record(graph, task_id, task_text, gold_sql, *, thread_id=None, split=None)
        → RunRecord  (run_id, outcome, final_answer, step_count)

    record_run(run_id, task_id, task_text, gold_sql, final_state, trace, cfg, graph,
               *, split=None)
        → RunRecord   (lower-level; call after running the graph yourself)
"""
from __future__ import annotations

import traceback
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import agent
import db
from tasks import check, gold_answer


# ------------------------------------------------------------------ result type
@dataclass
class RunRecord:
    run_id: str
    outcome: str
    final_answer: str | None
    step_count: int


# ------------------------------------------------------------------ checkpoint helpers
def _checkpoint_map(graph, cfg) -> dict[int, str]:
    """Map each step_idx → the checkpoint_id produced *after* that step executed.

    LangGraph's PostgresSaver stores one checkpoint per super-step.  After a node
    that sets ``step_idx = k + 1``, the checkpoint's ``channel_values["step_idx"]``
    equals ``k + 1``.  We want the *producing* step, which is ``k``.
    """
    mapping: dict[int, str] = {}
    try:
        for snap in graph.get_state_history(cfg):
            sid = snap.values.get("step_idx")
            cid = snap.config["configurable"].get("checkpoint_id")
            if sid is not None and cid is not None and sid > 0:
                # sid is the step_idx value *after* the node ran  →  produced by step sid-1
                mapping[sid - 1] = cid
    except Exception:
        pass  # graceful degradation if checkpointer is unavailable
    return mapping


# ------------------------------------------------------------------ state snapshot builder
def _build_state_snapshot(final_state: dict, trace: dict, step_idx: int, base_state: dict | None = None) -> dict:
    """Reconstruct the state *after* step_idx executed by replaying traced outputs.

    We start from base_state (or empty) and apply each step's output
    cumulatively.
    """
    state: dict = dict(base_state) if base_state else {}
    for k in sorted(trace.keys()):
        if k > step_idx:
            break
        out = trace[k].get("output")
        if out:
            state.update(out)
    return db.jsonb(state)


# ------------------------------------------------------------------ core persistence
def record_run(
    run_id: str,
    task_id: int,
    task_text: str,
    gold_sql: str,
    final_state: dict,
    trace: dict,
    cfg: dict,
    graph,
    *,
    split: str | None = None,
    parent_run_id: str | None = None,
    forked_at_step: int | None = None,
    patch: dict | None = None,
    injected_step: int | None = None,
    fault_type: str | None = None,
    copied_steps: list[dict] | None = None,
) -> RunRecord:
    """Persist a completed run and its steps to Neon Postgres atomically."""

    # -- compute outcome --------------------------------------------------
    try:
        gold = gold_answer(gold_sql)
    except Exception:
        gold = None
    gold_str = str(gold) if gold is not None else None

    final_ans = (final_state or {}).get("answer")
    outcome = "success" if gold is not None and check(str(final_ans), gold) else "fail"

    # -- checkpoint alignment ---------------------------------------------
    ckpt_map = _checkpoint_map(graph, cfg)

    # -- base state from copied parent steps if replaying -----------------
    base_state = None
    step_rows: list[tuple] = []
    if copied_steps:
        for cs in copied_steps:
            step_rows.append((
                run_id,
                cs["step_idx"],
                cs["node"],
                db.jsonb(cs.get("input")),
                db.jsonb(cs.get("output")),
                cs.get("error"),
                cs.get("latency_ms", 0),
                cs.get("tokens", 0),
                cs.get("retries", 0),
                cs.get("checkpoint_id"),
                db.jsonb(cs.get("state_snapshot")),
            ))
        base_state = copied_steps[-1].get("state_snapshot") or {}

    # -- build step rows for newly executed steps -------------------------
    for idx in sorted(trace.keys()):
        t = trace[idx]
        step_rows.append((
            run_id,
            idx,
            t["node"],
            db.jsonb(t.get("input")),
            db.jsonb(t.get("output")),
            t.get("error"),
            t.get("latency_ms", 0),
            0,                                      # tokens (not yet tracked)
            t.get("retries", 0),
            ckpt_map.get(idx),
            _build_state_snapshot(final_state, trace, idx, base_state=base_state),
        ))

    # -- atomic write to Neon ---------------------------------------------
    conn = db.connect()
    try:
        # Temporarily disable autocommit so we get a real transaction.
        conn.autocommit = False
        with conn.transaction():
            conn.execute(
                "INSERT INTO runs "
                "(id, task_id, task_text, gold_answer, final_answer, outcome, "
                " injected_step, fault_type, parent_run_id, forked_at_step, patch, "
                " llm_calls, cached_calls, split, created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s,%s,%s)",
                (
                    run_id, task_id, task_text, gold_str, final_ans, outcome,
                    injected_step, fault_type, parent_run_id, forked_at_step,
                    db.jsonb(patch) if patch is not None else None,
                    agent.STATS["llm"], agent.STATS["cached"],
                    split, datetime.now(timezone.utc),
                ),
            )
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO steps "
                    "(run_id, step_idx, node, input, output, error, "
                    " latency_ms, tokens, retries, checkpoint_id, state_snapshot) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    step_rows,
                )
    finally:
        conn.close()

    return RunRecord(
        run_id=run_id,
        outcome=outcome,
        final_answer=final_ans,
        step_count=len(step_rows),
    )


# ------------------------------------------------------------------ convenience wrapper
def run_and_record(
    graph,
    task_id: int,
    task_text: str,
    gold_sql: str,
    *,
    thread_id: str | None = None,
    hint: str = "",
    split: str | None = None,
) -> RunRecord:
    """Execute a task on the graph, then record the full run atomically.

    Parameters
    ----------
    graph      : compiled LangGraph (with checkpointer)
    task_id    : index into tasks.TASKS
    task_text  : the question string
    gold_sql   : SQL whose result is ground truth
    thread_id  : optional; auto-generated if omitted
    hint       : optional guidance string
    split      : optional data-split label ('train', 'test', 'unseen')
    """
    run_id = thread_id or f"run-{uuid.uuid4().hex[:12]}"

    agent.begin_run()
    final_state = None
    cfg = {"configurable": {"thread_id": run_id}}

    try:
        final_state, cfg = agent.run_task(graph, task_text, run_id, hint=hint)
    except Exception:
        # Record a failed run even if the graph crashes.
        if not agent.TRACE:
            # Nothing was traced; add a synthetic failure step.
            agent.TRACE[0] = {
                "node": "crash",
                "input": {"task": task_text},
                "output": None,
                "error": traceback.format_exc(),
                "latency_ms": 0,
                "llm_calls": 0,
                "cached_calls": 0,
                "retries": 0,
            }

    return record_run(
        run_id=run_id,
        task_id=task_id,
        task_text=task_text,
        gold_sql=gold_sql,
        final_state=final_state or {},
        trace=dict(agent.TRACE),
        cfg=cfg,
        graph=graph,
        split=split,
    )
