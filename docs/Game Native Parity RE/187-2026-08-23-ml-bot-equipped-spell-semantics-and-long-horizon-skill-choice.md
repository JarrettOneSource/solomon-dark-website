# 2026-08-23 — ML bot equipped-spell semantics and long-horizon skill choice

## Reported smell and parity question

- Owner requirement: the bot must know exactly which primary and secondary
  spells it has equipped, learn their different mechanics through play, and
  learn which offered skills carry it furthest rather than merely repeating a
  scripted priority list.
- The retail question ends at authoritative player skill ownership, rank,
  quickbar order, spell mechanics, offer application, and fixed-tick gameplay
  outcomes. A learned policy is an intentional Website automation extension;
  no retail AI or model is claimed.
- Falsifiers: two distinct equipped spells producing the same policy row,
  current rank or weld build being absent, offer and equipped rows using
  different semantics, a choice interval ending without later wave/death
  rewards, two Adam optimizers owning the shared combat trunk, or evaluation
  selecting by training totals instead of paired frozen wave depth.

The membership sweep falsified schema v5's equipped-secondary identity model.
Rows 8..47 were identified by element plus within-band index, but ids 48, 49,
50, 51, 54, 72, 73, 74, 76, 77, 78, and 79 all encoded zero for both fields.
Mana cost and cooldown happened to separate some ranks; those mutable mechanics
are not an identity contract. This is a whole-contract cutover to strict schema
v6, not a special case for one reported spell. Production's selected v5 asset
remains unchanged until a v6 candidate passes the frozen promotion gate.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native/static data already at parity | `native-skill-catalog.json`; `native-secondary-ability-contract.ts`; the 2026-08-23 category-2 cooldown entry above | Five elemental primary rows, ten welded primary builds, all 23 castable category-2 rows, ranks, costs, authored numeric mechanics, targeting/lifetime contracts, and exact cooldowns are already authoritative Website data. | high |
| Web observer | `ml-bot-policy/player-state.ts`, schema-v5 Blocks B/C | Primary element/build is exact. Elemental secondaries are exact; the twelve non-elemental ids listed above share the same element/band identity. | high |
| Web choice path | `skill-options.ts`, `model.py:PolicyV5.evaluate_choice`, `choice-trajectory.ts`, `advantages.py:smdp_choice_advantages` | Each offer has a 56-value mechanical row and the state latent; rewards are tick-discounted through the next offer or terminal state. Equipped spells do not yet use that same row. | high |
| Mac training evidence | stopped campaign `combined-learned-choice-u010-campaign-20260823`, updates 11..33; `STOP-REASON.md`; probes 21..30 | Choice PPO and main PPO independently updated the shared trunk. Deterministic aim-lead/potion regressions began after accumulated choice batches. Update 22 is the last frozen-screen winner; the trajectory was stopped and never promoted or deployed. | high |
| Live process/Git audit | Mac mini 2026-08-23 15:18 EDT; handoff repo rebased at `b5ad7802`; production asset SHA-256 `bf9f21ee…136f8b` | No trainer remained live. The claimed assistant reports were absent; its task-owned supervisor only retried unauthenticated Codex calls and was stopped without touching training artifacts. Production and `main` were unchanged by this continuation. | high |

No new retail address, table, or behavior was recovered, so the Mod Loader's
native reports do not receive a duplicate entry. This work consumes the full
already-recovered skill catalogs.

## System boundary and membership inventory

Native boundary: the authoritative player skill book and stat book, five
elemental primaries, ten weld builds, 23 category-2 quickbar spells, pending
skill offers, accepted progression mutation, native spell/cooldown/action
rails, and resulting fixed-tick combat state. Web-only boundary: semantic
observation, neural inference, expert bootstrap, SMDP choice credit, PPO,
checkpoint selection, and summoned-bot intent dispatch.

