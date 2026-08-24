"""Expert and on-policy collection over the authoritative web bridge."""

from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
import tempfile
from typing import Any, Callable, Mapping, Sequence

import numpy as np
import torch
from torch import Tensor

from .bridge import (
    ActionMaskPlans,
    BoneyardRolloutBridge,
    RolloutState,
    RolloutTransition,
)
from .model import MainActionBatch, PolicyV7
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
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{path.name}.", suffix=".npz", dir=path.parent
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                np.savez_compressed(
                    stream,
                    observations=self.observations,
                    **{f"mask_{name}": value for name, value in self.masks.items()},
                    **{f"action_{name}": value for name, value in self.actions.items()},
                )
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise

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
class ChoiceExpertDataset:
    observations: np.ndarray
    option_descriptors: np.ndarray
    option_ids: np.ndarray
    option_masks: np.ndarray
    selected_options: np.ndarray

    def __len__(self) -> int:
        return self.observations.shape[0]

    def subset(self, indices: np.ndarray) -> "ChoiceExpertDataset":
        return ChoiceExpertDataset(
            observations=self.observations[indices],
            option_descriptors=self.option_descriptors[indices],
            option_ids=self.option_ids[indices],
            option_masks=self.option_masks[indices],
            selected_options=self.selected_options[indices],
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{path.name}.", suffix=".npz", dir=path.parent
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                np.savez_compressed(
                    stream,
                    observations=self.observations,
                    option_descriptors=self.option_descriptors,
                    option_ids=self.option_ids,
                    option_masks=self.option_masks,
                    selected_options=self.selected_options,
                )
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise

    @classmethod
    def load(cls, path: Path) -> "ChoiceExpertDataset":
        with np.load(path, allow_pickle=False) as archive:
            dataset = cls(
                observations=archive["observations"].copy(),
                option_descriptors=archive["option_descriptors"].copy(),
                option_ids=archive["option_ids"].copy(),
                option_masks=archive["option_masks"].copy(),
                selected_options=archive["selected_options"].copy(),
            )
        validate_choice_expert_dataset(dataset)
        return dataset


@dataclass(frozen=True)
class PolicyRollout:
    initial_metadata: tuple[Mapping[str, Any], ...]
    observations: np.ndarray
    masks: Mapping[str, np.ndarray]
    actions: Mapping[str, np.ndarray]
    old_log_probabilities: np.ndarray
    values: np.ndarray
    rewards: np.ndarray
    gameplay_counters: tuple[tuple[Mapping[str, Any], ...], ...]
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


def collect_choice_expert_dataset(
    samples: int,
    *,
    worlds: int,
    worker_count: int,
    action_repeat: int,
    seed: int,
    progress: Callable[[Mapping[str, Any]], None] | None = None,
) -> ChoiceExpertDataset:
    if samples < 1 or worlds < 1 or worker_count < 1 or action_repeat < 1:
        raise ValueError("choice expert collection sizes must be positive")
    stream = SeedStream(seed)
    initial_seeds = [stream.take() for _ in range(worlds)]
    observations: list[np.ndarray] = []
    descriptors: list[np.ndarray] = []
    option_ids: list[np.ndarray] = []
    masks: list[np.ndarray] = []
    selected: list[int] = []
    attempts = 0
    maximum_attempts = max(10_000, samples * 1_000)
    next_progress_count = min(16, samples)
    with BoneyardRolloutBridge(initial_seeds, worker_count=worker_count) as bridge:
        while len(observations) < samples:
            attempts += bridge.world_count
            if attempts > maximum_attempts:
                raise RuntimeError(
                    f"choice expert collection found only {len(observations)} events "
                    f"within {maximum_attempts} authoritative decisions"
                )
            result = bridge.expert_step(ticks=action_repeat)
            for event in result.transition.choice_events:
                if event.get("choiceMode") != "scripted" or event.get("accepted") is not True:
                    continue
                observations.append(np.asarray(event["observation"], dtype=np.float32).copy())
                descriptors.append(
                    np.asarray(event["optionDescriptors"], dtype=np.float32).copy()
                )
                option_ids.append(np.asarray(event["optionIds"], dtype=np.int64).copy())
                masks.append(np.asarray(event["optionMask"], dtype=bool).copy())
                selected.append(int(event["selectedOption"]))
                if progress is not None and len(observations) >= next_progress_count:
                    progress({
                        "authoritativeDecisions": attempts,
                        "collectedChoices": len(observations),
                        "requestedChoices": samples,
                    })
                    next_progress_count = min(samples, next_progress_count + 16)
                if len(observations) >= samples:
                    break
            reset_seeds = [stream.take() if done else None for done in result.transition.dones]
            if any(seed_value is not None for seed_value in reset_seeds):
                bridge.reset(reset_seeds)
    option_count = max(row.shape[0] for row in descriptors)
    packed_descriptors = np.zeros(
        (samples, option_count, POLICY_SPEC.option_descriptor_size), dtype=np.float32
    )
    packed_ids = np.full((samples, option_count), -1, dtype=np.int64)
    packed_masks = np.zeros((samples, option_count), dtype=bool)
    for index, row in enumerate(descriptors):
        count = row.shape[0]
        packed_descriptors[index, :count] = row
        packed_ids[index, :count] = option_ids[index]
        packed_masks[index, :count] = masks[index]
    dataset = ChoiceExpertDataset(
        observations=np.stack(observations),
        option_descriptors=packed_descriptors,
        option_ids=packed_ids,
        option_masks=packed_masks,
        selected_options=np.asarray(selected, dtype=np.int64),
    )
    validate_choice_expert_dataset(dataset)
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


def split_choice_expert_dataset(
    dataset: ChoiceExpertDataset,
    *,
    validation_fraction: float,
    rng: np.random.Generator,
) -> tuple[ChoiceExpertDataset, ChoiceExpertDataset]:
    if not 0 < validation_fraction < 1 or len(dataset) < 2:
        raise ValueError("choice expert split requires at least two rows and a fractional holdout")
    order = rng.permutation(len(dataset))
    validation_count = max(1, min(len(dataset) - 1, round(len(dataset) * validation_fraction)))
    return dataset.subset(order[validation_count:]), dataset.subset(order[:validation_count])


def collect_policy_rollout(
    policy: PolicyV7,
    bridge: BoneyardRolloutBridge,
    *,
    steps: int,
    action_repeat: int,
    generator: torch.Generator,
    seeds: SeedStream,
    episodes: "EpisodeLedger",
    deterministic: bool = False,
    choice_temperature: float = 1.25,
) -> PolicyRollout:
    if steps < 1 or action_repeat < 1:
        raise ValueError("rollout steps and action repeat must be positive")
    initial_metadata = bridge.state.metadata
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
    gameplay_counters: list[tuple[Mapping[str, Any], ...]] = []
    completed: list[Mapping[str, Any]] = []
    episodes.ensure_started(bridge.state)
    for _ in range(steps):
        resolve_policy_choices(
            policy,
            bridge,
            temperature=choice_temperature,
            deterministic=deterministic,
            generator=generator,
        )
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
        gameplay_counters.append(transition.gameplay_counters)
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
    resolve_policy_choices(
        policy,
        bridge,
        temperature=choice_temperature,
        deterministic=deterministic,
        generator=generator,
    )
    next_observations, _ = state_tensors(bridge.state, next(policy.parameters()).device)
    with torch.no_grad():
        next_values = policy.value(policy.encode(next_observations)).squeeze(-1).cpu().numpy()
    return PolicyRollout(
        initial_metadata=initial_metadata,
        observations=np.stack(observations),
        masks={name: np.stack(value) for name, value in masks.items()},
        actions={name: np.stack(value) for name, value in actions.items()},
        old_log_probabilities=np.stack(old_logs),
        values=np.stack(values),
        rewards=np.stack(rewards),
        gameplay_counters=tuple(gameplay_counters),
        reward_terms={name: np.stack(value) for name, value in reward_terms.items()},
        dones=np.stack(dones),
        ticks=np.stack(ticks),
        next_values=next_values,
        choice_intervals=tuple(choice_intervals),
        completed_episodes=tuple(completed),
    )


def resolve_policy_choices(
    policy: PolicyV7,
    bridge: BoneyardRolloutBridge,
    *,
    temperature: float,
    deterministic: bool,
    generator: torch.Generator | None = None,
) -> None:
    if not np.isfinite(temperature) or temperature <= 0:
        raise ValueError("choice temperature must be positive and finite")
    device = next(policy.parameters()).device
    for _ in range(100):
        if all(plan is None for plan in bridge.state.choices):
            return
        choices: list[Mapping[str, int | float] | None] = []
        for plan in bridge.state.choices:
            if plan is None:
                choices.append(None)
                continue
            observations = torch.from_numpy(plan.observation[None, :]).to(
                device=device, dtype=torch.float32
            )
            descriptors = torch.from_numpy(plan.option_descriptors[None, :, :]).to(
                device=device, dtype=torch.float32
            )
            mask = torch.from_numpy(plan.option_mask[None, :]).to(
                device=device, dtype=torch.bool
            )
            with torch.no_grad():
                selected, evaluation = policy.select_choice(
                    observations,
                    descriptors,
                    mask,
                    temperature=temperature,
                    deterministic=deterministic,
                    generator=None if deterministic else generator,
                )
            choices.append({
                "oldLogProbability": float(evaluation.log_probability[0].cpu()),
                "oldValue": float(evaluation.value[0].cpu()),
                "selectedOption": int(selected[0].cpu()),
            })
        bridge.select_choices(choices)
    raise RuntimeError("learned choice resolution did not settle")


@dataclass
class EpisodeAccumulator:
    continuous_primary_cast: bool
    geometry_sha256: str
    primary_loadout_key: str
    primary_skill_id: int
    run_id: str
    seed: int
    weld_build_id: int | None
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
    spell_actions_by_skill_id: dict[str, int] = field(default_factory=dict)
    primary_actions_by_loadout: dict[str, dict[str, int]] = field(default_factory=dict)
    active_primary_cast_loadout: str | None = None
    active_primary_cast_run_ticks: int = 0
    maximum_equipped_skill_ranks: dict[str, int] = field(default_factory=dict)
    consumables_used: int = 0
    enemy_kills: int = 0
    enemy_kills_by_kind: dict[str, int] = field(default_factory=dict)
    gold_collected: float = 0.0
    health_orbs_collected: int = 0
    item_kinds: dict[str, int] = field(default_factory=dict)
    items_collected: int = 0
    mana_orbs_collected: int = 0
    powerups_collected: int = 0
    skill_picks: int = 0
    waves_completed: int = 0
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
            observation = before.observations[world]
            skill_id = spell_action_skill_id(observation, int(actions[world, 2]))
            if skill_id is not None:
                key = str(skill_id)
                accumulator.spell_actions_by_skill_id[key] = (
                    accumulator.spell_actions_by_skill_id.get(key, 0) + 1
                )
            if int(actions[world, 2]) == 1:
                observe_primary_action(
                    accumulator,
                    observation,
                    int(transition.ticks[world]),
                )
            else:
                close_primary_cast_run(accumulator)
            for equipped_id, rank in equipped_skill_ranks(observation).items():
                key = str(equipped_id)
                accumulator.maximum_equipped_skill_ranks[key] = max(
                    rank,
                    accumulator.maximum_equipped_skill_ranks.get(key, 0),
                )
            gameplay = transition.gameplay_counters[world]
            accumulator.consumables_used += int(gameplay["potionsUsed"])
            accumulator.enemy_kills += int(gameplay["enemyKills"])
            add_counts(accumulator.enemy_kills_by_kind, gameplay["enemyKillsByKind"])
            accumulator.gold_collected += float(gameplay["goldCollected"])
            accumulator.health_orbs_collected += int(gameplay["healthOrbsCollected"])
            accumulator.items_collected += int(gameplay["itemsCollected"])
            add_counts(accumulator.item_kinds, gameplay["itemKinds"])
            accumulator.mana_orbs_collected += int(gameplay["manaOrbsCollected"])
            accumulator.powerups_collected += int(gameplay["powerupsCollected"])
            accumulator.skill_picks += int(gameplay["skillPicks"])
            accumulator.waves_completed += int(gameplay["wavesCompleted"])
            current = after.observations[world]
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
                selected_option = int(event.get("selectedOption", -1))
                option_ids = list(event.get("optionIds", []))
                accumulator.choice_events.append({
                    "accepted": bool(event.get("accepted")),
                    "chosen": selected_option,
                    "chosen_skill": option_ids[selected_option]
                    if 0 <= selected_option < len(option_ids) else None,
                    "interval_steps": None,
                    "mode": event.get("choiceMode"),
                    "options": option_ids,
                    "trainable": bool(event.get("trainable")),
                })
            for interval in intervals_by_world.get(world, []):
                selected_option = int(interval.get("selectedOption", -1))
                option_ids = list(interval.get("optionIds", []))
                accumulator.choice_events.append({
                    "accepted": bool(interval.get("accepted")),
                    "chosen": selected_option,
                    "chosen_skill": option_ids[selected_option]
                    if 0 <= selected_option < len(option_ids) else None,
                    "interval_steps": int(interval.get("durationSteps", 0)),
                    "mode": interval.get("choiceMode"),
                    "options": option_ids,
                    "trainable": bool(interval.get("trainable")),
                })
            if transition.dones[world]:
                completed.append(episode_record(accumulator, aborted=False, error=None))
                self._active[world] = None
        return completed

    def aborted_records(self, reason: str) -> tuple[Mapping[str, Any], ...]:
        return tuple(self.abort_worlds(
            np.asarray([accumulator is not None for accumulator in self._active]),
            reason,
        ))

    def abort_worlds(
        self,
        mask: np.ndarray,
        reason: str,
    ) -> list[Mapping[str, Any]]:
        if mask.shape != (len(self._active),):
            raise ValueError("episode abort mask does not match world count")
        records: list[Mapping[str, Any]] = []
        for world, abort in enumerate(mask):
            accumulator = self._active[world]
            if not abort or accumulator is None:
                continue
            records.append(episode_record(accumulator, aborted=True, error=reason))
            self._active[world] = None
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


def validate_choice_expert_dataset(dataset: ChoiceExpertDataset) -> None:
    count = len(dataset)
    if dataset.observations.shape != (count, POLICY_SPEC.observation_size):
        raise ValueError("choice expert observations have the wrong shape")
    if (
        dataset.option_descriptors.ndim != 3
        or dataset.option_descriptors.shape[0] != count
        or dataset.option_descriptors.shape[2] != POLICY_SPEC.option_descriptor_size
    ):
        raise ValueError("choice expert descriptors have the wrong shape")
    option_count = dataset.option_descriptors.shape[1]
    if (
        dataset.option_ids.shape != (count, option_count)
        or dataset.option_masks.shape != (count, option_count)
        or dataset.selected_options.shape != (count,)
    ):
        raise ValueError("choice expert option arrays have the wrong shape")
    if not np.all(np.isfinite(dataset.observations)) or not np.all(
        np.isfinite(dataset.option_descriptors)
    ):
        raise ValueError("choice expert dataset contains non-finite values")
    masks = np.asarray(dataset.option_masks, dtype=bool)
    selected = np.asarray(dataset.selected_options, dtype=np.int64)
    if (
        not np.all(np.any(masks, axis=1))
        or np.any(selected < 0)
        or np.any(selected >= option_count)
        or not np.all(masks[np.arange(count), selected])
        or np.any(dataset.option_ids[masks] < 0)
        or np.any(dataset.option_ids[~masks] != -1)
    ):
        raise ValueError("choice expert dataset contains an illegal label")


def choice_expert_dataset_diagnostics(dataset: ChoiceExpertDataset) -> Mapping[str, Any]:
    validate_choice_expert_dataset(dataset)
    selected_skill_ids = dataset.option_ids[
        np.arange(len(dataset)), dataset.selected_options
    ]
    offered = dataset.option_ids[dataset.option_masks]
    option_counts = np.sum(dataset.option_masks, axis=1)
    primary_rows: dict[str, int] = {}
    for observation in dataset.observations:
        key = equipped_primary_loadout_key(observation)
        primary_rows[key] = primary_rows.get(key, 0) + 1
    return {
        "optionCountHistogram": {
            str(count): int(np.count_nonzero(option_counts == count))
            for count in np.unique(option_counts)
        },
        "selectedOptionHistogram": np.bincount(
            dataset.selected_options,
            minlength=dataset.option_masks.shape[1],
        ).tolist(),
        "selectedSkillHistogram": {
            str(skill_id): int(np.count_nonzero(selected_skill_ids == skill_id))
            for skill_id in np.unique(selected_skill_ids)
        },
        "uniqueOfferedSkills": int(np.unique(offered).size),
        "uniqueSelectedSkills": int(np.unique(selected_skill_ids).size),
        "primaryLoadoutRows": dict(sorted(primary_rows.items())),
    }


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
    primary_rows: dict[str, int] = {}
    primary_actions: dict[str, int] = {}
    for index, observation in enumerate(dataset.observations):
        key = equipped_primary_loadout_key(observation)
        primary_rows[key] = primary_rows.get(key, 0) + 1
        if int(dataset.actions["ability"][index]) == 1:
            primary_actions[key] = primary_actions.get(key, 0) + 1
    return {
        "interestingFraction": float(np.mean(interesting)),
        "enemyPresentFraction": float(np.mean(
            dataset.observations[:, FEATURE["enemy_count_scaled"]] > 0
        )),
        "actionHistograms": histograms,
        "uniqueActions": {
            name: int(np.count_nonzero(histogram)) for name, histogram in histograms.items()
        },
        "primaryLoadoutRows": dict(sorted(primary_rows.items())),
        "primaryActionsByLoadout": dict(sorted(primary_actions.items())),
    }


def new_episode(value: Mapping[str, Any]) -> EpisodeAccumulator:
    return EpisodeAccumulator(
        continuous_primary_cast=bool(value["continuousPrimaryCast"]),
        geometry_sha256=str(value["geometrySha256"]),
        primary_loadout_key=str(value["primaryLoadoutKey"]),
        primary_skill_id=int(value["primarySkillId"]),
        run_id=str(value["runId"]),
        seed=int(value["seed"]),
        weld_build_id=None if value["weldBuildId"] is None else int(value["weldBuildId"]),
    )


def episode_record(
    accumulator: EpisodeAccumulator,
    *,
    aborted: bool,
    error: str | None,
) -> Mapping[str, Any]:
    primary_actions = primary_action_records(accumulator)
    initial_primary = primary_actions.get(accumulator.primary_loadout_key, {})
    return {
        "metrics_version": 7,
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
        "spell_actions_by_skill_id": accumulator.spell_actions_by_skill_id,
        "primary_loadout_key": accumulator.primary_loadout_key,
        "primary_skill_id": accumulator.primary_skill_id,
        "weld_build_id": accumulator.weld_build_id,
        "continuous_primary_cast": accumulator.continuous_primary_cast,
        "primary_actions_by_loadout": primary_actions,
        "primary_action_decisions": int(initial_primary.get("primaryActionDecisions", 0)),
        "primary_action_ticks": int(initial_primary.get("primaryActionTicks", 0)),
        "primary_cast_runs": int(initial_primary.get("primaryCastRuns", 0)),
        "maximum_primary_cast_run_ticks": int(
            initial_primary.get("maximumPrimaryCastRunTicks", 0)
        ),
        "maximum_equipped_skill_ranks": accumulator.maximum_equipped_skill_ranks,
        "consumables_used": accumulator.consumables_used,
        "enemy_kills": accumulator.enemy_kills,
        "enemy_kills_by_kind": accumulator.enemy_kills_by_kind,
        "gold_collected": accumulator.gold_collected,
        "health_orbs_collected": accumulator.health_orbs_collected,
        "items_collected": accumulator.items_collected,
        "item_kinds": accumulator.item_kinds,
        "mana_orbs_collected": accumulator.mana_orbs_collected,
        "powerups_collected": accumulator.powerups_collected,
        "skill_picks": accumulator.skill_picks,
        "waves_completed": accumulator.waves_completed,
        "keys_held_max": accumulator.keys_held_max,
        "death": accumulator.reward_terms["death"] < 0,
        "final_level": accumulator.final_level,
        "choice_events": accumulator.choice_events,
        "aborted": aborted,
        "error": error,
}


def observe_primary_action(
    accumulator: EpisodeAccumulator,
    observation: np.ndarray,
    action_ticks: int,
) -> None:
    loadout_key = equipped_primary_loadout_key(observation)
    if accumulator.active_primary_cast_loadout not in (None, loadout_key):
        close_primary_cast_run(accumulator)
    skill_id = equipped_skill_id(observation, "equipped_primary")
    if skill_id is None:
        raise ValueError("primary action has no equipped identity")
    weld_build_id = None if skill_id != 52 else observation_unsigned_identity(
        observation,
        "equipped_primary",
        "weld_build_id",
    )
    row = accumulator.primary_actions_by_loadout.setdefault(loadout_key, {
        "maximumPrimaryCastRunTicks": 0,
        "primaryActionDecisions": 0,
        "primaryActionTicks": 0,
        "primaryCastRuns": 0,
        "primarySkillId": skill_id,
        "weldBuildId": -1 if weld_build_id is None else weld_build_id,
    })
    if (
        row["primarySkillId"] != skill_id
        or row["weldBuildId"] != (-1 if weld_build_id is None else weld_build_id)
    ):
        raise ValueError(f"primary loadout identity changed for {loadout_key}")
    accumulator.active_primary_cast_loadout = loadout_key
    accumulator.active_primary_cast_run_ticks += action_ticks
    row["primaryActionDecisions"] += 1
    row["primaryActionTicks"] += action_ticks
    row["maximumPrimaryCastRunTicks"] = max(
        row["maximumPrimaryCastRunTicks"],
        accumulator.active_primary_cast_run_ticks,
    )


def close_primary_cast_run(accumulator: EpisodeAccumulator) -> None:
    key = accumulator.active_primary_cast_loadout
    if key is not None and accumulator.active_primary_cast_run_ticks > 0:
        accumulator.primary_actions_by_loadout[key]["primaryCastRuns"] += 1
    accumulator.active_primary_cast_loadout = None
    accumulator.active_primary_cast_run_ticks = 0


def primary_action_records(accumulator: EpisodeAccumulator) -> Mapping[str, Mapping[str, Any]]:
    result = {
        key: {
            **row,
            "weldBuildId": None if row["weldBuildId"] < 0 else row["weldBuildId"],
        }
        for key, row in accumulator.primary_actions_by_loadout.items()
    }
    active = accumulator.active_primary_cast_loadout
    if active is not None and accumulator.active_primary_cast_run_ticks > 0:
        result[active] = {
            **result[active],
            "primaryCastRuns": int(result[active]["primaryCastRuns"]) + 1,
        }
    return dict(sorted(result.items()))


def add_counts(target: dict[str, int], source: Mapping[str, Any]) -> None:
    for name, value in source.items():
        target[str(name)] = target.get(str(name), 0) + int(value)


def spell_action_summary(
    observations: np.ndarray,
    ability_actions: np.ndarray,
) -> Mapping[str, int]:
    if observations.shape[:2] != ability_actions.shape:
        raise ValueError("spell action observations and actions do not align")
    result: dict[str, int] = {}
    for step in range(ability_actions.shape[0]):
        for world in range(ability_actions.shape[1]):
            skill_id = spell_action_skill_id(
                observations[step, world],
                int(ability_actions[step, world]),
            )
            if skill_id is not None:
                key = str(skill_id)
                result[key] = result.get(key, 0) + 1
    return result


def equipped_skill_rank_summary(observations: np.ndarray) -> Mapping[str, int]:
    result: dict[str, int] = {}
    for observation in observations.reshape(-1, observations.shape[-1]):
        for skill_id, rank in equipped_skill_ranks(observation).items():
            key = str(skill_id)
            result[key] = max(rank, result.get(key, 0))
    return result


def spell_action_skill_id(observation: np.ndarray, ability_action: int) -> int | None:
    if ability_action == 1:
        return equipped_skill_id(observation, "equipped_primary")
    if 2 <= ability_action <= 9:
        return equipped_skill_id(observation, f"equipped_secondary_{ability_action - 1}")
    return None


def equipped_skill_ranks(observation: np.ndarray) -> Mapping[int, int]:
    result: dict[int, int] = {}
    for prefix in (
        "equipped_primary",
        *(f"equipped_secondary_{slot}" for slot in range(1, 9)),
    ):
        skill_id = equipped_skill_id(observation, prefix)
        if skill_id is None:
            continue
        rank = round(
            float(observation[FEATURE[f"{prefix}_effective_rank_scaled"]])
            * POLICY_SPEC.scales["skillRank"]
        )
        result[skill_id] = max(rank, result.get(skill_id, 0))
    return result


def equipped_skill_id(observation: np.ndarray, prefix: str) -> int | None:
    if float(observation[FEATURE[f"{prefix}_present"]]) < 0.5:
        return None
    return observation_unsigned_identity(observation, prefix, "skill_id")


def equipped_primary_loadout_key(observation: np.ndarray) -> str:
    skill_id = equipped_skill_id(observation, "equipped_primary")
    if skill_id is None:
        raise ValueError("equipped primary loadout is absent")
    if skill_id != 52:
        return f"primary:{skill_id}"
    build_id = observation_unsigned_identity(
        observation,
        "equipped_primary",
        "weld_build_id",
    )
    return f"weld:{build_id}"


def observation_unsigned_identity(
    observation: np.ndarray,
    prefix: str,
    field: str,
) -> int:
    result = 0
    for bit in range(16):
        value = float(observation[FEATURE[f"{prefix}_{field}_bit_{bit}"]])
        if value not in (0.0, 1.0):
            raise ValueError(f"{prefix} {field} bit {bit} is not binary")
        result |= int(value) << bit
    return result
