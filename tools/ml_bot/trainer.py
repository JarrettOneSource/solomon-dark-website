"""End-to-end bootstrap, PPO campaign, checkpointing, and frozen evaluation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import io
import json
import math
from pathlib import Path
import time
from typing import Any, Mapping, Sequence

import numpy as np
import torch

from .advantages import (
    RunningReturnNormalizer,
    normalized_main_advantages,
    smdp_choice_advantages,
)
from .bridge import BoneyardRolloutBridge
from .checkpoint import atomic_write, load_checkpoint, save_checkpoint
from .metrics import append_jsonl, bootstrap_mean_interval
from .model import PolicyV5
from .optimization import (
    ChoiceCoverage,
    behavior_clone,
    choice_ppo_epochs,
    classification_accuracy,
    mean_metrics,
    ppo_epochs,
)
from .rollouts import (
    ACTION_ORDER,
    FEATURE,
    EpisodeLedger,
    ExpertDataset,
    SeedStream,
    collect_expert_dataset,
    collect_policy_rollout,
    split_expert_dataset,
    state_tensors,
)
from .spec import POLICY_SPEC


@dataclass(frozen=True)
class BootstrapConfiguration:
    samples: int = 6_000
    epochs: int = 20
    batch_size: int = 128
    learning_rate: float = 0.0015
    validation_fraction: float = 0.2
    worlds: int = 8
    workers: int = 8
    action_repeat: int = 10
    seed: int = 0x5EED_0001


@dataclass(frozen=True)
class TrainingConfiguration:
    iterations: int = 10
    rollout_steps: int = 1_024
    epochs: int = 4
    batch_size: int = 128
    choice_batch_size: int = 32
    minimum_choice_batch: int = 32
    learning_rate: float = 0.0003
    choice_learning_rate: float = 0.0003
    gamma: float = 0.995
    gae_lambda: float = 0.95
    worlds: int = 8
    workers: int = 8
    action_repeat: int = 10
    seed: int = 0x5EED_1000


def bootstrap_policy(
    output_directory: Path,
    configuration: BootstrapConfiguration,
    *,
    dataset_path: Path | None = None,
) -> Mapping[str, Any]:
    validate_bootstrap_configuration(configuration)
    configure_torch(configuration.seed)
    output_directory.mkdir(parents=True, exist_ok=True)
    cache = dataset_path or output_directory / "expert-v5.npz"
    if cache.exists():
        dataset = ExpertDataset.load(cache)
        if len(dataset) < configuration.samples:
            raise ValueError("cached expert dataset has fewer rows than requested")
        dataset = dataset.subset(np.arange(configuration.samples))
    else:
        dataset = collect_expert_dataset(
            configuration.samples,
            worlds=configuration.worlds,
            worker_count=configuration.workers,
            action_repeat=configuration.action_repeat,
            seed=configuration.seed,
        )
        dataset.save(cache)
    training, validation = split_expert_dataset(
        dataset,
        validation_fraction=configuration.validation_fraction,
        rng=np.random.default_rng(configuration.seed + 1),
    )
    device = torch.device("cpu")
    policy = PolicyV5.initialize(configuration.seed).to(device)
    optimizer = torch.optim.Adam(policy.main_parameters(), lr=configuration.learning_rate)
    training_tensors = expert_tensors(training, device)
    validation_tensors = expert_tensors(validation, device)
    metrics = behavior_clone(
        policy,
        optimizer,
        *training_tensors,
        epochs=configuration.epochs,
        batch_size=configuration.batch_size,
        generator=torch.Generator().manual_seed(configuration.seed + 2),
    )
    with torch.no_grad():
        training_accuracy = classification_accuracy(policy, *training_tensors)
        validation_accuracy = classification_accuracy(policy, *validation_tensors)
        policy.value.weight.zero_()
        policy.value.bias.zero_()
        policy.choice_value.weight.zero_()
        policy.choice_value.bias.zero_()
    gates = {
        "movement_accuracy": 0.60,
        "target_accuracy": 0.55,
        "ability_accuracy": 0.55,
        "aim_accuracy": 0.70,
        "joint_accuracy": 0.25,
    }
    failed = [
        name for name, minimum in gates.items() if validation_accuracy[name] < minimum
    ]
    if failed:
        raise RuntimeError(
            "bootstrap accuracy gate failed: "
            + ", ".join(
                f"{name}={validation_accuracy[name]:.4f} < {gates[name]:.4f}"
                for name in failed
            )
        )
    metadata = POLICY_SPEC.checkpoint_metadata(configuration.seed)
    metadata.update(
        {
            "bootstrapConfiguration": asdict(configuration),
            "bootstrapTrainingAccuracy": training_accuracy,
            "bootstrapValidationAccuracy": validation_accuracy,
            "numpyVersion": np.__version__,
            "torchVersion": torch.__version__,
            "trainingKind": "web-semantic-expert-bootstrap-v5",
        }
    )
    checkpoint = output_directory / "bootstrap-v5.sdml"
    save_checkpoint(checkpoint, metadata, policy.export_tensors())
    save_checkpoint(output_directory / "latest.sdml", metadata, policy.export_tensors())
    result = {
        "status": "ok",
        "checkpoint": str(checkpoint),
        "dataset": str(cache),
        "samples": len(dataset),
        "trainingAccuracy": training_accuracy,
        "validationAccuracy": validation_accuracy,
        "lastBatch": asdict(metrics[-1]),
    }
    (output_directory / "bootstrap-report.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return result


def train_policy(
    checkpoint_path: Path,
    output_directory: Path,
    configuration: TrainingConfiguration,
    *,
    resume: bool = False,
) -> Mapping[str, Any]:
    validate_training_configuration(configuration)
    configure_torch(configuration.seed)
    output_directory.mkdir(parents=True, exist_ok=True)
    metadata, tensors = load_checkpoint(checkpoint_path)
    policy = PolicyV5().to(torch.device("cpu"))
    policy.load_tensors(tensors)
    main_optimizer = torch.optim.Adam(policy.main_parameters(), lr=configuration.learning_rate)
    choice_optimizer = torch.optim.Adam(
        policy.choice_parameters(), lr=configuration.choice_learning_rate
    )
    main_normalizer = RunningReturnNormalizer()
    choice_normalizer = RunningReturnNormalizer()
    coverage = ChoiceCoverage(metadata.get("choiceCoverage", {}))
    pending_choices: list[Mapping[str, Any]] = []
    environment_steps = int(metadata["trainedEnvironmentSteps"])
    completed_updates = int(metadata["trainedUpdates"])
    completed_episode_count = 0
    seed_stream = SeedStream(configuration.seed)
    torch_generator = torch.Generator().manual_seed(configuration.seed + 1)
    trainer_state_path = output_directory / "trainer-state-v5.pt"
    if resume and trainer_state_path.exists():
        state = load_trainer_state(trainer_state_path)
        policy.load_state_dict(state["model"])
        main_optimizer.load_state_dict(state["mainOptimizer"])
        choice_optimizer.load_state_dict(state["choiceOptimizer"])
        main_normalizer = RunningReturnNormalizer.from_state_dict(state["mainNormalizer"])
        choice_normalizer = RunningReturnNormalizer.from_state_dict(state["choiceNormalizer"])
        coverage = ChoiceCoverage(state["choiceCoverage"])
        pending_choices = list(state["pendingChoices"])
        environment_steps = int(state["environmentSteps"])
        completed_updates = int(state["completedUpdates"])
        completed_episode_count = int(state["completedEpisodes"])
        seed_stream = SeedStream(int(state["nextSeed"]))
        torch_generator.set_state(state["torchGeneratorState"])
    initial_seeds = [seed_stream.take() for _ in range(configuration.worlds)]
    episodes = EpisodeLedger()
    started_at = time.monotonic()
    metrics_path = output_directory / "metrics.jsonl"
    episodes_path = output_directory / "episodes.jsonl"
    last_checkpoint = checkpoint_path
    with BoneyardRolloutBridge(
        initial_seeds, worker_count=configuration.workers
    ) as bridge:
        for local_iteration in range(1, configuration.iterations + 1):
            rollout = collect_policy_rollout(
                policy,
                bridge,
                steps=configuration.rollout_steps,
                action_repeat=configuration.action_repeat,
                generator=torch_generator,
                seeds=seed_stream,
                episodes=episodes,
            )
            advantages, returns, return_scale = normalized_main_advantages(
                rollout.rewards,
                rollout.values,
                rollout.dones,
                rollout.ticks,
                rollout.next_values,
                main_normalizer,
                gamma=configuration.gamma,
                gae_lambda=configuration.gae_lambda,
            )
            batch = rollout_tensors(rollout, torch.device("cpu"))
            main_metrics = ppo_epochs(
                policy,
                main_optimizer,
                batch["observations"],
                batch["masks"],
                batch["actions"],
                batch["oldLogProbabilities"],
                torch.from_numpy(advantages.reshape(-1)).float(),
                torch.from_numpy(returns.reshape(-1)).float(),
                epochs=configuration.epochs,
                batch_size=configuration.batch_size,
                generator=torch_generator,
            )
            pending_choices.extend(
                interval for interval in rollout.choice_intervals
                if interval.get("trainable") is True and interval.get("choiceMode") == "learned"
            )
            choice_metrics: list[Any] = []
            choice_return_scale = choice_normalizer.standard_deviation
            choice_event_count = 0
            if len(pending_choices) >= configuration.minimum_choice_batch:
                choice_event_count = len(pending_choices)
                choice_batch = prepare_choice_batch(pending_choices)
                for interval in pending_choices:
                    coverage.observe(
                        np.asarray(interval["optionDescriptors"]),
                        np.asarray(interval["optionMask"]),
                        int(interval["selectedOption"]),
                    )
                choice_advantages, choice_returns, choice_return_scale = smdp_choice_advantages(
                    pending_choices,
                    choice_normalizer,
                    gamma=configuration.gamma,
                    gae_lambda=configuration.gae_lambda,
                )
                choice_metrics = choice_ppo_epochs(
                    policy,
                    choice_optimizer,
                    choice_batch["observations"],
                    choice_batch["descriptors"],
                    choice_batch["masks"],
                    choice_batch["selectedOptions"],
                    choice_batch["oldLogProbabilities"],
                    torch.from_numpy(choice_advantages).float(),
                    torch.from_numpy(choice_returns).float(),
                    temperature=coverage.temperature,
                    epochs=configuration.epochs,
                    batch_size=configuration.choice_batch_size,
                    generator=torch_generator,
                )
                pending_choices.clear()
            environment_steps += int(np.sum(rollout.ticks))
            completed_updates += 1
            for episode in rollout.completed_episodes:
                append_jsonl(episodes_path, episode)
            completed_episode_count += len(rollout.completed_episodes)
            aggregate_main = mean_metrics(main_metrics)
            aggregate_choice = mean_metrics(choice_metrics)
            record = iteration_record(
                iteration=completed_updates,
                wall_seconds=time.monotonic() - started_at,
                environment_steps=environment_steps,
                episodes_completed=completed_episode_count,
                rollout=rollout,
                advantages=advantages,
                main_metrics=aggregate_main,
                choice_metrics=aggregate_choice,
                choice_events=choice_event_count,
                choice_pending=len(pending_choices),
                choice_temperature=coverage.temperature,
                return_scale=return_scale,
                choice_return_scale=choice_return_scale,
                configuration=configuration,
            )
            append_jsonl(metrics_path, record)
            metadata = {
                **metadata,
                "choiceCoverage": dict(sorted(coverage.counts.items())),
                "choiceTemperature": coverage.temperature,
                "choiceReturnNormalizer": choice_normalizer.state_dict(),
                "mainReturnNormalizer": main_normalizer.state_dict(),
                "trainedEnvironmentSteps": environment_steps,
                "trainedUpdates": completed_updates,
                "trainingConfiguration": asdict(configuration),
                "trainingKind": "web-headless-pytorch-ppo-v5",
            }
            last_checkpoint = output_directory / f"policy-v5-update-{completed_updates:06d}.sdml"
            save_checkpoint(last_checkpoint, metadata, policy.export_tensors())
            save_checkpoint(output_directory / "latest.sdml", metadata, policy.export_tensors())
            save_trainer_state(
                trainer_state_path,
                {
                    "trainerVersion": 5,
                    "model": policy.state_dict(),
                    "mainOptimizer": main_optimizer.state_dict(),
                    "choiceOptimizer": choice_optimizer.state_dict(),
                    "mainNormalizer": main_normalizer.state_dict(),
                    "choiceNormalizer": choice_normalizer.state_dict(),
                    "choiceCoverage": coverage.counts,
                    "pendingChoices": pending_choices,
                    "environmentSteps": environment_steps,
                    "completedUpdates": completed_updates,
                    "completedEpisodes": completed_episode_count,
                    "nextSeed": seed_stream.next_seed,
                    "torchGeneratorState": torch_generator.get_state(),
                    "configuration": asdict(configuration),
                },
            )
            print(json.dumps(record, allow_nan=False, sort_keys=True), flush=True)
        for episode in episodes.aborted_records("training iteration limit"):
            append_jsonl(episodes_path, episode)
    return {
        "status": "ok",
        "checkpoint": str(last_checkpoint),
        "metrics": str(metrics_path),
        "episodes": str(episodes_path),
        "trainedEnvironmentSteps": environment_steps,
        "trainedUpdates": completed_updates,
    }


def evaluate_policy(
    checkpoint_path: Path,
    seeds: Sequence[int],
    *,
    workers: int,
    action_repeat: int,
    maximum_steps: int,
) -> Mapping[str, Any]:
    if len(seeds) < 1 or workers < 1 or action_repeat < 1 or maximum_steps < 1:
        raise ValueError("evaluation sizes must be positive")
    _metadata, tensors = load_checkpoint(checkpoint_path)
    policy = PolicyV5()
    policy.load_tensors(tensors)
    policy.eval()
    records: list[Mapping[str, Any]] = []
    for start in range(0, len(seeds), workers):
        chunk = list(seeds[start : start + workers])
        ledger = EpisodeLedger()
        with BoneyardRolloutBridge(chunk, worker_count=min(workers, len(chunk))) as bridge:
            ledger.ensure_started(bridge.state)
            active = np.ones(len(chunk), dtype=bool)
            generator = torch.Generator().manual_seed(chunk[0])
            for _ in range(maximum_steps):
                before = bridge.state
                observations, plans = state_tensors(before, torch.device("cpu"))
                with torch.no_grad():
                    selected = policy.act(
                        observations, plans, deterministic=True, generator=generator
                    )
                actions = np.stack(
                    [selected.actions[name].numpy() for name in ACTION_ORDER], axis=1
                ).astype(np.uint8)
                actions[~active] = 0
                result = bridge.step(actions, ticks=action_repeat)
                newly_completed = ledger.observe(before, result.state, result.transition, actions)
                records.extend(newly_completed)
                active &= ~result.transition.dones
                if not np.any(active):
                    break
            if np.any(active):
                records.extend(ledger.aborted_records("evaluation step limit"))
    returns = [float(record["return"]) for record in records]
    waves = [float(record["waves_reached"]) for record in records]
    return {
        "checkpoint": str(checkpoint_path),
        "episodes": records,
        "return": bootstrap_mean_interval(returns, seed=0xE1A1),
        "status": "ok",
        "waveDepth": bootstrap_mean_interval(waves, seed=0xE1A2),
    }


def expert_tensors(
    dataset: ExpertDataset,
    device: torch.device,
) -> tuple[torch.Tensor, Mapping[str, torch.Tensor], Mapping[str, torch.Tensor]]:
    return (
        torch.from_numpy(dataset.observations).to(device=device, dtype=torch.float32),
        {
            name: torch.from_numpy(value).to(device=device, dtype=torch.bool)
            for name, value in dataset.masks.items()
        },
        {
            name: torch.from_numpy(value).to(device=device, dtype=torch.long)
            for name, value in dataset.actions.items()
        },
    )


def rollout_tensors(rollout: Any, device: torch.device) -> Mapping[str, Any]:
    return {
        "observations": torch.from_numpy(
            rollout.observations.reshape(-1, POLICY_SPEC.observation_size)
        ).to(device=device, dtype=torch.float32),
        "masks": {
            name: torch.from_numpy(value.reshape(-1, value.shape[-1])).to(
                device=device, dtype=torch.bool
            )
            for name, value in rollout.masks.items()
        },
        "actions": {
            name: torch.from_numpy(value.reshape(-1)).to(device=device, dtype=torch.long)
            for name, value in rollout.actions.items()
        },
        "oldLogProbabilities": torch.from_numpy(
            rollout.old_log_probabilities.reshape(-1)
        ).to(device=device, dtype=torch.float32),
    }


def prepare_choice_batch(intervals: Sequence[Mapping[str, Any]]) -> Mapping[str, torch.Tensor]:
    maximum_options = max(np.asarray(interval["optionDescriptors"]).shape[0] for interval in intervals)
    observations = np.stack([np.asarray(interval["observation"], dtype=np.float32) for interval in intervals])
    descriptors = np.zeros(
        (len(intervals), maximum_options, POLICY_SPEC.option_descriptor_size), dtype=np.float32
    )
    masks = np.zeros((len(intervals), maximum_options), dtype=bool)
    for index, interval in enumerate(intervals):
        rows = np.asarray(interval["optionDescriptors"], dtype=np.float32)
        count = rows.shape[0]
        descriptors[index, :count] = rows
        masks[index, :count] = np.asarray(interval["optionMask"], dtype=bool)
    return {
        "observations": torch.from_numpy(observations),
        "descriptors": torch.from_numpy(descriptors),
        "masks": torch.from_numpy(masks),
        "selectedOptions": torch.tensor(
            [int(interval["selectedOption"]) for interval in intervals], dtype=torch.long
        ),
        "oldLogProbabilities": torch.tensor(
            [float(interval["oldLogProbability"]) for interval in intervals], dtype=torch.float32
        ),
    }


def iteration_record(
    *,
    iteration: int,
    wall_seconds: float,
    environment_steps: int,
    episodes_completed: int,
    rollout: Any,
    advantages: np.ndarray,
    main_metrics: Mapping[str, float],
    choice_metrics: Mapping[str, float],
    choice_events: int,
    choice_pending: int,
    choice_temperature: float,
    return_scale: float,
    choice_return_scale: float,
    configuration: TrainingConfiguration,
) -> Mapping[str, Any]:
    completed = rollout.completed_episodes
    segment_returns = np.sum(rollout.rewards, axis=0)
    returns = np.asarray(
        [float(record["return"]) for record in completed] if completed else segment_returns,
        dtype=np.float64,
    )
    waves = np.asarray(
        [float(record["waves_reached"]) for record in completed]
        if completed
        else np.max(rollout.observations[:, :, FEATURE["wave_scaled"]], axis=0) * 20,
        dtype=np.float64,
    )
    lengths = np.asarray(
        [float(record["steps"]) for record in completed]
        if completed
        else np.full(rollout.rewards.shape[1], rollout.rewards.shape[0]),
        dtype=np.float64,
    )
    reward_terms = {
        "xp": float(np.sum(rollout.reward_terms["xp"])),
        "own_damage": float(np.sum(rollout.reward_terms["ownDamage"])),
        "self_hp": float(np.sum(rollout.reward_terms["selfHp"])),
        "wave": float(np.sum(rollout.reward_terms["wave"])),
        "death": float(np.sum(rollout.reward_terms["death"])),
        "clamp_adjustment": float(np.sum(rollout.reward_terms["clampAdjustment"])),
    }
    return {
        "metrics_version": 5,
        "iter": iteration,
        "wall_seconds": wall_seconds,
        "env_steps_total": environment_steps,
        "episodes_completed": episodes_completed,
        "return_mean": float(np.mean(returns)),
        "return_std": float(np.std(returns)),
        "wave_depth_mean": float(np.mean(waves)),
        "wave_depth_max": float(np.max(waves)),
        "ep_len_mean": float(np.mean(lengths)),
        "policy_loss": main_metrics.get("policy_loss", 0.0),
        "value_loss": main_metrics.get("value_loss", 0.0),
        "kl_divergence": main_metrics.get("approximate_kl", 0.0),
        "clip_fraction": main_metrics.get("clip_fraction", 0.0),
        "grad_norm": main_metrics.get("gradient_norm", 0.0),
        "adv_mean": float(np.mean(advantages)),
        "adv_std": float(np.std(advantages)),
        "entropy_move": main_metrics.get("entropy_movement", 0.0),
        "entropy_target": main_metrics.get("entropy_target", 0.0),
        "entropy_ability": main_metrics.get("entropy_ability", 0.0),
        "entropy_aim": main_metrics.get("entropy_aim", 0.0),
        "smdp": {
            "events": choice_events,
            "pending_events": choice_pending,
            "policy_loss": choice_metrics.get("policy_loss", 0.0),
            "value_loss": choice_metrics.get("value_loss", 0.0),
            "entropy_normalized": choice_metrics.get("normalized_entropy", 0.0),
            "temperature": choice_temperature,
            "selections_per_family": {},
            "loss_alarm": bool(
                choice_metrics
                and abs(choice_metrics.get("policy_loss", 0.0))
                > max(abs(main_metrics.get("policy_loss", 0.0)), 1e-9) * 2
            ),
        },
        "reward_terms": reward_terms,
        "return_normalization_std": return_scale,
        "choice_return_normalization_std": choice_return_scale,
        "gamma": configuration.gamma,
        "gae_lambda": configuration.gae_lambda,
        "action_repeat_ticks": configuration.action_repeat,
    }


def save_trainer_state(path: Path, value: Mapping[str, Any]) -> None:
    stream = io.BytesIO()
    torch.save(dict(value), stream)
    atomic_write(path, stream.getvalue())


def load_trainer_state(path: Path) -> Mapping[str, Any]:
    value = torch.load(path, map_location="cpu", weights_only=False)
    if not isinstance(value, Mapping) or value.get("trainerVersion") != 5:
        raise ValueError("trainer state is not strict version 5")
    return value


def configure_torch(seed: int) -> None:
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


def validate_bootstrap_configuration(value: BootstrapConfiguration) -> None:
    positive = (value.samples, value.epochs, value.batch_size, value.worlds, value.workers, value.action_repeat)
    if any(entry < 1 for entry in positive) or not 0 < value.validation_fraction < 1:
        raise ValueError("bootstrap configuration is invalid")
    if not math.isfinite(value.learning_rate) or value.learning_rate <= 0:
        raise ValueError("bootstrap learning rate must be positive")


def validate_training_configuration(value: TrainingConfiguration) -> None:
    positive = (
        value.iterations,
        value.rollout_steps,
        value.epochs,
        value.batch_size,
        value.choice_batch_size,
        value.minimum_choice_batch,
        value.worlds,
        value.workers,
        value.action_repeat,
    )
    if any(entry < 1 for entry in positive):
        raise ValueError("training configuration sizes must be positive")
    if value.gamma not in (0.99, 0.995, 0.997, 0.999):
        raise ValueError("gamma must be one of the owner-approved sweep values")
    if not 0 <= value.gae_lambda <= 1:
        raise ValueError("GAE lambda must be within [0, 1]")
    if value.learning_rate <= 0 or value.choice_learning_rate <= 0:
        raise ValueError("training learning rates must be positive")