| Member | Native/current source | Disposition | v6 proof contract |
| --- | --- | --- | --- |
| Ether, Fire, Air, Water, Earth primary ids 8/16/24/32/40 | `native-primary-skill-profile.ts`, skill/stat books | native mechanics `verified-already-at-parity`; learned observation `out-of-system` web policy | current id, effective/permanent rank, family, cost, damage/range/mechanics and active effect use the shared descriptor row |
| Weld builds 1000..1009, primary id 52 | `NATIVE_WELD_BUILDS`, native weld profile | native mechanics `verified-already-at-parity`; learned observation `out-of-system` web policy | every build has an exact build id and both element members in its equipped row |
| 11 Call Leviathan | secondary contract row 11 | native `verified-already-at-parity`; learned observation `out-of-system` | exact id/rank plus summon/aimed mechanics row |
| 12 Planewalker | row 12 | same | exact id/rank plus self/toggle/duration mechanics row |
| 15 Phasing | row 15 | same | exact id/rank plus movement/cooldown mechanics row |
| 21 Ring of Fire | row 21 | same | exact id/rank plus caster-area damage row |
| 23 Firewalker | row 23 | same | exact id/rank plus toggle/trail/duration row |
| 27 Magic Storm | row 27 | same | exact id/rank plus aimed-area damage row |
| 30 Prismatic Shock | row 30 | same | exact id/rank plus caster-area status row |
| 35 Ring of Ice | row 35 | same | exact id/rank plus caster-area freeze row |
| 41 Earthquake | row 41 | same | exact id/rank plus caster-area disruption row |
| 45 Raise Golem | row 45 | same | exact id/rank plus summon/health/damage row |
| 46 Stoneskin | row 46 | same | exact id/rank plus self-defense/duration row |
| 48 Teleport | row 48 | same | exact id/rank plus mobility/cooldown row; no collision with ids 49+ |
| 49 Magic Circle | row 49 | same | exact id/rank plus aimed-area recovery/slow row |
| 50 Magic Trap | row 50 | same | exact id/rank plus aimed/trap/primary-binding row |
| 51 Dampen | row 51 | same | exact id/rank plus caster-area projectile/dispel row |
| 54 Magic Shield | row 54 | same | exact id/rank plus self-defense/absorb row |
| 72 Acid Rain | row 72 | same | exact id/rank plus aimed-area damage row |
| 73 Fire Wall | row 73 | same | exact id/rank plus aimed-line damage row |
| 74 Ether Drain | row 74 | same | exact id/rank plus aimed-area drain row |
| 76 Call Comet | row 76 | same | exact id/rank plus aimed-area freeze/damage row |
| 77 Turn Undead | row 77 | same | exact id/rank plus caster-area species/status row |
| 78 Mindstar | row 78 | same | exact id/rank plus self/toggle/rank-boost row |
| 79 Regenerate | row 79 | same | exact id/rank plus self/toggle/recovery row |
| quickbar slots 1..8, including empty and primary-binding slots | actor skill book order | native `verified-already-at-parity`; learned projection `out-of-system` | nine ordered equipped rows: current primary then all eight slots; empty rows all zero; bindings retain exact identity but are not admitted as category-2 casts |
| pending offers, weld variants, rank increments, passives and utilities | progression offer/apply owner | native `verified-already-at-parity`; learned chooser `out-of-system` | offered and equipped members share one descriptor builder; every legal row is finite, exact, rank-aware, and masked |
| main movement/target/ability/aim policy and native legality rails | ML observer/action plan plus authoritative simulation | `out-of-system` web policy composed over exact native rails | four autoregressive heads cannot cast absent/unready/unaffordable slots and cannot mutate native ownership directly |
| choice policy and SMDP credit | choice tracker/trainer | `out-of-system` web policy | interval opens at accepted choice, accumulates every later fixed-tick reward, closes at next offer or death, and chains value/advantage by episode |
| production v5 checkpoint | server-only selected asset | `out-of-system` retained deployment baseline | no v5 runtime shim in v6; production file remains byte-identical until explicit publication authorization |

No member is blocked by the browser platform. The first selected v6 campaign
was intentionally Arcane/Fire. The owner reopened that boundary on 2026-08-23:
the final bot must train and evaluate all five pure primaries and all ten Weld
builds, and Air, Water, Earth, Flame Lash, Blizzard Beam, and Steam Jet must
demonstrate consecutive held-primary decisions rather than isolated cast
counts. The all-native curriculum is therefore part of completion, not a later
class/element expansion.

## Ownership and recovered behavioral contract

- The host simulation owns skill identity/rank, quickbar order, offers,
  acceptance, mana, cooldowns, target legality, effects, damage, waves, death,
  replication, reset, and teardown. The policy emits only ordinary semantic
  intents.
- One shared descriptor builder owns the 138 ordered fields for both an offered
  target rank and a currently equipped effective rank. No copied skill table or
  name-based heuristic is allowed.
- The strict v7 observation appends one primary descriptor and eight ordered
  quickbar descriptors to the existing world/combat blocks. Sixteen exact
  binary skill-id bits and sixteen exact Weld-build bits remain collision-free
  after the smooth scaled identity feature saturates, so later catalog ids do
  not require another observation layout change.
