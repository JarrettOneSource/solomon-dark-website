"""Behavior cloning plus clipped PPO updates for both policy surfaces."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Mapping

import numpy as np
import torch
from torch import Tensor

from .model import PolicyV7, choice_temperature_column
from .spec import POLICY_SPEC

ENTROPY_COEFFICIENTS = {
    "movement": 0.01,
    "target": 0.02,
    "ability": 0.01,
    "aim": 0.01,
}
CHOICE_ENTROPY_COEFFICIENT = 0.05
CHOICE_COVERAGE_THRESHOLD = 20


@dataclass(frozen=True)
class BootstrapMetrics:
    loss: float
    gradient_norm: float
    movement_accuracy: float
    target_accuracy: float
    ability_accuracy: float
    aim_accuracy: float
    joint_accuracy: float


@dataclass(frozen=True)
class PpoMetrics:
    policy_loss: float
    value_loss: float
    approximate_kl: float
    clip_fraction: float
    gradient_norm: float
    entropy_movement: float
    entropy_target: float
    entropy_ability: float
    entropy_aim: float
    early_stopped: bool


@dataclass(frozen=True)
class ChoicePpoMetrics:
    policy_loss: float
    value_loss: float
    approximate_kl: float
    clip_fraction: float
    gradient_norm: float
    normalized_entropy: float
    temperature: float


@dataclass(frozen=True)
class ChoiceBootstrapMetrics:
    loss: float
    gradient_norm: float
    accuracy: float


class ChoiceCoverage:
    def __init__(self, counts: Mapping[str, int] | None = None) -> None:
        self.counts = dict(counts or {})
        if any(
            not isinstance(key, str)
            or not key
            or not isinstance(count, int)
            or isinstance(count, bool)
            or count < 0
            for key, count in self.counts.items()
        ):
            raise ValueError("choice coverage must contain nonnegative integer counts")

    def observe(self, descriptors: np.ndarray, mask: np.ndarray, selected: int) -> None:
        descriptors = np.asarray(descriptors, dtype=np.float32)
        mask = np.asarray(mask, dtype=bool)
        if (
            descriptors.ndim != 2
            or descriptors.shape[1] != POLICY_SPEC.option_descriptor_size
            or mask.shape != (descriptors.shape[0],)
            or not np.any(mask)
            or not 0 <= selected < descriptors.shape[0]
            or not mask[selected]
        ):
            raise ValueError("choice coverage event is invalid")
        for index in np.flatnonzero(mask):
            for key in descriptor_keys(descriptors[index]):
                self.counts.setdefault(key, 0)
        for key in descriptor_keys(descriptors[selected]):
            self.counts[key] = self.counts.get(key, 0) + 1

    @property
    def complete(self) -> bool:
        return bool(self.counts) and all(
            count >= CHOICE_COVERAGE_THRESHOLD for count in self.counts.values()
        )

    @property
    def temperature(self) -> float:
        return 1.0 if self.complete else 1.25


def behavior_clone(
    policy: PolicyV7,
    optimizer: torch.optim.Optimizer,
    observations: Tensor,
    masks: Mapping[str, Tensor],
    actions: Mapping[str, Tensor],
    *,
    epochs: int,
    batch_size: int,
    generator: torch.Generator,
    maximum_gradient_norm: float = 1.0,
) -> list[BootstrapMetrics]:
    count = observations.shape[0]
    require_training_sizes(count, epochs, batch_size)
    class_weights = {
        name: balanced_class_weights(value, masks[name].shape[1])
        for name, value in actions.items()
    }
    metrics: list[BootstrapMetrics] = []
    for _ in range(epochs):
        order = torch.randperm(count, generator=generator, device=observations.device)
        for start in range(0, count, batch_size):
            indices = order[start : start + batch_size]
            evaluation = policy.evaluate_main(
                observations[indices],
                {name: value[indices] for name, value in masks.items()},
                {name: value[indices] for name, value in actions.items()},
            )
            loss = -sum(
                (
                    evaluation.log_probabilities[name]
                    * class_weights[name][actions[name][indices].long()]
                ).mean()
                for name in evaluation.log_probabilities
            )
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            gradient_norm = torch.nn.utils.clip_grad_norm_(
                policy.main_parameters(), maximum_gradient_norm
            )
            optimizer.step()
            with torch.no_grad():
                batch_observations = observations[indices]
                batch_masks = {name: value[indices] for name, value in masks.items()}
                batch_actions = {name: value[indices] for name, value in actions.items()}
                accuracies = classification_accuracy(
                    policy, batch_observations, batch_masks, batch_actions
                )
            metrics.append(
                BootstrapMetrics(
                    loss=float(loss.detach()),
                    gradient_norm=float(gradient_norm),
                    **accuracies,
                )
            )
    return metrics


def balanced_class_weights(actions: Tensor, width: int) -> Tensor:
    if actions.ndim != 1 or width < 1:
        raise ValueError("class-balanced actions must be one-dimensional with positive width")
    normalized = actions.long()
    if torch.any(normalized < 0) or torch.any(normalized >= width):
        raise ValueError("class-balanced actions contain an out-of-range class")
    counts = torch.bincount(normalized, minlength=width).to(dtype=torch.float32)
    present = counts > 0
    weights = torch.zeros(width, device=actions.device, dtype=torch.float32)
    weights[present] = torch.sqrt(torch.max(counts[present]) / counts[present])
    return weights / weights[normalized].mean()


def classification_accuracy(
    policy: PolicyV7,
    observations: Tensor,
    masks: Mapping[str, Tensor],
    actions: Mapping[str, Tensor],
) -> dict[str, float]:
    latent = policy.encode(observations)
    predictions: dict[str, Tensor] = {}
    for name, layer in (
        ("movement", policy.movement),
        ("target", policy.target),
        ("ability", policy.ability),
        ("aim", policy.aim),
    ):
        logits = layer(latent).masked_fill(~masks[name].bool(), -torch.inf)
        predictions[name] = torch.argmax(logits, dim=-1)
    correct = {name: predictions[name] == actions[name].long() for name in predictions}
    return {
        "movement_accuracy": float(correct["movement"].float().mean()),
        "target_accuracy": float(correct["target"].float().mean()),
        "ability_accuracy": float(correct["ability"].float().mean()),
        "aim_accuracy": float(correct["aim"].float().mean()),
        "joint_accuracy": float(torch.stack(tuple(correct.values())).all(dim=0).float().mean()),
    }


def choice_behavior_clone(
    policy: PolicyV7,
    optimizer: torch.optim.Optimizer,
    observations: Tensor,
    descriptors: Tensor,
    masks: Tensor,
    selected_options: Tensor,
    *,
    epochs: int,
    batch_size: int,
    generator: torch.Generator,
    maximum_gradient_norm: float = 1.0,
) -> list[ChoiceBootstrapMetrics]:
    count = observations.shape[0]
    require_training_sizes(count, epochs, batch_size)
    metrics: list[ChoiceBootstrapMetrics] = []
    for _ in range(epochs):
        order = torch.randperm(count, generator=generator, device=observations.device)
        for start in range(0, count, batch_size):
            indices = order[start : start + batch_size]
            evaluation = policy.evaluate_choice(
                observations[indices],
                descriptors[indices],
                masks[indices],
                selected_options[indices],
                temperature=1.0,
            )
            loss = -evaluation.log_probability.mean()
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            gradient_norm = torch.nn.utils.clip_grad_norm_(
                policy.choice_scorer_parameters(), maximum_gradient_norm
            )
            optimizer.step()
            with torch.no_grad():
                accuracy = choice_classification_accuracy(
                    policy,
                    observations[indices],
                    descriptors[indices],
                    masks[indices],
                    selected_options[indices],
                )
            metrics.append(ChoiceBootstrapMetrics(
                accuracy=accuracy,
                gradient_norm=float(gradient_norm),
                loss=float(loss.detach()),
            ))
    return metrics


def choice_classification_accuracy(
    policy: PolicyV7,
    observations: Tensor,
    descriptors: Tensor,
    masks: Tensor,
    selected_options: Tensor,
) -> float:
    predicted, _evaluation = policy.select_choice(
        observations,
        descriptors,
        masks,
        temperature=1.0,
        deterministic=True,
    )
    return float((predicted == selected_options.long()).float().mean())


def ppo_epochs(
    policy: PolicyV7,
    optimizer: torch.optim.Optimizer,
    observations: Tensor,
    masks: Mapping[str, Tensor],
    actions: Mapping[str, Tensor],
    old_log_probabilities: Tensor,
    advantages: Tensor,
    returns: Tensor,
    *,
    epochs: int,
    batch_size: int,
    generator: torch.Generator,
    clip_ratio: float = 0.2,
    value_coefficient: float = 0.5,
    maximum_gradient_norm: float = 1.0,
    target_kl: float = 0.02,
) -> list[PpoMetrics]:
    count = observations.shape[0]
    require_training_sizes(count, epochs, batch_size)
    normalized_advantages = normalize_advantages(advantages)
    metrics: list[PpoMetrics] = []
    for _ in range(epochs):
        order = torch.randperm(count, generator=generator, device=observations.device)
        for start in range(0, count, batch_size):
            indices = order[start : start + batch_size]
            evaluation = policy.evaluate_main(
                observations[indices],
                {name: value[indices] for name, value in masks.items()},
                {name: value[indices] for name, value in actions.items()},
            )
            old_log = old_log_probabilities[indices]
            advantage = normalized_advantages[indices]
            ratio = torch.exp(evaluation.log_probability - old_log)
            clipped = torch.clamp(ratio, 1.0 - clip_ratio, 1.0 + clip_ratio)
            policy_loss = -torch.minimum(ratio * advantage, clipped * advantage).mean()
            value_loss = torch.mean((evaluation.value - returns[indices]) ** 2)
            entropy_loss = sum(
                ENTROPY_COEFFICIENTS[name] * evaluation.entropies[name].mean()
                for name in ENTROPY_COEFFICIENTS
            )
            loss = policy_loss + value_coefficient * value_loss - entropy_loss
            with torch.no_grad():
                approximate_kl = (old_log - evaluation.log_probability).mean()
                clip_fraction = (torch.abs(ratio - 1.0) > clip_ratio).float().mean()
            if approximate_kl > target_kl:
                metrics.append(
                    PpoMetrics(
                        policy_loss=float(policy_loss.detach()),
                        value_loss=float(value_loss.detach()),
                        approximate_kl=float(approximate_kl),
                        clip_fraction=float(clip_fraction),
                        gradient_norm=0.0,
                        entropy_movement=float(evaluation.entropies["movement"].mean().detach()),
                        entropy_target=float(evaluation.entropies["target"].mean().detach()),
                        entropy_ability=float(evaluation.entropies["ability"].mean().detach()),
                        entropy_aim=float(evaluation.entropies["aim"].mean().detach()),
                        early_stopped=True,
                    )
                )
                return metrics
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            gradient_norm = torch.nn.utils.clip_grad_norm_(
                policy.main_parameters(), maximum_gradient_norm
            )
            optimizer.step()
            metrics.append(
                PpoMetrics(
                    policy_loss=float(policy_loss.detach()),
                    value_loss=float(value_loss.detach()),
                    approximate_kl=float(approximate_kl),
                    clip_fraction=float(clip_fraction),
                    gradient_norm=float(gradient_norm),
                    entropy_movement=float(evaluation.entropies["movement"].mean().detach()),
                    entropy_target=float(evaluation.entropies["target"].mean().detach()),
                    entropy_ability=float(evaluation.entropies["ability"].mean().detach()),
                    entropy_aim=float(evaluation.entropies["aim"].mean().detach()),
                    early_stopped=False,
                )
            )
    return metrics


def choice_ppo_epochs(
    policy: PolicyV7,
    optimizer: torch.optim.Optimizer,
    observations: Tensor,
    descriptors: Tensor,
    masks: Tensor,
    selected_options: Tensor,
    old_log_probabilities: Tensor,
    advantages: Tensor,
    returns: Tensor,
    *,
    temperature: float | Tensor,
    epochs: int,
    batch_size: int,
    generator: torch.Generator,
    clip_ratio: float = 0.2,
    value_coefficient: float = 0.5,
    maximum_gradient_norm: float = 1.0,
) -> list[ChoicePpoMetrics]:
    count = observations.shape[0]
    require_training_sizes(count, epochs, batch_size)
    sampling_temperatures = choice_temperature_column(temperature, observations).squeeze(-1)
    normalized_advantages = normalize_advantages(advantages)
    metrics: list[ChoicePpoMetrics] = []
    for _ in range(epochs):
        order = torch.randperm(count, generator=generator, device=observations.device)
        for start in range(0, count, batch_size):
            indices = order[start : start + batch_size]
            evaluation = policy.evaluate_choice(
                observations[indices],
                descriptors[indices],
                masks[indices],
                selected_options[indices],
                temperature=sampling_temperatures[indices],
            )
            old_log = old_log_probabilities[indices]
            advantage = normalized_advantages[indices]
            ratio = torch.exp(evaluation.log_probability - old_log)
            clipped = torch.clamp(ratio, 1.0 - clip_ratio, 1.0 + clip_ratio)
            policy_loss = -torch.minimum(ratio * advantage, clipped * advantage).mean()
            value_loss = torch.mean((evaluation.value - returns[indices]) ** 2)
            valid = masks[indices].sum(dim=-1)
            normalizer = torch.where(valid > 1, torch.log(valid.float()), torch.ones_like(valid))
            normalized_entropy = torch.where(
                valid > 1, evaluation.entropy / normalizer, torch.zeros_like(evaluation.entropy)
            )
            loss = (
                policy_loss
                + value_coefficient * value_loss
                - CHOICE_ENTROPY_COEFFICIENT * normalized_entropy.mean()
            )
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            gradient_norm = torch.nn.utils.clip_grad_norm_(
                policy.choice_ppo_parameters(), maximum_gradient_norm
            )
            optimizer.step()
            with torch.no_grad():
                approximate_kl = (old_log - evaluation.log_probability).mean()
                clip_fraction = (torch.abs(ratio - 1.0) > clip_ratio).float().mean()
            metrics.append(
                ChoicePpoMetrics(
                    policy_loss=float(policy_loss.detach()),
                    value_loss=float(value_loss.detach()),
                    approximate_kl=float(approximate_kl),
                    clip_fraction=float(clip_fraction),
                    gradient_norm=float(gradient_norm),
                    normalized_entropy=float(normalized_entropy.mean().detach()),
                    temperature=float(sampling_temperatures[indices].mean()),
                )
            )
    return metrics


def normalize_advantages(value: Tensor) -> Tensor:
    if value.numel() < 2:
        return value
    standard_deviation = value.std(unbiased=False)
    return (value - value.mean()) / standard_deviation if standard_deviation > 1e-8 else value


def require_training_sizes(count: int, epochs: int, batch_size: int) -> None:
    if count < 1 or epochs < 1 or batch_size < 1:
        raise ValueError("training count, epochs, and batch size must be positive")


def descriptor_keys(descriptor: np.ndarray) -> tuple[str, ...]:
    feature = {name: index for index, name in enumerate(POLICY_SPEC.option_descriptor_names)}
    families = tuple(
        name.removeprefix("family_")
        for name in POLICY_SPEC.option_descriptor_names
        if name.startswith("family_") and descriptor[feature[name]] > 0.5
    ) or ("unknown",)
    skill_id = sum(
        int(descriptor[feature[f"skill_id_bit_{bit}"]] > 0.5) << bit
        for bit in range(16)
    )
    keys = [f"family:{family}" for family in families]
    keys.append(f"skill:{skill_id}")
    if descriptor[feature["is_weld"]] > 0.5:
        elements = "".join(
            "1" if descriptor[feature[f"weld_element_{element}"]] > 0.5 else "0"
            for element in ("ether", "fire", "air", "water", "earth")
        )
        build_id = sum(
            int(descriptor[feature[f"weld_build_id_bit_{bit}"]] > 0.5) << bit
            for bit in range(16)
        )
        keys.append(f"weld:{build_id}:{elements}")
    return tuple(sorted(set(keys)))


def mean_metrics(values: list[object]) -> dict[str, float]:
    if not values:
        return {}
    names = values[0].__dataclass_fields__
    return {
        name: float(np.mean([float(getattr(value, name)) for value in values]))
        for name in names
    }
