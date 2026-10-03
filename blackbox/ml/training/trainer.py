"""Fine-tuning pipeline for pretrained Transformer failure localization."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer

from blackbox.ml.model.transformer_model import StepFailureClassifier
from blackbox.ml.preprocessing.text_formatter import format_step_as_text
from blackbox.traces.storage import load_jsonl


class StepLevelTraceDataset(Dataset):
    """Dataset extracting individual steps from traces with structured textual representation and binary label."""

    def __init__(
        self,
        traces: list[dict[str, Any]],
        tokenizer,
        max_length: int = 128,
    ):
        self.samples = []
        for trace in traces:
            task_type = trace.get("task_type")
            run_id = trace.get("run_id", "run")
            for step in trace.get("steps", []):
                text = format_step_as_text(step, task_type=task_type)
                label = float(step.get("failure_label", 0))
                self.samples.append({
                    "run_id": run_id,
                    "step_id": step.get("step_id"),
                    "text": text,
                    "label": label,
                })

        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        item = self.samples[idx]
        encoding = self.tokenizer(
            item["text"],
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "label": torch.tensor(item["label"], dtype=torch.float),
            "run_id": item["run_id"],
            "step_id": item["step_id"],
        }


class FailureLocalizationTrainer:
    """Trains and validates the Transformer failure localization model."""

    def __init__(
        self,
        pretrained_model_name: str = "distilbert-base-uncased",
        lr: float = 3e-5,
        max_length: int = 128,
        device: str | None = None,
    ):
        self.model_name = pretrained_model_name
        self.lr = lr
        self.max_length = max_length
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.tokenizer = AutoTokenizer.from_pretrained(pretrained_model_name)
        self.model = StepFailureClassifier(pretrained_model_name=pretrained_model_name)
        self.model.to(self.device)

    def train(
        self,
        train_traces: list[dict[str, Any]],
        val_traces: list[dict[str, Any]],
        epochs: int = 3,
        batch_size: int = 16,
        output_dir: str | Path = "blackbox/ml/model/checkpoints",
    ) -> dict[str, Any]:
        """Execute fine-tuning with class-weighted loss and validation evaluation."""
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        train_ds = StepLevelTraceDataset(train_traces, self.tokenizer, max_length=self.max_length)
        val_ds = StepLevelTraceDataset(val_traces, self.tokenizer, max_length=self.max_length)

        train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

        # Compute positive class weight to balance root-cause steps vs normal steps
        all_labels = [s["label"] for s in train_ds.samples]
        pos_count = sum(all_labels)
        neg_count = len(all_labels) - pos_count
        pos_weight = (neg_count / max(pos_count, 1.0))
        criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight], device=self.device))

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.lr, weight_decay=0.01)

        history: list[dict[str, Any]] = []
        best_val_loss = float("inf")
        best_model_path = out_dir / "best_model.pt"

        print(f"Starting training on {len(train_ds)} steps ({pos_count:.0f} positive root-cause, {neg_count:.0f} normal).")
        print(f"Device: {self.device}, Batch size: {batch_size}, Epochs: {epochs}, Pos weight: {pos_weight:.2f}")

        for epoch in range(1, epochs + 1):
            self.model.train()
            total_train_loss = 0.0

            for batch in train_loader:
                input_ids = batch["input_ids"].to(self.device)
                attention_mask = batch["attention_mask"].to(self.device)
                labels = batch["label"].to(self.device)

                optimizer.zero_grad()
                logits = self.model(input_ids, attention_mask)
                loss = criterion(logits, labels)
                loss.backward()
                optimizer.step()

                total_train_loss += loss.item() * len(labels)

            avg_train_loss = total_train_loss / len(train_ds)

            # Validation
            self.model.eval()
            total_val_loss = 0.0
            val_preds = []
            val_targets = []

            with torch.no_grad():
                for batch in val_loader:
                    input_ids = batch["input_ids"].to(self.device)
                    attention_mask = batch["attention_mask"].to(self.device)
                    labels = batch["label"].to(self.device)

                    logits = self.model(input_ids, attention_mask)
                    loss = criterion(logits, labels)
                    total_val_loss += loss.item() * len(labels)

                    probs = torch.sigmoid(logits).cpu().numpy()
                    val_preds.extend(probs)
                    val_targets.extend(labels.cpu().numpy())

            avg_val_loss = total_val_loss / len(val_ds)
            # Binary accuracy at 0.5 threshold
            bin_preds = (np.array(val_preds) >= 0.5).astype(int)
            acc = float(np.mean(bin_preds == np.array(val_targets)))

            epoch_stat = {
                "epoch": epoch,
                "train_loss": round(avg_train_loss, 4),
                "val_loss": round(avg_val_loss, 4),
                "val_step_acc": round(acc, 4),
            }
            history.append(epoch_stat)
            print(f"Epoch {epoch}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Val Acc: {acc:.4f}")

            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                torch.save(
                    {
                        "model_state_dict": self.model.state_dict(),
                        "model_name": self.model_name,
                        "epoch": epoch,
                        "val_loss": avg_val_loss,
                    },
                    best_model_path,
                )

        # Save training summary
        summary = {
            "best_val_loss": best_val_loss,
            "best_model_path": str(best_model_path),
            "history": history,
        }
        with open(out_dir / "training_summary.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        return summary
