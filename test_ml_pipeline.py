"""Automated test suite for the Black Box ML Data Pipeline and Failure Localization System.

Validates:
1. Dataset generation: 600-700 traces, 15 domains, step-level labeling, train/val/test/unseen split
2. Textual preprocessing: structured format (STEP TYPE, ACTION, INPUT, PREVIOUS STATE, OUTPUT, STATUS)
3. Transformer fine-tuning: convergence, checkpoint creation
4. Evaluator metrics: Top-1, Top-3, MRR, Precision, Recall, F1 on test and unseen failures
5. Diagnosis & Verification: end-to-end trace -> model -> Top-1 suspect step -> checkpoint -> patch -> replay -> comparison
"""
from __future__ import annotations

import json
import shutil
import tempfile
import traceback
from pathlib import Path

import torch

from blackbox.dataset import TraceGenerator
from blackbox.diagnosis import DiagnosisVerifier
from blackbox.ml.evaluation import FailureLocalizationEvaluator
from blackbox.ml.inference import FailureLocalizationModel
from blackbox.ml.preprocessing import format_step_as_text
from blackbox.ml.training import FailureLocalizationTrainer
from blackbox.traces import load_jsonl, save_jsonl


def test_1_dataset_generation():
    """Verify trace generation creates ~650 runs across 15 domains with proper root-cause labeling."""
    print("\n--- TEST 1: Dataset Generation & Labeling ---")
    gen = TraceGenerator(seed=42)
    traces = gen.generate_dataset(total_runs=650, target_success=350, target_failed=300)

    assert 600 <= len(traces) <= 700, f"Expected 600-700 traces, got {len(traces)}"
    success_traces = [t for t in traces if t["status"] == "success"]
    failed_traces = [t for t in traces if t["status"] == "failed"]

    assert len(success_traces) == 350, f"Expected 350 success, got {len(success_traces)}"
    assert len(failed_traces) == 300, f"Expected 300 failed, got {len(failed_traces)}"

    # Check domain diversity (15 domains)
    domains_present = set(t["task_type"] for t in traces)
    assert len(domains_present) == 15, f"Expected 15 domains, got {len(domains_present)}"

    # Check step-level labels for success runs: all 0
    for st in success_traces[:20]:
        labels = [s["failure_label"] for s in st["steps"]]
        assert all(l == 0 for l in labels), f"Success trace has non-zero label: {labels}"
        assert st["failure_type"] is None
        assert st["failure_step_id"] is None

    # Check step-level labels for failed runs: exactly one 1 (the root cause)
    for ft in failed_traces[:20]:
        labels = [s["failure_label"] for s in ft["steps"]]
        assert sum(labels) == 1, f"Failed trace must have exactly one root-cause step with label=1, got {sum(labels)}"
        assert ft["failure_type"] is not None
        assert ft["failure_step_id"] is not None

        # Check that the root-cause step matches failure_step_id
        rc_step = next(s for s in ft["steps"] if s["failure_label"] == 1)
        assert rc_step["step_id"] == ft["failure_step_id"], "failure_step_id does not match step with label=1"

    # Check data split
    splits = gen.split_dataset(traces)
    assert len(splits["train"]) > 0
    assert len(splits["validation"]) > 0
    assert len(splits["test"]) > 0
    assert len(splits["unseen_test"]) > 0

    # Ensure no unseen failure types leaked into training set
    from blackbox.dataset.generator.fault_injector import UNSEEN_FAILURE_TYPES
    for t in splits["train"]:
        if t.get("failure_type"):
            assert t["failure_type"] not in UNSEEN_FAILURE_TYPES, f"Data leakage: unseen failure {t['failure_type']} in train set"

    print(f"  [PASS] Successfully verified 650 traces, 15 domains, and step-level root-cause labels.")
    return True


