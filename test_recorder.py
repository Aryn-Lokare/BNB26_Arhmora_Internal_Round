"""Automated tests for the Flight Recorder and Reconstruction Engine.

Test plan
---------
1. test_clean_run_offline    – mock LLM, run a clean task, verify DB writes and field types
2. test_reconstruction       – reconstruct the mock run, assert state-snapshot consistency
3. test_failed_run           – inject a failure, verify outcome='fail' and steps.error populated
4. test_duplicate_run_id     – ensure re-recording with same run_id is handled
5. test_crash_recording      – simulate a graph crash, verify partial recording

Run:  python test_recorder.py
"""
from __future__ import annotations

import json
import sys
import traceback
import uuid

import agent
import db
from recorder import run_and_record, record_run
from reconstruct import reconstruct_run
from tasks import gold_answer, check


# ------------------------------------------------------------------ shared fixtures
TASK = "What is the highest department budget?"
GOOD_SQL = "SELECT MAX(budget) FROM departments"
BAD_SQL = "SELECT MIN(budget) FROM departments"

_original_llm = agent.llm  # save so integration test can restore it


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


def fake_llm_bad(prompt: str) -> str:
    """Mock LLM that produces a wrong query → fail outcome."""
    if "Break this into" in prompt:
        return json.dumps({"plan": ["find min budget"]})
    if "Choose the next tool" in prompt:
        return json.dumps({"tool": "run_sql", "args": {"query": BAD_SQL}})
    if "enough information" in prompt:
        return json.dumps({"done": True, "note": "got it"})
    work = prompt.split("Work so far: ")[1].split("\n")[0]
    rows = json.loads(work)[0]["result"]["rows"]
    return str(rows[0][0])


def cleanup_run(run_id: str):
    """Remove a test run from the database."""
    conn = db.connect()
    try:
        conn.execute("DELETE FROM steps WHERE run_id = %s", (run_id,))
        conn.execute("DELETE FROM runs WHERE id = %s", (run_id,))
    finally:
        conn.close()


# ------------------------------------------------------------------ tests
def test_clean_run_offline():
    """Mock LLM → clean run → verify DB writes, correct outcome, and field types."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    run_id = f"test-clean-{uuid.uuid4().hex[:8]}"

    try:
        rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=run_id)

        # Basic assertions
        assert rec.outcome == "success", f"expected success, got {rec.outcome}"
        assert rec.step_count >= 5, f"expected ≥5 steps, got {rec.step_count}"

        # Verify DB row for runs
        conn = db.connect()
        try:
            run = conn.execute("SELECT * FROM runs WHERE id = %s", (run_id,)).fetchone()
            assert run is not None, "run not found in DB"
            assert run["outcome"] == "success"
            assert run["task_id"] == 0
            assert run["task_text"] == TASK
            assert run["gold_answer"] is not None
            assert run["final_answer"] is not None
            assert run["llm_calls"] is not None
            assert run["created_at"] is not None
            # M2 clean-run fields should be NULL
            assert run["injected_step"] is None
            assert run["fault_type"] is None
            assert run["parent_run_id"] is None

            # Verify DB rows for steps
            steps = conn.execute(
                "SELECT * FROM steps WHERE run_id = %s ORDER BY step_idx", (run_id,)
            ).fetchall()
            assert len(steps) == rec.step_count
            for step in steps:
                assert step["node"] in ("schema", "plan", "select_tool", "run_tool", "reflect", "answer")
                assert step["input"] is not None, f"step {step['step_idx']} input is null"
                assert step["latency_ms"] is not None
                assert step["state_snapshot"] is not None
                # output can be null on crash, but should be present for a clean run
                assert step["output"] is not None, f"step {step['step_idx']} output is null"
        finally:
            conn.close()

        print("  [PASS] test_clean_run_offline PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_clean_run_offline FAILED")
        return False
    finally:
        cleanup_run(run_id)
        agent.llm = _original_llm


def test_reconstruction():
    """Record a clean run, then reconstruct it and validate snapshot consistency."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    run_id = f"test-recon-{uuid.uuid4().hex[:8]}"

    try:
        rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=run_id)
        assert rec.outcome == "success"

        result = reconstruct_run(run_id)
        assert result["valid"], f"reconstruction invalid: {result['errors']}"
        assert len(result["timeline"]) == rec.step_count
        assert result["run"]["outcome"] == "success"

        # Timeline should follow the expected node order
        nodes = [e["node"] for e in result["timeline"]]
        assert nodes[:5] == ["schema", "plan", "select_tool", "run_tool", "reflect"], \
            f"unexpected node order: {nodes}"

        print("  [PASS] test_reconstruction PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_reconstruction FAILED")
        return False
    finally:
        cleanup_run(run_id)
        agent.llm = _original_llm


