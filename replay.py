"""Checkpointed Replay & Alternative Execution Engine (Milestone M3).

Features:
- Fork from any step k using LangGraph checkpoint history
- Apply state patches (tool override, guidance hint, plan replacement)
- Resume execution without re-executing steps before k
- Record linked replay runs in Neon Postgres with parent metadata
- Poll and process asynchronous replay jobs from public.replay_jobs
"""
from __future__ import annotations

import traceback
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import agent
import db
from recorder import record_run, RunRecord
from tasks import TASKS


# ------------------------------------------------------------------ result type
@dataclass
class ReplayResult:
    run_id: str
    parent_run_id: str
    forked_at_step: int
    patch: dict
    outcome: str
    final_answer: str | None
    steps_skipped: int
    steps_executed: int
    total_steps: int
    compute_saved_pct: float


# ------------------------------------------------------------------ fork helper
def fork_state(
    graph,
    parent_run_id: str,
    k: int,
    patch: dict | None = None,
    new_thread_id: str | None = None,
) -> tuple[dict, dict]:
    """Copy state from just BEFORE step k into a new thread, apply patch, and prepare for resume.

    Parameters
    ----------
    graph : compiled LangGraph
    parent_run_id : thread_id of the original run
    k : step_idx to fork from (steps 0..k-1 will NOT be re-executed)
    patch : optional dict of state overrides (e.g. {"pending_call": ...}, {"hint": ...})
    new_thread_id : optional thread_id for the new replay run

    Returns
    -------
    (cfg, patched_state) ready for graph.invoke(None, cfg)
    """
    new_thread = new_thread_id or f"replay-{uuid.uuid4().hex[:12]}"
    parent_cfg = {"configurable": {"thread_id": parent_run_id}}

    snaps = list(graph.get_state_history(parent_cfg))
    if not snaps:
        raise ValueError(f"No checkpoint history found for parent run {parent_run_id!r}")

    # Find the checkpoint just before step k
    matching = [
        (idx, s)
        for idx, s in enumerate(snaps)
        if s.next and s.values.get("step_idx") == k
    ]
    if not matching:
        available_steps = [s.values.get("step_idx") for s in snaps if s.values]
        raise ValueError(
            f"Step {k} not found in parent run checkpoints. Available step_idx values: {available_steps}"
        )

    i, target_snap = matching[0]

    # Node that produced the checkpoint before step k
    prev_node = snaps[i + 1].next[0] if (i + 1 < len(snaps) and snaps[i + 1].next) else "__start__"

    patched_state = {**target_snap.values, **(patch or {})}
    cfg = {"configurable": {"thread_id": new_thread}}

    graph.update_state(cfg, patched_state, as_node=prev_node)
    return cfg, patched_state


# ------------------------------------------------------------------ replay execution
def replay_run(
    graph,
    parent_run_id: str,
    forked_at_step: int,
    patch: dict | None = None,
    *,
    new_run_id: str | None = None,
) -> ReplayResult:
    """Execute a checkpointed replay starting from step `forked_at_step`.

    1. Fetches parent run details and preceding steps (0 .. k-1) from Postgres.
    2. Restores checkpoint just before step k and applies `patch`.
    3. Resumes graph execution until completion.
    4. Persists the new linked run to Neon Postgres with parent lineage.
    """
    patch_dict = patch or {}
    replay_id = new_run_id or f"replay-{uuid.uuid4().hex[:12]}"

    # Fetch parent run metadata from Neon
    conn = db.connect()
    try:
        parent_run = conn.execute(
            "SELECT id, task_id, task_text, gold_answer, split FROM runs WHERE id = %s",
            (parent_run_id,),
        ).fetchone()
        if not parent_run:
            raise ValueError(f"Parent run {parent_run_id!r} not found in runs table")

        parent_steps_before_k = conn.execute(
            "SELECT * FROM steps WHERE run_id = %s AND step_idx < %s ORDER BY step_idx",
            (parent_run_id, forked_at_step),
        ).fetchall()
    finally:
        conn.close()

    # If task_id is available, find gold_sql from TASKS for outcome evaluation
    task_id = parent_run["task_id"]
    task_text = parent_run["task_text"]
    gold_sql = TASKS[task_id][1] if 0 <= task_id < len(TASKS) else ""

    # Fork state into the new thread
    cfg, _ = fork_state(
        graph,
        parent_run_id,
        forked_at_step,
        patch=patch_dict,
        new_thread_id=replay_id,
    )

    # Resume execution from step k
    agent.begin_run()
    final_state = None
    try:
        final_state = graph.invoke(None, cfg)
    except Exception:
        if not agent.TRACE:
            agent.TRACE[forked_at_step] = {
                "node": "crash",
                "input": {"forked_at_step": forked_at_step, "patch": patch_dict},
                "output": None,
                "error": traceback.format_exc(),
                "latency_ms": 0,
                "llm_calls": 0,
                "cached_calls": 0,
                "retries": 0,
            }

    # Record the replay run linked to its parent
    record = record_run(
        run_id=replay_id,
        task_id=task_id,
        task_text=task_text,
        gold_sql=gold_sql,
        final_state=final_state or {},
        trace=dict(agent.TRACE),
        cfg=cfg,
        graph=graph,
        split=parent_run.get("split"),
        parent_run_id=parent_run_id,
        forked_at_step=forked_at_step,
        patch=patch_dict,
        copied_steps=[dict(s) for s in parent_steps_before_k],
    )

    steps_skipped = len(parent_steps_before_k)
    steps_executed = len(agent.TRACE)
    total_steps = steps_skipped + steps_executed
    compute_saved_pct = (steps_skipped / total_steps * 100.0) if total_steps > 0 else 0.0

    return ReplayResult(
        run_id=replay_id,
        parent_run_id=parent_run_id,
        forked_at_step=forked_at_step,
        patch=patch_dict,
        outcome=record.outcome,
        final_answer=record.final_answer,
        steps_skipped=steps_skipped,
        steps_executed=steps_executed,
        total_steps=total_steps,
        compute_saved_pct=compute_saved_pct,
    )


