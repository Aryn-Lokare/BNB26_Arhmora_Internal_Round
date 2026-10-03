"""Textual preprocessor for execution steps to feed into the pretrained Transformer."""
from __future__ import annotations

import json
from typing import Any


def format_step_as_text(step: dict[str, Any], task_type: str | None = None) -> str:
    """Convert an execution step into the structured textual representation specified by the PRD:

    STEP TYPE: <type>
    ACTION: <action>
    INPUT: <input>
    PREVIOUS STATE: <state_before>
    OUTPUT: <output>
    STATUS: <status>
    """
    step_type = step.get("step_type", "unknown")
    action = step.get("action", "unknown")

    # Serialize input compactly
    inp = step.get("input")
    if isinstance(inp, dict):
        inp_str = ", ".join(f"{k}={v}" for k, v in inp.items())
    elif inp is not None:
        inp_str = str(inp)
    else:
        inp_str = "None"

    # Serialize previous state compactly
    st_before = step.get("state_before")
    if isinstance(st_before, dict):
        st_before_str = ", ".join(f"{k}={v}" for k, v in list(st_before.items())[:6])
    elif st_before is not None:
        st_before_str = str(st_before)
    else:
        st_before_str = "None"

    # Serialize output compactly
    out = step.get("output")
    if isinstance(out, dict):
        out_str = ", ".join(f"{k}={v}" for k, v in list(out.items())[:6])
    elif out is not None:
        out_str = str(out)
    else:
        out_str = "None"

    status = step.get("status", "success")
    err = step.get("error")
    if err:
        status = f"failed (Error: {err})"

    lines = []
    if task_type:
        lines.append(f"TASK DOMAIN: {task_type}")
    lines.extend([
        f"STEP TYPE: {step_type}",
        f"ACTION: {action}",
        f"INPUT: {inp_str}",
        f"PREVIOUS STATE: {st_before_str}",
        f"OUTPUT: {out_str}",
        f"STATUS: {status}",
    ])

    return "\n".join(lines)


def format_trace_steps_as_texts(trace: dict[str, Any]) -> list[str]:
    """Format all steps in a trace into a list of structured text strings."""
    task_type = trace.get("task_type")
    return [format_step_as_text(step, task_type=task_type) for step in trace.get("steps", [])]
