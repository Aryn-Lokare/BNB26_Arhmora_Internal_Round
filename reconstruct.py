"""Reconstruction engine – rebuilds a run step-by-step from the database.

    reconstruct_run(run_id) → dict
        Fetches the run and its steps, replays state evolution, validates
        checkpoint references, and returns a structured verification report.
"""
from __future__ import annotations

import db


def reconstruct_run(run_id: str) -> dict:
    """Reconstruct a recorded run step-by-step and verify consistency.

    Returns
    -------
    dict with keys:
        run          – the runs row (dict)
        steps        – ordered list of step dicts
        timeline     – list of {step_idx, node, state_after} showing state evolution
        valid        – True if reconstruction matches recorded snapshots
        errors       – list of mismatch descriptions (empty when valid)
        checkpoints  – dict of step_idx → checkpoint_id (only populated entries)
    """
    conn = db.connect()
    try:
        run = conn.execute("SELECT * FROM runs WHERE id = %s", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"run {run_id!r} not found")

        steps = conn.execute(
            "SELECT * FROM steps WHERE run_id = %s ORDER BY step_idx", (run_id,)
        ).fetchall()
    finally:
        conn.close()

    if not steps:
        return {
            "run": dict(run),
            "steps": [],
            "timeline": [],
            "valid": True,
            "errors": [],
            "checkpoints": {},
        }

    # -- replay state evolution -------------------------------------------
    timeline: list[dict] = []
    reconstructed_state: dict = {}
    errors: list[str] = []
    checkpoints: dict[int, str] = {}

    for step in steps:
        idx = step["step_idx"]
        output = step["output"]
        snapshot = step["state_snapshot"]

        # Apply this step's output to running state
        if output:
            reconstructed_state.update(output)

        timeline.append({
            "step_idx": idx,
            "node": step["node"],
            "state_after": dict(reconstructed_state),
        })

        # Compare reconstructed state to the recorded snapshot
        if snapshot is not None:
            for key in snapshot:
                recon_val = reconstructed_state.get(key)
                snap_val = snapshot[key]
                if recon_val != snap_val:
                    errors.append(
                        f"step {idx} ({step['node']}): state key {key!r} mismatch – "
                        f"reconstructed={_trunc(recon_val)} vs snapshot={_trunc(snap_val)}"
                    )

        # Collect checkpoint references
        if step.get("checkpoint_id"):
            checkpoints[idx] = step["checkpoint_id"]

    # -- validate checkpoint existence ------------------------------------
    if checkpoints:
        conn = db.connect()
        try:
            ckpt_ids = list(checkpoints.values())
            placeholders = ",".join(["%s"] * len(ckpt_ids))
            existing = conn.execute(
                f"SELECT checkpoint_id FROM checkpoints WHERE checkpoint_id IN ({placeholders})",
                ckpt_ids,
            ).fetchall()
            existing_ids = {r["checkpoint_id"] for r in existing}
            for idx, cid in checkpoints.items():
                if cid not in existing_ids:
                    errors.append(
                        f"step {idx}: checkpoint_id {cid!r} not found in checkpoints table"
                    )
        except Exception as e:
            # Checkpoints table may not exist or have different schema
            errors.append(f"checkpoint validation skipped: {e}")
        finally:
            conn.close()

    # -- final answer consistency -----------------------------------------
    if steps and run.get("final_answer") is not None:
        last_answer_step = None
        for step in reversed(steps):
            if step["node"] == "answer" and step.get("output"):
                last_answer_step = step
                break
        if last_answer_step and last_answer_step["output"].get("answer") != run["final_answer"]:
            errors.append(
                f"final_answer mismatch: runs.final_answer={run['final_answer']!r} vs "
                f"last answer step output={last_answer_step['output'].get('answer')!r}"
            )

    return {
        "run": dict(run),
        "steps": [dict(s) for s in steps],
        "timeline": timeline,
        "valid": len(errors) == 0,
        "errors": errors,
        "checkpoints": checkpoints,
    }


def _trunc(val, maxlen: int = 120) -> str:
    """Truncate a value's repr for readable error messages."""
    s = repr(val)
    return s if len(s) <= maxlen else s[:maxlen] + "…"


# ------------------------------------------------------------------ CLI
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python reconstruct.py <run_id>")
        sys.exit(1)

    result = reconstruct_run(sys.argv[1])
    run = result["run"]
    print(f"Run: {run['id']}  outcome={run['outcome']}  task_id={run['task_id']}")
    print(f"Steps: {len(result['steps'])}  checkpoints: {len(result['checkpoints'])}")
    print(f"Valid: {result['valid']}")
    if result["errors"]:
        print("Errors:")
        for e in result["errors"]:
            print(f"  [FAIL] {e}")
    else:
        print("[OK] Reconstruction matches all recorded snapshots.")

    print("\nTimeline:")
    for entry in result["timeline"]:
        print(f"  [{entry['step_idx']}] {entry['node']}")
