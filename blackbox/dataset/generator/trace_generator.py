"""Trace generator pipeline: creates 600-700 diverse, realistic agent traces with reproducible seed."""
from __future__ import annotations

import copy
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from blackbox.dataset.generator.fault_injector import (
    FAILURE_TYPES,
    KNOWN_FAILURE_TYPES,
    UNSEEN_FAILURE_TYPES,
    inject_fault_into_workflow,
)
from blackbox.dataset.generator.workflows import DOMAIN_SCENARIOS, DOMAINS
from blackbox.traces.storage import save_jsonl, save_trace


class TraceGenerator:
    """Generates synthetic yet highly realistic agent execution traces across 15 domains."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)

    def _generate_realistic_step_data(
        self,
        domain: str,
        step_def: dict[str, Any],
        step_number: int,
        running_state: dict[str, Any],
        base_time: datetime,
    ) -> dict[str, Any]:
        """Synthesize realistic input, output, state, latency, and checkpoint for a step."""
        step_type = step_def["type"]
        action = step_def["action"]
        duration_ms = self.rng.randint(80, 1400)
        timestamp = (base_time + timedelta(milliseconds=duration_ms * step_number)).isoformat()

        # Generate realistic domain-specific inputs & outputs
        inp: dict[str, Any] = {}
        for k in step_def.get("input_keys", []):
            if "id" in k:
                inp[k] = running_state.get(k, self.rng.choice([1024, 2048, 512, 9081, 334]))
            elif "query" in k or "prompt" in k or "message" in k:
                inp[k] = f"Execute action {action} for {domain} workflow"
            elif "date" in k or "time" in k:
                inp[k] = "2026-10-04T09:00:00Z"
            elif "amount" in k or "balance" in k or "price" in k:
                inp[k] = round(self.rng.uniform(25.0, 950.0), 2)
            else:
                inp[k] = f"val_{k}_{self.rng.randint(10, 99)}"

        out: dict[str, Any] = {}
        for k in step_def.get("output_keys", []):
            if "id" in k:
                out[k] = inp.get(k, self.rng.randint(1000, 9999))
            elif "status" in k or "valid" in k or "eligible" in k:
                out[k] = True if "valid" in k or "eligible" in k else "success"
            elif "total" in k or "amount" in k or "rate" in k or "balance" in k:
                out[k] = round(self.rng.uniform(50.0, 1200.0), 2)
            elif "rows" in k or "list" in k or "items" in k or "candidates" in k:
                out[k] = [{"item_id": self.rng.randint(1, 100), "score": round(self.rng.uniform(0.7, 0.99), 2)} for _ in range(self.rng.randint(1, 3))]
            else:
                out[k] = f"output_{k}_{self.rng.randint(100, 999)}"

        state_before = copy.deepcopy(running_state)
        state_after = copy.deepcopy(running_state)
        state_after.update(out)
        running_state.update(out)

        return {
            "step_id": f"step_{step_number:02d}",
            "step_number": step_number,
            "step_type": step_type,
            "action": action,
            "input": inp,
            "output": out,
            "state_before": state_before,
            "state_after": state_after,
            "timestamp": timestamp,
            "duration_ms": duration_ms,
            "status": "success",
            "error": None,
            "checkpoint_id": f"cp_{step_number:02d}",
            "failure_label": 0,
        }

    def generate_single_trace(
        self,
        run_id: str,
        domain: str,
        is_failure: bool,
        failure_type: str | None = None,
    ) -> dict[str, Any]:
        """Generate a single complete execution trace (successful or failed with root-cause)."""
        scenarios = DOMAIN_SCENARIOS[domain]
        scenario = self.rng.choice(scenarios)

        step_defs = scenario["steps"]
        # Allow slight variation in step length by optionally truncating or adding a reflection step
        num_steps = len(step_defs)
        if self.rng.random() < 0.25 and num_steps > 4:
            # 4-step shorter trace
            selected_defs = step_defs[:4]
        else:
            selected_defs = list(step_defs)

        base_time = datetime(2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc) + timedelta(minutes=self.rng.randint(1, 1000))
        running_state: dict[str, Any] = {"workflow_domain": domain, "scenario": scenario["scenario"]}

        steps: list[dict[str, Any]] = []
        for i, sdef in enumerate(selected_defs):
            step_obj = self._generate_realistic_step_data(
                domain=domain,
                step_def=sdef,
                step_number=i + 1,
                running_state=running_state,
                base_time=base_time,
            )
            steps.append(step_obj)

        agent_name = f"{domain}_agent_v{self.rng.randint(1, 3)}"

        if not is_failure:
            # Normal clean run: all steps failure_label = 0
            start_time = steps[0]["timestamp"]
            end_time = steps[-1]["timestamp"]
            final_output = steps[-1]["output"]
            return {
                "run_id": run_id,
                "task_type": domain,
                "agent_name": agent_name,
                "status": "success",
                "start_time": start_time,
                "end_time": end_time,
                "total_steps": len(steps),
                "failure_type": None,
                "failure_step_id": None,
                "final_output": final_output,
                "steps": steps,
            }
        else:
            # Failed run: inject fault at step k (ROOT CAUSE)
            chosen_failure = failure_type or self.rng.choice(FAILURE_TYPES)
            mutated_steps, k, error_msg = inject_fault_into_workflow(
                workflow_steps=steps,
                failure_type=chosen_failure,
                rng=self.rng,
            )
            start_time = mutated_steps[0]["timestamp"]
            end_time = mutated_steps[-1]["timestamp"]
            root_cause_step_id = mutated_steps[k]["step_id"]

            return {
                "run_id": run_id,
                "task_type": domain,
                "agent_name": agent_name,
                "status": "failed",
                "start_time": start_time,
                "end_time": end_time,
                "total_steps": len(mutated_steps),
                "failure_type": chosen_failure,
                "failure_step_id": root_cause_step_id,
                "final_output": mutated_steps[-1]["output"],
                "steps": mutated_steps,
            }

    def generate_dataset(
        self,
        total_runs: int = 650,
        target_success: int = 350,
        target_failed: int = 300,
    ) -> list[dict[str, Any]]:
        """Generate the full dataset of ~650 runs across all 15 domains with balanced failures."""
        traces: list[dict[str, Any]] = []

        # Calculate per-domain distribution
        num_domains = len(DOMAINS)
        success_per_domain = target_success // num_domains
        failed_per_domain = target_failed // num_domains

        run_counter = 1

        # We also distribute failure types evenly across failed traces
        # Ensure unseen failure types get dedicated traces
        all_failures_pool = list(FAILURE_TYPES) * (target_failed // len(FAILURE_TYPES) + 2)
        self.rng.shuffle(all_failures_pool)
        failure_idx = 0

        for domain in DOMAINS:
            # Generate success runs for domain
            n_succ = success_per_domain
            for _ in range(n_succ):
                run_id = f"run_{run_counter:04d}"
                trace = self.generate_single_trace(
                    run_id=run_id,
                    domain=domain,
                    is_failure=False,
                )
                traces.append(trace)
                run_counter += 1

            # Generate failed runs for domain
            n_fail = failed_per_domain
            for _ in range(n_fail):
                run_id = f"run_{run_counter:04d}"
                ftype = all_failures_pool[failure_idx]
                failure_idx = (failure_idx + 1) % len(all_failures_pool)
                trace = self.generate_single_trace(
                    run_id=run_id,
                    domain=domain,
                    is_failure=True,
                    failure_type=ftype,
                )
                traces.append(trace)
                run_counter += 1

        # Fill any remainder up to total_runs
        while len(traces) < total_runs:
            run_id = f"run_{run_counter:04d}"
            domain = self.rng.choice(DOMAINS)
            is_fail = (len([t for t in traces if t["status"] == "failed"]) < target_failed)
            ftype = self.rng.choice(FAILURE_TYPES) if is_fail else None
            trace = self.generate_single_trace(run_id, domain, is_failure=is_fail, failure_type=ftype)
            traces.append(trace)
            run_counter += 1

        self.rng.shuffle(traces)
        return traces

    def split_dataset(
        self,
        traces: list[dict[str, Any]],
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
    ) -> dict[str, list[dict[str, Any]]]:
        """Split dataset into Train (70%), Validation (15%), Test (15%), plus dedicated Unseen Test set.

        Crucial Requirement:
        - Avoid data leakage.
        - Hold out unseen failure types completely from Train and Validation!
        """
        unseen_traces: list[dict[str, Any]] = []
        eligible_traces: list[dict[str, Any]] = []

        for t in traces:
            if t["status"] == "failed" and t.get("failure_type") in UNSEEN_FAILURE_TYPES:
                unseen_traces.append(t)
            else:
                eligible_traces.append(t)

        # Shuffle eligible with generator seed
        self.rng.shuffle(eligible_traces)

        n_total = len(eligible_traces)
        n_train = int(n_total * train_ratio)
        n_val = int(n_total * val_ratio)

        train_traces = eligible_traces[:n_train]
        val_traces = eligible_traces[n_train : n_train + n_val]
        test_traces = eligible_traces[n_train + n_val :]

        # Combine standard test traces with unseen traces for overall test evaluation,
        # but also keep unseen_test distinct for isolated generalization analysis.
        combined_test = test_traces + unseen_traces
        self.rng.shuffle(combined_test)

        return {
            "train": train_traces,
            "validation": val_traces,
            "test": combined_test,
            "standard_test": test_traces,
            "unseen_test": unseen_traces,
        }

    def generate_and_save_all(
        self,
        output_dir: str | Path = "blackbox/dataset",
        total_runs: int = 650,
        target_success: int = 350,
        target_failed: int = 300,
    ) -> dict[str, Any]:
        """Generate dataset, partition into train/validation/test/unseen, and persist to files."""
        out_path = Path(output_dir)
        raw_dir = out_path / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)

        traces = self.generate_dataset(
            total_runs=total_runs,
            target_success=target_success,
            target_failed=target_failed,
        )

        # Save individual raw trace JSONs
        for t in traces:
            save_trace(t, raw_dir / f"{t['run_id']}.json")

        splits = self.split_dataset(traces)

        # Save JSONL split files
        train_file = save_jsonl(splits["train"], out_path / "train.jsonl")
        val_file = save_jsonl(splits["validation"], out_path / "validation.jsonl")
        test_file = save_jsonl(splits["test"], out_path / "test.jsonl")
        unseen_file = save_jsonl(splits["unseen_test"], out_path / "unseen_test.jsonl")

        summary = {
            "total_generated": len(traces),
            "successful_count": sum(1 for t in traces if t["status"] == "success"),
            "failed_count": sum(1 for t in traces if t["status"] == "failed"),
            "train_count": len(splits["train"]),
            "validation_count": len(splits["validation"]),
            "test_count": len(splits["test"]),
            "unseen_test_count": len(splits["unseen_test"]),
            "files": {
                "train": str(train_file),
                "validation": str(val_file),
                "test": str(test_file),
                "unseen_test": str(unseen_file),
                "raw_dir": str(raw_dir),
            },
        }

        # Write dataset summary metadata
        with open(out_path / "dataset_summary.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        return summary
