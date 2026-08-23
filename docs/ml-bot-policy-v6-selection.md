# ML bot policy v6 selection receipt

Schema v6 is the equipped-spell semantic cutover. It replaces the ambiguous v5
loadout projection with one exact shared descriptor for the current primary,
all eight quickbar slots, and every offered skill. It also isolates choice PPO
from the combat trunk after the stopped v5 joint-optimizer trajectory proved
that overlapping Adam ownership regressed aim lead and potion use.

## Selected checkpoint

- Kind: schema-v6 semantic-expert bootstrap, learned-choice warm start, then
  joint main/choice PPO through update 17.
- Format: strict `SDMLV6`; model/observation/main-trajectory/choice-trajectory
  version 6, 2,738 observations, 106 values per skill descriptor.
- Source tree: `9cd43a43d102e63466cbf46b0597b260668c220b` plus canonical
  checkpoint codec commit `5d4e11a09f94ede4cc71660d7ec2441ff19e02de`.
- Mac checkpoint:
  `/Users/jarrett/codex-acceptance/ml-bot-v6-20260823/training/combined/policy-v6-update-000017.sdml`.
- SHA-256: `c1c4d934b4957421a2c5346fe4d25a8d3cea1e034661a6a880a766a8b2c40b8a`.
- Bytes: `6,464,566`.
- Choice optimizer scope: `choice-head-and-value-v1`; main and choice parameter
  identities are disjoint and old shared-trunk trainer state fails closed.

Python and TypeScript reproduce the selected checkpoint byte-for-byte. Main
inference parity has action equality, value absolute error
`7.450580596923828e-9`, and log-probability error
`1.1377436281989617e-7`. Choice inference selects the same option with value
error `5.21540641784668e-8` and log-probability error
`4.452634903839847e-8`.

## Bootstrap and learning gates

- Combat bootstrap: 6,000 authoritative states, 92.28% enemy-present rows,
  99.85% interesting rows, all movement/aim actions represented, 15 potion
  rows, and 80% deterministic potion imitation.
- Bootstrap probes all passed: combat target `1.0`, combat cast `0.9980`,
  no-target idle `1.0`, aim lead `0.8534`, hazard exit `0.9057`, potion `0.8`.
- Choice dataset: 512 authentic three-option offers after 144,576 decisions;
  25 unique offered skills and 21 unique selected skills. Dataset SHA-256:
  `654074e4c31a0aede77450731a5689c6962ac7e69702339a428ddeec2f35ab65`.
- Choice warm start: 100% training / 86.27% holdout accuracy. Exactly
  `choice_hidden_{weight,bias}` and `choice_score_{weight,bias}` changed; zero
  protected tensors changed.
- Selected update-17 choice retention: 100% training / 86.27% holdout.
- Selected behavior probes all pass: target `1.0`, cast `0.9980`, idle `1.0`,
  aim lead `0.7068`, hazard exit `0.8396`, potion `0.8`.

Twenty PPO updates produced 818,919 authoritative training ticks, 5,145 kills,
97 completed waves, 137 potions, 289 learned skill picks, 214 gold, five items,
43 health orbs, 127 mana orbs, and one powerup. Update 17 is both the best
admissible screen and the last checkpoint before a deterministic regression:
update 18 fails aim lead at `0.6955`, and update 20 falls to `0.5789`.
The rejected tail is retained as evidence and is not selected.

## Frozen 30 + 30 evaluation

Every reported episode ended in a real death. The train-distribution seed that
was still alive at 3,000 decisions was rerun alone through the documented
10,000-decision extension path and died at 4,106 decisions after reaching wave
9, killing 244 enemies, and completing eight waves. No truncated record enters
the final statistics.

| Set/checkpoint | Mean waves reached (95% bootstrap CI) | Kills | Waves completed | Potions | Choices | Items | Health / mana orbs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train, deployed v5 | 1.100 (0.966–1.267) | 636 | 4 | 29 | 41 scripted | 0 | 3 / 12 |
| Train, selected v6 update 17 | 2.200 (1.633–2.867) | 1,847 | 37 | 50 | 99 learned | 2 | 15 / 60 |
| Holdout, deployed v5 | 0.967 (0.800–1.133) | 563 | 2 | 29 | 36 scripted | 0 | 1 / 5 |
| Holdout, selected v6 update 17 | 1.933 (1.567–2.300) | 1,623 | 30 | 37 | 93 learned | 2 | 23 / 34 |

The frozen paired promotion rule passes:

