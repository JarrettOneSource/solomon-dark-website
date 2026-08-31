#!/usr/bin/env python3
"""Train, evaluate, and validate the Solomon Dark web policy-v7 bot."""

from __future__ import annotations

import argparse
from dataclasses import asdict, replace
import json
from pathlib import Path
import sys
from typing import Any, Sequence

import numpy as np
import torch

from ml_bot.checkpoint import atomic_write, load_checkpoint, typescript_checkpoint_report
from ml_bot.arena import checkpoint_arena
from ml_bot.model import PolicyV7
from ml_bot.diagnostics import render_dashboard, render_replay
from ml_bot.metrics import (
    evaluation_checkpoint_identity,
    promotion_decision,
    training_summary,
)
from ml_bot.probes import behavior_probe_scorecard, choice_retention_scorecard
from ml_bot.spec import POLICY_SPEC, REPOSITORY_ROOT
from ml_bot.trainer import (
    BootstrapConfiguration,
    ChoiceBootstrapConfiguration,
    TrainingConfiguration,
    bootstrap_choice_policy,
    bootstrap_policy,
    evaluate_policy,
    extend_evaluation,
    train_policy,
)

DEFAULT_OUTPUT = REPOSITORY_ROOT / "runtime/ml-training/web-v7"
DEFAULT_EVAL_SEEDS = REPOSITORY_ROOT / "tools/ml_bot/eval-seeds.json"


def main(argv: Sequence[str] | None = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)
    result = args.handler(args)
    if result is not None:
        print(json.dumps(result, indent=2, allow_nan=False, sort_keys=True))
    return 0


def run_bootstrap(args: argparse.Namespace) -> Any:
    configuration = bootstrap_configuration(args)
    return bootstrap_policy(
        Path(args.output).resolve(),
        configuration,
        dataset_path=None if args.dataset is None else Path(args.dataset).resolve(),
    )


def run_choice_bootstrap(args: argparse.Namespace) -> Any:
    configuration = ChoiceBootstrapConfiguration(
        samples=args.samples,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        validation_fraction=args.validation_fraction,
        worlds=args.worlds,
        workers=args.workers,
        action_repeat=args.action_repeat,
        seed=args.seed,
    )
    return bootstrap_choice_policy(
        Path(args.checkpoint).resolve(),
        Path(args.output).resolve(),
        configuration,
        dataset_path=None if args.dataset is None else Path(args.dataset).resolve(),
    )


def run_train(args: argparse.Namespace) -> Any:
    output = Path(args.output).resolve()
    configuration = training_configuration(args)
    register_experiment(
        output,
        args.experiment,
        args.expected_metric,
        args.eval_condition,
        configuration,
    )
    return train_policy(
        Path(args.checkpoint).resolve(),
        output,
        configuration,
        resume=args.resume,
    )


def run_campaign(args: argparse.Namespace) -> Any:
    output = Path(args.output).resolve()
    bootstrap = bootstrap_policy(
        output,
        bootstrap_configuration(args),
        dataset_path=None if args.dataset is None else Path(args.dataset).resolve(),
    )
    configuration = training_configuration(args)
    register_experiment(
        output,
        args.experiment,
        args.expected_metric,
        args.eval_condition,
        configuration,
    )
    trained = train_policy(
        Path(str(bootstrap["checkpoint"])),
        output,
        configuration,
    )
    return {"status": "ok", "bootstrap": bootstrap, "training": trained}


def run_gamma_sweep(args: argparse.Namespace) -> Any:
    output = Path(args.output).resolve()
    base = training_configuration(args)
    results = {}
    for gamma in args.gammas:
        configuration = replace(base, gamma=gamma)
        destination = output / f"gamma-{str(gamma).replace('.', 'p')}"
        register_experiment(
            destination,
            f"Gamma sweep {gamma}",
            args.expected_metric,
            args.eval_condition,
            configuration,
        )
        results[str(gamma)] = train_policy(
            Path(args.checkpoint).resolve(),
            destination,
            configuration,
        )
    return {"status": "ok", "gammas": results}


