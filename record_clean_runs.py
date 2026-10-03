"""Batch runner – execute tasks from tasks.py in clean mode and record them.

Usage:
    python record_clean_runs.py                # record first 5 tasks
    python record_clean_runs.py --count 10     # record first 10 tasks
    python record_clean_runs.py --all          # record all tasks
    python record_clean_runs.py --check        # verify & reconstruct all recorded runs
"""
from __future__ import annotations

import argparse
import sys
import time

import agent
from reconstruct import reconstruct_run
from recorder import run_and_record
from tasks import TASKS
import db


def record_batch(count: int, split: str | None = None):
    """Record clean runs for the first `count` tasks."""
    graph = agent.build_graph()
    passed, failed = 0, 0
    total_steps, total_latency = 0, 0
    total_llm, total_cached = 0, 0

    for i, (question, gold_sql) in enumerate(TASKS[:count]):
        t0 = time.time()
        try:
            rec = run_and_record(graph, i, question, gold_sql, split=split)
        except Exception as e:
            print(f"  [{i:3d}] ERROR  {question[:60]}  → {e}")
            failed += 1
            continue
        elapsed = time.time() - t0

        if rec.outcome == "success":
            passed += 1
        else:
            failed += 1

        total_steps += rec.step_count
        total_latency += elapsed
        total_llm += agent.STATS["llm"]
        total_cached += agent.STATS["cached"]

        tag = "[OK]" if rec.outcome == "success" else "[FAIL]"
        print(
            f"  [{i:3d}] {tag} {rec.outcome:7s}  "
            f"steps={rec.step_count}  "
            f"time={elapsed:.1f}s  "
            f"answer={_trunc(rec.final_answer, 40):40s}  "
            f"run_id={rec.run_id}"
        )

    print(f"\n{'='*70}")
    print(f"Results: {passed}/{passed+failed} passed, {failed} failed")
    if passed + failed > 0:
        print(f"Total steps: {total_steps}  "
              f"Avg steps/run: {total_steps/(passed+failed):.1f}")
        print(f"Total time: {total_latency:.1f}s  "
              f"Avg time/run: {total_latency/(passed+failed):.1f}s")
        print(f"LLM calls: {total_llm}  Cached: {total_cached}  "
              f"Cache hit rate: {total_cached/(total_llm+total_cached)*100:.0f}%"
              if (total_llm + total_cached) > 0 else "")


def verify_all():
    """Reconstruct and verify every run recorded in the database."""
    conn = db.connect()
    try:
        runs = conn.execute(
            "SELECT id, task_id, outcome FROM runs ORDER BY created_at"
        ).fetchall()
    finally:
        conn.close()

    if not runs:
        print("No runs found in the database.")
        return

    print(f"Verifying {len(runs)} recorded runs ...\n")
    valid_count, error_count = 0, 0

    for run in runs:
        try:
            result = reconstruct_run(run["id"])
            tag = "[OK]" if result["valid"] else "[FAIL]"
            status = "valid" if result["valid"] else f"{len(result['errors'])} errors"
            print(
                f"  {tag} {run['id']}  task={run['task_id']}  "
                f"outcome={run['outcome']}  steps={len(result['steps'])}  {status}"
            )
            if result["valid"]:
                valid_count += 1
            else:
                error_count += 1
                for e in result["errors"][:3]:
                    print(f"      -> {e}")
        except Exception as e:
            print(f"  [FAIL] {run['id']}  ERROR: {e}")
            error_count += 1

    print(f"\n{'='*70}")
    print(f"Verification: {valid_count}/{len(runs)} valid, {error_count} with errors")


def _trunc(s: str | None, maxlen: int = 60) -> str:
    if s is None:
        return "<none>"
    return s if len(s) <= maxlen else s[:maxlen - 3] + "..."


def main():
    parser = argparse.ArgumentParser(description="Record clean agent runs to Neon.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--count", type=int, default=5, help="Number of tasks to run (default: 5)")
    group.add_argument("--all", action="store_true", help="Run all tasks")
    group.add_argument("--check", action="store_true", help="Verify/reconstruct all recorded runs")
    parser.add_argument("--split", type=str, default=None, help="Data split label (train/test/unseen)")
    args = parser.parse_args()

    if args.check:
        verify_all()
    else:
        count = len(TASKS) if args.all else args.count
        print(f"Recording {count} clean runs (of {len(TASKS)} total tasks)...\n")
        record_batch(count, split=args.split)


if __name__ == "__main__":
    main()
