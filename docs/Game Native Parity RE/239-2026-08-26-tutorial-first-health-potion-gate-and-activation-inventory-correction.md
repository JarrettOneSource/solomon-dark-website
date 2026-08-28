# 2026-08-26 — Tutorial first-health-potion gate and activation inventory correction

## Reported smell and falsifiers

- Reported behavior: stage 18 remains on `DRINK POTION` after the first of two
  Health Potion quantities is consumed. It advances only after the second.
- The untouched web controller advances only when the recursive health-potion
  quantity is zero. The web Tutorial enters with the ordinary starter Health
  and Mana Potions still in its gameplay economy; wave 5 then stacks its
  authored Health Potion drop onto the starter quantity.
- Falsifiers: stock leaves the starter Health Potion in Tutorial inventory; a
  stock stage-18 transition tests a consumption edge instead of the remaining
  count; wave 5 authors two Health Potion quantities; or the web controller
  receives a duplicate count from presentation state rather than authority.

## Native evidence and corrected ownership

| Evidence | Finding | Confidence |
| --- | --- | --- |
| retail `Tutorial::Activate 0x005D5FE0`, instructions `0x005D6297..0x005D62EB` | recursively finds the first Health Potion (`0x005529A0`) and Mana Potion (`0x00552B70`), removes both through inventory owner `0x00568170`, then refreshes the belt with `0x005D50E0` | high |
| retail `Tutorial::Tick 0x005D6330`, stage 18 at `0x005D6D04..0x005D6D17` | calls recursive Health Potion quantity sum `0x00552A80` on `Game+0x13B8` and advances only when the result is zero | high |
| retail `Game` initializer `0x005CFA80` | creates one quantity each of native Health and Mana Potion before Tutorial activation | high |
| authored `Potion SKELETON` 10065 -> trigger 10072/10073 | wave 5 drops exactly one native Health Potion | high |
| web `preparePlayerEntityTutorialLoadout`, `countTutorialHealthPotions`, and stage 18 | skill loadout is normalized, but starter inventory is untouched; the faithfully zero-gated controller therefore sees quantity two after pickup | high |

This corrects the earlier ledger statements that the natural stock Tutorial
retains its starter potions at backpack indexes 0/1. Those statements described
the then-current web baseline, not the retail activation transaction. The
user-authorized stage-10 amulet guidance remains identity-driven; after this
correction the naturally acquired amulet projects at the first live backpack
cell instead of index 2.

## System boundary and membership inventory

| Member | Owner | Disposition | Required proof |
| --- | --- | --- | --- |
| ordinary new-wizard Health and Mana starter creation | Game/economy initialization | `verified-already-at-parity` outside Tutorial | ordinary Hub/new-run baselines remain unchanged |
| Tutorial activation removal of first recursive native Health and Mana objects | Tutorial loadout transaction | `exact-ported` | fresh Tutorial gameplay backpack has neither starter; native/mod potion near misses remain untouched |
| belt/count refresh after removal | gameplay economy and existing derived HUD | `exact-ported` by authoritative economy mutation | no stale potion quantity or action survives entry |
| wave-5 Potion Skeleton and one Health Potion drop | authored Tutorial graph | `verified-already-at-parity` | pickup creates exactly one health quantity |
| stage-18 recursive health count and zero predicate | `native-tutorial.ts` controller | `verified-already-at-parity`; do not weaken | quantity one holds stage 18; first consume makes zero and starts wave 6/stage 19 |
| Mana Potion removal | same native activation transaction | `exact-ported` sibling | no ordinary mana starter remains in Tutorial |
| nested Sack traversal | inventory tree owner | `exact-ported` | first matching native subtype can be removed recursively without flattening siblings |
| durable pre-Tutorial profile and post-Tutorial Create loadout | profile/session owners | `verified-already-at-parity` | transient Tutorial stripping does not mutate the saved baseline; Create still receives normal starters |
| stage-10 authored amulet guidance | exact identity plus live projection | `verified-already-at-parity` after natural-index correction | pointer follows the actual amulet cell, now naturally index 0 |
| death, restart, disconnect, and ordinary Boneyard entry | existing session teardown/entry | `verified-already-at-parity` | no stripped economy leaks outside the Tutorial run |

No member is blocked by the browser platform.

## Implementation and validation contract

- Keep the stage-18 `healthPotionCount === 0` predicate. Correct the owning
  Tutorial activation transaction by removing the first recursive stock Health
  and Mana Potion objects before the run begins, alongside the existing Acid
  Rain/quickbar normalization.
- Add red coverage for the transient Tutorial economy, recursive exact-subtype
  removal, untouched ordinary-game starters, the single wave-5 quantity, and
  the stage-18 `1 -> 0 -> stage 19/wave 6` transition after one real consume.
- Update stage-10 natural-index expectations without weakening its exact amulet
  identity or live-cell behavior.
- Validate the exact candidate on the Mac mini through the canonical Website
  gate and a real Chrome Tutorial journey that picks up the authored drop,
  drinks it once, observes stage 19/`SURVIVE`, and records empty page, console,
  failed-request, and failed-response arrays.

## Implementation validation receipt

- `discardInventoryItem` now exposes the inventory owner's whole-object
  recursive removal transaction. `preparePlayerEntityTutorialLoadout` finds
  and discards the first native Health and Mana Potion before returning the
  Tutorial skill/economy transaction. The stage-18 zero-count predicate is
  unchanged.
- The untouched Mac candidate failed both causal regressions: Tutorial entry
  still contained the Health/Mana pair, and inserting the one authored drop
  produced health quantity 2 instead of 1. After implementation, the focused
  inventory/Tutorial/modal group passed `51/51`, the typed Tutorial group
  passed `55/55`, and the complete save-document group passed `17/17` with the
  active Tutorial amulet at natural backpack index 0.
- The exact final Mac tree passed `/opt/homebrew/bin/bash ./scripts/validate.sh`:
  backend build with zero warnings/errors, 24 Website/backend contracts,
  formatting, lint/import/generated checks, every frontend group including
  `1594/1594` Boneyard/game tests, five desktop tests, production frontend and
  game-host builds, bundle budget, and media policy.
- The byte-identical Mod Loader report passed the canonical portable static-RE
  gate, `509/509`.
- Mac Chrome at `1600x900` entered the stock Tutorial with no transient starter
  potions, materialized and picked up one authored Health Potion, observed
  quantity 1 at stage 18, clicked the real red potion button once, observed
  quantity 0 and stage 19, and painted `SURVIVE`. The post-Tutorial Create flow
  still restored the ordinary `Health Potion` / `Mana Potion` starter pair.
  Page, console, failed-response, and request-error arrays were empty.
- Manual inspection confirms the stage-19 frame paints `SURVIVE` above the live
  Boneyard, with the normal HUD and no lingering `DRINK POTION` instruction.
  The final screenshot and JSON receipt are retained under Mac
  `/Users/jarrett/codex-evidence/tutorial-health-potion-gate-20260826/`.
  The task remains unpushed pending publication direction.