def run_evaluate(args: argparse.Namespace) -> Any:
    source = json.loads(Path(args.seeds).read_text(encoding="utf-8"))
    if not isinstance(source, dict) or args.seed_set not in source:
        raise ValueError(f"evaluation seed set {args.seed_set} is missing")
    seeds = source[args.seed_set]
    if not isinstance(seeds, list) or len(seeds) < 30:
        raise ValueError("frozen evaluation requires at least 30 seeds")
    result = evaluate_policy(
        Path(args.checkpoint).resolve(),
        seeds,
        workers=args.workers,
        action_repeat=args.action_repeat,
        maximum_steps=args.maximum_steps,
        progress=lambda value: print(
            json.dumps({"evaluationProgress": value}, sort_keys=True),
            file=sys.stderr,
            flush=True,
        ),
    )
    if args.report:
        atomic_write(
            Path(args.report).resolve(),
            (json.dumps(result, indent=2, allow_nan=False, sort_keys=True) + "\n").encode(),
        )
    if not result["validForPromotion"] and not args.allow_incomplete:
        raise RuntimeError(
            "evaluation is not promotion-valid: "
            f"{result['completeEpisodes']}/{result['requestedEpisodes']} complete episodes"
        )
    return result


def run_validate(args: argparse.Namespace) -> Any:
    metadata, tensors = load_checkpoint(Path(args.checkpoint).resolve())
    policy = PolicyV7()
    policy.load_tensors(tensors)
    typescript = typescript_checkpoint_report(Path(args.checkpoint).resolve())
    if typescript.get("sha256") != typescript.get("reencodedSha256"):
        raise ValueError("Python and TypeScript checkpoint codecs are not byte-identical")
    observation = checkpoint_test_observation()
    full_plans = {
        "movement": torch.ones((1, 9), dtype=torch.bool),
        "target": torch.ones((1, 9), dtype=torch.bool),
        "ability_by_target": torch.ones((1, 9, 22), dtype=torch.bool),
        "aim_by_ability": torch.ones((1, 22, 9), dtype=torch.bool),
    }

    with torch.no_grad():
        python_result = policy.act(observation, full_plans, deterministic=True)
        choice_descriptors = torch.from_numpy(
            np.asarray([
                ((index % 31) - 15) / 15
                for index in range(3 * POLICY_SPEC.option_descriptor_size)
            ], dtype=np.float32).reshape(1, 3, POLICY_SPEC.option_descriptor_size)
        )
        choice_selected, choice_result = policy.select_choice(
            observation,
            choice_descriptors,
            torch.tensor([[True, True, False]]),
            temperature=float(metadata["choiceTemperature"]),
            deterministic=True,
        )
    python_actions = {name: int(value[0]) for name, value in python_result.actions.items()}
    if python_actions != typescript.get("actions"):
        raise ValueError("Python and TypeScript checkpoint actions disagree")
    value_error = abs(float(python_result.value[0]) - float(typescript["value"]))
    log_error = abs(
        float(python_result.log_probability[0]) - float(typescript["logProbability"])
    )
    if value_error > 1e-4 or log_error > 1e-4:
        raise ValueError("Python and TypeScript checkpoint numerics disagree")
    typescript_choice = typescript.get("choice")
    if not isinstance(typescript_choice, dict):
        raise ValueError("TypeScript checkpoint choice result is missing")
    choice_value_error = abs(
        float(choice_result.value[0]) - float(typescript_choice["value"])
    )
    choice_log_error = abs(
        float(choice_result.log_probability[0])
        - float(typescript_choice["logProbability"])
    )
    if (
        int(choice_selected[0]) != int(typescript_choice["selectedOption"])
        or choice_value_error > 1e-4
        or choice_log_error > 1e-4
    ):
        raise ValueError("Python and TypeScript checkpoint choice numerics disagree")
    return {
        "status": "ok",
        "checkpoint": str(Path(args.checkpoint).resolve()),
        "metadata": {
            name: metadata.get(name)
            for name in (
                "architecture",
                "choiceOptimizerScope",
                "choicePolicyMode",
                "choiceTemperature",
                "modelVersion",
                "observationVersion",
                "seed",
                "trainedEnvironmentSteps",
                "trainedUpdates",
            )
        },
        "observationSize": POLICY_SPEC.observation_size,
        "optionDescriptorSize": POLICY_SPEC.option_descriptor_size,
        "parameterCount": sum(parameter.numel() for parameter in policy.parameters()),
        "inferenceParity": {
            "actions": python_actions,
            "logProbabilityAbsoluteError": log_error,
            "valueAbsoluteError": value_error,
            "typescript": typescript,
        },
        "choiceInferenceParity": {
            "selectedOption": int(choice_selected[0]),
            "logProbabilityAbsoluteError": choice_log_error,
            "valueAbsoluteError": choice_value_error,
        },
    }


