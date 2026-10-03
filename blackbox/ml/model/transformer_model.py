"""Pretrained Transformer architecture for step-level root-cause failure localization."""
from __future__ import annotations

import torch
import torch.nn as nn
from transformers import AutoConfig, AutoModel


class StepFailureClassifier(nn.Module):
    """Transformer encoder with binary classification head predicting P(failure-causing step)."""

    def __init__(
        self,
        pretrained_model_name: str = "distilbert-base-uncased",
        dropout_prob: float = 0.2,
        freeze_encoder_layers: int = 0,
    ):
        super().__init__()
        self.config = AutoConfig.from_pretrained(pretrained_model_name)
        self.encoder = AutoModel.from_pretrained(pretrained_model_name)

        # Optionally freeze lower layers for fast, stable CPU training
        if freeze_encoder_layers > 0 and hasattr(self.encoder, "transformer"):
            layers = self.encoder.transformer.layer
            for layer in layers[:freeze_encoder_layers]:
                for param in layer.parameters():
                    param.requires_grad = False

        hidden_size = self.config.hidden_size
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_prob),
            nn.Linear(hidden_size, 128),
            nn.ReLU(),
            nn.Dropout(dropout_prob / 2.0),
            nn.Linear(128, 1),
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """Forward pass returning scalar logits for each step."""
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        # Pool: use first token representation ([CLS])
        cls_rep = outputs.last_hidden_state[:, 0, :]
        logits = self.classifier(cls_rep).squeeze(-1)
        return logits

    def predict_proba(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """Compute calibrated probabilities in [0, 1]."""
        with torch.no_grad():
            logits = self.forward(input_ids, attention_mask)
            return torch.sigmoid(logits)
