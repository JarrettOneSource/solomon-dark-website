"""PyTorch implementation of the strict schema-v7 policy architecture."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import numpy as np
import torch
from torch import Tensor, nn

from .spec import POLICY_SPEC, TENSOR_SHAPES

HEAD_WIDTHS = {"movement": 9, "target": 9, "ability": 22, "aim": 9}


@dataclass(frozen=True)
class MainActionBatch:
    actions: Mapping[str, Tensor]
    entropies: Mapping[str, Tensor]
    log_probability: Tensor
    masks: Mapping[str, Tensor]
    value: Tensor


@dataclass(frozen=True)
class MainEvaluation:
    entropies: Mapping[str, Tensor]
    log_probability: Tensor
    log_probabilities: Mapping[str, Tensor]
    value: Tensor


@dataclass(frozen=True)
class ChoiceEvaluation:
    entropy: Tensor
    log_probability: Tensor
    value: Tensor


class PolicyV7(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.trunk_1 = nn.Linear(POLICY_SPEC.observation_size, 512)
        self.trunk_2 = nn.Linear(512, 256)
        self.movement = nn.Linear(256, 9)
        self.target = nn.Linear(256, 9)
        self.ability = nn.Linear(256, 22)
        self.aim = nn.Linear(256, 9)
        self.value = nn.Linear(256, 1)
        self.choice_hidden = nn.Linear(256 + POLICY_SPEC.option_descriptor_size, 128)
        self.choice_score = nn.Linear(128, 1)
        self.choice_value = nn.Linear(256, 1)

    @classmethod
    def initialize(cls, seed: int) -> "PolicyV7":
        if not isinstance(seed, int) or isinstance(seed, bool) or not 0 <= seed <= 0xFFFF_FFFF:
            raise ValueError("policy seed must be a uint32")
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(seed)
            policy = cls()
            for module in policy.modules():
                if isinstance(module, nn.Linear):
                    nn.init.xavier_uniform_(module.weight)
                    nn.init.zeros_(module.bias)
        return policy

    def encode(self, observations: Tensor) -> Tensor:
        require_shape(observations, (None, POLICY_SPEC.observation_size), "observations")
        require_finite(observations, "observations")
        return torch.tanh(self.trunk_2(torch.tanh(self.trunk_1(observations))))

    def act(
        self,
        observations: Tensor,
        plans: Mapping[str, Tensor],
        *,
        deterministic: bool,
        generator: torch.Generator | None = None,
    ) -> MainActionBatch:
        latent = self.encode(observations)
        movement_mask = require_mask(plans["movement"], latent.shape[0], 9, "movement plan")
        target_mask = require_mask(plans["target"], latent.shape[0], 9, "target plan")
        movement_action, movement_log, movement_entropy = select_action(
            self.movement(latent), movement_mask, deterministic, generator
        )
        target_action, target_log, target_entropy = select_action(
            self.target(latent), target_mask, deterministic, generator
        )
        ability_plan = plans["ability_by_target"]
        require_shape(ability_plan, (latent.shape[0], 9, 22), "ability plan")
        batch = torch.arange(latent.shape[0], device=latent.device)
        ability_mask = require_mask(
            ability_plan[batch, target_action], latent.shape[0], 22, "selected ability mask"
        )
        ability_action, ability_log, ability_entropy = select_action(
            self.ability(latent), ability_mask, deterministic, generator
        )
        aim_plan = plans["aim_by_ability"]
        require_shape(aim_plan, (latent.shape[0], 22, 9), "aim plan")
        aim_mask = require_mask(
            aim_plan[batch, ability_action], latent.shape[0], 9, "selected aim mask"
        )
        aim_action, aim_log, aim_entropy = select_action(
            self.aim(latent), aim_mask, deterministic, generator
        )
        return MainActionBatch(
            actions={
                "movement": movement_action,
                "target": target_action,
                "ability": ability_action,
                "aim": aim_action,
            },
            entropies={
                "movement": movement_entropy,
                "target": target_entropy,
                "ability": ability_entropy,
                "aim": aim_entropy,
            },
            log_probability=movement_log + target_log + ability_log + aim_log,
            masks={
                "movement": movement_mask,
                "target": target_mask,
                "ability": ability_mask,
                "aim": aim_mask,
            },
            value=self.value(latent).squeeze(-1),
        )

    def evaluate_main(
        self,
        observations: Tensor,
        masks: Mapping[str, Tensor],
        actions: Mapping[str, Tensor],
    ) -> MainEvaluation:
        latent = self.encode(observations)
        logs: dict[str, Tensor] = {}
        entropies: dict[str, Tensor] = {}
        for name, layer in (
            ("movement", self.movement),
            ("target", self.target),
            ("ability", self.ability),
            ("aim", self.aim),
        ):
            width = HEAD_WIDTHS[name]
            mask = require_mask(masks[name], latent.shape[0], width, f"{name} mask")
            action = actions[name].long()
            require_shape(action, (latent.shape[0],), f"{name} actions")
            logits = masked_logits(layer(latent), mask)
            log_probabilities = torch.log_softmax(logits, dim=-1)
            probabilities = torch.softmax(logits, dim=-1)
            logs[name] = log_probabilities.gather(1, action[:, None]).squeeze(1)
            entropies[name] = masked_entropy(probabilities, log_probabilities, mask)
        ordered_logs = tuple(logs.values())
        return MainEvaluation(
            entropies=entropies,
            log_probability=sum(ordered_logs[1:], ordered_logs[0]),
            log_probabilities=logs,
            value=self.value(latent).squeeze(-1),
        )

    def evaluate_choice(
        self,
        observations: Tensor,
        descriptors: Tensor,
        mask: Tensor,
        selected_options: Tensor,
        *,
        temperature: float | Tensor,
    ) -> ChoiceEvaluation:
        latent = self.encode(observations)
        require_shape(
            descriptors,
            (latent.shape[0], None, POLICY_SPEC.option_descriptor_size),
            "choice descriptors",
        )
        require_finite(descriptors, "choice descriptors")
        option_count = descriptors.shape[1]
        normalized_mask = require_mask(mask, latent.shape[0], option_count, "choice mask")
        temperatures = choice_temperature_column(temperature, latent)
        state = latent[:, None, :].expand(-1, option_count, -1)
        hidden = torch.tanh(self.choice_hidden(torch.cat((state, descriptors), dim=-1)))
        logits = masked_logits(self.choice_score(hidden).squeeze(-1) / temperatures, normalized_mask)
        log_probabilities = torch.log_softmax(logits, dim=-1)
        probabilities = torch.softmax(logits, dim=-1)
        actions = selected_options.long()
        require_shape(actions, (latent.shape[0],), "selected choice options")
        return ChoiceEvaluation(
            entropy=masked_entropy(probabilities, log_probabilities, normalized_mask),
            log_probability=log_probabilities.gather(1, actions[:, None]).squeeze(1),
            value=self.choice_value(latent).squeeze(-1),
        )

    def select_choice(
        self,
        observations: Tensor,
        descriptors: Tensor,
        mask: Tensor,
        *,
        temperature: float | Tensor,
        deterministic: bool,
        generator: torch.Generator | None = None,
    ) -> tuple[Tensor, ChoiceEvaluation]:
        latent = self.encode(observations)
        require_shape(
            descriptors,
            (latent.shape[0], None, POLICY_SPEC.option_descriptor_size),
            "choice descriptors",
        )
        require_finite(descriptors, "choice descriptors")
        temperatures = choice_temperature_column(temperature, latent)
        option_count = descriptors.shape[1]
        normalized_mask = require_mask(mask, latent.shape[0], option_count, "choice mask")
        state = latent[:, None, :].expand(-1, option_count, -1)
        hidden = torch.tanh(self.choice_hidden(torch.cat((state, descriptors), dim=-1)))
        action, _, _ = select_action(
            self.choice_score(hidden).squeeze(-1) / temperatures,
            normalized_mask,
            deterministic,
            generator,
        )
        return action, self.evaluate_choice(
            observations,
            descriptors,
            normalized_mask,
            action,
            temperature=temperature,
        )

    def main_parameters(self) -> list[nn.Parameter]:
        return parameters_of(
            self.trunk_1,
            self.trunk_2,
            self.movement,
            self.target,
            self.ability,
            self.aim,
            self.value,
        )

    def choice_ppo_parameters(self) -> list[nn.Parameter]:
        """Return the choice-only parameters updated by SMDP PPO.

        The shared observation trunk belongs to the main optimizer. Giving the
        trunk to a second Adam optimizer creates independent moment estimates
        for the same tensors and allows choice updates to erase frozen combat
        behaviors such as aim lead and potion use.
        """
        return parameters_of(self.choice_hidden, self.choice_score, self.choice_value)

    def choice_scorer_parameters(self) -> list[nn.Parameter]:
        return parameters_of(self.choice_hidden, self.choice_score)

    def export_tensors(self) -> dict[str, np.ndarray]:
        tensors = {
            "ability_bias": self.ability.bias,
            "ability_weight": self.ability.weight,
            "aim_bias": self.aim.bias,
            "aim_weight": self.aim.weight,
            "choice_hidden_bias": self.choice_hidden.bias,
            "choice_hidden_weight": self.choice_hidden.weight,
            "choice_score_bias": self.choice_score.bias,
            "choice_score_weight": self.choice_score.weight,
            "choice_value_bias": self.choice_value.bias,
            "choice_value_weight": self.choice_value.weight,
            "movement_bias": self.movement.bias,
            "movement_weight": self.movement.weight,
            "target_bias": self.target.bias,
            "target_weight": self.target.weight,
            "trunk_1_bias": self.trunk_1.bias,
            "trunk_1_weight": self.trunk_1.weight,
            "trunk_2_bias": self.trunk_2.bias,
            "trunk_2_weight": self.trunk_2.weight,
            "value_bias": self.value.bias,
            "value_weight": self.value.weight,
        }
        return {
            name: value.detach().cpu().to(torch.float32).numpy().copy()
            for name, value in tensors.items()
        }

    def load_tensors(self, tensors: Mapping[str, np.ndarray]) -> None:
        if set(tensors) != set(TENSOR_SHAPES):
            raise ValueError("model tensors do not match schema v7")
        targets = {
            "ability_bias": self.ability.bias,
            "ability_weight": self.ability.weight,
            "aim_bias": self.aim.bias,
            "aim_weight": self.aim.weight,
            "choice_hidden_bias": self.choice_hidden.bias,
            "choice_hidden_weight": self.choice_hidden.weight,
            "choice_score_bias": self.choice_score.bias,
            "choice_score_weight": self.choice_score.weight,
            "choice_value_bias": self.choice_value.bias,
            "choice_value_weight": self.choice_value.weight,
            "movement_bias": self.movement.bias,
            "movement_weight": self.movement.weight,
            "target_bias": self.target.bias,
            "target_weight": self.target.weight,
            "trunk_1_bias": self.trunk_1.bias,
            "trunk_1_weight": self.trunk_1.weight,
            "trunk_2_bias": self.trunk_2.bias,
            "trunk_2_weight": self.trunk_2.weight,
            "value_bias": self.value.bias,
            "value_weight": self.value.weight,
        }
        with torch.no_grad():
            for name, target in targets.items():
                source = np.asarray(tensors[name], dtype=np.float32)
                if source.shape != TENSOR_SHAPES[name] or not np.all(np.isfinite(source)):
                    raise ValueError(f"model tensor {name} is invalid")
                target.copy_(torch.from_numpy(source).to(device=target.device))


def choice_temperature_column(temperature: float | Tensor, reference: Tensor) -> Tensor:
    values = torch.as_tensor(temperature, dtype=reference.dtype, device=reference.device)
    if values.ndim == 0:
        values = values.expand(reference.shape[0])
    require_shape(values, (reference.shape[0],), "choice sampling temperatures")
    require_finite(values, "choice sampling temperatures")
    if not torch.all(values > 0):
        raise ValueError("choice temperature must be positive and finite")
    return values[:, None]



def parameters_of(*modules: nn.Module) -> list[nn.Parameter]:
    return [parameter for module in modules for parameter in module.parameters()]


def select_action(
    logits: Tensor,
    mask: Tensor,
    deterministic: bool,
    generator: torch.Generator | None,
) -> tuple[Tensor, Tensor, Tensor]:
    normalized = masked_logits(logits, mask)
    log_probabilities = torch.log_softmax(normalized, dim=-1)
    probabilities = torch.softmax(normalized, dim=-1)
    action = torch.argmax(normalized, dim=-1) if deterministic else torch.multinomial(
        probabilities, 1, replacement=True, generator=generator
    ).squeeze(1)
    return (
        action,
        log_probabilities.gather(1, action[:, None]).squeeze(1),
        masked_entropy(probabilities, log_probabilities, mask),
    )


def masked_logits(logits: Tensor, mask: Tensor) -> Tensor:
    require_shape(mask, tuple(logits.shape), "action mask")
    normalized = mask.bool()
    if not torch.all(normalized.any(dim=-1)):
        raise ValueError("action mask contains a row with no legal action")
    require_finite(logits, "policy logits")
    return logits.masked_fill(~normalized, -torch.inf)


def masked_entropy(probabilities: Tensor, log_probabilities: Tensor, mask: Tensor) -> Tensor:
    safe_log = torch.where(mask.bool(), log_probabilities, 0)
    return -(probabilities * safe_log).sum(dim=-1)


def require_mask(value: Tensor, rows: int, width: int, label: str) -> Tensor:
    require_shape(value, (rows, width), label)
    normalized = value.bool()
    if not torch.all(normalized.any(dim=-1)):
        raise ValueError(f"{label} has no legal action")
    return normalized


def require_shape(value: Tensor, expected: tuple[int | None, ...], label: str) -> None:
    if value.ndim != len(expected) or any(
        required is not None and value.shape[index] != required
        for index, required in enumerate(expected)
    ):
        raise ValueError(f"{label} has shape {tuple(value.shape)}, expected {expected}")


def require_finite(value: Tensor, label: str) -> None:
    if not torch.all(torch.isfinite(value)):
        raise ValueError(f"{label} contains non-finite values")