def run_extend_evaluate(args: argparse.Namespace) -> Any:
    source = json.loads(Path(args.report).read_text(encoding="utf-8"))
    result = extend_evaluation(
        Path(args.checkpoint).resolve(),
        source,
        workers=args.workers,
        action_repeat=args.action_repeat,
        maximum_steps=args.maximum_steps,
        progress=lambda value: print(
            json.dumps({"evaluationProgress": value}, sort_keys=True),
            file=sys.stderr,
            flush=True,
        ),
    )
    atomic_write(
        Path(args.output).resolve(),
        (json.dumps(result, indent=2, allow_nan=False, sort_keys=True) + "\n").encode(),
    )
    if not result["validForPromotion"] and not args.allow_incomplete:
        raise RuntimeError(
            "extended evaluation is not promotion-valid: "
            f"{result['completeEpisodes']}/{result['requestedEpisodes']} complete episodes"
        )
    return result


def checkpoint_test_observation():
    import numpy as np

    values = np.asarray(
        [((index % 97) - 48) / 48 for index in range(POLICY_SPEC.observation_size)],
        dtype=np.float32,
    )
    return torch.from_numpy(values[None, :])


def run_diagnostics(args: argparse.Namespace) -> Any:
    return render_dashboard(Path(args.training_directory).resolve(), Path(args.output).resolve())


def run_replay(args: argparse.Namespace) -> Any:
    return render_replay(Path(args.source).resolve(), Path(args.output).resolve())


def run_probes(args: argparse.Namespace) -> Any:
    return behavior_probe_scorecard(
        Path(args.checkpoint).resolve(),
        Path(args.dataset).resolve(),
        Path(args.output).resolve(),
    )


def run_choice_retention(args: argparse.Namespace) -> Any:
    return choice_retention_scorecard(
        Path(args.checkpoint).resolve(),
        Path(args.dataset).resolve(),
        Path(args.output).resolve(),
        seed=args.seed,
        validation_fraction=args.validation_fraction,
    )


