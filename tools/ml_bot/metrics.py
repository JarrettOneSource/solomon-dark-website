"""Append-only metric artifacts and deterministic evaluation statistics."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import hashlib
from typing import Any, Iterable, Mapping, Sequence

import numpy as np

from .checkpoint import MAGIC, load_checkpoint
from .spec import POLICY_SPEC


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


def checkpoint_promotion_eligible(metadata: Mapping[str, Any]) -> bool:
    eligibility = metadata.get("promotionEligible")
    if eligibility is not None and not isinstance(eligibility, bool):
        raise ValueError("checkpoint promotion eligibility must be boolean")
    training_kind = metadata.get("trainingKind")
    search_derived = any(str(key).startswith("lineSearch") for key in metadata) or (
        isinstance(training_kind, str) and "line-search" in training_kind
    )
    return eligibility is not False and not search_derived



def evaluation_checkpoint_identity(
    train_report: Mapping[str, Any],
    holdout_report: Mapping[str, Any],
    *,
    label: str,
    accepted_versions: Sequence[int] = (7,),
) -> Mapping[str, str]:
    if not accepted_versions or any(
        not isinstance(version, int) or isinstance(version, bool) or version < 1
        for version in accepted_versions
    ):
        raise ValueError("accepted evaluation versions must be positive integers")
    for report in (train_report, holdout_report):
        if report.get("evaluationVersion") not in accepted_versions:
            allowed = ", ".join(str(version) for version in accepted_versions)
            raise ValueError(f"{label} evaluation report version must be one of {allowed}")
    path = train_report.get("checkpoint")
    if not isinstance(path, str) or path != holdout_report.get("checkpoint"):
        raise ValueError(f"{label} train and holdout reports use different checkpoints")
    digest = train_report.get("checkpointSha256")
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or digest != holdout_report.get("checkpointSha256")
    ):
        raise ValueError(f"{label} train and holdout checkpoint hashes differ")
    checkpoint = Path(path)
    if not checkpoint.is_file():
        raise ValueError(f"{label} checkpoint no longer matches its evaluation reports")
    payload = checkpoint.read_bytes()
    if hashlib.sha256(payload).hexdigest() != digest:
        raise ValueError(f"{label} checkpoint no longer matches its evaluation reports")
    if payload.startswith(MAGIC) or any(
        report.get("evaluationVersion") == 7 for report in (train_report, holdout_report)
    ):
        metadata, _ = load_checkpoint(checkpoint)
        if not checkpoint_promotion_eligible(metadata):
            raise ValueError(f"{label} checkpoint metadata excludes it from promotion")
    return {"checkpoint": str(checkpoint.resolve()), "checkpointSha256": digest}


def episode_gameplay_summary(records: Iterable[Mapping[str, Any]]) -> Mapping[str, Any]:
    totals: dict[str, Any] = {
        "episode_records": 0,
        "decisions": 0,
        "simulation_ticks": 0,
        "deaths": 0,
        "enemy_kills": 0,
        "enemy_kills_by_kind": {},
        "waves_completed": 0,
        "potions_used": 0,
        "skill_picks": 0,
        "skill_choices_by_id": {},
        "skill_choice_modes": {},
        "spell_actions_by_skill_id": {},
        "maximum_equipped_skill_ranks": {},
        "primary_action_loadouts": {},
        "primary_loadouts": {},
        "gold_collected": 0.0,
        "items_collected": 0,
        "item_kinds": {},
        "health_orbs_collected": 0,
        "mana_orbs_collected": 0,
        "powerups_collected": 0,
    }
    for record in records:
        totals["episode_records"] += 1
        totals["decisions"] += int(record["steps"])
        totals["simulation_ticks"] += int(record["simulation_ticks"])
        totals["deaths"] += int(bool(record["death"]))
        for source, target in (
            ("enemy_kills", "enemy_kills"),
            ("waves_completed", "waves_completed"),
            ("consumables_used", "potions_used"),
            ("skill_picks", "skill_picks"),
            ("gold_collected", "gold_collected"),
            ("items_collected", "items_collected"),
            ("health_orbs_collected", "health_orbs_collected"),
            ("mana_orbs_collected", "mana_orbs_collected"),
            ("powerups_collected", "powerups_collected"),
        ):
            totals[target] += record[source]
        for source, target in (
            ("enemy_kills_by_kind", "enemy_kills_by_kind"),
            ("item_kinds", "item_kinds"),
            ("spell_actions_by_skill_id", "spell_actions_by_skill_id"),
        ):
            for name, count in record.get(source, {}).items():
                totals[target][name] = totals[target].get(name, 0) + int(count)
        for skill_id, rank in record.get("maximum_equipped_skill_ranks", {}).items():
            totals["maximum_equipped_skill_ranks"][skill_id] = max(
                int(rank),
                totals["maximum_equipped_skill_ranks"].get(skill_id, 0),
            )
        for choice in record.get("choice_events", []):
            if choice.get("interval_steps") is not None:
                continue
            skill_id = choice.get("chosen_skill")
            mode = choice.get("mode")
            if isinstance(skill_id, int):
                key = str(skill_id)
                totals["skill_choices_by_id"][key] = (
                    totals["skill_choices_by_id"].get(key, 0) + 1
                )
            if isinstance(mode, str):
                totals["skill_choice_modes"][mode] = (
                    totals["skill_choice_modes"].get(mode, 0) + 1
                )
        loadout_key = record.get("primary_loadout_key")
        if isinstance(loadout_key, str) and loadout_key:
            initial_actions = record.get("primary_actions_by_loadout", {}).get(
                loadout_key,
                {},
            )
            loadout = totals["primary_loadouts"].setdefault(loadout_key, {
                "continuousPrimaryCast": bool(record.get("continuous_primary_cast")),
                "deaths": 0,
                "enemyKills": 0,
                "episodes": 0,
                "maximumPrimaryCastRunTicks": 0,
                "primaryActionDecisions": 0,
                "primaryActionTicks": 0,
                "primaryCastRuns": 0,
                "primarySkillId": int(record.get("primary_skill_id", -1)),
                "wavesCompleted": 0,
                "wavesReached": 0,
                "weldBuildId": record.get("weld_build_id"),
            })
            if (
                loadout["continuousPrimaryCast"]
                != bool(record.get("continuous_primary_cast"))
                or loadout["primarySkillId"] != int(record.get("primary_skill_id", -1))
                or loadout["weldBuildId"] != record.get("weld_build_id")
            ):
                raise ValueError(f"primary loadout metadata changed for {loadout_key}")
            loadout["episodes"] += 1
            loadout["deaths"] += int(bool(record.get("death")))
            loadout["enemyKills"] += int(record.get("enemy_kills", 0))
            loadout["wavesCompleted"] += int(record.get("waves_completed", 0))
            loadout["wavesReached"] += int(record.get("waves_reached", 0))
            loadout["primaryActionDecisions"] += int(
                initial_actions.get("primaryActionDecisions", 0)
            )
            loadout["primaryActionTicks"] += int(initial_actions.get("primaryActionTicks", 0))
            loadout["primaryCastRuns"] += int(initial_actions.get("primaryCastRuns", 0))
            loadout["maximumPrimaryCastRunTicks"] = max(
                loadout["maximumPrimaryCastRunTicks"],
                int(initial_actions.get("maximumPrimaryCastRunTicks", 0)),
            )
        for action_key, actions in record.get("primary_actions_by_loadout", {}).items():
            target = totals["primary_action_loadouts"].setdefault(action_key, {
                "maximumPrimaryCastRunTicks": 0,
                "primaryActionDecisions": 0,
                "primaryActionTicks": 0,
                "primaryCastRuns": 0,
                "primarySkillId": int(actions["primarySkillId"]),
                "weldBuildId": actions.get("weldBuildId"),
            })
            if (
                target["primarySkillId"] != int(actions["primarySkillId"])
                or target["weldBuildId"] != actions.get("weldBuildId")
            ):
                raise ValueError(f"primary action identity changed for {action_key}")
            target["primaryActionDecisions"] += int(actions["primaryActionDecisions"])
            target["primaryActionTicks"] += int(actions["primaryActionTicks"])
            target["primaryCastRuns"] += int(actions["primaryCastRuns"])
            target["maximumPrimaryCastRunTicks"] = max(
                target["maximumPrimaryCastRunTicks"],
                int(actions["maximumPrimaryCastRunTicks"]),
            )
    totals["primary_action_loadouts"] = dict(sorted(totals["primary_action_loadouts"].items()))
    totals["primary_loadouts"] = dict(sorted(totals["primary_loadouts"].items()))
    return totals


def primary_curriculum_coverage(records: Sequence[Mapping[str, Any]]) -> Mapping[str, Any]:
    gameplay = episode_gameplay_summary(records)
    initial_loadouts = gameplay["primary_loadouts"]
    action_loadouts = gameplay["primary_action_loadouts"]
    expected = {str(row["key"]): row for row in POLICY_SPEC.primary_curriculum}
    missing = sorted(set(expected) - set(initial_loadouts))
    without_actions = sorted(
        key for key in expected
        if key not in action_loadouts or int(action_loadouts[key]["primaryActionDecisions"]) < 1
    )
    continuous_failures = sorted(
        key
        for key, contract in expected.items()
        if contract["castMode"] == "continuous"
        and (
            key not in action_loadouts
            or int(action_loadouts[key]["maximumPrimaryCastRunTicks"]) < 20
        )
    )
    return {
        "coverageVersion": 1,
        "expectedLoadouts": sorted(expected),
        "observedLoadouts": sorted(initial_loadouts),
        "actionLoadouts": sorted(action_loadouts),
        "missingLoadouts": missing,
        "loadoutsWithoutPrimaryActions": without_actions,
        "continuousCastFailures": continuous_failures,
        "minimumContinuousCastTicks": 20,
        "passed": not missing and not without_actions and not continuous_failures,
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


def training_summary(
    training_directory: Path,
    checkpoint: Path,
) -> Mapping[str, Any]:
    metrics = read_jsonl(training_directory / "metrics.jsonl")
    episodes = read_jsonl(training_directory / "episodes.jsonl")
    if not metrics:
        raise ValueError("training summary requires at least one metrics record")
    metadata, _tensors = load_checkpoint(checkpoint)
    last_metric = metrics[-1]
    if (
        int(metadata["trainedUpdates"]) != int(last_metric.get("iter", -1))
        or int(metadata["trainedEnvironmentSteps"])
        != int(last_metric.get("env_steps_total", -1))
    ):
        raise ValueError("training summary checkpoint does not match the latest metrics")
    gameplay: dict[str, Any] = {
        "enemy_kills": 0,
        "enemy_kills_by_kind": {},
        "waves_completed": 0,
        "potions_used": 0,
        "skill_picks": 0,
        "skill_choices_by_id": {},
        "spell_actions_by_skill_id": {},
        "maximum_equipped_skill_ranks": {},
        "gold_collected": 0.0,
        "items_collected": 0,
        "item_kinds": {},
        "health_orbs_collected": 0,
        "mana_orbs_collected": 0,
        "powerups_collected": 0,
    }
    for record in metrics:
        row = record.get("gameplay", {})
        for name in (
            "enemy_kills",
            "waves_completed",
            "potions_used",
            "skill_picks",
            "gold_collected",
            "items_collected",
            "health_orbs_collected",
            "mana_orbs_collected",
            "powerups_collected",
        ):
            gameplay[name] += row.get(name, 0)
        for name in ("enemy_kills_by_kind", "item_kinds"):
            for key, count in row.get(name, {}).items():
                gameplay[name][key] = gameplay[name].get(key, 0) + count
        for skill_id, count in record.get("smdp", {}).get("selected_skill_ids", {}).items():
            gameplay["skill_choices_by_id"][skill_id] = (
                gameplay["skill_choices_by_id"].get(skill_id, 0) + count
            )
        for skill_id, count in record.get("spell_actions_by_skill_id", {}).items():
            gameplay["spell_actions_by_skill_id"][skill_id] = (
                gameplay["spell_actions_by_skill_id"].get(skill_id, 0) + count
            )
        for skill_id, rank in record.get("maximum_equipped_skill_ranks", {}).items():
            gameplay["maximum_equipped_skill_ranks"][skill_id] = max(
                rank,
                gameplay["maximum_equipped_skill_ranks"].get(skill_id, 0),
            )
    completed = [episode for episode in episodes if episode.get("aborted") is False]
    episode_gameplay = episode_gameplay_summary(episodes)
    gameplay["primary_loadouts"] = episode_gameplay["primary_loadouts"]
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    return {
        "summary_version": 7,
        "checkpoint": str(checkpoint.resolve()),
        "checkpoint_sha256": digest,
        "checkpoint_bytes": checkpoint.stat().st_size,
        "updates": int(metadata["trainedUpdates"]),
        "metric_records": len(metrics),
        "trained_environment_steps": int(metadata["trainedEnvironmentSteps"]),
        "gameplay": gameplay,
        "episode_records": len(episodes),
        "complete_episodes": len(completed),
        "incomplete_episodes": len(episodes) - len(completed),
        "best_wave": max((episode["waves_reached"] for episode in completed), default=0),
        "best_return": max((episode["return"] for episode in completed), default=0.0),
        "maximum_kl": max(record.get("kl_divergence_max", 0.0) for record in metrics),
        "primary_curriculum_coverage": primary_curriculum_coverage(completed),
        "reward_clamp_adjustment": sum(
            record.get("reward_terms", {}).get("clamp_adjustment", 0.0)
            for record in metrics
        ),
    }
