"""Expert and on-policy collection over the authoritative web bridge."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np
import torch
from torch import Tensor

from .bridge import (
    ActionMaskPlans,
    BoneyardRolloutBridge,
    RolloutState,
    RolloutTransition,
)
from .model import MainActionBatch, PolicyV5
from .spec import POLICY_SPEC

FEATURE = {name: index for index, name in enumerate(POLICY_SPEC.observation_names)}
ACTION_ORDER = ("movement", "target", "ability", "aim")


@dataclass(frozen=True)
class ExpertDataset:
    observations: np.ndarray
    masks: Mapping[str, np.ndarray]
    actions: Mapping[str, np.ndarray]

    def __len__(self) -> int:
        return self.observations.shape[0]

    def subset(self, indices: np.ndarray) -> "ExpertDataset":
        return ExpertDataset(
            observations=self.observations[indices],
            masks={name: value[indices] for name, value in self.masks.items()},
            actions={name: value[indices] for name, value in self.actions.items()},
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            path,
            observations=self.observations,
            **{f"mask_{name}": value for name, value in self.masks.items()},
            **{f"action_{name}": value for name, value in self.actions.items()},
        )

    @classmethod
    def load(cls, path: Path) -> "ExpertDataset":
        with np.load(path, allow_pickle=False) as archive:
            dataset = cls(
                observations=archive["observations"].copy(),
                masks={name: archive[f"mask_{name}"].copy() for name in ACTION_ORDER},
                actions={name: archive[f"action_{name}"].copy() for name in ACTION_ORDER},
            )
        validate_expert_dataset(dataset)
        return dataset


@dataclass(frozen=True)
class PolicyRollout:
    observations: np.ndarray
    masks: Mapping[str, np.ndarray]
    actions: Mapping[str, np.ndarray]
    old_log_probabilities: np.ndarray
    values: np.ndarray
    rewards: np.ndarray
    reward_terms: Mapping[str, np.ndarray]
    dones: np.ndarray
    ticks: np.ndarray
    next_values: np.ndarray
    choice_intervals: tuple[Mapping[str, Any], ...]
    completed_episodes: tuple[Mapping[str, Any], ...]


class SeedStream:
    def __init__(self, seed: int) -> None:
        self._next = int(seed) & 0xFFFF_FFFF

    def take(self) -> int:
        result = self._next
        self._next = (self._next + 1) & 0xFFFF_FFFF
        return result

    @property
    def next_seed(self) -> int:
        return self._next


def collect_expert_dataset(
    samples: int,
    *,
    worlds: int,
    worker_count: int,
    action_repeat: int,
    seed: int,
) -> ExpertDataset:
    if samples < 1 or worlds < 1 or worker_count < 1 or action_repeat < 1:
        raise ValueError("expert collection sizes must be positive")
    stream = SeedStream(seed)
    initial_seeds = [stream.take() for _ in range(worlds)]
    observations: list[np.ndarray] = []
    masks: dict[str, list[np.ndarray]] = {name: [] for name in ACTION_ORDER}
    actions: dict[str, list[int]] = {name: [] for name in ACTION_ORDER}
    idle_limit = max(worlds, round(samples * 0.10))
    idle_count = 0
    attempts = 0
    maximum_attempts = max(10_000, samples * 100)
    with BoneyardRolloutBridge(initial_seeds, worker_count=worker_count) as bridge:
        while len(observations) < samples:
            attempts += bridge.world_count
            if attempts > maximum_attempts:
                raise RuntimeError(
                    f"expert collection found only {len(observations)} useful rows "
                    f"within {maximum_attempts} authoritative decisions"
                )
            result = bridge.expert_step(ticks=action_repeat)
            transition = result.transition
            for world in range(bridge.world_count):
                observation = transition.observations[world]
                action = transition.actions[world]
                interesting = expert_row_is_interesting(observation, action)
                if not interesting and idle_count >= idle_limit:
                    continue
                if not interesting:
                    idle_count += 1
                observations.append(observation.copy())
                for name in ACTION_ORDER:
                    masks[name].append(transition.masks[name][world].astype(bool, copy=True))
                for column, name in enumerate(ACTION_ORDER):
                    actions[name].append(int(action[column]))
                if len(observations) >= samples:
                    break
            reset_seeds = [stream.take() if done else None for done in transition.dones]
            if any(seed_value is not None for seed_value in reset_seeds):
                bridge.reset(reset_seeds)
    dataset = ExpertDataset(
        observations=np.stack(observations),
        masks={name: np.stack(values) for name, values in masks.items()},
        actions={name: np.asarray(values, dtype=np.int64) for name, values in actions.items()},
    )
    validate_expert_dataset(dataset)
    return dataset


def expert_row_is_interesting(observation: np.ndarray, actions: np.ndarray) -> bool:
    return bool(
        observation[FEATURE["enemy_count_scaled"]] > 0
        or observation[FEATURE["hazard_count_scaled"]] > 0
        or observation[FEATURE["pickup_count_scaled"]] > 0
        or np.any(actions != 0)
    )


def split_expert_dataset(
    dataset: ExpertDataset,
    *,
    validation_fraction: float,
    rng: np.random.Generator,
) -> tuple[ExpertDataset, ExpertDataset]:
    if not 0 < validation_fraction < 1 or len(dataset) < 2:
        raise ValueError("expert split requires at least two rows and a fractional holdout")
    order = rng.permutation(len(dataset))
    validation_count = max(1, min(len(dataset) - 1, round(len(dataset) * validation_fraction)))
    return dataset.subset(order[validation_count:]), dataset.subset(order[:validation_count])


def collect_policy_rollout(
    policy: PolicyV5,
    bridge: BoneyardRolloutBridge,
    *,
    steps: int,
    action_repeat: int,
    generator: torch.Generator,
    seeds: SeedStream,
    episodes: "EpisodeLedger",
    deterministic: bool = False,
) -> PolicyRollout:
    if steps < 1 or action_repeat < 1:
        raise ValueError("rollout steps and action repeat must be positive")
    observations: list[np.ndarray] = []
    masks: dict[str, list[np.ndarray]] = {name: [] for name in ACTION_ORDER}
    actions: dict[str, list[np.ndarray]] = {name: [] for name in ACTION_ORDER}
    old_logs: list[np.ndarray] = []
    values: list[np.ndarray] = []
    rewards: list[np.ndarray] = []
    reward_terms: dict[str, list[np.ndarray]] = {
        name: [] for name in ("death", "ownDamage", "selfHp", "wave", "xp", "clampAdjustment")
    }
    dones: list[np.ndarray] = []
    ticks: list[np.ndarray] = []
    choice_intervals: list[Mapping[str, Any]] = []
    completed: list[Mapping[str, Any]] = []
    episodes.ensure_started(bridge.state)
    for _ in range(steps):
        before = bridge.state
        observation_tensor, plan_tensors = state_tensors(before, next(policy.parameters()).device)
        with torch.no_grad():
            selected = policy.act(
                observation_tensor,
                plan_tensors,
                deterministic=deterministic,
                generator=None if deterministic else generator,
            )
        packed_actions = np.stack(
            [selected.actions[name].cpu().numpy() for name in ACTION_ORDER], axis=1
        ).astype(np.uint8)
        result = bridge.step(packed_actions, ticks=action_repeat)
        transition = result.transition
        verify_policy_transition(before, transition, selected, packed_actions)
        observations.append(transition.observations.copy())
        for name in ACTION_ORDER:
            masks[name].append(selected.masks[name].cpu().numpy().astype(bool, copy=True))
            actions[name].append(selected.actions[name].cpu().numpy().astype(np.int64, copy=True))
        old_logs.append(selected.log_probability.cpu().numpy().copy())
        values.append(selected.value.cpu().numpy().copy())
        rewards.append(transition.rewards.copy())
        for name in ("death", "ownDamage", "selfHp", "wave", "xp"):
            reward_terms[name].append(transition.reward_terms[name].copy())
        reward_terms["clampAdjustment"].append(
            transition.rewards - transition.raw_rewards
        )
        dones.append(transition.dones.copy())
        ticks.append(transition.ticks.copy())
        choice_intervals.extend(transition.choice_intervals)
        completed.extend(episodes.observe(before, result.state, transition, packed_actions))
        reset_seeds = [seeds.take() if done else None for done in transition.dones]
        if any(seed_value is not None for seed_value in reset_seeds):
            reset_state = bridge.reset(reset_seeds)
            episodes.reset_worlds(reset_state, transition.dones)
    next_observations, _ = state_tensors(bridge.state, next(policy.parameters()).device)
    with torch.no_grad():
        next_values = policy.value(policy.encode(next_observations)).squeeze(-1).cpu().numpy()
    return PolicyRollout(
        observations=np.stack(observations),
        masks={name: np.stack(value) for name, value in masks.items()},
        actions={name: np.stack(value) for name, value in actions.items()},
        old_log_probabilities=np.stack(old_logs),
        values=np.stack(values),
        rewards=np.stack(rewards),
        reward_terms={name: np.stack(value) for name, value in reward_terms.items()},
        dones=np.stack(dones),
        ticks=np.stack(ticks),
        next_values=next_values,
        choice_intervals=tuple(choice_intervals),
        completed_episodes=tuple(completed),
    )


@dataclass
class EpisodeAccumulator:
    geometry_sha256: str
    run_id: str
    seed: int
    steps: int = 0
    simulation_ticks: int = 0
    episode_return: float = 0.0
    reward_terms: dict[str, float] = field(default_factory=lambda: {
        "xp": 0.0,
        "own_damage": 0.0,
        "self_hp": 0.0,
        "wave": 0.0,
        "death": 0.0,
        "clamp_adjustment": 0.0,
    })
    action_histograms: dict[str, list[int]] = field(default_factory=lambda: {
        "move": [0] * 9,
        "target": [0] * 9,
        "ability": [0] * 22,
        "aim": [0] * 9,
    })
    consumables_used: int = 0
    powerups_collected: int = 0
    keys_held_max: int = 0
    waves_reached: int = 0
    final_level: int = 1
    clamp_count: int = 0
    choice_events: list[dict[str, Any]] = field(default_factory=list)


class EpisodeLedger:
    def __init__(self) -> None:
        self._active: list[EpisodeAccumulator | None] = []

    def ensure_started(self, state: RolloutState) -> None:
        if not self._active:
            self._active = [new_episode(row) for row in state.metadata]

    def reset_worlds(self, state: RolloutState, reset_mask: np.ndarray) -> None:
        for world, reset in enumerate(reset_mask):
            if reset:
                self._active[world] = new_episode(state.metadata[world])

    def observe(
        self,
        before: RolloutState,
        after: RolloutState,
        transition: RolloutTransition,
        actions: np.ndarray,
    ) -> list[Mapping[str, Any]]:
        completed: list[Mapping[str, Any]] = []
        events_by_world: dict[int, list[Mapping[str, Any]]] = {}
        for event in transition.choice_events:
            events_by_world.setdefault(int(event["worldIndex"]), []).append(event)
        intervals_by_world: dict[int, list[Mapping[str, Any]]] = {}
        for interval in transition.choice_intervals:
            intervals_by_world.setdefault(int(interval["worldIndex"]), []).append(interval)
        for world, accumulator in enumerate(self._active):
            if accumulator is None:
                continue
            accumulator.steps += 1
            accumulator.simulation_ticks += int(transition.ticks[world])
            accumulator.episode_return += float(transition.rewards[world])
            accumulator.reward_terms["xp"] += float(transition.reward_terms["xp"][world])
            accumulator.reward_terms["own_damage"] += float(
                transition.reward_terms["ownDamage"][world]
            )
            accumulator.reward_terms["self_hp"] += float(transition.reward_terms["selfHp"][world])
            accumulator.reward_terms["wave"] += float(transition.reward_terms["wave"][world])
            accumulator.reward_terms["death"] += float(transition.reward_terms["death"][world])
            adjustment = float(transition.rewards[world] - transition.raw_rewards[world])
            accumulator.reward_terms["clamp_adjustment"] += adjustment
            accumulator.clamp_count += int(transition.reward_clamped[world])
            for column, name in enumerate(("move", "target", "ability", "aim")):
                accumulator.action_histograms[name][int(actions[world, column])] += 1
            accumulator.consumables_used += int(actions[world, 2] >= 10)
            previous = before.observations[world]
            current = after.observations[world]
            accumulator.powerups_collected += int(
                previous[FEATURE["self_damage_x4"]] < 0.5
                and current[FEATURE["self_damage_x4"]] >= 0.5
            )
            accumulator.keys_held_max = max(
                accumulator.keys_held_max,
                int(current[FEATURE["inventory_has_wizard_key"]] >= 0.5),
            )
            accumulator.waves_reached = max(
                accumulator.waves_reached,
                round(float(current[FEATURE["wave_scaled"]]) * 20),
            )
            accumulator.final_level = max(
                1, round(float(current[FEATURE["self_level_scaled"]]) * 75)
            )
            for event in events_by_world.get(world, []):
                accumulator.choice_events.append({
                    "accepted": bool(event.get("accepted")),
                    "chosen": int(event.get("selectedOption", -1)),
                    "interval_steps": None,
                    "options": list(event.get("optionIds", [])),
                    "trainable": bool(event.get("trainable")),
                })
            for interval in intervals_by_world.get(world, []):
                accumulator.choice_events.append({
                    "accepted": bool(interval.get("accepted")),
                    "chosen": int(interval.get("selectedOption", -1)),
                    "interval_steps": int(interval.get("durationSteps", 0)),
                    "options": list(interval.get("optionIds", [])),
                    "trainable": bool(interval.get("trainable")),
                })
            if transition.dones[world]:
                completed.append(episode_record(accumulator, aborted=False, error=None))
                self._active[world] = None
        return completed

    def aborted_records(self, reason: str) -> tuple[Mapping[str, Any], ...]:
        records = tuple(
            episode_record(accumulator, aborted=True, error=reason)
            for accumulator in self._active
            if accumulator is not None
        )
        self._active = []
        return records


def state_tensors(state: RolloutState, device: torch.device) -> tuple[Tensor, Mapping[str, Tensor]]:
    observations = torch.from_numpy(state.observations).to(device=device, dtype=torch.float32)
    return observations, {
        "movement": torch.from_numpy(state.plans.movement).to(device=device, dtype=torch.bool),
        "target": torch.from_numpy(state.plans.target).to(device=device, dtype=torch.bool),
        "ability_by_target": torch.from_numpy(state.plans.ability_by_target).to(
            device=device, dtype=torch.bool
        ),
        "aim_by_ability": torch.from_numpy(state.plans.aim_by_ability).to(
            device=device, dtype=torch.bool
        ),
    }


def verify_policy_transition(
    before: RolloutState,
    transition: RolloutTransition,
    selected: MainActionBatch,
    actions: np.ndarray,
) -> None:
    if not np.array_equal(before.observations, transition.observations):
        raise RuntimeError("rollout transition observation is misaligned")
    if not np.array_equal(actions, transition.actions):
        raise RuntimeError("rollout transition action is misaligned")
    for name in ACTION_ORDER:
        expected = selected.masks[name].cpu().numpy().astype(np.uint8)
        if not np.array_equal(expected, transition.masks[name]):
            raise RuntimeError(f"rollout transition {name} mask is misaligned")


def validate_expert_dataset(dataset: ExpertDataset) -> None:
    count = dataset.observations.shape[0]
    if dataset.observations.shape != (count, POLICY_SPEC.observation_size):
        raise ValueError("expert observations have the wrong shape")
    if not np.all(np.isfinite(dataset.observations)):
        raise ValueError("expert observations contain non-finite values")
    widths = {"movement": 9, "target": 9, "ability": 22, "aim": 9}
    for name, width in widths.items():
        mask = np.asarray(dataset.masks[name], dtype=bool)
        action = np.asarray(dataset.actions[name], dtype=np.int64)
        if mask.shape != (count, width) or action.shape != (count,):
            raise ValueError(f"expert {name} arrays have the wrong shape")
        if not np.all(np.any(mask, axis=1)) or not np.all(mask[np.arange(count), action]):
            raise ValueError(f"expert {name} contains an illegal label")


def expert_dataset_diagnostics(dataset: ExpertDataset) -> Mapping[str, Any]:
    validate_expert_dataset(dataset)
    interesting = np.asarray([
        expert_row_is_interesting(
            dataset.observations[index],
            np.asarray([dataset.actions[name][index] for name in ACTION_ORDER]),
        )
        for index in range(len(dataset))
    ])
    histograms = {
        name: np.bincount(dataset.actions[name], minlength=dataset.masks[name].shape[1]).tolist()
        for name in ACTION_ORDER
    }
    return {
        "interestingFraction": float(np.mean(interesting)),
        "enemyPresentFraction": float(np.mean(
            dataset.observations[:, FEATURE["enemy_count_scaled"]] > 0
        )),
        "actionHistograms": histograms,
        "uniqueActions": {
            name: int(np.count_nonzero(histogram)) for name, histogram in histograms.items()
        },
    }


def new_episode(value: Mapping[str, Any]) -> EpisodeAccumulator:
    return EpisodeAccumulator(
        geometry_sha256=str(value["geometrySha256"]),
        run_id=str(value["runId"]),
        seed=int(value["seed"]),
    )


def episode_record(
    accumulator: EpisodeAccumulator,
    *,
    aborted: bool,
    error: str | None,
) -> Mapping[str, Any]:
    return {
        "metrics_version": 5,
        "seed": accumulator.seed,
        "composition": "solo",
        "boneyard_layout": accumulator.geometry_sha256,
        "episode_id": accumulator.run_id,
        "waves_reached": accumulator.waves_reached,
        "steps": accumulator.steps,
        "simulation_ticks": accumulator.simulation_ticks,
        "return": accumulator.episode_return,
        "reward_terms": accumulator.reward_terms,
        "reward_clamp_count": accumulator.clamp_count,
        "action_histograms": accumulator.action_histograms,
        "consumables_used": accumulator.consumables_used,
        "powerups_collected": accumulator.powerups_collected,
        "keys_held_max": accumulator.keys_held_max,
        "death": accumulator.reward_terms["death"] < 0,
        "final_level": accumulator.final_level,
        "choice_events": accumulator.choice_events,
        "aborted": aborted,
        "error": error,
    }