def run_promote(args: argparse.Namespace) -> Any:
    reports = {
        name: json.loads(Path(path).read_text(encoding="utf-8"))
        for name, path in {
            "incumbentTrain": args.incumbent_train,
            "candidateTrain": args.candidate_train,
            "incumbentHoldout": args.incumbent_holdout,
            "candidateHoldout": args.candidate_holdout,
        }.items()
    }
    if any(report.get("validForPromotion") is not True for report in reports.values()):
        raise ValueError("all four evaluation reports must be promotion-valid")
    incumbent_identity = evaluation_checkpoint_identity(
        reports["incumbentTrain"],
        reports["incumbentHoldout"],
        label="incumbent",
        accepted_versions=(5, 6, 7),
    )
    candidate_identity = evaluation_checkpoint_identity(
        reports["candidateTrain"], reports["candidateHoldout"], label="candidate"
    )
    incumbent_train, candidate_train = paired_wave_vectors(
        reports["incumbentTrain"], reports["candidateTrain"]
    )
    incumbent_holdout, candidate_holdout = paired_wave_vectors(
        reports["incumbentHoldout"], reports["candidateHoldout"]
    )
    result = promotion_decision(
        incumbent_train,
        candidate_train,
        incumbent_holdout,
        candidate_holdout,
    )
    incumbent_checkpoint = incumbent_identity["checkpoint"]
    candidate_checkpoint = candidate_identity["checkpoint"]
    result = {
        **result,
        "incumbentCheckpoint": incumbent_checkpoint,
        "incumbentCheckpointSha256": incumbent_identity["checkpointSha256"],
        "candidateCheckpoint": candidate_checkpoint,
        "candidateCheckpointSha256": candidate_identity["checkpointSha256"],
        "selectedCheckpoint": (
            candidate_checkpoint if result["promoted"] else incumbent_checkpoint
        ),
        "selectedCheckpointSha256": (
            candidate_identity["checkpointSha256"]
            if result["promoted"]
            else incumbent_identity["checkpointSha256"]
        ),
    }
    atomic_write(
        Path(args.output).resolve(),
        (json.dumps(result, indent=2, allow_nan=False, sort_keys=True) + "\n").encode(),
    )
    return result


def run_arena(args: argparse.Namespace) -> Any:
    seed_document = json.loads(Path(args.seeds).read_text(encoding="utf-8"))
    seeds = seed_document[args.seed_set][: args.seed_count]
    checkpoints = {}
    for entry in args.checkpoint:
        if "=" not in entry:
            raise ValueError("arena checkpoints must use NAME=PATH")
        name, path = entry.split("=", 1)
        if not name or name in checkpoints:
            raise ValueError("arena checkpoint names must be unique and nonempty")
        checkpoints[name] = Path(path).resolve()
    report = checkpoint_arena(
        checkpoints,
        seeds,
        workers=args.workers,
        action_repeat=args.action_repeat,
        maximum_steps=args.maximum_steps,
        output=Path(args.output).resolve(),
    )
    return {
        "status": "ok",
        "winner": report["winner"],
        "promotionScale": report["promotionScale"],
        "ladder": [
            {key: value for key, value in entry.items() if key != "evaluation"}
            for entry in report["ladder"]
        ],
        "output": str(Path(args.output).resolve()),
    }


def run_summary(args: argparse.Namespace) -> Any:
    result = training_summary(
        Path(args.training_directory).resolve(),
        Path(args.checkpoint).resolve(),
    )
    atomic_write(
        Path(args.output).resolve(),
        (json.dumps(result, indent=2, allow_nan=False, sort_keys=True) + "\n").encode(),
    )
    return result


def paired_wave_vectors(first: Any, second: Any) -> tuple[list[float], list[float]]:
    def rows(report: Any) -> dict[int, float]:
        return {
            int(episode["seed"]): float(episode["waves_reached"])
            for episode in report["episodes"]
            if episode.get("aborted") is False
        }

    first_rows = rows(first)
    second_rows = rows(second)
    if set(first_rows) != set(second_rows):
        raise ValueError("evaluation reports do not contain the same seeds")
    seeds = sorted(first_rows)
    return [first_rows[seed] for seed in seeds], [second_rows[seed] for seed in seeds]


def bootstrap_configuration(args: argparse.Namespace) -> BootstrapConfiguration:
    return BootstrapConfiguration(
        samples=args.samples,
        epochs=args.bootstrap_epochs,
        batch_size=args.bootstrap_batch_size,
        learning_rate=args.bootstrap_learning_rate,
        validation_fraction=args.validation_fraction,
        worlds=args.worlds,
        workers=args.workers,
        action_repeat=args.action_repeat,
        seed=args.seed,
    )


