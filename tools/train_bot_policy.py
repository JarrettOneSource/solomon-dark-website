#!/usr/bin/env python3
"""Train, evaluate, and validate the Solomon Dark web policy-v5 bot."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
import sys
from typing import Any, Sequence

from ml_bot.checkpoint import atomic_write, load_checkpoint
from ml_bot.model import PolicyV5
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
    return result


def run_validate(args: argparse.Namespace) -> Any:
    metadata, tensors = load_checkpoint(Path(args.checkpoint).resolve())
    policy = PolicyV5()
    policy.load_tensors(tensors)
    return {
        "status": "ok",
        "checkpoint": str(Path(args.checkpoint).resolve()),
        "metadata": metadata,
        "observationSize": POLICY_SPEC.observation_size,
        "optionDescriptorSize": POLICY_SPEC.option_descriptor_size,
        "parameterCount": sum(parameter.numel() for parameter in policy.parameters()),
    }


def run_self_test(_args: argparse.Namespace) -> None:
    if self_test() != 0:
        raise RuntimeError("ML bot self-test failed")
    return None


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