- train-distribution mean difference `+1.100`, 95% interval
  `+0.460..+1.740`;
- holdout mean difference `+0.967`, 95% interval `+0.541..+1.392`;
- candidate wins both paired sets and does not regress on holdout.

## Equipped-spell evidence

The schema membership tests cover five elemental primaries, all ten weld
builds, all 23 category-2 spells, every quickbar position, empty slots, rank
changes, and every authored numeric skill property. The twelve non-elemental
members that collided in v5 are now collision-free.

In the 30-seed holdout, exact actions by equipped non-elemental spell were:
Teleport 405, Magic Circle 125, Magic Trap 451, and Magic Shield 18. The same
report records Fire 1,819 and Ring of Fire 784. These are selected legal actions
decoded from the current loadout row at each decision, not slot-only counters.

## Publication state

- Validated code/checkpoint/harness commit:
  `75c8ac27eb13cdeeaa4ff6faf085e32c0acb78e3` on local branch
  `codex/ml-bot-learned-choice-finish-20260823-root`.
- Final clean Mac worktree:
  `/Users/jarrett/codex-acceptance/ml-bot-v6-20260823/final`.
- Canonical Mac gate: exit zero; backend build 0 warnings/errors, ML tests
  70/70, every remaining test group zero failures, production Game entry
  435,085 raw / 122,488 gzip bytes within budget, and media policy green.
  Log SHA-256: `8d3afaf28c67d01757dd247d057b45d2fa3a686869cc2ffda872e0ff39158244`.
- Final GameHost smoke: the developer Lua summon joined the party, traveled
  1,392.46 world units through the authored entrance, made 25 policy decisions,
  killed four enemies, and remained alive. Log SHA-256:
  `48e7a8520afb6abc8d4f0b9d511b8783492a3f2f86db9c6b45b654eb5e364d76`.
- Final Mac Chrome acceptance: anonymous and authenticated players entered the
  real Hub, saved, observed deployment drain/reload, and resumed; internal page
  and console error arrays were empty. Anonymous ticks `957 → 1198`;
  authenticated `839 → 1052`. Log SHA-256:
  `61a88d78b41e102d2550c453ef205bc6d1a829ea9488fbff94c3f592a7a25fac`.
- All task-owned backend, Vite, Chrome, supervisor, trainer, rollout, and
  listener processes were stopped; ports 48187/48210 are clear.
- Remote `main`, public Git, production checkpoint, upload, and deployment:
  unchanged and not authorized by this training pass.
- Production/deployed incumbent remains schema v5 SHA-256
  `bf9f21ee7d149a7f46a40265bd9a03659b255468e198fee614f54ebded136f8b`
  until an explicit publication/deployment request.

## Run and continue training on the Mac

Run the packaged selected bot through the real GameHost integration:

```sh
cd /Users/jarrett/codex-acceptance/ml-bot-v6-20260823/final/frontend
npm run smoke:game:ml-bot -- --duration-ms 90000
```

Start a new isolated ten-update PPO experiment from the selected checkpoint:

```sh
cd /Users/jarrett/codex-acceptance/ml-bot-v6-20260823/final
python=/Users/jarrett/codex-acceptance/ml-bot-training-f12db3b6/venv/bin/python
output=/Users/jarrett/codex-acceptance/ml-bot-v6-user-training

PATH=/Users/jarrett/.local/bin:/Users/jarrett/.dotnet:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin \
PYTHONPATH=tools "$python" tools/train_bot_policy.py train \
  --checkpoint frontend/server-assets/ml-bot-policy-v6-selected.sdml \
  --output "$output" --iterations 10 --rollout-steps 512 \
  --ppo-epochs 4 --ppo-batch-size 128 \
  --choice-batch-size 32 --minimum-choice-batch 32 \
  --learning-rate 0.0001 --choice-learning-rate 0.0001 \
  --gamma 0.995 --gae-lambda 0.95 --target-kl 0.02 \
  --worlds 8 --workers 8 --action-repeat 10 --seed 0x5eed3000 \
  --experiment "User continuation from promoted schema-v6 update 17" \
  --expected-metric "paired frozen-seed wave depth increases" \
  --eval-condition "frozen train-dist and holdout seeds"
```

The new output directory is required: update 17 is a selected runtime
checkpoint, not a matching trainer-state resume. Screen each saved checkpoint
with `probes`, `choice-retention`, and `arena`; stop a trajectory at the first
failed behavior probe and never overwrite the packaged selected asset directly.