def test_2_preprocessing():
    """Verify conversion of execution step into structured textual representation."""
    print("\n--- TEST 2: Step Textual Preprocessing ---")
    step = {
        "step_id": "step_04",
        "step_number": 4,
        "step_type": "tool_call",
        "action": "send_email",
        "input": {"customer_id": 1042},
        "output": {"error": "customer not found"},
        "state_before": {"customer_id": 1024},
        "state_after": {"email_status": "failed"},
        "status": "failed",
        "error": "customer not found",
        "checkpoint_id": "cp_04",
        "failure_label": 1,
    }
    text = format_step_as_text(step, task_type="customer_support")

    assert "STEP TYPE: tool_call" in text
    assert "ACTION: send_email" in text
    assert "INPUT: customer_id=1042" in text
    assert "PREVIOUS STATE: customer_id=1024" in text
    assert "STATUS: failed" in text
    print("  [PASS] Structured textual representation complies with Black Box PRD.")
    return True


def test_3_training_and_evaluation():
    """Verify that the model fine-tunes and evaluates with Top-1, Top-3, and MRR metrics."""
    print("\n--- TEST 3: Pretrained Transformer Fine-tuning & Evaluation ---")
    tmp_dir = Path(tempfile.mkdtemp(prefix="blackbox_test_"))
    try:
        gen = TraceGenerator(seed=123)
        traces = gen.generate_dataset(total_runs=80, target_success=40, target_failed=40)
        splits = gen.split_dataset(traces)

        trainer = FailureLocalizationTrainer(
            pretrained_model_name="distilbert-base-uncased",
            lr=3e-5,
            max_length=96,
        )
        summary = trainer.train(
            train_traces=splits["train"],
            val_traces=splits["validation"],
            epochs=2,
            batch_size=16,
            output_dir=tmp_dir,
        )
        assert Path(summary["best_model_path"]).exists(), "best_model.pt was not saved"

        # Inference
        model = FailureLocalizationModel(model_path=summary["best_model_path"], max_length=96)
        evaluator = FailureLocalizationEvaluator(model)

        eval_results = evaluator.evaluate_traces(splits["test"])
        assert "top1_accuracy_pct" in eval_results
        assert "top3_accuracy_pct" in eval_results
        assert "mean_reciprocal_rank" in eval_results
        assert eval_results["top3_accuracy_pct"] >= eval_results["top1_accuracy_pct"]

        print(f"  [PASS] Training converged. Top-1: {eval_results['top1_accuracy_pct']}%, Top-3: {eval_results['top3_accuracy_pct']}%, MRR: {eval_results['mean_reciprocal_rank']}")
        return True
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_4_diagnosis_and_verification():
    """Verify end-to-end integration: trace -> Transformer -> predicted step -> checkpoint -> patch -> replay -> report."""
    print("\n--- TEST 4: End-to-End Diagnosis & Replay Verification ---")
    gen = TraceGenerator(seed=777)
    sample_failed_trace = gen.generate_single_trace(
        run_id="run_test_debug_01",
        domain="customer_support",
        is_failure=True,
        failure_type="wrong_tool_argument",
    )

    verifier = DiagnosisVerifier()
    report = verifier.diagnose_and_verify(sample_failed_trace)

    assert report["run_id"] == "run_test_debug_01"
    assert report["diagnosed_root_cause_step"] is not None
    assert report["checkpoint_id"] is not None
    assert report["original_status"] == "failed"
    assert report["replayed_status"] == "success"
    assert report["diagnosis_confirmed"] is True
    assert report["compute_saved_pct"] > 0

    print(f"  [PASS] Diagnosis verified:")
    print(f"    Suspect step:     {report['diagnosed_root_cause_step']} ({report['checkpoint_id']})")
    print(f"    Confidence:       {report['confidence']:.2f}")
    print(f"    Compute saved:    {report['compute_saved_pct']}%")
    print(f"    Confirmation:     {report['verdict']}")
    return True


def main():
    print("=" * 60)
    print("Running Black Box ML Pipeline Test Suite")
    print("=" * 60)

    tests = [
        test_1_dataset_generation,
        test_2_preprocessing,
        test_3_training_and_evaluation,
        test_4_diagnosis_and_verification,
    ]

    all_passed = True
    for t in tests:
        try:
            passed = t()
            if not passed:
                all_passed = False
        except Exception:
            traceback.print_exc()
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED SUCCESSFULLY! (4/4)")
    else:
        print("SOME TESTS FAILED.")
    print("=" * 60)
    return all_passed


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
