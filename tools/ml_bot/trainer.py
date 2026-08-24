"""End-to-end bootstrap, PPO campaign, checkpointing, and frozen evaluation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import io
import json
import math
from pathlib import Path
import time
from typing import Any, Callable, Mapping, Sequence

import numpy as np
import torch

from .advantages import (
    RunningReturnNormalizer,
    normalized_main_advantages,
    smdp_choice_advantages,
)
from .bridge import BoneyardRolloutBridge
from .checkpoint import atomic_write, load_checkpoint, save_checkpoint
from .diagnostics import write_observation_audit, write_spatial_replay, write_value_calibration
from .metrics import (
    append_jsonl,
    bootstrap_mean_interval,
    episode_gameplay_summary,
    primary_curriculum_coverage,
)
from .model import PolicyV7
from .optimization import (
    ChoiceCoverage,
    behavior_clone,
    choice_behavior_clone,
    choice_classification_accuracy,
    choice_ppo_epochs,
    classification_accuracy,
    mean_metrics,
    ppo_epochs,
)
from .rollouts import (
    ACTION_ORDER,
    FEATURE,
    EpisodeLedger,
    ChoiceExpertDataset,
    ExpertDataset,
    SeedStream,
    collect_expert_dataset,
    collect_choice_expert_dataset,
    choice_expert_dataset_diagnostics,
    expert_dataset_diagnostics,
    collect_policy_rollout,
    resolve_policy_choices,
    equipped_skill_rank_summary,
    spell_action_summary,
    split_expert_dataset,
    split_choice_expert_dataset,
    state_tensors,
)
from .spec import POLICY_SPEC


CHOICE_OPTIMIZER_SCOPE = "choice-head-and-value-v1"


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
    target_kl: float = 0.02
    worlds: int = 8
    workers: int = 8
    action_repeat: int = 10
    seed: int = 0x5EED_1000


@dataclass(frozen=True)
class ChoiceBootstrapConfiguration:
    samples: int = 512
    epochs: int = 30
    batch_size: int = 64
    learning_rate: float = 0.001
    validation_fraction: float = 0.2
    worlds: int = 8
    workers: int = 8
    action_repeat: int = 10
    seed: int = 0x5EED_2000


def bootstrap_policy(
    output_directory: Path,
    configuration: BootstrapConfiguration,
    *,
    dataset_path: Path | None = None,
) -> Mapping[str, Any]:
    validate_bootstrap_configuration(configuration)
    configure_torch(configuration.seed)
    output_directory.mkdir(parents=True, exist_ok=True)
    cache = dataset_path or output_directory / "expert-v7.npz"
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
    dataset_diagnostics = expert_dataset_diagnostics(dataset)
    expected_primary_loadouts = {str(row["key"]) for row in POLICY_SPEC.primary_curriculum}
    observed_primary_loadouts = set(dataset_diagnostics["primaryLoadoutRows"])
    primary_action_loadouts = {
        key
        for key, count in dataset_diagnostics["primaryActionsByLoadout"].items()
        if int(count) > 0
    }
    if (
        dataset_diagnostics["interestingFraction"] < 0.5
        or dataset_diagnostics["uniqueActions"]["movement"] < 2
        or dataset_diagnostics["uniqueActions"]["target"] < 2
        or dataset_diagnostics["uniqueActions"]["ability"] < 2
        or observed_primary_loadouts != expected_primary_loadouts
        or primary_action_loadouts != expected_primary_loadouts
    ):
        raise RuntimeError(f"expert dataset diversity gate failed: {dataset_diagnostics}")
    device = torch.device("cpu")
    policy = PolicyV7.initialize(configuration.seed).to(device)
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
        full_tensors = expert_tensors(dataset, device)
        potion_rows = full_tensors[2]["ability"] >= 10
        potion_count = int(torch.count_nonzero(potion_rows))
        potion_accuracy = 0.0 if potion_count == 0 else classification_accuracy(
            policy,
            full_tensors[0][potion_rows],
            {name: value[potion_rows] for name, value in full_tensors[1].items()},
            {name: value[potion_rows] for name, value in full_tensors[2].items()},
        )["ability_accuracy"]
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
    if potion_count < 8 or potion_accuracy < 0.70:
        raise RuntimeError(
            "bootstrap potion-imitation gate failed: "
            f"count={potion_count}, accuracy={potion_accuracy:.4f}"
        )
    metadata = POLICY_SPEC.checkpoint_metadata(configuration.seed)
    metadata.update(
        {
            "bootstrapConfiguration": asdict(configuration),
            "bootstrapTrainingAccuracy": training_accuracy,
            "bootstrapValidationAccuracy": validation_accuracy,
            "bootstrapPotionAccuracy": potion_accuracy,
            "bootstrapPotionRows": potion_count,
            "expertDatasetDiagnostics": dataset_diagnostics,
            "numpyVersion": np.__version__,
            "torchVersion": torch.__version__,
            "trainingKind": "web-semantic-expert-bootstrap-v7",
        }
    )
    checkpoint = output_directory / "bootstrap-v7.sdml"
    save_checkpoint(checkpoint, metadata, policy.export_tensors())
    save_checkpoint(output_directory / "latest.sdml", metadata, policy.export_tensors())
    result = {
        "status": "ok",
        "checkpoint": str(checkpoint),
        "dataset": str(cache),
        "samples": len(dataset),
        "trainingAccuracy": training_accuracy,
        "validationAccuracy": validation_accuracy,
        "potionAccuracy": potion_accuracy,
        "potionRows": potion_count,
        "lastBatch": asdict(metrics[-1]),
        "datasetDiagnostics": dataset_diagnostics,
    }
    (output_directory / "bootstrap-report.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return result


def bootstrap_choice_policy(
    checkpoint_path: Path,
    output_directory: Path,
    configuration: ChoiceBootstrapConfiguration,
    *,
    dataset_path: Path | None = None,
) -> Mapping[str, Any]:
    validate_choice_bootstrap_configuration(configuration)
    configure_torch(configuration.seed)
    output_directory.mkdir(parents=True, exist_ok=True)
    cache = dataset_path or output_directory / "choice-expert-v7.npz"
    if cache.exists():
        dataset = ChoiceExpertDataset.load(cache)
        if len(dataset) < configuration.samples:
            raise ValueError("cached choice expert dataset has fewer rows than requested")
        dataset = dataset.subset(np.arange(configuration.samples))
    else:
        dataset = collect_choice_expert_dataset(
            configuration.samples,
            worlds=configuration.worlds,
            worker_count=configuration.workers,
            action_repeat=configuration.action_repeat,
            seed=configuration.seed,
            progress=lambda value: print(
                json.dumps({"choiceBootstrapProgress": value}, sort_keys=True),
                flush=True,
            ),
        )
        dataset.save(cache)
    diagnostics = choice_expert_dataset_diagnostics(dataset)
    expected_primary_loadouts = {str(row["key"]) for row in POLICY_SPEC.primary_curriculum}
    if (
        diagnostics["uniqueOfferedSkills"] < 8
        or diagnostics["uniqueSelectedSkills"] < 3
        or sum(count > 0 for count in diagnostics["selectedOptionHistogram"]) < 2
        or set(diagnostics["primaryLoadoutRows"]) != expected_primary_loadouts
    ):
        raise RuntimeError(f"choice expert dataset diversity gate failed: {diagnostics}")
    training, validation = split_choice_expert_dataset(
        dataset,
        validation_fraction=configuration.validation_fraction,
        rng=np.random.default_rng(configuration.seed + 1),
    )
    metadata, tensors = load_checkpoint(checkpoint_path)
    policy = PolicyV7().to(torch.device("cpu"))
    policy.load_tensors(tensors)
    protected = {
        name: value.copy()
        for name, value in policy.export_tensors().items()
        if name not in {
            "choice_hidden_bias",
            "choice_hidden_weight",
            "choice_score_bias",
            "choice_score_weight",
        }
    }
    main_parameters = policy.main_parameters()
    for parameter in main_parameters:
        parameter.requires_grad_(False)
    optimizer = torch.optim.Adam(
        policy.choice_scorer_parameters(), lr=configuration.learning_rate
    )
    training_tensors = choice_expert_tensors(training, torch.device("cpu"))
    validation_tensors = choice_expert_tensors(validation, torch.device("cpu"))
    try:
        metrics = choice_behavior_clone(
            policy,
            optimizer,
            *training_tensors,
            epochs=configuration.epochs,
            batch_size=configuration.batch_size,
            generator=torch.Generator().manual_seed(configuration.seed + 2),
        )
    finally:
        for parameter in main_parameters:
            parameter.requires_grad_(True)
    with torch.no_grad():
        training_accuracy = choice_classification_accuracy(policy, *training_tensors)
        validation_accuracy = choice_classification_accuracy(policy, *validation_tensors)
    exported = policy.export_tensors()
    if any(not np.array_equal(exported[name], value) for name, value in protected.items()):
        raise RuntimeError("choice bootstrap changed a protected policy tensor")
    if training_accuracy < 0.95 or validation_accuracy < 0.85:
        raise RuntimeError(
            "choice bootstrap accuracy gate failed: "
            f"training={training_accuracy:.4f}, validation={validation_accuracy:.4f}"
        )
    metadata = {
        **metadata,
        "choiceBootstrapConfiguration": asdict(configuration),
        "choiceBootstrapDatasetDiagnostics": diagnostics,
        "choiceBootstrapSourceCheckpointSha256": file_sha256(checkpoint_path),
        "choiceBootstrapTrainingAccuracy": training_accuracy,
        "choiceBootstrapValidationAccuracy": validation_accuracy,
        "choiceCoverage": {},
        "choicePolicyMode": "learned",
        "choiceTemperature": 1.25,
        "trainingKind": "web-choice-expert-bootstrap-v7",
    }
    checkpoint = output_directory / "choice-bootstrap-v7.sdml"
    save_checkpoint(checkpoint, metadata, exported)
    save_checkpoint(output_directory / "latest.sdml", metadata, exported)
    result = {
        "status": "ok",
        "checkpoint": str(checkpoint),
        "dataset": str(cache),
        "samples": len(dataset),
        "trainingAccuracy": training_accuracy,
        "validationAccuracy": validation_accuracy,
        "lastBatch": asdict(metrics[-1]),
        "datasetDiagnostics": diagnostics,
    }
    atomic_write(
        output_directory / "choice-bootstrap-report.json",
        (json.dumps(result, indent=2, sort_keys=True) + "\n").encode(),
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
    policy = PolicyV7().to(torch.device("cpu"))
    policy.load_tensors(tensors)
    main_parameters = policy.main_parameters()
    choice_parameters = policy.choice_ppo_parameters()
    if {id(parameter) for parameter in main_parameters} & {
        id(parameter) for parameter in choice_parameters
    }:
        raise RuntimeError("main and choice optimizers must own disjoint parameters")
    main_optimizer = torch.optim.Adam(main_parameters, lr=configuration.learning_rate)
    choice_optimizer = torch.optim.Adam(choice_parameters, lr=configuration.choice_learning_rate)
    main_normalizer = RunningReturnNormalizer()
    choice_normalizer = RunningReturnNormalizer()
    coverage = ChoiceCoverage(metadata.get("choiceCoverage", {}))
    pending_choices: list[Mapping[str, Any]] = []
    environment_steps = int(metadata["trainedEnvironmentSteps"])
    completed_updates = int(metadata["trainedUpdates"])
    completed_episode_count = 0
    seed_stream = SeedStream(configuration.seed)
    torch_generator = torch.Generator().manual_seed(configuration.seed + 1)
    trainer_state_path = output_directory / "trainer-state-v7.pt"
    if resume and trainer_state_path.exists():
        state = load_trainer_state(trainer_state_path)
        validate_resume_state(state, checkpoint_path, configuration, metadata)
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
    learned_choices = metadata.get("choicePolicyMode") == "learned"
    with BoneyardRolloutBridge(
        initial_seeds,
        worker_count=configuration.workers,
        learned_choices=learned_choices,
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
                choice_temperature=coverage.temperature,
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
                target_kl=configuration.target_kl,
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
            aggregate_main["approximate_kl_max"] = max(
                metric.approximate_kl for metric in main_metrics
            )
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
            write_observation_audit(
                output_directory / f"observation-audit-{completed_updates:06d}.json",
                rollout.observations,
            )
            write_value_calibration(
                output_directory / f"value-calibration-{completed_updates:06d}.json",
                rollout.values,
                returns,
            )
            write_spatial_replay(
                output_directory / "replays" / f"update-{completed_updates:06d}-world-0.jsonl",
                rollout,
            )
            metadata = {
                **metadata,
                "choiceCoverage": dict(sorted(coverage.counts.items())),
                "choiceOptimizerScope": CHOICE_OPTIMIZER_SCOPE,
                "choiceTemperature": coverage.temperature,
                "choiceReturnNormalizer": choice_normalizer.state_dict(),
                "mainReturnNormalizer": main_normalizer.state_dict(),
                "trainedEnvironmentSteps": environment_steps,
                "trainedUpdates": completed_updates,
                "trainingConfiguration": checkpoint_training_configuration(configuration),
                "trainingKind": "web-headless-pytorch-ppo-v7",
            }
            last_checkpoint = output_directory / f"policy-v7-update-{completed_updates:06d}.sdml"
            save_checkpoint(last_checkpoint, metadata, policy.export_tensors())
            save_checkpoint(output_directory / "latest.sdml", metadata, policy.export_tensors())
            save_trainer_state(
                trainer_state_path,
                {
                    "trainerVersion": 7,
                    "model": policy.state_dict(),
                    "mainOptimizer": main_optimizer.state_dict(),
                    "choiceOptimizer": choice_optimizer.state_dict(),
                    "choiceOptimizerScope": CHOICE_OPTIMIZER_SCOPE,
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
                    "runtimeCheckpointSha256": file_sha256(last_checkpoint),
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
    progress: Callable[[Mapping[str, Any]], None] | None = None,
) -> Mapping[str, Any]:
    if len(seeds) < 1 or workers < 1 or action_repeat < 1 or maximum_steps < 1:
        raise ValueError("evaluation sizes must be positive")
    metadata, tensors = load_checkpoint(checkpoint_path)
    policy = PolicyV7()
    policy.load_tensors(tensors)
    policy.eval()
    records: list[Mapping[str, Any]] = []
    learned_choices = metadata.get("choicePolicyMode") == "learned"
    choice_temperature = float(metadata.get("choiceTemperature", 1.25))
    initial_count = min(workers, len(seeds))
    initial_seeds = list(seeds[:initial_count])
    next_seed_index = initial_count
    ledger = EpisodeLedger()
    with BoneyardRolloutBridge(
        initial_seeds,
        worker_count=initial_count,
        learned_choices=learned_choices,
    ) as bridge:
        ledger.ensure_started(bridge.state)
        active = np.ones(initial_count, dtype=bool)
        decision_counts = np.zeros(initial_count, dtype=np.int64)
        while len(records) < len(seeds):
            resolve_policy_choices(
                policy,
                bridge,
                temperature=choice_temperature,
                deterministic=True,
            )
            before = bridge.state
            observations, plans = state_tensors(before, torch.device("cpu"))
            with torch.no_grad():
                selected = policy.act(observations, plans, deterministic=True)
            actions = np.stack(
                [selected.actions[name].numpy() for name in ACTION_ORDER], axis=1
            ).astype(np.uint8)
            # The bridge has a fixed lane count. Retired lanes still have to
            # receive actions that are legal for their current mask; their
            # ledger entries are already closed and their results are ignored.
            result = bridge.step(actions, ticks=action_repeat)
            decision_counts[active] += 1
            records.extend(ledger.observe(before, result.state, result.transition, actions))
            terminal = active & result.transition.dones
            timed_out = active & ~terminal & (decision_counts >= maximum_steps)
            records.extend(ledger.abort_worlds(timed_out, "evaluation step limit"))
            reusable = terminal | timed_out
            reset_seeds: list[int | None] = [None] * initial_count
            reset_mask = np.zeros(initial_count, dtype=bool)
            for world in np.flatnonzero(reusable):
                if next_seed_index < len(seeds):
                    reset_seeds[world] = int(seeds[next_seed_index])
                    next_seed_index += 1
                    decision_counts[world] = 0
                    reset_mask[world] = True
                else:
                    active[world] = False
            if np.any(reset_mask):
                reset_state = bridge.reset(reset_seeds)
                ledger.reset_worlds(reset_state, reset_mask)
            if progress is not None and np.any(reusable):
                progress({
                    "checkpoint": str(checkpoint_path),
                    "evaluatedEpisodes": len(records),
                    "completeEpisodes": sum(
                        record.get("aborted") is False for record in records
                    ),
                    "incompleteEpisodes": sum(
                        record.get("aborted") is True for record in records
                    ),
                    "gameplay": episode_gameplay_summary(records),
                    "requestedEpisodes": len(seeds),
                })
    return evaluation_report(
        checkpoint_path,
        seeds,
        records,
        action_repeat=action_repeat,
        choice_policy_mode="learned" if learned_choices else "scripted",
        maximum_steps=maximum_steps,
    )


def evaluation_report(
    checkpoint_path: Path,
    seeds: Sequence[int],
    records: Sequence[Mapping[str, Any]],
    *,
    action_repeat: int,
    choice_policy_mode: str,
    maximum_steps: int,
) -> Mapping[str, Any]:
    completed = [record for record in records if record.get("aborted") is False]
    incomplete = [record for record in records if record.get("aborted") is True]
    primary_coverage = primary_curriculum_coverage(completed)
    returns = [float(record["return"]) for record in completed]
    waves = [float(record["waves_reached"]) for record in completed]
    return {
        "evaluationVersion": 7,
        "checkpoint": str(checkpoint_path),
        "checkpointSha256": file_sha256(checkpoint_path),
        "episodes": records,
        "requestedEpisodes": len(seeds),
        "actionRepeatTicks": action_repeat,
        "choicePolicyMode": choice_policy_mode,
        "maximumSteps": maximum_steps,
        "completeEpisodes": len(completed),
        "incompleteEpisodes": len(incomplete),
        "validForPromotion": (
            len(completed) == len(seeds)
            and len(completed) >= 30
            and primary_coverage["passed"] is True
        ),
        "gameplay": episode_gameplay_summary(records),
        "primaryCurriculumCoverage": primary_coverage,
        "return": None if not returns else bootstrap_mean_interval(returns, seed=0xE1A1),
        "status": "ok",
        "waveDepth": None if not waves else bootstrap_mean_interval(waves, seed=0xE1A2),
    }


def extend_evaluation(
    checkpoint_path: Path,
    source_report: Mapping[str, Any],
    *,
    workers: int,
    action_repeat: int,
    maximum_steps: int,
    progress: Callable[[Mapping[str, Any]], None] | None = None,
) -> Mapping[str, Any]:
    if str(checkpoint_path.resolve()) != source_report.get("checkpoint"):
        raise ValueError("evaluation report belongs to a different checkpoint")
    report_hash = source_report.get("checkpointSha256")
    if not isinstance(report_hash, str) or report_hash != file_sha256(checkpoint_path):
        raise ValueError("evaluation report checkpoint hash has changed")
    existing = source_report.get("episodes")
    if not isinstance(existing, list):
        raise ValueError("evaluation report episodes are missing")
    incomplete_seeds = [
        int(episode["seed"]) for episode in existing if episode.get("aborted") is True
    ]
    if not incomplete_seeds:
        return source_report
    extended = evaluate_policy(
        checkpoint_path,
        incomplete_seeds,
        workers=min(workers, len(incomplete_seeds)),
        action_repeat=action_repeat,
        maximum_steps=maximum_steps,
        progress=progress,
    )
    replacements = {int(episode["seed"]): episode for episode in extended["episodes"]}
    merged = [
        replacements.get(int(episode["seed"]), episode) for episode in existing
    ]
    seeds = [int(episode["seed"]) for episode in existing]
    return evaluation_report(
        checkpoint_path,
        seeds,
        merged,
        action_repeat=action_repeat,
        choice_policy_mode=str(extended["choicePolicyMode"]),
        maximum_steps=maximum_steps,
    )


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


def choice_expert_tensors(
    dataset: ChoiceExpertDataset,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    return (
        torch.from_numpy(dataset.observations).to(device=device, dtype=torch.float32),
        torch.from_numpy(dataset.option_descriptors).to(device=device, dtype=torch.float32),
        torch.from_numpy(dataset.option_masks).to(device=device, dtype=torch.bool),
        torch.from_numpy(dataset.selected_options).to(device=device, dtype=torch.long),
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
    gameplay = aggregate_gameplay(rollout.gameplay_counters)
    choice_selections = choice_selection_summary(rollout.choice_intervals)
    return {
        "metrics_version": 7,
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
        "kl_divergence_max": main_metrics.get("approximate_kl_max", 0.0),
        "clip_fraction": main_metrics.get("clip_fraction", 0.0),
        "ppo_early_stop_fraction": main_metrics.get("early_stopped", 0.0),
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
            "selected_skill_ids": choice_selections["skills"],
            "selections_per_family": choice_selections["families"],
            "loss_alarm": bool(
                choice_metrics
                and abs(choice_metrics.get("policy_loss", 0.0))
                > max(abs(main_metrics.get("policy_loss", 0.0)), 1e-9) * 2
            ),
        },
        "reward_terms": reward_terms,
        "gameplay": gameplay,
        "spell_actions_by_skill_id": spell_action_summary(
            rollout.observations,
            rollout.actions["ability"],
        ),
        "maximum_equipped_skill_ranks": equipped_skill_rank_summary(
            rollout.observations,
        ),
        "return_normalization_std": return_scale,
        "choice_return_normalization_std": choice_return_scale,
        "gamma": configuration.gamma,
        "gae_lambda": configuration.gae_lambda,
        "action_repeat_ticks": configuration.action_repeat,
        "target_kl": configuration.target_kl,
    }


def choice_selection_summary(
    intervals: Sequence[Mapping[str, Any]],
) -> Mapping[str, Mapping[str, int]]:
    descriptor_indices = {
        name: index for index, name in enumerate(POLICY_SPEC.option_descriptor_names)
    }
    families: dict[str, int] = {}
    skills: dict[str, int] = {}
    for interval in intervals:
        selected = int(interval["selectedOption"])
        option_ids = interval["optionIds"]
        descriptors = np.asarray(interval["optionDescriptors"], dtype=np.float32)
        skill = str(int(option_ids[selected]))
        skills[skill] = skills.get(skill, 0) + 1
        row = descriptors[selected]
        selected_families = [
            name.removeprefix("family_")
            for name, index in descriptor_indices.items()
            if name.startswith("family_")
            and name not in ("family_element", "family_discipline")
            and row[index] > 0.5
        ] or ["unknown"]
        for family in selected_families:
            families[family] = families.get(family, 0) + 1
    return {
        "families": dict(sorted(families.items())),
        "skills": dict(sorted(skills.items(), key=lambda entry: int(entry[0]))),
    }


def aggregate_gameplay(
    steps: Sequence[Sequence[Mapping[str, Any]]],
) -> Mapping[str, Any]:
    totals: dict[str, Any] = {
        "enemy_kills": 0,
        "enemy_kills_by_kind": {},
        "waves_completed": 0,
        "potions_used": 0,
        "skill_picks": 0,
        "gold_collected": 0.0,
        "items_collected": 0,
        "item_kinds": {},
        "health_orbs_collected": 0,
        "mana_orbs_collected": 0,
        "powerups_collected": 0,
    }
    for worlds in steps:
        for row in worlds:
            totals["enemy_kills"] += int(row["enemyKills"])
            totals["waves_completed"] += int(row["wavesCompleted"])
            totals["potions_used"] += int(row["potionsUsed"])
            totals["skill_picks"] += int(row["skillPicks"])
            totals["gold_collected"] += float(row["goldCollected"])
            totals["items_collected"] += int(row["itemsCollected"])
            totals["health_orbs_collected"] += int(row["healthOrbsCollected"])
            totals["mana_orbs_collected"] += int(row["manaOrbsCollected"])
            totals["powerups_collected"] += int(row["powerupsCollected"])
            for source_name, target_name in (
                ("enemyKillsByKind", "enemy_kills_by_kind"),
                ("itemKinds", "item_kinds"),
            ):
                for name, value in row[source_name].items():
                    totals[target_name][name] = totals[target_name].get(name, 0) + int(value)
    return totals


def save_trainer_state(path: Path, value: Mapping[str, Any]) -> None:
    stream = io.BytesIO()
    torch.save(dict(value), stream)
    atomic_write(path, stream.getvalue())


def load_trainer_state(path: Path) -> Mapping[str, Any]:
    value = torch.load(path, map_location="cpu", weights_only=False)
    if not isinstance(value, Mapping) or value.get("trainerVersion") != 7:
        raise ValueError("trainer state is not strict version 7")
    return value


def validate_resume_state(
    state: Mapping[str, Any],
    checkpoint_path: Path,
    configuration: TrainingConfiguration,
    metadata: Mapping[str, Any],
) -> None:
    if state.get("choiceOptimizerScope") != CHOICE_OPTIMIZER_SCOPE:
        raise ValueError(
            "trainer state uses an incompatible choice optimizer scope; "
            "start a clean output directory from the runtime checkpoint"
        )
    expected_hash = state.get("runtimeCheckpointSha256")
    if not isinstance(expected_hash, str) or expected_hash != file_sha256(checkpoint_path):
        raise ValueError("trainer state does not belong to the supplied runtime checkpoint")
    stored_configuration = state.get("configuration")
    if not isinstance(stored_configuration, Mapping):
        raise ValueError("trainer state configuration is missing")
    current = asdict(configuration)
    for name, value in stored_configuration.items():
        if name == "iterations":
            continue
        if current.get(name) != value:
            raise ValueError(f"resume configuration changed immutable field {name}")
    if (
        int(metadata.get("trainedEnvironmentSteps", -1)) != int(state.get("environmentSteps", -2))
        or int(metadata.get("trainedUpdates", -1)) != int(state.get("completedUpdates", -2))
    ):
        raise ValueError("runtime checkpoint and trainer progress counters disagree")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checkpoint_training_configuration(
    configuration: TrainingConfiguration,
) -> Mapping[str, Any]:
    return {
        name: (
            np.format_float_positional(value, unique=True, trim="-")
            if isinstance(value, float)
            else value
        )
        for name, value in asdict(configuration).items()
    }


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


def validate_choice_bootstrap_configuration(value: ChoiceBootstrapConfiguration) -> None:
    positive = (
        value.samples,
        value.epochs,
        value.batch_size,
        value.worlds,
        value.workers,
        value.action_repeat,
    )
    if any(entry < 1 for entry in positive) or not 0 < value.validation_fraction < 1:
        raise ValueError("choice bootstrap configuration is invalid")
    if not math.isfinite(value.learning_rate) or value.learning_rate <= 0:
        raise ValueError("choice bootstrap learning rate must be positive")


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
    if not math.isfinite(value.target_kl) or value.target_kl <= 0:
        raise ValueError("target KL must be positive and finite")
