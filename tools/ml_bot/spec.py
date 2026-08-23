"""Single-source schema-v5 contract loaded from the TypeScript artifact."""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any, Mapping

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = (
    REPOSITORY_ROOT
    / "frontend/src/game/core-server/ml-bot-policy/policy-spec-v5.json"
)

TENSOR_SHAPES: dict[str, tuple[int, ...]] = {
    "ability_bias": (22,),
    "ability_weight": (22, 256),
    "aim_bias": (9,),
    "aim_weight": (9, 256),
    "choice_hidden_bias": (128,),
    "choice_hidden_weight": (128, 312),
    "choice_score_bias": (1,),
    "choice_score_weight": (1, 128),
    "choice_value_bias": (1,),
    "choice_value_weight": (1, 256),
    "movement_bias": (9,),
    "movement_weight": (9, 256),
    "target_bias": (9,),
    "target_weight": (9, 256),
    "trunk_1_bias": (512,),
    "trunk_1_weight": (512, 1_784),
    "trunk_2_bias": (256,),
    "trunk_2_weight": (256, 512),
    "value_bias": (1,),
    "value_weight": (1, 256),
}


@dataclass(frozen=True)
class PolicySpec:
    action_heads: Mapping[str, tuple[str, ...]]
    architecture: str
    choice_hidden_size: int
    choice_trajectory_version: int
    hidden_sizes: tuple[int, ...]
    main_trajectory_version: int
    model_format: str
    model_version: int
    observation_names: tuple[str, ...]
    observation_version: int
    option_descriptor_names: tuple[str, ...]

    @property
    def observation_size(self) -> int:
        return len(self.observation_names)

    @property
    def option_descriptor_size(self) -> int:
        return len(self.option_descriptor_names)

    def checkpoint_metadata(self, seed: int) -> dict[str, Any]:
        require_uint32(seed, "checkpoint seed")
        return {
            "actionHeads": {
                name: list(values) for name, values in self.action_heads.items()
            },
            "architecture": self.architecture,
            "choiceCoverage": {},
            "choiceHiddenSize": self.choice_hidden_size,
            "choiceTemperature": 1.25,
            "choiceTrajectoryVersion": self.choice_trajectory_version,
            "hiddenSizes": list(self.hidden_sizes),
            "mainTrajectoryVersion": self.main_trajectory_version,
            "modelFormat": self.model_format,
            "modelVersion": self.model_version,
            "observationNames": list(self.observation_names),
            "observationVersion": self.observation_version,
            "optionDescriptorNames": list(self.option_descriptor_names),
            "seed": seed,
            "trainedEnvironmentSteps": 0,
            "trainedUpdates": 0,
        }

    def validate_metadata(self, value: Mapping[str, Any]) -> None:
        exact = {
            "architecture": self.architecture,
            "choiceHiddenSize": self.choice_hidden_size,
            "choiceTrajectoryVersion": self.choice_trajectory_version,
            "hiddenSizes": list(self.hidden_sizes),
            "mainTrajectoryVersion": self.main_trajectory_version,
            "modelFormat": self.model_format,
            "modelVersion": self.model_version,
            "observationNames": list(self.observation_names),
            "observationVersion": self.observation_version,
            "optionDescriptorNames": list(self.option_descriptor_names),
        }
        for name, expected in exact.items():
            if value.get(name) != expected:
                raise ValueError(f"checkpoint {name} does not match schema v5")
        if value.get("actionHeads") != {
            name: list(values) for name, values in self.action_heads.items()
        }:
            raise ValueError("checkpoint action heads do not match schema v5")
        require_uint32(value.get("seed"), "checkpoint seed")
        require_nonnegative_integer(
            value.get("trainedEnvironmentSteps"), "trained environment steps"
        )
        require_nonnegative_integer(value.get("trainedUpdates"), "trained updates")
        temperature = value.get("choiceTemperature")
        if (
            not isinstance(temperature, (int, float))
            or isinstance(temperature, bool)
            or not math.isfinite(float(temperature))
            or not 0 < float(temperature)
        ):
            raise ValueError("checkpoint choice temperature must be positive")
        coverage = value.get("choiceCoverage")
        if not isinstance(coverage, Mapping):
            raise ValueError("checkpoint choice coverage must be an object")
        for key, count in coverage.items():
            if not isinstance(key, str) or not key:
                raise ValueError("checkpoint choice coverage keys must not be empty")
            require_nonnegative_integer(count, f"choice coverage {key}")


def load_policy_spec(path: Path = SPEC_PATH) -> PolicySpec:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("policy spec root must be an object")
    action_heads = value.get("actionHeads")
    if not isinstance(action_heads, dict):
        raise ValueError("policy spec actionHeads must be an object")
    expected_widths = {"movement": 9, "target": 9, "ability": 22, "aim": 9}
    normalized_heads: dict[str, tuple[str, ...]] = {}
    if set(action_heads) != set(expected_widths):
        raise ValueError("policy spec action heads are not closed")
    for name, width in expected_widths.items():
        entries = action_heads.get(name)
        if not isinstance(entries, list) or len(entries) != width or not all(
            isinstance(entry, str) and entry for entry in entries
        ):
            raise ValueError(f"policy spec {name} head is invalid")
        normalized_heads[name] = tuple(entries)
    observation_names = string_tuple(value.get("observationNames"), "observation names")
    descriptor_names = string_tuple(
        value.get("optionDescriptorNames"), "option descriptor names"
    )
    if len(observation_names) != 1_784 or len(set(observation_names)) != 1_784:
        raise ValueError("policy spec must contain 1,784 unique observations")
    if len(descriptor_names) != 56 or len(set(descriptor_names)) != 56:
        raise ValueError("policy spec must contain 56 unique option descriptors")
    expected = {
        "architecture": "mlp-tanh-four-head-v5",
        "choiceHiddenSize": 128,
        "choiceTrajectoryVersion": 5,
        "hiddenSizes": [512, 256],
        "mainTrajectoryVersion": 5,
        "modelFormat": "solomon-dark-web-bot-policy",
        "modelVersion": 5,
        "observationVersion": 5,
    }
    for name, required in expected.items():
        if value.get(name) != required:
            raise ValueError(f"policy spec {name} does not match schema v5")
    return PolicySpec(
        action_heads=normalized_heads,
        architecture=str(value["architecture"]),
        choice_hidden_size=int(value["choiceHiddenSize"]),
        choice_trajectory_version=int(value["choiceTrajectoryVersion"]),
        hidden_sizes=tuple(int(item) for item in value["hiddenSizes"]),
        main_trajectory_version=int(value["mainTrajectoryVersion"]),
        model_format=str(value["modelFormat"]),
        model_version=int(value["modelVersion"]),
        observation_names=observation_names,
        observation_version=int(value["observationVersion"]),
        option_descriptor_names=descriptor_names,
    )


def string_tuple(value: Any, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(
        isinstance(entry, str) and entry for entry in value
    ):
        raise ValueError(f"policy spec {label} must be nonempty strings")
    return tuple(value)


def require_uint32(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 0xFFFF_FFFF:
        raise ValueError(f"{label} must be a uint32")
    return value


def require_nonnegative_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{label} must be a nonnegative integer")
    return value


POLICY_SPEC = load_policy_spec()
