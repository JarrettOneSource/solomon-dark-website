"""Deterministic checkpoint ladder over identical headless seeds."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping, Sequence

import numpy as np

from .checkpoint import atomic_write
from .trainer import evaluate_policy


def checkpoint_arena(
    checkpoints: Mapping[str, Path],
    seeds: Sequence[int],
    *,
    workers: int,
    action_repeat: int,
    maximum_steps: int,
    output: Path,
) -> Mapping[str, object]:
    if len(checkpoints) < 2:
        raise ValueError("checkpoint arena requires at least two policies")
    entries = []
    for name, checkpoint in checkpoints.items():
        evaluation = evaluate_policy(
            checkpoint,
            seeds,
            workers=workers,
            action_repeat=action_repeat,
            maximum_steps=maximum_steps,
        )
        episodes = evaluation["episodes"]
        waves = np.asarray([episode["waves_reached"] for episode in episodes], dtype=np.float64)
        returns = np.asarray([episode["return"] for episode in episodes], dtype=np.float64)
        entries.append({
            "name": name,
            "checkpoint": str(checkpoint.resolve()),
            "completeEpisodes": evaluation["completeEpisodes"],
            "incompleteEpisodes": evaluation["incompleteEpisodes"],
            "meanWaveDepth": float(np.mean(waves)),
            "maximumWaveDepth": float(np.max(waves)),
            "meanReturn": float(np.mean(returns)),
            "enemyKills": int(sum(episode["enemy_kills"] for episode in episodes)),
            "wavesCompleted": int(sum(episode["waves_completed"] for episode in episodes)),
            "deaths": int(sum(bool(episode["death"]) for episode in episodes)),
            "evaluation": evaluation,
        })
    entries.sort(
        key=lambda entry: (entry["meanWaveDepth"], entry["meanReturn"]), reverse=True
    )
    report = {
        "arena_version": 7,
        "seeds": list(seeds),
        "maximumSteps": maximum_steps,
        "promotionScale": len(seeds) >= 30 and all(
            entry["incompleteEpisodes"] == 0 for entry in entries
        ),
        "ladder": entries,
        "winner": entries[0]["name"],
    }
    atomic_write(
        output,
        (json.dumps(report, indent=2, allow_nan=False, sort_keys=True) + "\n").encode(),
    )
    return report
