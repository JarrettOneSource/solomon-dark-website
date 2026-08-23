"""Persistent NDJSON bridge to the authoritative TypeScript headless workers."""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
from typing import Any, Mapping, Sequence

import numpy as np

from .spec import POLICY_SPEC, REPOSITORY_ROOT, require_uint32

PROTOCOL = "solomon-dark-ml-rollout-v5"
SERVER_PATH = REPOSITORY_ROOT / "frontend/tools/ml-bot-rollout-server.mjs"


@dataclass(frozen=True)
class ActionMaskPlans:
    movement: np.ndarray
    target: np.ndarray
    ability_by_target: np.ndarray
    aim_by_ability: np.ndarray


@dataclass(frozen=True)
class RolloutState:
    hashes: tuple[str, ...]
    metadata: tuple[Mapping[str, Any], ...]
    observations: np.ndarray
    plans: ActionMaskPlans


@dataclass(frozen=True)
class RolloutTransition:
    actions: np.ndarray
    choice_events: tuple[Mapping[str, Any], ...]
    choice_intervals: tuple[Mapping[str, Any], ...]
    dones: np.ndarray
    gameplay_counters: tuple[Mapping[str, Any], ...]
    masks: Mapping[str, np.ndarray]
    next_simulation_ticks: np.ndarray
    next_state_hashes: tuple[str, ...]
    observations: np.ndarray
    raw_rewards: np.ndarray
    reward_clamped: np.ndarray
    rewards: np.ndarray
    reward_terms: Mapping[str, np.ndarray]
    simulation_ticks: np.ndarray
    skill_selections: tuple[Mapping[str, Any], ...]
    state_hashes: tuple[str, ...]
    ticks: np.ndarray


@dataclass(frozen=True)
class RolloutStep:
    state: RolloutState
    transition: RolloutTransition


class RolloutProtocolError(RuntimeError):
    pass


