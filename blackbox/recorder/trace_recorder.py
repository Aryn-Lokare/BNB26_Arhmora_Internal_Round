"""Trace recorder bridge – integrates with existing LangGraph recorder and standardizes trace schema."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path
root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import recorder as base_recorder
from recorder import RunRecord, get_run_trace_json, record_run, run_and_record


def format_step_dict(
    step_id: str,
    step_number: int,
    step_type: str,
    action: str,
    inp: Any,
    out: Any,
    state_before: dict | None = None,
    state_after: dict | None = None,
    timestamp: str | None = None,
    duration_ms: int = 0,
    status: str = "success",
    error: str | None = None,
    checkpoint_id: str | None = None,
    failure_label: int = 0,
) -> dict[str, Any]:
    """Create a standardized step dictionary complying with the Black Box trace spec."""
    return {
        "step_id": step_id,
        "step_number": step_number,
        "step_type": step_type,
        "action": action,
        "input": inp,
        "output": out,
        "state_before": state_before or {},
        "state_after": state_after or {},
        "timestamp": timestamp or "2026-10-03T12:00:00Z",
        "duration_ms": duration_ms,
        "status": status,
        "error": error,
        "checkpoint_id": checkpoint_id or f"cp_{step_number:02d}",
        "failure_label": failure_label,
    }


def format_run_trace(
    run_id: str,
    task_type: str,
    agent_name: str,
    status: str,
    start_time: str,
    end_time: str,
    steps: list[dict[str, Any]],
    failure_type: str | None = None,
    failure_step_id: str | None = None,
    final_output: Any = None,
) -> dict[str, Any]:
    """Create a standardized run trace complying with the Black Box trace spec."""
    return {
        "run_id": run_id,
        "task_type": task_type,
        "agent_name": agent_name,
        "status": status,
        "start_time": start_time,
        "end_time": end_time,
        "total_steps": len(steps),
        "failure_type": failure_type,
        "failure_step_id": failure_step_id,
        "final_output": final_output,
        "steps": steps,
    }


def adapt_db_trace_to_standard(db_trace: dict[str, Any]) -> dict[str, Any]:
    """Convert an existing database/recorder JSON trace into the standardized Black Box trace schema."""
    run_id = db_trace.get("id") or db_trace.get("run_id", "unknown_run")
    outcome = db_trace.get("outcome", "fail")
    status = "success" if outcome == "success" else "failed"
    fault_type = db_trace.get("fault_type")
    injected_step = db_trace.get("injected_step")
    created_at = db_trace.get("created_at", "2026-10-03T12:00:00Z")

    raw_steps = db_trace.get("steps", [])
    standard_steps = []
    failure_step_id = None

    for i, s in enumerate(raw_steps):
        step_idx = s.get("step_idx", i)
        step_num = i + 1
        step_id = f"step_{step_num:02d}"
        node = s.get("node", "step")

        # Map node to step_type
        if node in ("plan", "reflect", "answer"):
            step_type = "llm_decision"
        elif node in ("select_tool", "run_tool"):
            step_type = "tool_call"
        elif node == "schema":
            step_type = "retrieval"
        else:
            step_type = "agent_step"

        # Label: if injected step matches this step_idx and run failed
        is_root_cause = 1 if (status == "failed" and injected_step is not None and step_idx == injected_step) else 0
        if is_root_cause:
            failure_step_id = step_id

        err = s.get("error")
        step_status = "failed" if err else "success"

        # State snapshot
        snap = s.get("state_snapshot") or {}

        standard_steps.append(
            format_step_dict(
                step_id=step_id,
                step_number=step_num,
                step_type=step_type,
                action=node,
                inp=s.get("input"),
                out=s.get("output"),
                state_before={},
                state_after=snap,
                timestamp=created_at,
                duration_ms=s.get("latency_ms", 0),
                status=step_status,
                error=err,
                checkpoint_id=s.get("checkpoint_id") or f"cp_{step_num:02d}",
                failure_label=is_root_cause,
            )
        )

    return format_run_trace(
        run_id=run_id,
        task_type="data_analysis",
        agent_name="sql_analytics_agent",
        status=status,
        start_time=created_at,
        end_time=created_at,
        steps=standard_steps,
        failure_type=fault_type,
        failure_step_id=failure_step_id,
        final_output=db_trace.get("final_answer"),
    )