- One curriculum owner derives pure primaries from the authoritative skill
  catalog/category table and Welds from `NATIVE_WELD_BUILDS`. Consecutive seeds
  cover every row without a copied selector list. A future primary becomes a
  curriculum member through those native owners; the policy learns it from
  identity, mechanics, runtime effects, legal actions, and later rewards.
- Continuous primary ownership spans policy decisions. Evaluation records
  primary-action decisions/ticks, cast-run count, and maximum consecutive held
  ticks per exact pure/Weld loadout; every channel member must reach at least
  two consecutive ten-tick policy actions.
- Choice reward is the same authoritative combat reward stream: self-health
  delta, attributed damage/XP, wave advancement, and terminal death, with
  fixed-tick discount. Promotion remains paired waves reached over frozen 30 +
  30 seeds; kills or training return alone cannot promote.
- Main PPO owns the shared observation trunk. Choice PPO owns only the choice
  scorer and choice value. The parameter sets are disjoint, old overlapping
  trainer state is rejected, and no fallback resume path exists.

## Web implementation consequence

- Cut the model/spec/trajectory/checkpoint/bridge/asset path to strict schema
  v7; legacy v5/v6 artifacts fail closed and production continues running its
  unchanged public v5 build until separately replaced.
- Extract the skill-row builder from `skill-options.ts`; use it for offer rows
  and for the new equipped-loadout observation block.
- Keep existing Blocks B/C runtime readiness and effect state; append semantic
  loadout rows instead of overloading their established fields.
- Delete the obsolete overlapping `choice_parameters()` seam. Stamp the sole
  choice optimizer scope in checkpoints and trainer state.
- Bootstrap and train v6 from fresh authoritative states; do not reinterpret
  the stopped v5 trajectory as v6 data.

## Validation contract

- Focused TypeScript membership tests enumerate five elemental primaries, all
  ten weld builds, all 23 category-2 spells, eight slot positions, empty and
  primary-binding rows, rank changes, and the twelve previously ambiguous ids.
  Every occupied semantic row is finite, exact and collision-free.
- Offer tests prove the shared builder produces byte-identical mechanics for an
  offered row and the same equipped target rank, including weld identity and
  missing/present numeric properties.
- Python self-test proves v7 spec/codec/Node bridge parity, main PPO, choice
  SMDP PPO, disjoint optimizer ownership, immutable combat trunk during a
  choice-only update, and fail-closed legacy resume.
- Fresh Mac bootstrap must pass action diversity, potion imitation, choice
  diversity, complete per-primary action coverage, train/holdout imitation,
  behavior probes, and Python/TypeScript main-and-choice inference parity.
- Periodic candidate screens record exact equipped skill ids/ranks, casts by
  skill, chosen ids/families, SMDP events/entropy/loss, authoritative ticks,
  kills, waves reached/completed, deaths, potions, loot, and orbs.
- Only credible candidates receive paired 30-seed train-distribution and
  30-seed holdout evaluation. Both sets cover all 15 primary loadouts twice;
  missing primary actions or a failed continuous-cast member makes a report
  ineligible before the frozen promotion rule decides packaging.
- The exact candidate then runs `/opt/homebrew/bin/bash ./scripts/validate.sh`
  and a real Mac Chrome GameHost journey with empty page/console/failed-response
  arrays. Push, main, production replacement, and deployment remain separate
  and are not authorized by this entry.

## Initial v6 implementation validation receipt (superseded as final selection)

- Strict schema v6 adds Block T: nine ordered 106-value rows (current primary
  plus quickbar slots 1..8), all generated by the same `skill-descriptors.ts`
  owner used for offers. The 2,738-value observer, 1,593,396-parameter model,
  SDMLV6 codec, trajectories, worker bridge, GameHost asset path, trainer,
  diagnostics, and docs have no v5 runtime fallback.
- Full membership on Mac: five primaries, ten welds, all 23 category-2 spells,
  eight slot positions, exact zero rows, rank changes, and every numeric
  property in the 81-row native skill range pass. The complete ML suite is
  70/70; the pinned Python/Node self-test reports observation 2,738,
  descriptor 106, and byte-identical cross-codec checkpoints.
- Training source: clean Mac commit `5d4e11a0`; final selected/harness code
  commit `75c8ac27`. Bootstrap used 6,000 authoritative states and passed all
  six probes. Choice bootstrap used 512 real offers after 144,576 decisions,
  25 offered / 21 selected skills, 100% train / 86.27% holdout imitation, and
  changed only four scorer tensors.
- Twenty PPO updates advanced 818,919 ticks and produced 5,145 kills, 97 waves,
  137 potions, 289 choices, five items, and one powerup. Update 17 is selected;
  update 18 is the first aim-lead failure and the tail through 20 is rejected.
