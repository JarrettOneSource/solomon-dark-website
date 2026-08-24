"""Mac training-stack acceptance exercised before any campaign is launched."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile

import numpy as np
import torch

from .advantages import (
    RunningReturnNormalizer,
    discount_choice_rewards,
    normalized_main_advantages,
    smdp_choice_advantages,
)
from .bridge import BoneyardRolloutBridge
from .checkpoint import decode_checkpoint, encode_checkpoint, typescript_checkpoint_report
from .model import PolicyV7
from .metrics import (
    episode_gameplay_summary,
    evaluation_checkpoint_identity,
    paired_seed_comparison,
    promotion_decision,
    training_summary,
)
from .optimization import (
    balanced_class_weights,
    behavior_clone,
    choice_ppo_epochs,
    ppo_epochs,
)
from .spec import POLICY_SPEC
from .trainer import (
    TrainingConfiguration,
    checkpoint_training_configuration,
    validate_resume_state,
)


def main() -> int:
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(0x5EED)
    policy = PolicyV7.initialize(0x5EED)
    metadata = POLICY_SPEC.checkpoint_metadata(0x5EED)
    encoded = encode_checkpoint(metadata, policy.export_tensors())
    decoded_metadata, decoded_tensors = decode_checkpoint(encoded)
    assert decoded_metadata == metadata
    restored = PolicyV7()
    restored.load_tensors(decoded_tensors)
    for name, tensor in policy.export_tensors().items():
        np.testing.assert_array_equal(tensor, restored.export_tensors()[name])

    rows = 4
    observations = torch.zeros((rows, POLICY_SPEC.observation_size), dtype=torch.float32)
    plans = {
        "movement": null_masks(rows, 9),
        "target": null_masks(rows, 9),
        "ability_by_target": null_mask_plan(rows, 9, 22),
        "aim_by_ability": null_mask_plan(rows, 22, 9),
    }
    generator = torch.Generator().manual_seed(123)
    with torch.no_grad():
        action_batch = restored.act(
            observations, plans, deterministic=False, generator=generator
        )
    assert all(torch.equal(action, torch.zeros(rows, dtype=torch.long)) for action in action_batch.actions.values())
    assert torch.all(torch.isfinite(action_batch.log_probability))
    assert torch.all(torch.isfinite(action_batch.value))
    weights = balanced_class_weights(torch.tensor([0, 0, 0, 1]), 2)
    assert weights[1] > weights[0]
    assert torch.isclose(weights[torch.tensor([0, 0, 0, 1])].mean(), torch.tensor(1.0))

    main_optimizer = torch.optim.Adam(restored.main_parameters(), lr=3e-4)
    bootstrap_metrics = behavior_clone(
        restored,
        main_optimizer,
        observations,
        action_batch.masks,
        action_batch.actions,
        epochs=1,
        batch_size=2,
        generator=torch.Generator().manual_seed(456),
    )
    assert bootstrap_metrics and np.isfinite(bootstrap_metrics[-1].loss)

    with torch.no_grad():
        on_policy = restored.act(observations, plans, deterministic=True)
    rewards = np.asarray([[0.0, 0.25], [0.5, -0.1]], dtype=np.float64)
    values = on_policy.value.detach().numpy().reshape(2, 2)
    advantages, returns, return_scale = normalized_main_advantages(
        rewards,
        values,
        np.asarray([[0, 0], [1, 0]], dtype=np.uint8),
        np.full((2, 2), 10, dtype=np.uint32),
        np.zeros(2, dtype=np.float64),
        RunningReturnNormalizer(),
        gamma=0.995,
        gae_lambda=0.95,
    )
    ppo_metrics = ppo_epochs(
        restored,
        main_optimizer,
        observations,
        on_policy.masks,
        on_policy.actions,
        on_policy.log_probability.detach(),
        torch.from_numpy(advantages.reshape(-1)).float(),
        torch.from_numpy(returns.reshape(-1)).float(),
        epochs=1,
        batch_size=2,
        generator=torch.Generator().manual_seed(789),
    )
    assert ppo_metrics and return_scale > 0 and np.isfinite(ppo_metrics[-1].policy_loss)

    choice_observations = observations[:2]
    descriptors = torch.zeros((2, 3, POLICY_SPEC.option_descriptor_size))
    descriptors[:, :, 0] = 1
    choice_masks = torch.tensor([[1, 1, 0], [1, 1, 1]], dtype=torch.bool)
    with torch.no_grad():
        selected, choice_old = restored.select_choice(
            choice_observations,
            descriptors,
            choice_masks,
            temperature=1.25,
            deterministic=True,
        )
    choice_intervals = [
        {
            "done": False,
            "durationTicks": 0,
            "episodeId": "a",
            "nextValue": 0.0,
            "oldValue": float(choice_old.value[0]),
            "participantId": "agent",
            "rewards": [],
            "rewardTicks": [],
        },
        {
            "done": True,
            "durationTicks": 10,
            "episodeId": "a",
            "nextValue": 0.0,
            "oldValue": float(choice_old.value[1]),
            "participantId": "agent",
            "rewards": [0.25],
            "rewardTicks": [10],
        },
    ]
    credit_rewards = [0.65, 1.5, -2.0]
    credit_ticks = [10, 20, 10]
    expected_credit = (
        credit_rewards[0]
        + 0.995**10 * credit_rewards[1]
        + 0.995**30 * credit_rewards[2]
    )
    assert np.isclose(
        discount_choice_rewards(
            {"rewards": credit_rewards, "rewardTicks": credit_ticks},
            gamma=0.995,
        ),
        expected_credit,
    )
    choice_advantages, choice_returns, choice_scale = smdp_choice_advantages(
        choice_intervals,
        RunningReturnNormalizer(),
        gamma=0.995,
        gae_lambda=0.95,
    )
    shared_trunk_before = [
        parameter.detach().clone()
        for module in (restored.trunk_1, restored.trunk_2)
        for parameter in module.parameters()
    ]
    assert not (
        {id(parameter) for parameter in restored.main_parameters()}
        & {id(parameter) for parameter in restored.choice_ppo_parameters()}
    )
    choice_optimizer = torch.optim.Adam(restored.choice_ppo_parameters(), lr=3e-4)
    choice_metrics = choice_ppo_epochs(
        restored,
        choice_optimizer,
        choice_observations,
        descriptors,
        choice_masks,
        selected,
        choice_old.log_probability,
        torch.from_numpy(choice_advantages).float(),
        torch.from_numpy(choice_returns).float(),
        temperature=1.25,
        epochs=1,
        batch_size=2,
        generator=torch.Generator().manual_seed(1_234),
    )
    assert choice_metrics and choice_scale > 0 and np.isfinite(choice_metrics[-1].value_loss)
    shared_trunk_after = [
        parameter.detach()
        for module in (restored.trunk_1, restored.trunk_2)
        for parameter in module.parameters()
    ]
    assert all(
        torch.equal(before, after)
        for before, after in zip(shared_trunk_before, shared_trunk_after, strict=True)
    )
    paired = paired_seed_comparison([1, 2, 3, 4], [2, 3, 4, 5])
    assert paired["candidateWins"] is True and paired["candidateRegresses"] is False
    promotion = promotion_decision(
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [2, 2, 2, 2],
        [2, 2, 2, 2],
    )
    assert promotion["promoted"] is True
    gameplay = episode_gameplay_summary([{
        "consumables_used": 1,
        "death": True,
        "enemy_kills": 3,
        "enemy_kills_by_kind": {"SKELETON": 3},
        "gold_collected": 2.0,
        "health_orbs_collected": 1,
        "item_kinds": {"equipment": 1},
        "items_collected": 1,
        "mana_orbs_collected": 2,
        "powerups_collected": 1,
        "simulation_ticks": 40,
        "skill_picks": 2,
        "steps": 4,
        "waves_completed": 1,
    }])
    assert gameplay["enemy_kills"] == 3
    assert gameplay["waves_completed"] == 1
    assert gameplay["potions_used"] == 1
    assert gameplay["item_kinds"] == {"equipment": 1}

    with tempfile.TemporaryDirectory() as temporary_name:
        temporary = Path(temporary_name)
        summary_metadata = {
            **metadata,
            "integralFloatCodecProbe": 1.0,
            "trainingConfiguration": checkpoint_training_configuration(
                TrainingConfiguration(
                    learning_rate=0.000025,
                    choice_learning_rate=0.000025,
                )
            ),
            "trainedEnvironmentSteps": 10,
            "trainedUpdates": 1,
        }
        assert summary_metadata["trainingConfiguration"]["learning_rate"] == "0.000025"
        summary_checkpoint = temporary / "policy-v7-update-000001.sdml"
        summary_checkpoint.write_bytes(
            encode_checkpoint(summary_metadata, policy.export_tensors())
        )
        typescript_codec = typescript_checkpoint_report(summary_checkpoint)
        assert typescript_codec["sha256"] == typescript_codec["reencodedSha256"]
        try:
            validate_resume_state(
                {"choiceOptimizerScope": "shared-trunk-v0"},
                summary_checkpoint,
                TrainingConfiguration(),
                summary_metadata,
            )
        except ValueError as error:
            assert "incompatible choice optimizer scope" in str(error)
        else:
            raise AssertionError("legacy overlapping choice optimizer state was accepted")
        (temporary / "metrics.jsonl").write_text(
            json.dumps({
                "env_steps_total": 10,
                "episodes_completed": 1,
                "gameplay": {"enemy_kills": 2, "waves_completed": 1},
                "iter": 1,
                "kl_divergence_max": 0.01,
                "reward_terms": {"clamp_adjustment": 0.0},
            }) + "\n",
            encoding="utf-8",
        )
        (temporary / "episodes.jsonl").write_text(
            json.dumps({
                "aborted": False,
                "choice_events": [],
                "consumables_used": 0,
                "continuous_primary_cast": False,
                "death": True,
                "enemy_kills": 2,
                "enemy_kills_by_kind": {"SKELETON": 2},
                "gold_collected": 0.0,
                "health_orbs_collected": 0,
                "item_kinds": {},
                "items_collected": 0,
                "mana_orbs_collected": 0,
                "maximum_equipped_skill_ranks": {"16": 1},
                "maximum_primary_cast_run_ticks": 10,
                "powerups_collected": 0,
                "primary_action_decisions": 1,
                "primary_action_ticks": 10,
                "primary_actions_by_loadout": {
                    "primary:16": {
                        "maximumPrimaryCastRunTicks": 10,
                        "primaryActionDecisions": 1,
                        "primaryActionTicks": 10,
                        "primaryCastRuns": 1,
                        "primarySkillId": 16,
                        "weldBuildId": None,
                    }
                },
                "primary_cast_runs": 1,
                "primary_loadout_key": "primary:16",
                "primary_skill_id": 16,
                "return": 3.0,
                "simulation_ticks": 10,
                "skill_picks": 0,
                "spell_actions_by_skill_id": {"16": 1},
                "steps": 1,
                "weld_build_id": None,
                "waves_completed": 1,
                "waves_reached": 2,
            }) + "\n",
            encoding="utf-8",
        )
        summary = training_summary(temporary, summary_checkpoint)
        assert summary["updates"] == 1
        assert summary["trained_environment_steps"] == 10
        assert summary["gameplay"]["enemy_kills"] == 2
        identity_report = {
            "checkpoint": str(summary_checkpoint.resolve()),
            "checkpointSha256": summary["checkpoint_sha256"],
            "evaluationVersion": 7,
        }
        identity = evaluation_checkpoint_identity(
            identity_report, identity_report, label="candidate"
        )
        assert identity["checkpointSha256"] == summary["checkpoint_sha256"]
        legacy_identity = evaluation_checkpoint_identity(
            {**identity_report, "evaluationVersion": 6},
            {**identity_report, "evaluationVersion": 6},
            label="incumbent",
            accepted_versions=(5, 6, 7),
        )
        assert legacy_identity == identity
        try:
            evaluation_checkpoint_identity(
                {**identity_report, "evaluationVersion": 6},
                {**identity_report, "evaluationVersion": 6},
                label="candidate",
            )
        except ValueError as error:
            assert "version must be one of 7" in str(error)
        else:
            raise AssertionError("candidate accepted a legacy evaluation version")
        try:
            evaluation_checkpoint_identity(
                identity_report,
                {**identity_report, "checkpointSha256": "0" * 64},
                label="candidate",
            )
        except ValueError as error:
            assert "hashes differ" in str(error)
        else:
            raise AssertionError("promotion identity accepted mismatched hashes")
        (temporary / "metrics.jsonl").write_text(
            json.dumps({
                "env_steps_total": 20,
                "episodes_completed": 1,
                "gameplay": {},
                "iter": 2,
            }) + "\n",
            encoding="utf-8",
        )
        try:
            training_summary(temporary, summary_checkpoint)
        except ValueError as error:
            assert "does not match" in str(error)
        else:
            raise AssertionError("training summary accepted mismatched checkpoint metrics")

    with BoneyardRolloutBridge([0x100, 0x101], worker_count=2) as bridge:
        initial_hashes = bridge.state.hashes
        primary_id_index = POLICY_SPEC.observation_names.index(
            "equipped_primary_option_id_index_scaled"
        )
        primary_present_index = POLICY_SPEC.observation_names.index(
            "equipped_primary_present"
        )
        assert np.all(bridge.state.observations[:, primary_present_index] == 1)
        assert np.allclose(
            bridge.state.observations[:, primary_id_index]
            * POLICY_SPEC.scales["skillId"],
            [16, 24],
        )
        assert [row["primaryLoadoutKey"] for row in bridge.state.metadata] == [
            "primary:16",
            "primary:24",
        ]
        expert = bridge.expert_step(ticks=2)
        assert expert.transition.actions.shape == (2, 4)
        assert expert.transition.observations.shape == (2, POLICY_SPEC.observation_size)
        assert len(expert.transition.gameplay_counters) == 2
        assert expert.state.plans.ability_by_target.shape == (2, 9, 22)
        reset = bridge.reset([0x100, None])
        assert reset.hashes[0] == initial_hashes[0]
        assert reset.hashes[1] == expert.state.hashes[1]

    with BoneyardRolloutBridge(
        [0x1234_5678], worker_count=1, learned_choices=True
    ) as bridge:
        for _ in range(2_000):
            if bridge.state.choices[0] is not None:
                break
            bridge.expert_step(ticks=10)
        plan = bridge.state.choices[0]
        assert plan is not None
        before_hash = bridge.state.hashes[0]
        selected_state = bridge.select_choices([{
            "oldLogProbability": -0.5,
            "oldValue": 1.25,
            "selectedOption": int(np.flatnonzero(plan.option_mask)[0]),
        }])
        assert selected_state.hashes[0] != before_hash
        assert selected_state.choices[0] is None
        choice_step = bridge.expert_step(ticks=10)
        assert choice_step.transition.choice_events[0]["choiceMode"] == "learned"
        assert choice_step.transition.choice_events[0]["trainable"] is True

    print(json.dumps({
        "checkpointBytes": len(encoded),
        "observationSize": POLICY_SPEC.observation_size,
        "optionDescriptorSize": POLICY_SPEC.option_descriptor_size,
        "returnScale": return_scale,
        "choiceReturnScale": choice_scale,
        "status": "ok",
    }, sort_keys=True))
    return 0


def null_masks(rows: int, width: int) -> torch.Tensor:
    result = torch.zeros((rows, width), dtype=torch.bool)
    result[:, 0] = True
    return result


def null_mask_plan(rows: int, choices: int, width: int) -> torch.Tensor:
    result = torch.zeros((rows, choices, width), dtype=torch.bool)
    result[:, :, 0] = True
    return result


if __name__ == "__main__":
    raise SystemExit(main())