def test_failed_run():
    """Run with a bad query → outcome='fail' and steps.error may be populated."""
    agent.llm = fake_llm_bad
    graph = agent.build_graph()
    run_id = f"test-fail-{uuid.uuid4().hex[:8]}"

    try:
        rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=run_id)
        assert rec.outcome == "fail", f"expected fail, got {rec.outcome}"
        assert rec.step_count >= 5

        conn = db.connect()
        try:
            run = conn.execute("SELECT * FROM runs WHERE id = %s", (run_id,)).fetchone()
            assert run["outcome"] == "fail"

            steps = conn.execute(
                "SELECT * FROM steps WHERE run_id = %s ORDER BY step_idx", (run_id,)
            ).fetchall()
            assert len(steps) >= 5
        finally:
            conn.close()

        print("  [PASS] test_failed_run PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_failed_run FAILED")
        return False
    finally:
        cleanup_run(run_id)
        agent.llm = _original_llm


def test_crash_recording():
    """Simulate an LLM crash mid-run and verify partial recording."""

    call_count = 0

    def crashing_llm(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        if call_count <= 1:
            # First call (plan step) succeeds
            return json.dumps({"plan": ["find max budget"]})
        # Second call (select_tool) crashes
        raise RuntimeError("simulated LLM crash")

    agent.llm = crashing_llm
    graph = agent.build_graph()
    run_id = f"test-crash-{uuid.uuid4().hex[:8]}"

    try:
        rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=run_id)
        # Should be recorded as a fail
        assert rec.outcome == "fail", f"expected fail, got {rec.outcome}"
        assert rec.step_count >= 1, "at least 1 step should be recorded even on crash"

        conn = db.connect()
        try:
            run = conn.execute("SELECT * FROM runs WHERE id = %s", (run_id,)).fetchone()
            assert run is not None, "crashed run not found in DB"
            assert run["outcome"] == "fail"

            steps = conn.execute(
                "SELECT * FROM steps WHERE run_id = %s ORDER BY step_idx", (run_id,)
            ).fetchall()
            assert len(steps) >= 1

            # At least one step should have an error
            has_error = any(s.get("error") for s in steps)
            assert has_error, "expected at least one step with an error on crash"
        finally:
            conn.close()

        print("  [PASS] test_crash_recording PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_crash_recording FAILED")
        return False
    finally:
        cleanup_run(run_id)
        agent.llm = _original_llm


def test_structured_json_trace():
    """Verify that runs produce a complete structured JSON trace with success/fail label and steps."""
    agent.llm = fake_llm
    graph = agent.build_graph()
    run_id = f"test-trace-{uuid.uuid4().hex[:8]}"

    try:
        # Run with save_json=True
        rec = run_and_record(graph, 0, TASK, GOOD_SQL, thread_id=run_id, save_json=True)

        # 1. Verify in-memory structured trace
        trace = rec.to_dict()
        assert trace["id"] == run_id
        assert trace["outcome"] == "success"
        assert trace["final_answer"] is not None
        assert "steps" in trace and len(trace["steps"]) == rec.step_count
        for step in trace["steps"]:
            assert "step_idx" in step
            assert "node" in step
            assert "input" in step
            assert "output" in step
            assert "state_snapshot" in step

        # 2. Verify saved JSON file on disk
        from pathlib import Path
        trace_file = Path(f"traces/{run_id}.json")
        assert trace_file.exists(), f"trace file {trace_file} was not written"
        with open(trace_file, "r", encoding="utf-8") as f:
            disk_data = json.load(f)
        assert disk_data["id"] == run_id
        assert disk_data["outcome"] == "success"
        assert len(disk_data["steps"]) == rec.step_count

        # Clean up trace file
        if trace_file.exists():
            trace_file.unlink()

        print("  [PASS] test_structured_json_trace PASSED")
        return True
    except Exception:
        traceback.print_exc()
        print("  [FAIL] test_structured_json_trace FAILED")
        return False
    finally:
        cleanup_run(run_id)
        agent.llm = _original_llm


# ------------------------------------------------------------------ runner
def main():
    print("=" * 60)
    print("Flight Recorder – Automated Tests")
    print("=" * 60)

    tests = [
        test_clean_run_offline,
        test_reconstruction,
        test_failed_run,
        test_crash_recording,
        test_structured_json_trace,
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

