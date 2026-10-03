"""Checkpoint management – interacts with LangGraph checkpointer and Neon storage."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import db


def get_checkpoint_by_id(checkpoint_id: str) -> dict[str, Any] | None:
    """Retrieve checkpoint record by its checkpoint_id from Neon database."""
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT * FROM checkpoints WHERE checkpoint_id = %s",
            (checkpoint_id,),
        ).fetchone()
        return dict(row) if row else None
    except Exception:
        return None
    finally:
        conn.close()


def get_step_checkpoint_state(run_id: str, step_idx: int) -> dict[str, Any] | None:
    """Fetch the state snapshot stored after step_idx for run_id."""
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT checkpoint_id, state_snapshot FROM steps WHERE run_id = %s AND step_idx = %s",
            (run_id, step_idx),
        ).fetchone()
        if row and row.get("state_snapshot"):
            return row["state_snapshot"]
        return None
    except Exception:
        return None
    finally:
        conn.close()
