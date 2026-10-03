"""Replay adapter – clean interface to the existing Checkpointed Replay Engine."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import replay as base_replay
from replay import ReplayResult, create_replay_job, fork_state, process_replay_job, replay_run


class ReplayEngine:
    """High-level interface to the existing Time-Machine Replay system."""

    def __init__(self, graph=None):
        import agent
        self.graph = graph or agent.build_graph()

    def fork_and_patch(
        self,
        parent_run_id: str,
        forked_at_step: int,
        patch: dict[str, Any] | None = None,
        new_thread_id: str | None = None,
    ):
        """Fork state from checkpoint before step `forked_at_step` and apply patch."""
        return fork_state(
            self.graph,
            parent_run_id=parent_run_id,
            forked_at_step=forked_at_step,
            patch=patch or {},
            new_thread_id=new_thread_id,
        )

    def replay(
        self,
        parent_run_id: str,
        forked_at_step: int,
        patch: dict[str, Any] | None = None,
        new_run_id: str | None = None,
    ) -> ReplayResult:
        """Execute checkpointed replay starting from step `forked_at_step`."""
        return replay_run(
            self.graph,
            parent_run_id=parent_run_id,
            forked_at_step=forked_at_step,
            patch=patch or {},
            new_run_id=new_run_id,
        )

    @staticmethod
    def compare_runs(original_run: dict[str, Any], replayed_run: dict[str, Any]) -> dict[str, Any]:
        """Compare an original execution trace with a replayed/patched execution trace."""
        orig_steps = original_run.get("steps", [])
        rep_steps = replayed_run.get("steps", [])

        divergence_step = None
        for i, (os, rs) in enumerate(zip(orig_steps, rep_steps)):
            # Check for difference in action, input, or output
            if (
                os.get("action") != rs.get("action")
                or os.get("output") != rs.get("output")
                or os.get("status") != rs.get("status")
            ):
                divergence_step = i + 1
                break

        if divergence_step is None and len(orig_steps) != len(rep_steps):
            divergence_step = min(len(orig_steps), len(rep_steps)) + 1

        return {
            "original_run_id": original_run.get("run_id") or original_run.get("id"),
            "original_status": original_run.get("status") or original_run.get("outcome"),
            "original_steps_count": len(orig_steps),
            "replayed_run_id": replayed_run.get("run_id") or replayed_run.get("id"),
            "replayed_status": replayed_run.get("status") or replayed_run.get("outcome"),
            "replayed_steps_count": len(rep_steps),
            "divergence_step": divergence_step,
            "status_improved": (
                (original_run.get("status") in ("failed", "fail"))
                and (replayed_run.get("status") in ("success", "completed"))
            ),
        }