- Frozen train evaluation: 30/30 deaths, mean wave 2.200 (95% 1.633..2.867),
  1,847 kills, 37 waves, 99 choices, two items. The sole 3,000-step survivor
  died under the exact extension path at 4,106 decisions after wave 9,
  244 kills, and eight completed waves.
- Frozen holdout: 30/30 deaths, mean wave 1.933 (95% 1.567..2.300), 1,623
  kills, 30 waves, 93 choices, two items. Exact non-elemental actions:
  Teleport 405, Magic Circle 125, Magic Trap 451, Magic Shield 18.
- Paired promotion against deployed v5 passes: train `+1.100` waves, 95%
  `+0.460..+1.740`; holdout `+0.967`, `+0.541..+1.392`. Selected checkpoint
  SHA-256 `c1c4d934b4957421a2c5346fe4d25a8d3cea1e034661a6a880a766a8b2c40b8a`,
  6,464,566 bytes.
- Exact final Mac gate at `75c8ac27`: exit zero, backend 0 warnings/errors, ML
  70/70, all remaining groups zero failures, Game 435,085 raw / 122,488 gzip,
  media policy green. Log SHA-256
  `8d3afaf28c67d01757dd247d057b45d2fa3a686869cc2ffda872e0ff39158244`.
- Final GameHost smoke: authored entrance travel 1,392.46, 25 decisions, four
  kills, alive. Final real Chrome acceptance: anonymous/authenticated Hub,
  save, drain, reload and resume; page/console arrays empty. All task processes
  and listeners exited.
- Local commits only. Remote `main`, production checkpoint, upload, and deploy
  are unchanged and remain unauthorized.

## All-primary v7 implementation validation receipt

- Strict v7 uses 3,026 observations and nine 138-value shared descriptor rows.
  Sixteen exact skill-id bits and sixteen exact Weld-build bits distinguish
  later ids after the scaled feature saturates. The model has 1,744,948
  parameters; SDMLV7, trajectories, trainer, bridge, GameHost, and selected
  asset have no v5/v6 runtime shim.
- The curriculum derives five pure primaries and all ten Welds from native
  owners. Mac tests enumerate every row, exact identity, and future ids 81/82.
  Channel-active primary remains legal across policy decisions; direct Mac
  proof covers Lightning, Frost Jet, Boulder, Flame Lash, Blizzard Beam, and
  Steam Jet.
- Bootstrap used 15,000 authoritative states and represented every primary
  action. Learned-choice bootstrap used 512 authentic offers after 158,790
  decisions: all 15 contexts, 38 offered / 33 selected skills, all option
  positions, 100% train / 89.22% holdout imitation.
- Three retained PPO experiments advanced more than 3.8 million ticks. The
  selected v7 lineage itself reached 1,458,211 ticks, 9,295 kills, 142 waves,
  325 potions, and 501 learned choices. All screened checkpoints retained the
  six combat probes and frozen choice gate.
- Packaged update 19 is strict SHA-256
  `85edda9d6bd7f7f08eca209fb9790c8d4d5e570e20b8ff8d5bb08284b3dd055c`,
  7,086,446 bytes. Python and TypeScript reproduce it byte-for-byte.
- Canonical train: 30/30 deaths, mean wave 1.533 (95% 0.867..2.333),
  1,567 kills, 24 waves, 67 choices, 36 potions. Canonical holdout: 30/30
  deaths, mean 1.033 (0.700..1.400), 807 kills, 10 waves, 48 choices,
  34 potions. Both sets observe every primary and pass all continuous casts.
- The official comparison against the stronger unpublished all-primary v6
  candidate is `promoted=false`: train `+0.533`, 95% `-0.044..+1.111`;
  holdout `+0.000`, `-0.451..+0.451`. V7 is packaged only on this local
  capability branch; no performance-promotion or production claim is made.
- Functional Mac cutoff `d8ca5e1d` is rebased on tutorial authority
  `f7e09723`. The tutorial schema advance exposed and closed two acceptance
  seams: the browser driver now dismisses the first-run offer, and the backend
  accepts current schema 7 while retaining schema 6. The focused cloud-save
  contract and real Chrome deployment/save/reload/killed/profile flows pass.
  Live GameHost smokes pass Ether, Fire, Air, Water, and Earth with ordinary
  entrance traversal and at least one kill each. The final committed selection
  tree passes the complete Mac canonical gate.
- At this validation cutoff, remote `main`, public Git, the production
  checkpoint, upload, and deployment were unchanged. This validation entry did
  not itself authorize publication or deployment.
