"""Automated tests for Milestone M3: Checkpointed Replay & Alternative Execution.

Test plan:
1. test_checkpointed_replay_offline   - Faulted run fixed by forking from checkpoint at step k; assert earlier steps skipped
2. test_patch_override                - Test state patching (hint and state overrides) and DB lineage
3. test_replay_job_queue              - Test asynchronous replay_jobs submission, status transition, and processing
4. test_replay_reconstruction         - Verify that reconstructed replay run matches recorded state snapshots

Run:  python test_replay.py
"""
from __future__ import annotations

import json
import sys
import traceback
import uuid

import agent
import db
from recorder import run_and_record
from reconstruct import reconstruct_run
from replay import replay_run, create_replay_job, process_replay_job, poll_and_process_jobs
from tasks import gold_answer, check

TASK = "What is the highest department budget?"
GOOD_SQL = "SELECT MAX(budget) FROM departments"
BAD_SQL = "SELECT MIN(budget) FROM departments"

_original_llm = agent.llm


def fake_llm(prompt: str) -> str:
    """Deterministic mock LLM for offline testing."""
    if "Break this into" in prompt:
        return json.dumps({"plan": ["find max budget"]})
    if "Choose the next tool" in prompt:
        return json.dumps({"tool": "run_sql", "args": {"query": GOOD_SQL}})
    if "enough information" in prompt:
        return json.dumps({"done": True, "note": "got it"})
    work = prompt.split("Work so far: ")[1].split("\n")[0]
    rows = json.loads(work)[0]["result"]["rows"]
    return str(rows[0][0])


def cleanup_runs(*run_ids: str):
    """Clean up test runs and jobs from Neon DB respecting foreign key constraints."""
    conn = db.connect()
    try:
        for rid in run_ids:
            if rid:
                # 1. Clean replay_jobs referencing rid or children
                conn.execute("DELETE FROM replay_jobs WHERE run_id = %s OR result_run_id = %s", (rid, rid))
                conn.execute(
                    "DELETE FROM replay_jobs WHERE run_id IN (SELECT id FROM runs WHERE parent_run_id = %s) "
                    "OR result_run_id IN (SELECT id FROM runs WHERE parent_run_id = %s)",
                    (rid, rid),
                )
                # 2. Clean steps for children
                conn.execute("DELETE FROM steps WHERE run_id IN (SELECT id FROM runs WHERE parent_run_id = %s)", (rid,))
                # 3. Clean child runs
                conn.execute("DELETE FROM runs WHERE parent_run_id = %s", (rid,))
                # 4. Clean steps for rid
                conn.execute("DELETE FROM steps WHERE run_id = %s", (rid,))
                # 5. Clean run rid
                conn.execute("DELETE FROM runs WHERE id = %s", (rid,))
    finally:
        conn.close()


def test_checkpointed_replay_offline():
    """Verify that forking from step k fixes a faulted run and skips earlier steps."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    parent_id = f"test-parent-{uuid.uuid4().hex[:8]}"
    replay_id = f"test-replay-{uuid.uuid4().hex[:8]}"

    try:
        # Step 1: Create a faulted parent run at step 2 (select_tool)
        k = 2
        agent.set_fault(
            k,
            "select_tool",
            lambda call: {**call, "args": {"query": BAD_SQL}} if call else call,
        )
        parent_rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=parent_id)
        agent.clear_fault()

        assert parent_rec.outcome == "fail", "parent run should fail due to fault"

        # Step 2: Replay from step k without fault
        replay_res = replay_run(graph, parent_id, forked_at_step=k, new_run_id=replay_id)

        assert replay_res.outcome == "success", f"replay should succeed, got {replay_res.outcome}"
        assert replay_res.steps_skipped == k, f"expected {k} skipped steps, got {replay_res.steps_skipped}"
        assert replay_res.compute_saved_pct > 0, "compute saved percentage should be > 0"

        # Step 3: Verify DB records
        conn = db.connect()
        try:
            run_row = conn.execute("SELECT * FROM runs WHERE id = %s", (replay_id,)).fetchone()
            assert run_row is not None, "replay run not found in DB"
            assert run_row["parent_run_id"] == parent_id, "parent_run_id not set"
            assert run_row["forked_at_step"] == k, "forked_at_step not set"
            assert run_row["outcome"] == "success"

            steps = conn.execute(
                "SELECT * FROM steps WHERE run_id = %s ORDER BY step_idx", (replay_id,)
            ).fetchall()
            assert len(steps) == replay_res.total_steps
            # Verify steps before k exist in steps table
            step_indices = [s["step_idx"] for s in steps]
            for i in range(replay_res.total_steps):
                assert i in step_indices, f"step {i} missing from replay steps"
        finally:
            conn.close()

        print("  [PASS] test_checkpointed_replay_offline PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_checkpointed_replay_offline FAILED")
        return False
    finally:
        agent.clear_fault()
        cleanup_runs(parent_id, replay_id)
        agent.llm = _original_llm


def test_patch_override():
    """Verify that state patches (hint and tool call) are applied and stored in DB."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    parent_id = f"test-parent-p-{uuid.uuid4().hex[:8]}"
    replay_id = f"test-replay-p-{uuid.uuid4().hex[:8]}"

    try:
        # Create a clean parent run
        parent_rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=parent_id)
        assert parent_rec.outcome == "success"

        patch = {"hint": "focus on engineering budget"}
        replay_res = replay_run(graph, parent_id, forked_at_step=1, patch=patch, new_run_id=replay_id)

        assert replay_res.outcome == "success"
        assert replay_res.patch == patch

        # Check DB patch column
        conn = db.connect()
        try:
            row = conn.execute("SELECT patch FROM runs WHERE id = %s", (replay_id,)).fetchone()
            assert row["patch"] == patch, f"expected {patch}, got {row['patch']}"
        finally:
            conn.close()

        print("  [PASS] test_patch_override PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_patch_override FAILED")
        return False
    finally:
        cleanup_runs(parent_id, replay_id)
        agent.llm = _original_llm