# ------------------------------------------------------------------ replay jobs queue
def create_replay_job(run_id: str, from_step: int, patch: dict) -> int:
    """Submit a new replay job to the database queue."""
    conn = db.connect()
    try:
        row = conn.execute(
            "INSERT INTO replay_jobs (run_id, from_step, patch, status, created_at) "
            "VALUES (%s, %s, %s, 'pending', %s) RETURNING id",
            (run_id, from_step, db.jsonb(patch), datetime.now(timezone.utc)),
        ).fetchone()
        return row["id"]
    finally:
        conn.close()


def process_replay_job(graph, job_id: int) -> dict[str, Any]:
    """Process a single replay job by id."""
    conn = db.connect()
    try:
        job = conn.execute(
            "SELECT * FROM replay_jobs WHERE id = %s", (job_id,)
        ).fetchone()
        if not job:
            raise ValueError(f"replay_job {job_id} not found")

        # Mark as running
        conn.execute(
            "UPDATE replay_jobs SET status = 'running' WHERE id = %s", (job_id,)
        )
    finally:
        conn.close()

    try:
        patch = job["patch"] if isinstance(job["patch"], dict) else {}
        result = replay_run(
            graph,
            parent_run_id=job["run_id"],
            forked_at_step=job["from_step"],
            patch=patch,
        )
        conn = db.connect()
        try:
            conn.execute(
                "UPDATE replay_jobs SET status = 'completed', result_run_id = %s, error = NULL WHERE id = %s",
                (result.run_id, job_id),
            )
        finally:
            conn.close()
        return {"job_id": job_id, "status": "completed", "result": result}
    except Exception as e:
        err_msg = traceback.format_exc()
        conn = db.connect()
        try:
            conn.execute(
                "UPDATE replay_jobs SET status = 'failed', error = %s WHERE id = %s",
                (err_msg, job_id),
            )
        finally:
            conn.close()
        return {"job_id": job_id, "status": "failed", "error": err_msg}


def poll_and_process_jobs(graph, max_jobs: int | None = None) -> list[dict[str, Any]]:
    """Poll for pending jobs and process them sequentially."""
    conn = db.connect()
    try:
        query = "SELECT id FROM replay_jobs WHERE status = 'pending' ORDER BY created_at"
        if max_jobs:
            query += f" LIMIT {int(max_jobs)}"
        pending = conn.execute(query).fetchall()
    finally:
        conn.close()

    results = []
    for row in pending:
        res = process_replay_job(graph, row["id"])
        results.append(res)
    return results


# ------------------------------------------------------------------ CLI
if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Checkpointed Replay Engine")
    parser.add_argument("--run-id", type=str, help="Parent run ID to replay from")
    parser.add_argument("--step", type=int, help="Step index k to fork from")
    parser.add_argument("--hint", type=str, default="", help="Guidance hint patch")
    parser.add_argument("--poll", action="store_true", help="Poll and process pending replay_jobs")
    args = parser.parse_args()

    graph = agent.build_graph()

    if args.poll:
        processed = poll_and_process_jobs(graph)
        print(f"Processed {len(processed)} replay jobs.")
        for p in processed:
            print(f"  Job {p['job_id']}: {p['status']}")
    elif args.run_id and args.step is not None:
        patch = {"hint": args.hint} if args.hint else {}
        res = replay_run(graph, args.run_id, args.step, patch)
        print(f"Replay run: {res.run_id}")
        print(f"Outcome: {res.outcome}")
        print(f"Final answer: {res.final_answer}")
        print(f"Compute saved: {res.compute_saved_pct:.1f}% ({res.steps_skipped} steps skipped)")
    else:
        parser.print_help()
