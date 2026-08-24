# All-primary ML bot policy v7 selection receipt

Schema v7 is the capability-complete ML bot cutover. It observes the exact
equipped primary, every quickbar slot, and every offered skill through one
138-value descriptor. Exact uint16 skill and Weld-build bits remain distinct
after the smooth scaled identity feature saturates, so later native catalog
rows can enter collection without another identity-layout change.

## Selected v7 checkpoint

- Selected within the v7 family: low-KL continuation update 19.
- Packaged path: `frontend/server-assets/ml-bot-policy-v7-selected.sdml`.
- SHA-256: `85edda9d6bd7f7f08eca209fb9790c8d4d5e570e20b8ff8d5bb08284b3dd055c`.
- Bytes: `7,086,446`.
- Format/model/observation/main trajectory/choice trajectory: strict version 7.
- Observation width: 3,026; descriptor width: 138; parameters: 1,744,948.
- Trained updates/environment ticks: 19 / 1,458,211.
- Choice mode: learned; optimizer scope: `choice-head-and-value-v1`.
- Python and TypeScript re-encode the packaged file to the same SHA. Main and
  choice actions match; value/log-probability errors remain below `2.4e-6`.

The selected lineage used 19 metric updates (initial PPO 1–10, then low-KL
updates 11–19): 9,295 kills, 142 completed waves, 325 potions, 501 learned
choices, 395 Gold, eight items, 89 health orbs, and 242 mana orbs.

## All-primary and continuous-cast contract

The curriculum is generated from authoritative category-1 catalog rows and
`NATIVE_WELD_BUILDS`: five pure primaries plus all ten Welds. Frozen train and
holdout each contain exactly two starting episodes per row. Evaluation is
invalid if any row lacks a primary action or if Lightning, Frost Jet, Boulder,
Flame Lash, Blizzard Beam, or Steam Jet never holds primary across two
consecutive ten-tick decisions.

Across the final 60 episodes:

| Loadout | Primary decisions | Max held ticks | Waves reached |
| --- | ---: | ---: | ---: |
| Magic Missile (`primary:8`) | 386 | 10 | 9 |
| Fireball (`primary:16`) | 108 | 10 | 4 |
| Lightning (`primary:24`) | 2,686 | 4,040 | 14 |
| Frost Jet (`primary:32`) | 1,288 | 2,130 | 3 |
| Boulder (`primary:40`) | 672 | 3,451 | 0 |
| Burning Bolt (`weld:1000`) | 248 | 60 | 8 |
| Frost Missile (`weld:1001`) | 130 | 10 | 4 |
| Ball Lightning (`weld:1002`) | 93 | 20 | 4 |
| Flame Lash (`weld:1003`) | 4,106 | 4,780 | 16 |
| Blizzard Beam (`weld:1004`) | 965 | 2,740 | 1 |
| Steam Jet (`weld:1005`) | 1,351 | 2,490 | 5 |
| Ethereal Boulder (`weld:1006`) | 435 | 220 | 1 |
| Meteor Swarm (`weld:1007`) | 685 | 1,750 | 3 |
| Hailstones (`weld:1008`) | 392 | 10 | 1 |
| Crawling Shock (`weld:1009`) | 68 | 10 | 4 |

Every row acted and all six continuous members passed by large margins.
Dynamic telemetry follows the current equipped pure/Weld identity if a learned
choice changes primary mid-episode.

## Training gates

- Expert bootstrap: 15,000 authoritative states; all 15 loadouts and all
  primary actions represented; 99.60% validation ability, 96.47% aim, 77.67%
  movement, 100% target, and 83.33% potion imitation.
- Learned-choice bootstrap: 512 real offers after 158,790 authoritative
  decisions; all 15 primary contexts, 38 offered skills, 33 selected skills,
  and all three option positions represented; 100% train / 89.22% holdout.
- Final selected probes: target 100%, combat cast 99.81%, no-target idle
  99.80%, aim lead 94.95%, hazard exit 91.94%, potion 83.33%.
- Final selected choice retention: 98.29% train / 97.06% holdout.
- Three PPO experiments were retained: the 20-update base campaign, a ten-update
  low-KL continuation, and an approved `gamma=0.999` experiment. Every screened
  checkpoint remained probe- and choice-admissible.

## Frozen 30 + 30 evaluation

All reported episodes ended in real death; no extension or truncated record is
present in the packaged checkpoint reports.

| Set/checkpoint | Mean waves reached (95% bootstrap CI) | Kills | Waves completed | Choices | Potions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train, unpublished all-primary v6 | 1.000 (0.567–1.633) | 971 | 10 | 46 | 19 |
| Train, selected v7 | 1.533 (0.867–2.333) | 1,567 | 24 | 67 | 36 |
| Holdout, unpublished all-primary v6 | 1.033 (0.633–1.500) | 950 | 14 | 51 | 19 |
| Holdout, selected v7 | 1.033 (0.700–1.400) | 807 | 10 | 48 | 34 |

