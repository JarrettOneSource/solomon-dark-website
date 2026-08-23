"""Append-only metric artifacts and deterministic evaluation statistics."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import numpy as np


def append_jsonl(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(value, allow_nan=False, separators=(",", ":"), sort_keys=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(payload + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def read_jsonl(path: Path) -> list[Mapping[str, Any]]:
    if not path.exists():
        return []
    result: list[Mapping[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            result.append(value)
    return result


def bootstrap_mean_interval(
    values: Sequence[float],
    *,
    seed: int,
    samples: int = 10_000,
) -> Mapping[str, float | int]:
    array = np.asarray(values, dtype=np.float64)
    if array.ndim != 1 or array.size == 0 or not np.all(np.isfinite(array)):
        raise ValueError("bootstrap interval requires finite scalar values")
    if samples < 1:
        raise ValueError("bootstrap sample count must be positive")
    rng = np.random.default_rng(seed)
    means = np.mean(rng.choice(array, size=(samples, array.size), replace=True), axis=1)
    return {
        "count": int(array.size),
        "mean": float(np.mean(array)),
        "lower95": float(np.quantile(means, 0.025)),
        "upper95": float(np.quantile(means, 0.975)),
    }


def paired_seed_comparison(
    incumbent: Sequence[float],
    candidate: Sequence[float],
) -> Mapping[str, float | int | bool]:
    first = np.asarray(incumbent, dtype=np.float64)
    second = np.asarray(candidate, dtype=np.float64)
    if first.shape != second.shape or first.ndim != 1 or first.size == 0:
        raise ValueError("paired comparison requires equal nonempty vectors")
    difference = second - first
    standard_error = float(np.std(difference, ddof=1) / math.sqrt(difference.size)) \
        if difference.size > 1 else 0.0
    mean = float(np.mean(difference))
    lower = mean - 1.96 * standard_error
    upper = mean + 1.96 * standard_error
    return {
        "count": int(difference.size),
        "meanDifference": mean,
        "standardError": standard_error,
        "lower95": lower,
        "upper95": upper,
        "candidateWins": lower > 0,
        "candidateRegresses": upper < 0,
    }


def promotion_decision(
    incumbent_train: Sequence[float],
    candidate_train: Sequence[float],
    incumbent_holdout: Sequence[float],
    candidate_holdout: Sequence[float],
) -> Mapping[str, Any]:
    train = paired_seed_comparison(incumbent_train, candidate_train)
    holdout = paired_seed_comparison(incumbent_holdout, candidate_holdout)
    promoted = bool(train["candidateWins"]) and not bool(holdout["candidateRegresses"])
    return {
        "promoted": promoted,
        "trainDistribution": train,
        "holdout": holdout,
        "rule": "paired train lower CI above zero with no holdout upper CI below zero",
    }


def aggregate_reward_terms(records: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for record in records:
        terms = record.get("reward_terms")
        if not isinstance(terms, Mapping):
            continue
        for name, value in terms.items():
            if isinstance(value, (int, float)) and math.isfinite(float(value)):
                totals[str(name)] = totals.get(str(name), 0.0) + float(value)
    return totals
