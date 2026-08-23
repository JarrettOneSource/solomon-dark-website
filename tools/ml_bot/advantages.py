"""Tick-aware GAE, semi-Markov choice credit, and return normalization."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Mapping, Sequence

import numpy as np


@dataclass
class RunningReturnNormalizer:
    count: int = 0
    mean: float = 0.0
    squared_difference: float = 0.0

    def update(self, values: np.ndarray) -> None:
        finite = np.asarray(values, dtype=np.float64)
        if finite.size == 0 or not np.all(np.isfinite(finite)):
            raise ValueError("return normalizer requires nonempty finite values")
        for value in finite.reshape(-1):
            self.count += 1
            delta = float(value) - self.mean
            self.mean += delta / self.count
            self.squared_difference += delta * (float(value) - self.mean)

    @property
    def standard_deviation(self) -> float:
        if self.count < 2:
            return 1.0
        return max(math.sqrt(self.squared_difference / self.count), 1e-6)

    def state_dict(self) -> dict[str, float | int]:
        return {
            "count": self.count,
            "mean": self.mean,
            "squared_difference": self.squared_difference,
        }

    @classmethod
    def from_state_dict(cls, value: Mapping[str, Any]) -> "RunningReturnNormalizer":
        count = value.get("count")
        mean = value.get("mean")
        squared = value.get("squared_difference")
        if (
            not isinstance(count, int)
            or isinstance(count, bool)
            or count < 0
            or not isinstance(mean, (int, float))
            or not math.isfinite(float(mean))
            or not isinstance(squared, (int, float))
            or not math.isfinite(float(squared))
            or float(squared) < 0
        ):
            raise ValueError("return normalizer state is invalid")
        return cls(count=count, mean=float(mean), squared_difference=float(squared))


def discounted_returns(
    rewards: np.ndarray,
    dones: np.ndarray,
    ticks: np.ndarray,
    *,
    gamma: float,
) -> np.ndarray:
    rewards, dones, ticks = validate_rollout_arrays(rewards, dones, ticks)
    validate_gamma(gamma)
    result = np.zeros_like(rewards, dtype=np.float64)
    running = np.zeros(rewards.shape[1], dtype=np.float64)
    for step in range(rewards.shape[0] - 1, -1, -1):
        discount = np.power(gamma, ticks[step])
        running = rewards[step] + discount * (1.0 - dones[step]) * running
        result[step] = running
    return result


def generalized_advantage_estimate(
    rewards: np.ndarray,
    values: np.ndarray,
    dones: np.ndarray,
    ticks: np.ndarray,
    next_values: np.ndarray,
    *,
    gamma: float,
    gae_lambda: float,
) -> tuple[np.ndarray, np.ndarray]:
    rewards, dones, ticks = validate_rollout_arrays(rewards, dones, ticks)
    values = np.asarray(values, dtype=np.float64)
    next_values = np.asarray(next_values, dtype=np.float64)
    if values.shape != rewards.shape or next_values.shape != (rewards.shape[1],):
        raise ValueError("value arrays do not match rollout shape")
    if not np.all(np.isfinite(values)) or not np.all(np.isfinite(next_values)):
        raise ValueError("value arrays contain non-finite values")
    validate_gamma(gamma)
    if not math.isfinite(gae_lambda) or not 0 <= gae_lambda <= 1:
        raise ValueError("GAE lambda must be within [0, 1]")
    advantages = np.zeros_like(rewards, dtype=np.float64)
    following_advantage = np.zeros(rewards.shape[1], dtype=np.float64)
    following_value = next_values.copy()
    for step in range(rewards.shape[0] - 1, -1, -1):
        alive = 1.0 - dones[step]
        discount = np.power(gamma, ticks[step])
        trace = np.power(gamma * gae_lambda, ticks[step])
        delta = rewards[step] + discount * alive * following_value - values[step]
        following_advantage = delta + trace * alive * following_advantage
        advantages[step] = following_advantage
        following_value = values[step]
    return advantages, advantages + values


def normalized_main_advantages(
    rewards: np.ndarray,
    values: np.ndarray,
    dones: np.ndarray,
    ticks: np.ndarray,
    next_values: np.ndarray,
    normalizer: RunningReturnNormalizer,
    *,
    gamma: float,
    gae_lambda: float,
) -> tuple[np.ndarray, np.ndarray, float]:
    raw_returns = discounted_returns(rewards, dones, ticks, gamma=gamma)
    normalizer.update(raw_returns)
    scale = normalizer.standard_deviation
    advantages, returns = generalized_advantage_estimate(
        np.asarray(rewards, dtype=np.float64) / scale,
        values,
        dones,
        ticks,
        next_values,
        gamma=gamma,
        gae_lambda=gae_lambda,
    )
    return advantages, returns, scale


def smdp_choice_advantages(
    intervals: Sequence[Mapping[str, Any]],
    normalizer: RunningReturnNormalizer,
    *,
    gamma: float,
    gae_lambda: float,
) -> tuple[np.ndarray, np.ndarray, float]:
    validate_gamma(gamma)
    if not math.isfinite(gae_lambda) or not 0 <= gae_lambda <= 1:
        raise ValueError("GAE lambda must be within [0, 1]")
    if not intervals:
        raise ValueError("choice SMDP requires at least one complete interval")
    aggregates = np.asarray(
        [discount_choice_rewards(interval, gamma=gamma) for interval in intervals],
        dtype=np.float64,
    )
    normalizer.update(aggregates)
    scale = normalizer.standard_deviation
    advantages = np.zeros(len(intervals), dtype=np.float64)
    next_advantage_by_episode: dict[tuple[str, str], float] = {}
    for index in range(len(intervals) - 1, -1, -1):
        interval = intervals[index]
        duration = require_nonnegative_integer(interval.get("durationTicks"), "choice duration")
        done = require_boolean(interval.get("done"), "choice done")
        old_value = require_finite(interval.get("oldValue"), "choice old value")
        next_value = 0.0 if done else require_finite(interval.get("nextValue"), "choice next value")
        episode_key = (str(interval.get("episodeId")), str(interval.get("participantId")))
        alive = 0.0 if done else 1.0
        delta = aggregates[index] / scale + gamma**duration * alive * next_value - old_value
        next_advantage = next_advantage_by_episode.get(episode_key, 0.0)
        advantage = delta + (gamma * gae_lambda) ** duration * alive * next_advantage
        advantages[index] = advantage
        next_advantage_by_episode[episode_key] = advantage
    old_values = np.asarray(
        [require_finite(interval.get("oldValue"), "choice old value") for interval in intervals],
        dtype=np.float64,
    )
    return advantages, advantages + old_values, scale


def discount_choice_rewards(interval: Mapping[str, Any], *, gamma: float) -> float:
    rewards = interval.get("rewards")
    reward_ticks = interval.get("rewardTicks")
    if (
        not isinstance(rewards, Sequence)
        or isinstance(rewards, (str, bytes))
        or not isinstance(reward_ticks, Sequence)
        or isinstance(reward_ticks, (str, bytes))
        or len(rewards) != len(reward_ticks)
    ):
        raise ValueError("choice interval rewards and ticks are invalid")
    result = 0.0
    discount = 1.0
    for reward, ticks in zip(rewards, reward_ticks, strict=True):
        result += discount * require_finite(reward, "choice reward")
        discount *= gamma ** require_positive_integer(ticks, "choice reward ticks")
    return result


def validate_rollout_arrays(
    rewards: np.ndarray,
    dones: np.ndarray,
    ticks: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rewards = np.asarray(rewards, dtype=np.float64)
    dones = np.asarray(dones, dtype=np.float64)
    ticks = np.asarray(ticks, dtype=np.int64)
    if rewards.ndim != 2 or dones.shape != rewards.shape or ticks.shape != rewards.shape:
        raise ValueError("rollout reward/done/tick arrays must share [steps, worlds] shape")
    if (
        not np.all(np.isfinite(rewards))
        or not np.all((dones == 0) | (dones == 1))
        or not np.all(ticks >= 1)
    ):
        raise ValueError("rollout reward/done/tick arrays are invalid")
    return rewards, dones, ticks


def validate_gamma(gamma: float) -> None:
    if not math.isfinite(gamma) or not 0 < gamma <= 1:
        raise ValueError("gamma must be within (0, 1]")


def require_finite(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(float(value)):
        raise ValueError(f"{label} must be finite")
    return float(value)


def require_positive_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{label} must be a positive integer")
    return value


def require_nonnegative_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{label} must be a nonnegative integer")
    return value


def require_boolean(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{label} must be boolean")
    return value
