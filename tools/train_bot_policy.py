#!/usr/bin/env python3
"""Train, evaluate, and validate the Solomon Dark web policy-v5 bot."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
import sys
from typing import Any, Sequence

import torch

from ml_bot.checkpoint import atomic_write, load_checkpoint, typescript_checkpoint_report
from ml_bot.model import PolicyV5
from ml_bot.diagnostics import render_dashboard, render_replay
from ml_bot.metrics import promotion_decision
from ml_bot.probes import behavior_probe_scorecard
from ml_bot.self_test import main as self_test
from ml_bot.spec import POLICY_SPEC, REPOSITORY_ROOT
from ml_bot.trainer import (
    BootstrapConfiguration,
    TrainingConfiguration,
    bootstrap_policy,
    evaluate_policy,
    train_policy,
)

DEFAULT_OUTPUT = REPOSITORY_ROOT / "runtime/ml-training/web-v5"
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
    policy = PolicyV5()
    policy.load_tensors(tensors)
    typescript = typescript_checkpoint_report(Path(args.checkpoint).resolve())
    observation = checkpoint_test_observation()
    full_plans = {
        "movement": torch.ones((1, 9), dtype=torch.bool),
        "target": torch.ones((1, 9), dtype=torch.bool),
        "ability_by_target": torch.ones((1, 9, 22), dtype=torch.bool),
        "aim_by_ability": torch.ones((1, 22, 9), dtype=torch.bool),
    }
    with torch.no_grad():
        python_result = policy.act(observation, full_plans, deterministic=True)
    python_actions = {name: int(value[0]) for name, value in python_result.actions.items()}
    if python_actions != typescript.get("actions"):
        raise ValueError("Python and TypeScript checkpoint actions disagree")
    value_error = abs(float(python_result.value[0]) - float(typescript["value"]))
    log_error = abs(
        float(python_result.log_probability[0]) - float(typescript["logProbability"])
    )
    if value_error > 1e-4 or log_error > 1e-4:
        raise ValueError("Python and TypeScript checkpoint numerics disagree")
    return {
        "status": "ok",
        "checkpoint": str(Path(args.checkpoint).resolve()),
        "metadata": metadata,
        "observationSize": POLICY_SPEC.observation_size,
        "optionDescriptorSize": POLICY_SPEC.option_descriptor_size,
        "parameterCount": sum(parameter.numel() for parameter in policy.parameters()),
        "inferenceParity": {
            "actions": python_actions,
            "logProbabilityAbsoluteError": log_error,
            "valueAbsoluteError": value_error,
            "typescript": typescript,
        },
    }


def checkpoint_test_observation():
    import numpy as np

    values = np.asarray([((index % 97) - 48) / 48 for index in range(1_784)], dtype=np.float32)
    return torch.from_numpy(values[None, :])


def run_self_test(_args: argparse.Namespace) -> None:
    if self_test() != 0:
        raise RuntimeError("ML bot self-test failed")
    return None


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

    self_parser = subparsers.add_parser("self-test", help="exercise every training boundary")
    self_parser.set_defaults(handler=run_self_test)

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

    promote_parser = subparsers.add_parser("promote", help="apply the frozen paired-seed rule")
    promote_parser.add_argument("--incumbent-train", required=True)
    promote_parser.add_argument("--candidate-train", required=True)
    promote_parser.add_argument("--incumbent-holdout", required=True)
    promote_parser.add_argument("--candidate-holdout", required=True)
    promote_parser.add_argument("--output", required=True)
    promote_parser.set_defaults(handler=run_promote)

    validate_parser = subparsers.add_parser("validate", help="validate a strict v5 checkpoint")
    validate_parser.add_argument("--checkpoint", required=True)
    validate_parser.set_defaults(handler=run_validate)

    bootstrap_parser = subparsers.add_parser("bootstrap", help="imitate the web semantic expert")
    add_output(bootstrap_parser)
    add_bootstrap(bootstrap_parser)
    bootstrap_parser.set_defaults(handler=run_bootstrap)

    train_parser = subparsers.add_parser("train", help="run headless PyTorch PPO")
    add_output(train_parser)
    add_training(train_parser)
    train_parser.add_argument("--checkpoint", required=True)
    train_parser.add_argument("--resume", action="store_true")
    train_parser.set_defaults(handler=run_train)

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


def add_training(parser: argparse.ArgumentParser, *, environment: bool = True) -> None:
    parser.add_argument("--iterations", type=positive_integer, default=10)
    parser.add_argument("--rollout-steps", type=positive_integer, default=1_024)
    parser.add_argument("--ppo-epochs", type=positive_integer, default=4)
    parser.add_argument("--ppo-batch-size", type=positive_integer, default=128)
    parser.add_argument("--choice-batch-size", type=positive_integer, default=32)
    parser.add_argument("--minimum-choice-batch", type=positive_integer, default=32)
    parser.add_argument("--learning-rate", type=positive_float, default=0.0003)
    parser.add_argument("--choice-learning-rate", type=positive_float, default=0.0003)
    parser.add_argument("--gamma", type=float, choices=(0.99, 0.995, 0.997, 0.999), default=0.995)
    parser.add_argument("--gae-lambda", type=closed_fraction, default=0.95)
    parser.add_argument("--target-kl", type=positive_float, default=0.02)
    parser.add_argument("--experiment", default="First schema-v5 web headless PPO campaign")
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


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as error:
        print(f"ML bot training error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
