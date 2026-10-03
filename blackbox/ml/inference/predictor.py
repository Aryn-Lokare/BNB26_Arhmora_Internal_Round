"""Inference engine for ranking execution steps by failure probability."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
from transformers import AutoTokenizer

from blackbox.ml.model.transformer_model import StepFailureClassifier
from blackbox.ml.preprocessing.text_formatter import format_step_as_text


class FailureLocalizationModel:
    """Ranks trace steps and localizes root-cause failure using the fine-tuned Transformer."""

    def __init__(
        self,
        model_path: str | Path | None = None,
        pretrained_model_name: str = "distilbert-base-uncased",
        device: str | None = None,
        max_length: int = 128,
    ):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.tokenizer = AutoTokenizer.from_pretrained(pretrained_model_name)
        self.model = StepFailureClassifier(pretrained_model_name=pretrained_model_name)
        self.max_length = max_length

        if model_path:
            ckpt_path = Path(model_path)
            if ckpt_path.exists():
                ckpt = torch.load(ckpt_path, map_location=self.device)
                state = ckpt.get("model_state_dict", ckpt)
                self.model.load_state_dict(state)

        self.model.to(self.device)
        self.model.eval()

        # Dynamic INT8 quantization on CPU for ~2x-3x inference speedup with negligible accuracy impact
        if self.device.type == "cpu":
            try:
                self.model = torch.quantization.quantize_dynamic(
                    self.model, {torch.nn.Linear}, dtype=torch.qint8
                )
            except Exception:
                pass

    def score_step(self, step: dict[str, Any], task_type: str | None = None) -> float:
        """Compute the failure-causing probability for a single step."""
        text = format_step_as_text(step, task_type=task_type)
        encoding = self.tokenizer(
            text,
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)

        with torch.no_grad():
            prob = self.model.predict_proba(input_ids, attention_mask)
            return float(prob.item())

    def predict_failure(self, trace: dict[str, Any], top_k: int = 3) -> dict[str, Any]:
        """Rank steps in a trace and return Top-1 and Top-K suspected root-cause steps.

        Output conforms directly to the Black Box PRD format:
        {
          "run_id": "...",
          "predicted_failure_step": "step_02",
          "confidence": 0.87,
          "top_candidates": [
            {"step_id": "step_02", "score": 0.87, "checkpoint_id": "cp_02", "step_number": 2},
            ...
          ]
        }
        """
        run_id = trace.get("run_id") or trace.get("id", "unknown_run")
        task_type = trace.get("task_type")
        steps = trace.get("steps", [])

        if not steps:
            return {
                "run_id": run_id,
                "predicted_failure_step": None,
                "confidence": 0.0,
                "top_candidates": [],
                "all_step_scores": {},
            }

        # Score all steps in parallel batch
        texts = [format_step_as_text(s, task_type=task_type) for s in steps]
        encoding = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)

        with torch.no_grad():
            probs = self.model.predict_proba(input_ids, attention_mask).cpu().numpy().tolist()

        if isinstance(probs, float):
            probs = [probs]

        candidates = []
        all_scores = {}
        for s, score in zip(steps, probs):
            step_id = s.get("step_id")
            score_rounded = round(float(score), 4)
            all_scores[step_id] = score_rounded
            candidates.append({
                "step_id": step_id,
                "step_number": s.get("step_number"),
                "action": s.get("action"),
                "checkpoint_id": s.get("checkpoint_id"),
                "score": score_rounded,
            })

        # Rank by score descending
        candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = candidates[:top_k]
        best_candidate = candidates[0] if candidates else None

        # Calibrated confidence: accounts for separation margin over runner-up candidate
        if best_candidate:
            top1_score = float(best_candidate["score"])
            if len(candidates) > 1:
                top2_score = float(candidates[1]["score"])
                # Relative margin in [0, 1]
                margin = max(0.0, (top1_score - top2_score) / max(top1_score, 1e-4))
                # Confidence rewards clear separation and penalizes ambiguous ties
                calibrated_confidence = round(float(top1_score * (0.65 + 0.35 * margin)), 4)
            else:
                calibrated_confidence = round(top1_score, 4)
        else:
            calibrated_confidence = 0.0

        return {
            "run_id": run_id,
            "predicted_failure_step": best_candidate["step_id"] if best_candidate else None,
            "confidence": calibrated_confidence,
            "checkpoint_id": best_candidate["checkpoint_id"] if best_candidate else None,
            "top_candidates": top_candidates,
            "all_step_scores": all_scores,
        }