The selected v7 does not regress by mean, but it does **not** pass the frozen
paired performance promotion rule against the stronger unpublished v6
candidate:

- train: `+0.533`, 95% `-0.044..+1.111`;
- holdout: `+0.000`, 95% `-0.451..+0.451`;
- official `promoted=false`.

The v7 asset is packaged on this local capability branch because v6 cannot
satisfy the requested future-safe exact identity contract. It is not claimed
as a performance promotion and is not authorized for public `main` or
production. The final v7 evaluation itself is promotion-valid and has complete
primary/channel coverage.

The 60 packaged episodes ended in 60 real deaths after 30,010 decisions,
2,374 kills, 34 completed waves, 115 learned choices, and 70 potions. The
farthest reached wave 9, killed 475 enemies, and completed eight waves as
Lightning. A separate admissible update-17 experiment reached wave 12 (672
kills, 11 completed waves) but was rejected as the packaged model because its
aggregate train/holdout consistency was weaker.

## Mac acceptance

- Final functional cutoff: `d8ca5e1d59167482545b25db025e3af43a9848ae` on
  upstream game authority `f7e09723cabbfa216fec9d050fa52aab63897fcd`.
- Clean Mac worktree:
  `/Users/jarrett/codex-acceptance/ml-bot-v6-current-main-20260823/final-v7`.
- The final committed selection tree passed the complete Mac canonical gate;
  the immutable log is
  `/Users/jarrett/codex-acceptance/ml-bot-v6-current-main-20260823/final-f7e-canonical.log`.
- A focused backend integration test accepts current schema 7 and retained
  schema 6 saves. Log SHA:
  `a62b40df652f176f9304e4c8ab44998aa6c41a7c8ac013a501d21cc0f2dd6a52`.
- Real Chrome/WebGL deployment, anonymous/authenticated cloud persistence,
  save/reload, active-wizard, retired-wizard, and profile-only acceptance
  passed. Log SHA:
  `6b55038ebafa859b3ec6a63db8243afb732824cbe7476d8835444b78b666e488`.
- Live GameHost smokes passed for all five pure elements. Decisions/kills:
  Ether 25/2, Fire 25/4, Air 25/4, Water 25/1, Earth 40/1. Every bot traversed
  the authored entrance and remained alive.
- Evaluation report SHA-256 values: train
  `d7eca0a67b5e7b35e22288d97f866a98bd829407e186815732c97819148c0320`,
  holdout
  `deb2ac1de3b71f7689fb88dc084e8be0fa8b5c8e06e366a0fd024729ad04f84c`,
  and paired comparison
  `aa961a96eadbbe87fd6dc75f2f4c3840080743a3fd034c354a37b1f6983caa3e`.

## Run it on the Mac mini

Run any pure-primary character through the real GameHost integration:

```sh
cd /Users/jarrett/codex-acceptance/ml-bot-v6-current-main-20260823/final-v7/frontend
npm run smoke:game:ml-bot -- --duration-ms 90000 --bot-element air
```

Accepted elements are `ether`, `fire`, `air`, `water`, and `earth`. In the
developer console, summon a live character directly:

```lua
return sd.bots.summon({ element = "water", discipline = "arcane" })
```

Start a fresh isolated continuation from the packaged checkpoint (do not
overwrite it and do not reuse a mismatched trainer state):

```sh
cd /Users/jarrett/codex-acceptance/ml-bot-v6-current-main-20260823/final-v7
python=/Users/jarrett/codex-acceptance/ml-bot-training-f12db3b6/venv/bin/python
output=/Users/jarrett/codex-acceptance/ml-bot-v7-user-training

PATH=/Users/jarrett/.local/opt/node-v22.17.0-darwin-arm64/bin:/Users/jarrett/.local/bin:/Users/jarrett/.dotnet:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin \
PYTHONPATH=tools "$python" tools/train_bot_policy.py train \
  --checkpoint frontend/server-assets/ml-bot-policy-v7-selected.sdml \
  --output "$output" --iterations 10 --rollout-steps 512 \
  --ppo-epochs 2 --ppo-batch-size 128 \
  --choice-batch-size 32 --minimum-choice-batch 32 \
  --learning-rate 0.000025 --choice-learning-rate 0.000025 \
  --gamma 0.995 --gae-lambda 0.95 --target-kl 0.005 \
  --worlds 15 --workers 8 --action-repeat 10 --seed 0x5eed7500 \
  --experiment "User continuation from all-primary schema-v7 selection" \
  --expected-metric "consistent paired wave depth increases" \
  --eval-condition "frozen all-primary train and holdout seeds"
```

Remote `main`, public Git, production checkpoint, upload, and deployment remain
unchanged and unauthorized.