class BoneyardRolloutBridge:
    def __init__(
        self,
        seeds: Sequence[int],
        *,
        worker_count: int | None = None,
        node: str = "node",
        repository_root: Path = REPOSITORY_ROOT,
    ) -> None:
        normalized_seeds = validate_seeds(seeds, allow_none=False)
        self._process = subprocess.Popen(
            [
                node,
                "--experimental-strip-types",
                str(SERVER_PATH.relative_to(REPOSITORY_ROOT)),
            ],
            cwd=repository_root,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        self._next_id = 1
        self._closed = False
        response = self._request(
            {
                "seeds": normalized_seeds,
                "type": "initialize",
                **({} if worker_count is None else {"workerCount": worker_count}),
            }
        )
        self.world_count = required_integer(response.get("worldCount"), "world count", minimum=1)
        self.observation_length = required_integer(
            response.get("observationLength"), "observation length", minimum=1
        )
        if self.world_count != len(normalized_seeds) or self.observation_length != 1_784:
            self.close()
            raise RolloutProtocolError("rollout server dimensions do not match schema v5")
        self.state = decode_state(response, self.world_count)

    def step(self, actions: np.ndarray, *, ticks: int = 1) -> RolloutStep:
        normalized = validate_actions(actions, self.world_count)
        response = self._request(
            {
                "actions": encode_array(normalized),
                "ticks": required_integer(ticks, "step ticks", minimum=1, maximum=100_000),
                "type": "step",
            }
        )
        return self._accept_step(response)

    def expert_step(self, *, ticks: int = 1) -> RolloutStep:
        response = self._request(
            {
                "ticks": required_integer(ticks, "expert step ticks", minimum=1, maximum=100_000),
                "type": "expert-step",
            }
        )
        return self._accept_step(response)

    def reset(self, seeds: Sequence[int | None]) -> RolloutState:
        normalized = validate_seeds(seeds, allow_none=True)
        if len(normalized) != self.world_count:
            raise ValueError("selective reset seeds must match bridge world count")
        response = self._request({"seeds": normalized, "type": "reset"})
        self.state = decode_state(response, self.world_count)
        return self.state

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._process.poll() is None:
            try:
                self._request({"type": "close"}, allow_closed=True)
            finally:
                self._process.wait(timeout=10)

    def __enter__(self) -> "BoneyardRolloutBridge":
        return self

    def __exit__(self, _type: object, _value: object, _traceback: object) -> None:
        self.close()

    def _accept_step(self, response: Mapping[str, Any]) -> RolloutStep:
        state = decode_state(response, self.world_count)
        transition = decode_transition(response.get("transition"), self.world_count)
        if transition.next_state_hashes != state.hashes:
            raise RolloutProtocolError("transition next hashes disagree with rollout state")
        self.state = state
        return RolloutStep(state=state, transition=transition)

    def _request(
        self,
        payload: Mapping[str, Any],
        *,
        allow_closed: bool = False,
    ) -> Mapping[str, Any]:
        if self._closed and not allow_closed:
            raise RolloutProtocolError("rollout bridge is closed")
        if self._process.stdin is None or self._process.stdout is None:
            raise RolloutProtocolError("rollout bridge pipes are unavailable")
        request_id = self._next_id
        self._next_id += 1
        self._process.stdin.write(json.dumps({**payload, "id": request_id}, separators=(",", ":")) + "\n")
        self._process.stdin.flush()
        line = self._process.stdout.readline()
        if not line:
            raise RolloutProtocolError(
                f"rollout server exited before response (code {self._process.poll()})"
            )
        try:
            response = json.loads(line)
        except json.JSONDecodeError as error:
            raise RolloutProtocolError("rollout server returned invalid JSON") from error
        if not isinstance(response, dict) or response.get("id") != request_id:
            raise RolloutProtocolError("rollout server response id is invalid")
        if response.get("protocol") != PROTOCOL:
            raise RolloutProtocolError("rollout server protocol is not schema v5")
        if response.get("ok") is not True:
            raise RolloutProtocolError(str(response.get("error", "rollout request failed")))
        return response


def decode_state(value: Mapping[str, Any], worlds: int) -> RolloutState:
    hashes = string_tuple(value.get("hashes"), worlds, "state hashes")
    return RolloutState(
        hashes=hashes,
        metadata=decode_episode_metadata(value.get("metadata"), worlds),
        observations=decode_array(
            value.get("observations"), "<f4", (worlds, POLICY_SPEC.observation_size), "observations"
        ),
        plans=decode_plans(value.get("plans"), worlds),
    )


def decode_plans(value: Any, worlds: int) -> ActionMaskPlans:
    source = required_mapping(value, "action mask plans")
    return ActionMaskPlans(
        movement=decode_array(source.get("movement"), "u1", (worlds, 9), "movement plan"),
        target=decode_array(source.get("target"), "u1", (worlds, 9), "target plan"),
        ability_by_target=decode_array(
            source.get("abilityByTarget"), "u1", (worlds, 9, 22), "ability plan"
        ),
        aim_by_ability=decode_array(
            source.get("aimByAbility"), "u1", (worlds, 22, 9), "aim plan"
        ),
    )


def decode_episode_metadata(value: Any, worlds: int) -> tuple[Mapping[str, Any], ...]:
    rows = required_list(value, "episode metadata")
    if len(rows) != worlds:
        raise RolloutProtocolError("episode metadata does not match world count")
    result: list[Mapping[str, Any]] = []
    for row in rows:
        source = required_mapping(row, "episode metadata row")
        geometry = source.get("geometrySha256")
        run_id = source.get("runId")
        seed = source.get("seed")
        if not isinstance(geometry, str) or not geometry or not isinstance(run_id, str) or not run_id:
            raise RolloutProtocolError("episode metadata identity is invalid")
        require_uint32(seed, "episode metadata seed")
        result.append({"geometrySha256": geometry, "runId": run_id, "seed": seed})
    return tuple(result)


def decode_transition(value: Any, worlds: int) -> RolloutTransition:
    source = required_mapping(value, "rollout transition")
    masks = required_mapping(source.get("masks"), "transition masks")
    reward_terms = required_mapping(source.get("rewardTerms"), "reward terms")
    return RolloutTransition(
        actions=decode_array(source.get("actions"), "u1", (worlds, 4), "actions"),
        choice_events=tuple(decode_indexed_choice(entry, interval=False) for entry in required_list(
            source.get("choiceEvents"), "choice events"
        )),
        choice_intervals=tuple(decode_indexed_choice(entry, interval=True) for entry in required_list(
            source.get("choiceIntervals"), "choice intervals"
        )),
        dones=decode_array(source.get("dones"), "u1", (worlds,), "dones").astype(bool),
        gameplay_counters=decode_gameplay_counters(source.get("gameplayCounters"), worlds),
        masks={
            "movement": decode_array(masks.get("movement"), "u1", (worlds, 9), "movement masks"),
            "target": decode_array(masks.get("target"), "u1", (worlds, 9), "target masks"),
            "ability": decode_array(masks.get("ability"), "u1", (worlds, 22), "ability masks"),
            "aim": decode_array(masks.get("aim"), "u1", (worlds, 9), "aim masks"),
        },
        next_simulation_ticks=decode_array(
            source.get("nextSimulationTicks"), "<f8", (worlds,), "next simulation ticks"
        ),
        next_state_hashes=string_tuple(source.get("nextStateHashes"), worlds, "next hashes"),
        observations=decode_array(
            source.get("observations"), "<f4", (worlds, POLICY_SPEC.observation_size), "transition observations"
        ),
        raw_rewards=decode_array(source.get("rawRewards"), "<f8", (worlds,), "raw rewards"),
        reward_clamped=decode_array(
            source.get("rewardClamped"), "u1", (worlds,), "reward clamp flags"
        ).astype(bool),
        rewards=decode_array(source.get("rewards"), "<f8", (worlds,), "rewards"),
        reward_terms={
            name: decode_array(reward_terms.get(name), "<f8", (worlds,), f"{name} rewards")
            for name in ("death", "ownDamage", "selfHp", "wave", "xp")
        },
        simulation_ticks=decode_array(
            source.get("simulationTicks"), "<f8", (worlds,), "simulation ticks"
        ),
        skill_selections=tuple(required_mapping(entry, "skill selection") for entry in required_list(
            source.get("skillSelections"), "skill selections"
        )),
        state_hashes=string_tuple(source.get("stateHashes"), worlds, "transition hashes"),
        ticks=decode_array(source.get("ticks"), "<u4", (worlds,), "transition ticks"),
    )


def decode_indexed_choice(value: Any, *, interval: bool) -> Mapping[str, Any]:
    source = required_mapping(value, "indexed choice")
    world_index = required_integer(source.get("worldIndex"), "choice world index", minimum=0)
    event = dict(required_mapping(source.get("value"), "choice value"))
    event["observation"] = decode_array(
        event.get("observation"), "<f4", (POLICY_SPEC.observation_size,), "choice observation"
    )
    descriptors = decode_array(
        event.get("optionDescriptors"), "<f4", (None,), "choice descriptors flat"
    )
    if descriptors.size == 0 or descriptors.size % POLICY_SPEC.option_descriptor_size:
        raise RolloutProtocolError("choice descriptors do not contain complete rows")
    event["optionDescriptors"] = descriptors.reshape(-1, POLICY_SPEC.option_descriptor_size)
    event["optionMask"] = decode_array(
        event.get("optionMask"), "u1", (event["optionDescriptors"].shape[0],), "choice mask"
    )
    if interval:
        if event.get("choiceTrajectoryVersion") != 5:
            raise RolloutProtocolError("choice interval is not trajectory v5")
    event["worldIndex"] = world_index
    return event


def decode_gameplay_counters(value: Any, worlds: int) -> tuple[Mapping[str, Any], ...]:
    rows = required_list(value, "gameplay counters")
    if len(rows) != worlds:
        raise RolloutProtocolError("gameplay counters do not match world count")
    numeric = (
        "enemyKills",
        "goldCollected",
        "healthOrbsCollected",
        "itemsCollected",
        "manaOrbsCollected",
        "potionsUsed",
        "powerupsCollected",
        "skillPicks",
        "wavesCompleted",
    )
    result: list[Mapping[str, Any]] = []
    for row in rows:
        source = dict(required_mapping(row, "gameplay counter row"))
        for name in numeric:
            number = source.get(name)
            if not isinstance(number, (int, float)) or isinstance(number, bool) or number < 0:
                raise RolloutProtocolError(f"gameplay counter {name} is invalid")
        for name in ("enemyKillsByKind", "itemKinds"):
            counts = required_mapping(source.get(name), f"gameplay counter {name}")
            if any(
                not isinstance(key, str)
                or not key
                or not isinstance(count, (int, float))
                or isinstance(count, bool)
                or count < 0
                for key, count in counts.items()
            ):
                raise RolloutProtocolError(f"gameplay counter {name} is invalid")
        result.append(source)
    return tuple(result)


def validate_actions(value: np.ndarray, worlds: int) -> np.ndarray:
    actions = np.asarray(value)
    if actions.shape != (worlds, 4) or not np.issubdtype(actions.dtype, np.integer):
        raise ValueError("actions must be an integer [worlds, 4] array")
    limits = np.asarray([9, 9, 22, 9])
    if np.any(actions < 0) or np.any(actions >= limits):
        raise ValueError("actions contain an index outside its head")
    return np.ascontiguousarray(actions, dtype=np.uint8)


def validate_seeds(value: Sequence[int | None], *, allow_none: bool) -> list[int | None]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or len(value) == 0:
        raise ValueError("seeds must be a nonempty sequence")
    result: list[int | None] = []
    for seed in value:
        if allow_none and seed is None:
            result.append(None)
        else:
            result.append(require_uint32(seed, "rollout seed"))
    return result


def decode_array(value: Any, dtype: str, shape: tuple[int | None, ...], label: str) -> np.ndarray:
    if not isinstance(value, str):
        raise RolloutProtocolError(f"{label} must be base64")
    try:
        payload = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as error:
        raise RolloutProtocolError(f"{label} is invalid base64") from error
    array = np.frombuffer(payload, dtype=np.dtype(dtype)).copy()
    if len(shape) == 1 and shape[0] is None:
        return array
    expected = int(np.prod([dimension for dimension in shape if dimension is not None]))
    if array.size != expected:
        raise RolloutProtocolError(f"{label} has {array.size} values, expected {expected}")
    return array.reshape(tuple(int(dimension) for dimension in shape if dimension is not None))


def encode_array(value: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(value).tobytes()).decode("ascii")


def required_mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise RolloutProtocolError(f"{label} must be an object")
    return value


def required_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise RolloutProtocolError(f"{label} must be an array")
    return value


def string_tuple(value: Any, length: int, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or len(value) != length or not all(
        isinstance(entry, str) for entry in value
    ):
        raise RolloutProtocolError(f"{label} is invalid")
    return tuple(value)


def required_integer(
    value: Any,
    label: str,
    *,
    minimum: int,
    maximum: int | None = None,
) -> int:
    if (
        not isinstance(value, int)
        or isinstance(value, bool)
        or value < minimum
        or (maximum is not None and value > maximum)
    ):
        raise ValueError(f"{label} must be an integer in range")
    return value