def training_configuration(args: argparse.Namespace) -> TrainingConfiguration:
    return TrainingConfiguration(
        iterations=args.iterations,
        rollout_steps=args.rollout_steps,
        epochs=args.ppo_epochs,
        batch_size=args.ppo_batch_size,
        choice_batch_size=args.choice_batch_size,
        minimum_choice_batch=args.minimum_choice_batch,
        learning_rate=args.learning_rate,
        choice_learning_rate=args.choice_learning_rate,
        gamma=args.gamma,
        gae_lambda=args.gae_lambda,
        target_kl=args.target_kl,
        worlds=args.worlds,
        workers=args.workers,
        action_repeat=args.action_repeat,
        seed=args.seed,
    )


def register_experiment(
    output: Path,
    change: str,
    expected_metric: str,
    eval_condition: str,
    configuration: TrainingConfiguration,
) -> None:
    if not change.strip() or not expected_metric.strip() or not eval_condition.strip():
        raise ValueError("experiment change, expected metric, and eval condition are required")
    output.mkdir(parents=True, exist_ok=True)
    path = output / "experiments.md"
    if not path.exists():
        path.write_text(
            "# ML policy experiments\n\n"
            "| Change | Expected metric | Evaluation condition | Configuration |\n"
            "| --- | --- | --- | --- |\n",
            encoding="utf-8",
        )
    configuration_json = json.dumps(asdict(configuration), sort_keys=True).replace("|", "\\|")
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(
            f"| {change.strip()} | {expected_metric.strip()} | "
            f"{eval_condition.strip()} | `{configuration_json}` |\n"
        )


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    diagnostics_parser = subparsers.add_parser(
        "diagnostics", help="render a self-contained training dashboard"
    )
    diagnostics_parser.add_argument("--training-directory", required=True)
    diagnostics_parser.add_argument("--output", required=True)
    diagnostics_parser.set_defaults(handler=run_diagnostics)

    replay_parser = subparsers.add_parser("replay", help="render a spatial replay")
    replay_parser.add_argument("--source", required=True)
    replay_parser.add_argument("--output", required=True)
    replay_parser.set_defaults(handler=run_replay)

    probes_parser = subparsers.add_parser(
        "probes", help="score checkpoint decisions on curated expert-state slices"
    )
    probes_parser.add_argument("--checkpoint", required=True)
    probes_parser.add_argument("--dataset", required=True)
    probes_parser.add_argument("--output", required=True)
    probes_parser.set_defaults(handler=run_probes)

    choice_retention_parser = subparsers.add_parser(
        "choice-retention",
        help="score learned-choice imitation retention on the frozen expert split",
    )
    choice_retention_parser.add_argument("--checkpoint", required=True)
    choice_retention_parser.add_argument("--dataset", required=True)
    choice_retention_parser.add_argument("--output", required=True)
    choice_retention_parser.add_argument("--seed", type=uint32, default=0x5EED_2000)
    choice_retention_parser.add_argument("--validation-fraction", type=fraction, default=0.2)
    choice_retention_parser.set_defaults(handler=run_choice_retention)

    promote_parser = subparsers.add_parser("promote", help="apply the frozen paired-seed rule")
    promote_parser.add_argument("--incumbent-train", required=True)
    promote_parser.add_argument("--candidate-train", required=True)
    promote_parser.add_argument("--incumbent-holdout", required=True)
    promote_parser.add_argument("--candidate-holdout", required=True)
    promote_parser.add_argument("--output", required=True)
    promote_parser.set_defaults(handler=run_promote)

    arena_parser = subparsers.add_parser("arena", help="rank checkpoints on identical seeds")
    arena_parser.add_argument("--checkpoint", action="append", required=True)
    arena_parser.add_argument("--seeds", default=str(DEFAULT_EVAL_SEEDS))
    arena_parser.add_argument(
        "--seed-set", choices=("eval_train_dist", "eval_holdout"), required=True
    )
    arena_parser.add_argument("--seed-count", type=positive_integer, default=4)
    arena_parser.add_argument("--workers", type=positive_integer, default=4)
    arena_parser.add_argument("--action-repeat", type=positive_integer, default=10)
    arena_parser.add_argument("--maximum-steps", type=positive_integer, default=1_500)
    arena_parser.add_argument("--output", required=True)
    arena_parser.set_defaults(handler=run_arena)

    summary_parser = subparsers.add_parser("summarize", help="write one campaign report")
    summary_parser.add_argument("--training-directory", required=True)
    summary_parser.add_argument("--checkpoint", required=True)
    summary_parser.add_argument("--output", required=True)
    summary_parser.set_defaults(handler=run_summary)

    validate_parser = subparsers.add_parser("validate", help="validate a strict v7 checkpoint")
    validate_parser.add_argument("--checkpoint", required=True)
    validate_parser.set_defaults(handler=run_validate)

    bootstrap_parser = subparsers.add_parser("bootstrap", help="imitate the web semantic expert")
    add_output(bootstrap_parser)
    add_bootstrap(bootstrap_parser)
    bootstrap_parser.set_defaults(handler=run_bootstrap)

    choice_bootstrap_parser = subparsers.add_parser(
        "bootstrap-choices",
        help="warm-start the learned skill chooser from authoritative scripted offers",
    )
    add_output(choice_bootstrap_parser)
    choice_bootstrap_parser.add_argument("--checkpoint", required=True)
    choice_bootstrap_parser.add_argument("--samples", type=positive_integer, default=512)
    choice_bootstrap_parser.add_argument("--epochs", type=positive_integer, default=30)
    choice_bootstrap_parser.add_argument("--batch-size", type=positive_integer, default=64)
    choice_bootstrap_parser.add_argument("--learning-rate", type=positive_float, default=0.001)
    choice_bootstrap_parser.add_argument("--validation-fraction", type=fraction, default=0.2)
    choice_bootstrap_parser.add_argument("--dataset")
    add_environment(choice_bootstrap_parser)
    choice_bootstrap_parser.set_defaults(handler=run_choice_bootstrap)

    train_parser = subparsers.add_parser("train", help="run headless PyTorch PPO")
    add_output(train_parser)
    add_training(train_parser)
    train_parser.add_argument("--checkpoint", required=True)
    train_parser.add_argument("--resume", action="store_true")
    train_parser.set_defaults(handler=run_train)

    sweep_parser = subparsers.add_parser("gamma-sweep", help="train the four approved horizons")
    add_output(sweep_parser)
    add_training(sweep_parser, gamma=False)
    sweep_parser.add_argument("--checkpoint", required=True)
    sweep_parser.add_argument(
        "--gammas", type=gamma_list, default=[0.99, 0.995, 0.997, 0.999]
    )
    sweep_parser.set_defaults(handler=run_gamma_sweep)

    campaign_parser = subparsers.add_parser("campaign", help="bootstrap then train")
    add_output(campaign_parser)
    add_bootstrap(campaign_parser, environment=False)
    add_training(campaign_parser, environment=False)
    add_environment(campaign_parser)
    campaign_parser.set_defaults(handler=run_campaign)

    evaluate_parser = subparsers.add_parser("evaluate", help="run a frozen deterministic seed set")
    evaluate_parser.add_argument("--checkpoint", required=True)
    evaluate_parser.add_argument("--seeds", default=str(DEFAULT_EVAL_SEEDS))
    evaluate_parser.add_argument(
        "--seed-set", choices=("eval_train_dist", "eval_holdout"), required=True
    )
    evaluate_parser.add_argument("--workers", type=positive_integer, default=8)
    evaluate_parser.add_argument("--action-repeat", type=positive_integer, default=10)
    evaluate_parser.add_argument("--maximum-steps", type=positive_integer, default=3_000)
    evaluate_parser.add_argument("--report")
    evaluate_parser.add_argument("--allow-incomplete", action="store_true")
    evaluate_parser.set_defaults(handler=run_evaluate)

    extend_parser = subparsers.add_parser(
        "extend-evaluate", help="rerun only horizon-truncated evaluation seeds"
    )
    extend_parser.add_argument("--checkpoint", required=True)
    extend_parser.add_argument("--report", required=True)
    extend_parser.add_argument("--output", required=True)
    extend_parser.add_argument("--workers", type=positive_integer, default=8)
    extend_parser.add_argument("--action-repeat", type=positive_integer, default=10)
    extend_parser.add_argument("--maximum-steps", type=positive_integer, default=10_000)
    extend_parser.add_argument("--allow-incomplete", action="store_true")
    extend_parser.set_defaults(handler=run_extend_evaluate)
    return parser


