"""Deterministic representation-level behavior scorecard over web expert states."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import torch

from .checkpoint import atomic_write, load_checkpoint
from .model import PolicyV5
from .optimization import classification_accuracy
from .rollouts import ACTION_ORDER, ExpertDataset, expert_tensors
from .spec import POLICY_SPEC

FEATURE = {name: index for index, name in enumerate(POLICY_SPEC.observation_names)}


def behavior_probe_scorecard(
    checkpoint: Path,
    dataset_path: Path,
    output: Path,
) -> Mapping[str, Any]:
    _metadata, tensors = load_checkpoint(checkpoint)
    policy = PolicyV5()
    policy.load_tensors(tensors)
    policy.eval()
    dataset = ExpertDataset.load(dataset_path)
    observations = dataset.observations
    selectors = {
        "combat-target": observations[:, FEATURE["enemy_count_scaled"]] > 0,
        "hazard-exit": observations[:, FEATURE["hazard_count_scaled"]] > 0,
        "potion": dataset.actions["ability"] >= 10,
        "aim-lead": dataset.actions["aim"] > 0,
        "combat-cast": (
            (observations[:, FEATURE["enemy_count_scaled"]] > 0)
            & (dataset.actions["ability"] > 0)
            & (dataset.actions["ability"] < 10)
        ),
        "no-target-idle": observations[:, FEATURE["enemy_count_scaled"]] == 0,
    }
    focus = {
        "combat-target": ("target_accuracy", 0.55),
        "hazard-exit": ("movement_accuracy", 0.50),
        "potion": ("ability_accuracy", 0.70),
        "aim-lead": ("aim_accuracy", 0.70),
        "combat-cast": ("ability_accuracy", 0.55),
        "no-target-idle": ("ability_accuracy", 0.90),
    }
    probes: dict[str, Mapping[str, Any]] = {}
    for name, selector in selectors.items():
        indices = np.flatnonzero(selector)
        if indices.size == 0:
            probes[name] = {
                "count": 0,
                "status": "missing",
                "passed": False,
                "metric": focus[name][0],
                "minimum": focus[name][1],
                "actual": None,
            }
            continue
        subset = dataset.subset(indices)
        tensors_for_probe = expert_tensors(subset, torch.device("cpu"))
        with torch.no_grad():
            accuracies = classification_accuracy(policy, *tensors_for_probe)
        metric, minimum = focus[name]
        actual = accuracies[metric]
        probes[name] = {
            "count": int(indices.size),
            "status": "measured",
            "passed": actual >= minimum,
            "metric": metric,
            "minimum": minimum,
            "actual": actual,
            "accuracies": accuracies,
        }
    report = {
        "probe_version": 5,
        "checkpoint": str(checkpoint.resolve()),
        "dataset": str(dataset_path.resolve()),
        "passed": all(bool(value["passed"]) for value in probes.values()),
        "probes": probes,
    }
    atomic_write(
        output,
        (json.dumps(report, allow_nan=False, indent=2, sort_keys=True) + "\n").encode(),
    )
    return report