def test_replay_job_queue():
    """Verify asynchronous replay_jobs submission, status transition, and processing."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    parent_id = f"test-parent-j-{uuid.uuid4().hex[:8]}"
    job_id = None
    result_run_id = None

    try:
        # Create parent run
        parent_rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=parent_id)

        # Create replay job
        patch = {"hint": "use highest salary"}
        job_id = create_replay_job(parent_id, from_step=2, patch=patch)
        assert job_id is not None

        # Check job is pending
        conn = db.connect()
        try:
            job = conn.execute("SELECT * FROM replay_jobs WHERE id = %s", (job_id,)).fetchone()
            assert job["status"] == "pending"
        finally:
            conn.close()

        # Process job
        res = process_replay_job(graph, job_id)
        assert res["status"] == "completed"
        result_run_id = res["result"].run_id

        # Verify job is marked completed in DB
        conn = db.connect()
        try:
            job = conn.execute("SELECT * FROM replay_jobs WHERE id = %s", (job_id,)).fetchone()
            assert job["status"] == "completed"
            assert job["result_run_id"] == result_run_id
            assert job["error"] is None
        finally:
            conn.close()

        print("  [PASS] test_replay_job_queue PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_replay_job_queue FAILED")
        return False
    finally:
        cleanup_runs(parent_id, result_run_id)
        if job_id:
            conn = db.connect()
            try:
                conn.execute("DELETE FROM replay_jobs WHERE id = %s", (job_id,))
            finally:
                conn.close()
        agent.llm = _original_llm


def test_replay_reconstruction():
    """Verify that reconstruct_run validates the replayed run against snapshots."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    parent_id = f"test-parent-r-{uuid.uuid4().hex[:8]}"
    replay_id = f"test-replay-r-{uuid.uuid4().hex[:8]}"

    try:
        parent_rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=parent_id)
        replay_res = replay_run(graph, parent_id, forked_at_step=2, new_run_id=replay_id)

        recon = reconstruct_run(replay_id)
        assert recon["valid"], f"reconstruction errors: {recon['errors']}"
        assert len(recon["timeline"]) == replay_res.total_steps

        print("  [PASS] test_replay_reconstruction PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_replay_reconstruction FAILED")
        return False
    finally:
        cleanup_runs(parent_id, replay_id)
        agent.llm = _original_llm


def main():
    print("=" * 60)
    print("Checkpointed Replay Engine - Automated Tests (Milestone M3)")
    print("=" * 60)

    tests = [
        test_checkpointed_replay_offline,
        test_patch_override,
        test_replay_job_queue,
        test_replay_reconstruction,
    ]

    results = []
    for t in tests:
        print(f"\nRunning {t.__name__} ...")
        results.append(t())

    print(f"\n{'=' * 60}")
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} passed")
    if passed < total:
        print("SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED")


if __name__ == "__main__":
    main()