def add_output(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))


def add_bootstrap(parser: argparse.ArgumentParser, *, environment: bool = True) -> None:
    parser.add_argument("--samples", type=positive_integer, default=6_000)
    parser.add_argument("--bootstrap-epochs", type=positive_integer, default=20)
    parser.add_argument("--bootstrap-batch-size", type=positive_integer, default=128)
    parser.add_argument("--bootstrap-learning-rate", type=positive_float, default=0.0015)
    parser.add_argument("--validation-fraction", type=fraction, default=0.2)
    parser.add_argument("--dataset")
    if environment:
        add_environment(parser)


def add_training(
    parser: argparse.ArgumentParser,
    *,
    environment: bool = True,
    gamma: bool = True,
) -> None:
    parser.add_argument("--iterations", type=positive_integer, default=10)
    parser.add_argument("--rollout-steps", type=positive_integer, default=1_024)
    parser.add_argument("--ppo-epochs", type=positive_integer, default=4)
    parser.add_argument("--ppo-batch-size", type=positive_integer, default=128)
    parser.add_argument("--choice-batch-size", type=positive_integer, default=32)
    parser.add_argument("--minimum-choice-batch", type=positive_integer, default=32)
    parser.add_argument("--learning-rate", type=positive_float, default=0.0003)
    parser.add_argument("--choice-learning-rate", type=positive_float, default=0.0003)
    if gamma:
        parser.add_argument(
            "--gamma", type=float, choices=(0.99, 0.995, 0.997, 0.999), default=0.995
        )
    else:
        parser.set_defaults(gamma=0.995)
    parser.add_argument("--gae-lambda", type=closed_fraction, default=0.95)
    parser.add_argument("--target-kl", type=positive_float, default=0.02)
    parser.add_argument("--experiment", default="First schema-v7 web headless PPO campaign")
    parser.add_argument("--expected-metric", default="holdout wave depth increases")
    parser.add_argument("--eval-condition", default="frozen train-dist and holdout seeds")
    if environment:
        add_environment(parser)


