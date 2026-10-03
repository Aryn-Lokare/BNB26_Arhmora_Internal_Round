"""Unified CLI and API pipeline for Black Box ML Failure Localization and Checkpointed Replay."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path
root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from blackbox.dataset.generator.trace_generator import TraceGenerator
from blackbox.diagnosis.verifier import DiagnosisVerifier
from blackbox.ml.evaluation.evaluator import FailureLocalizationEvaluator
from blackbox.ml.inference.predictor import FailureLocalizationModel
from blackbox.ml.training.trainer import FailureLocalizationTrainer
from blackbox.traces.storage import load_jsonl, load_trace, save_trace


def step_1_generate(output_dir: str = "blackbox/dataset", total_runs: int = 650, seed: int = 42):
    """Step 1 & 2 & 3: Generate 600-700 traces with step-level labels and split them."""
    print("=" * 70)
    print("STEP 1-3: Generating diverse agent execution traces & splitting dataset")
    print("=" * 70)
    gen = TraceGenerator(seed=seed)
    summary = gen.generate_and_save_all(
        output_dir=output_dir,
        total_runs=total_runs,
        target_success=350,
        target_failed=300,
    )
    print(f"Generated {summary['total_generated']} total traces across 15 domains:")
    print(f"  Successful: {summary['successful_count']}")
    print(f"  Failed:     {summary['failed_count']}")
    print("Data splits:")
    print(f"  Train:       {summary['train_count']} traces -> {summary['files']['train']}")
    print(f"  Validation:  {summary['validation_count']} traces -> {summary['files']['validation']}")
    print(f"  Test:        {summary['test_count']} traces -> {summary['files']['test']}")
    print(f"  Unseen Test: {summary['unseen_test_count']} traces -> {summary['files']['unseen_test']}")
    return summary


def step_4_train(
    dataset_dir: str = "blackbox/dataset",
    output_dir: str = "blackbox/ml/model/checkpoints",
    epochs: int = 3,
    batch_size: int = 16,
    lr: float = 3e-5,
):
    """Step 4: Fine-tune the pretrained Transformer on step-level failure labels."""
    print("=" * 70)
    print("STEP 4: Fine-tuning Pretrained Transformer (DistilBERT) for Failure Localization")
    print("=" * 70)
    ds_path = Path(dataset_dir)
    train_traces = load_jsonl(ds_path / "train.jsonl")
    val_traces = load_jsonl(ds_path / "validation.jsonl")

    trainer = FailureLocalizationTrainer(
        pretrained_model_name="distilbert-base-uncased",
        lr=lr,
        max_length=128,
    )
    summary = trainer.train(
        train_traces=train_traces,
        val_traces=val_traces,
        epochs=epochs,
        batch_size=batch_size,
        output_dir=output_dir,
    )
    print("\nTraining completed successfully:")
    print(f"  Best Val Loss: {summary['best_val_loss']:.4f}")
    print(f"  Model saved to: {summary['best_model_path']}")
    return summary


def step_5_evaluate(
    dataset_dir: str = "blackbox/dataset",
    model_path: str = "blackbox/ml/model/checkpoints/best_model.pt",
):
    """Step 5: Evaluate model on test set, known failures, and unseen failure types."""
    print("=" * 70)
    print("STEP 5: Evaluating Model on Test Sets & Generalization Suite")
    print("=" * 70)
    ds_path = Path(dataset_dir)
    test_traces = load_jsonl(ds_path / "test.jsonl")
    unseen_traces = load_jsonl(ds_path / "unseen_test.jsonl")

    model = FailureLocalizationModel(model_path=model_path)
    evaluator = FailureLocalizationEvaluator(model)

    results = evaluator.evaluate_traces(test_traces)
    unseen_results = evaluator.evaluate_traces(unseen_traces)

    print("\n--- OVERALL TEST SET EVALUATION ---")
    print(f"Total traces evaluated: {results['total_traces_evaluated']} ({results['failed_traces_count']} failed, {results['success_traces_count']} success)")
    print(f"Top-1 Localization Accuracy: {results['top1_accuracy_pct']:.2f}%  (vs Random Baseline: {results['baseline_random_top1_pct']:.2f}%)")
    print(f"Top-3 Localization Accuracy: {results['top3_accuracy_pct']:.2f}%")
    print(f"Mean Reciprocal Rank (MRR):  {results['mean_reciprocal_rank']:.4f}")
    print(f"Precision:                   {results['precision']:.4f}")
    print(f"Recall:                      {results['recall']:.4f}")
    print(f"F1 Score:                    {results['f1_score']:.4f}")
    print(f"Normal Runs False Alarm:     {results['success_runs_false_alarm_rate']:.2f}%")

    print("\n--- GENERALIZATION BREAKDOWN ---")
    known = results["generalization"]["known_failures"]
    unseen = unseen_results["generalization"]["unseen_failures"]
    print(f"Known Failure Types ({known['total']} runs):   Top-1: {known['top1_acc_pct']:.2f}% | Top-3: {known['top3_acc_pct']:.2f}%")
    print(f"Unseen Failure Types ({unseen['total']} runs): Top-1: {unseen['top1_acc_pct']:.2f}% | Top-3: {unseen['top3_acc_pct']:.2f}%")

    eval_out = Path("blackbox/ml/evaluation/eval_results.json")
    with open(eval_out, "w", encoding="utf-8") as f:
        json.dump({"overall_test": results, "unseen_test": unseen_results}, f, indent=2)
    print(f"\nDetailed metrics written to: {eval_out}")
    return results


def step_6_to_13_diagnose_and_verify(
    trace_path_or_id: str | None = None,
    model_path: str = "blackbox/ml/model/checkpoints/best_model.pt",
    patch: dict[str, Any] | None = None,
):
    """Steps 6-13: Predict failure step -> Restore checkpoint -> Apply patch -> Replay -> Compare -> Report."""
    print("=" * 70)
    print("STEPS 6-13: Failure Localization, Checkpoint Restoration, Replay & Verification")
    print("=" * 70)

    # If no trace provided, pick the first failed trace from test set
    if not trace_path_or_id:
        test_file = Path("blackbox/dataset/test.jsonl")
        if test_file.exists():
            for t in load_jsonl(test_file):
                if t.get("status") == "failed":
                    trace = t
                    break
        else:
            raise FileNotFoundError("No trace path provided and test.jsonl not found.")
    elif Path(trace_path_or_id).exists():
        trace = load_trace(trace_path_or_id)
    else:
        # Try finding in raw dir
        cand = Path(f"blackbox/dataset/raw/{trace_path_or_id}.json")
        if cand.exists():
            trace = load_trace(cand)
        else:
            raise ValueError(f"Trace not found: {trace_path_or_id}")

    model = FailureLocalizationModel(model_path=model_path)
    verifier = DiagnosisVerifier(model=model)

    print(f"\n[Step 6] Input Failed Agent Trace: {trace['run_id']} (Task: {trace['task_type']}, Failure: {trace.get('failure_type')})")
    print(f"  Ground truth root-cause step: {trace.get('failure_step_id')}")

    # Steps 7-13
    report = verifier.diagnose_and_verify(trace=trace, patch=patch)

    print(f"\n[Step 7] Most Likely Failure-Causing Step:")
    print(f"  Predicted Suspect Step: {report['diagnosed_root_cause_step']} (Confidence: {report['confidence']:.2f})")
    print(f"  Top 3 Candidates:")
    for c in report["top_candidates"]:
        print(f"    - {c['step_id']} (action: {c.get('action')}, score: {c['score']:.4f})")

    print(f"\n[Step 8-9] Restoring Checkpoint:")
    print(f"  Target Checkpoint: {report['checkpoint_id']} (State immediately preceding step {report['step_number']})")

    print(f"\n[Step 10] Applying Patch:")
    print(f"  Applied Patch: {json.dumps(report['patch_applied'])}")

    print(f"\n[Step 11] Replaying Remaining Execution:")
    print(f"  Replay Run ID:     {report['replay_run_id']}")
    print(f"  Steps Skipped:     {report['steps_skipped']} steps (Already executed in parent run)")
    print(f"  Steps Executed:    {report['steps_executed']} steps")
    print(f"  Compute Saved:     {report['compute_saved_pct']}%")

    print(f"\n[Step 12] Comparing Original vs Patched Execution:")
    print(f"  Original Status:   {report['original_status'].upper()}")
    print(f"  Replayed Status:   {report['replayed_status'].upper()}")
    print(f"  Point of Divergence: Step {report['divergence_step']}")

    print(f"\n[Step 13] Verification Report:")
    print(f"  Verdict: {report['verdict']}")
    print(f"  Diagnosis Validated: {'YES [SUCCESS]' if report['diagnosis_confirmed'] else 'NO [INCONCLUSIVE]'}")

    return report


def main():
    parser = argparse.ArgumentParser(description="Black Box: ML Data Pipeline & Replay Engine")
    subparsers = parser.add_subparsers(dest="command", help="Subcommand to run")

    # Generate
    p_gen = subparsers.add_parser("generate", help="Generate 600-700 traces and split dataset")
    p_gen.add_argument("--output-dir", default="blackbox/dataset")
    p_gen.add_argument("--total-runs", type=int, default=650)
    p_gen.add_argument("--seed", type=int, default=42)

    # Train
    p_train = subparsers.add_parser("train", help="Fine-tune pretrained Transformer")
    p_train.add_argument("--dataset-dir", default="blackbox/dataset")
    p_train.add_argument("--epochs", type=int, default=3)
    p_train.add_argument("--batch-size", type=int, default=16)
    p_train.add_argument("--lr", type=float, default=3e-5)

    # Evaluate
    p_eval = subparsers.add_parser("evaluate", help="Evaluate model metrics")
    p_eval.add_argument("--dataset-dir", default="blackbox/dataset")
    p_eval.add_argument("--model-path", default="blackbox/ml/model/checkpoints/best_model.pt")

    # Diagnose & Verify
    p_diag = subparsers.add_parser("diagnose", help="Diagnose a trace and verify with replay")
    p_diag.add_argument("--trace", default=None, help="Trace JSON file path or run_id")
    p_diag.add_argument("--model-path", default="blackbox/ml/model/checkpoints/best_model.pt")

    # Run All
    p_all = subparsers.add_parser("run_all", help="Execute complete end-to-end workflow (1-13)")
    p_all.add_argument("--epochs", type=int, default=3)

    args = parser.parse_args()

    if args.command == "generate":
        step_1_generate(output_dir=args.output_dir, total_runs=args.total_runs, seed=args.seed)
    elif args.command == "train":
        step_4_train(dataset_dir=args.dataset_dir, epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
    elif args.command == "evaluate":
        step_5_evaluate(dataset_dir=args.dataset_dir, model_path=args.model_path)
    elif args.command == "diagnose":
        step_6_to_13_diagnose_and_verify(trace_path_or_id=args.trace, model_path=args.model_path)
    elif args.command == "run_all":
        step_1_generate()
        step_4_train(epochs=args.epochs)
        step_5_evaluate()
        step_6_to_13_diagnose_and_verify()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
