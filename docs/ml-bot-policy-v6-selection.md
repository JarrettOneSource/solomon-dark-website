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
`4.470348358154297e-8`, and log-probability error
`1.1609595844674914e-6`. Choice inference selects the same option with value
error `3.725290298461914e-8` and log-probability error
`3.5683373651729244e-9`.

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

- Local task branch: selected checkpoint and receipt update pending final exact
  commit.
- Mac canonical gate and real GameHost/browser acceptance for the selected
  asset: pending below.
- Remote `main`, public Git, production checkpoint, upload, and deployment:
  unchanged and not authorized by this training pass.
- Production/deployed incumbent remains schema v5 SHA-256
  `bf9f21ee7d149a7f46a40265bd9a03659b255468e198fee614f54ebded136f8b`
  until an explicit publication/deployment request.