def add_environment(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--worlds", type=positive_integer, default=8)
    parser.add_argument("--workers", type=positive_integer, default=8)
    parser.add_argument("--action-repeat", type=positive_integer, default=10)
    parser.add_argument("--seed", type=uint32, default=0x5EED_1000)


def positive_integer(value: str) -> int:
    parsed = int(value, 0)
    if parsed < 1:
        raise argparse.ArgumentTypeError("expected a positive integer")
    return parsed


def uint32(value: str) -> int:
    parsed = int(value, 0)
    if not 0 <= parsed <= 0xFFFF_FFFF:
        raise argparse.ArgumentTypeError("expected a uint32")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("expected a positive number")
    return parsed


def fraction(value: str) -> float:
    parsed = float(value)
    if not 0 < parsed < 1:
        raise argparse.ArgumentTypeError("expected a fraction within (0, 1)")
    return parsed


def closed_fraction(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("expected a fraction within [0, 1]")
    return parsed


def gamma_list(value: str) -> list[float]:
    parsed = [float(entry) for entry in value.split(",") if entry]
    allowed = {0.99, 0.995, 0.997, 0.999}
    if not parsed or any(entry not in allowed for entry in parsed) or len(set(parsed)) != len(parsed):
        raise argparse.ArgumentTypeError("expected unique approved gammas separated by commas")
    return parsed


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as error:
        print(f"ML bot training error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
