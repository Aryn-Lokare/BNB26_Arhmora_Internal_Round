"""Evaluation suite for Failure Localization Model."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from blackbox.dataset.generator.fault_injector import UNSEEN_FAILURE_TYPES
from blackbox.ml.inference.predictor import FailureLocalizationModel


class FailureLocalizationEvaluator:
    """Computes Top-1, Top-3, Precision, Recall, F1, and MRR across test sets."""

    def __init__(self, model: FailureLocalizationModel):
        self.model = model

    def evaluate_traces(self, traces: list[dict[str, Any]]) -> dict[str, Any]:
        """Compute comprehensive evaluation metrics for a collection of traces."""
        failed_traces = [t for t in traces if t.get("status") in ("failed", "fail")]
        success_traces = [t for t in traces if t.get("status") in ("success", "completed")]

        # Localization metrics on failed traces (where ground truth root cause exists)
        top1_hits = 0
        top3_hits = 0
        reciprocal_ranks = []

        # Step-level binary classification counters
        tp = 0
        fp = 0
        fn = 0
        tn = 0

        # Detailed breakdown by failure type
        by_failure_type: dict[str, dict[str, Any]] = {}

        for t in failed_traces:
            prediction = self.model.predict_failure(t, top_k=3)
            pred_step = prediction["predicted_failure_step"]
            top_candidate_steps = [c["step_id"] for c in prediction["top_candidates"]]

            # Ground truth root cause step_id
            gt_step = t.get("failure_step_id")
            if not gt_step:
                for s in t.get("steps", []):
                    if s.get("failure_label") == 1:
                        gt_step = s.get("step_id")
                        break

            ftype = t.get("failure_type", "unknown")
            if ftype not in by_failure_type:
                by_failure_type[ftype] = {"total": 0, "top1": 0, "top3": 0}
            by_failure_type[ftype]["total"] += 1

            if gt_step:
                # Top-1
                if pred_step == gt_step:
                    top1_hits += 1
                    by_failure_type[ftype]["top1"] += 1

                # Top-3
                if gt_step in top_candidate_steps:
                    top3_hits += 1
                    by_failure_type[ftype]["top3"] += 1

                # MRR calculation
                # Find rank of gt_step among all scored steps
                all_scores = prediction["all_step_scores"]
                ranked_steps = sorted(all_scores.keys(), key=lambda sid: all_scores[sid], reverse=True)
                if gt_step in ranked_steps:
                    rank = ranked_steps.index(gt_step) + 1
                    reciprocal_ranks.append(1.0 / rank)
                else:
                    reciprocal_ranks.append(0.0)

            # Step-level binary metrics (threshold 0.5)
            for s in t.get("steps", []):
                sid = s.get("step_id")
                label = s.get("failure_label", 0)
                score = prediction["all_step_scores"].get(sid, 0.0)
                pred_binary = 1 if score >= 0.5 else 0

                if label == 1 and pred_binary == 1:
                    tp += 1
                elif label == 0 and pred_binary == 1:
                    fp += 1
                elif label == 1 and pred_binary == 0:
                    fn += 1
                else:
                    tn += 1

        # Evaluate on normal success traces (false positive analysis)
        success_max_scores = []
        for t in success_traces:
            pred = self.model.predict_failure(t, top_k=1)
            success_max_scores.append(pred["confidence"])
            for s in t.get("steps", []):
                sid = s.get("step_id")
                score = pred["all_step_scores"].get(sid, 0.0)
                if score >= 0.5:
                    fp += 1
                else:
                    tn += 1

        n_failed = len(failed_traces)
        top1_acc = (top1_hits / max(n_failed, 1)) * 100.0
        top3_acc = (top3_hits / max(n_failed, 1)) * 100.0
        mrr = float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0

        precision = (tp / max(tp + fp, 1))
        recall = (tp / max(tp + fn, 1))
        f1 = (2 * precision * recall / max(precision + recall, 1e-6))

        # Known vs Unseen failure breakdown
        known_ftypes = [ft for ft in by_failure_type if ft not in UNSEEN_FAILURE_TYPES]
        unseen_ftypes = [ft for ft in by_failure_type if ft in UNSEEN_FAILURE_TYPES]

        known_tot = sum(by_failure_type[ft]["total"] for ft in known_ftypes)
        known_top1 = sum(by_failure_type[ft]["top1"] for ft in known_ftypes)
        known_top3 = sum(by_failure_type[ft]["top3"] for ft in known_ftypes)

        unseen_tot = sum(by_failure_type[ft]["total"] for ft in unseen_ftypes)
        unseen_top1 = sum(by_failure_type[ft]["top1"] for ft in unseen_ftypes)
        unseen_top3 = sum(by_failure_type[ft]["top3"] for ft in unseen_ftypes)

        # Baseline: Random step selection
        random_top1_expected = np.mean([1.0 / len(t.get("steps", [1])) for t in failed_traces]) * 100.0 if failed_traces else 0.0

        return {
            "total_traces_evaluated": len(traces),
            "failed_traces_count": n_failed,
            "success_traces_count": len(success_traces),
            "top1_accuracy_pct": round(top1_acc, 2),
            "top3_accuracy_pct": round(top3_acc, 2),
            "mean_reciprocal_rank": round(mrr, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "baseline_random_top1_pct": round(random_top1_expected, 2),
            "generalization": {
                "known_failures": {
                    "total": known_tot,
                    "top1_acc_pct": round((known_top1 / max(known_tot, 1)) * 100.0, 2),
                    "top3_acc_pct": round((known_top3 / max(known_tot, 1)) * 100.0, 2),
                },
                "unseen_failures": {
                    "total": unseen_tot,
                    "top1_acc_pct": round((unseen_top1 / max(unseen_tot, 1)) * 100.0, 2),
                    "top3_acc_pct": round((unseen_top3 / max(unseen_tot, 1)) * 100.0, 2),
                },
            },
            "success_runs_false_alarm_rate": round(
                (sum(1 for s in success_max_scores if s >= 0.5) / max(len(success_traces), 1)) * 100.0, 2
            ),
            "by_failure_type": {
                ft: {
                    "total": v["total"],
                    "top1_acc_pct": round((v["top1"] / max(v["total"], 1)) * 100.0, 2),
                    "top3_acc_pct": round((v["top3"] / max(v["total"], 1)) * 100.0, 2),
                }
                for ft, v in by_failure_type.items()
            },
        }
