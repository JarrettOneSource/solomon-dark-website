# 2026-08-22 — User-corrected Skeleton walking articulation

## Reported smell and parity question

- User correction: stock Skeleton arms visibly move while the actor walks; the
  prior response's “stationary top half is native” conclusion is wrong.
- Reproduction: compare contiguous stock walk draws against a live web
  Skeleton that changes position before entering attack range. Track requested
  movement scalar, resolved displacement, authoritative gait/body state, and
  the actual Pixi limb/body records independently.
- Falsifiers: a stock walk with a constant body record; a native movement path
  that writes only `+0x144`; a web walk whose body record changes before the
  correction; or a class wrapper that applies the same body rule to Skeleton,
  Archer, and Mage.

This is a secondary report in an already-covered system and therefore a
process failure. The prior pass followed action writers and renderer readers
but stopped before the movement vtable wrappers and never captured a real
walking Skeleton. Its attack-only browser proof could not answer the user's
walking-arm report.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | pinned `animation-goldens.json`, instance `anm-g4`, retail SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Walking ticks `24272..24308` submit limb records `1711,1711,1585,1585,1603,1621,1639,1639` and body records `1135,1117,1117,1117,1135,1153,1153,1153`. Stock changes both layers. | high |
| Instructions | Badguy movement builder `0x004763E0`, raw range `0x00476AC9..0x00476B73` | Per represented movement tick, gait phase `+0x144` advances by `S/25` modulo eight and body phase `+0x148` by `S/+0x14C` modulo four; both use strict-greater wraps and float32 stores. Body selector `+0x150` comes from the phase-indexed table. | high |
| Static table | `0x00804F2C`, all indices reachable under the strict wrap | Complete float table is `[0,1,2,1,0.5]`; helper `0x00747360` converts the phase by truncation toward zero. | high |
| Instructions | constructors `0x00473390` and `0x0048ABB0` | Badguy independently seeds gait/body phases with `Float(4,false)`, sets body divisor `35`, and starts selector zero. Mage additionally stores one `Integer(2)` at rest selector `+0x270` and current selector `+0x150`. | high |
| Class wrappers | Skeleton `0x004773E0`, Archer `0x00477B40`, Mage `0x00478380`; vtable slot `+0x6C` | Unarmed/unarmored Skeleton and Archer retain common body gait. Equipped or armored Skeleton resets body selector zero after the common builder. Mage restores constructor rest selector. Every member retains independent limb gait. | high |
| Pre-fix web | `moveTowardTarget` and Mac walking probe | Shared web gait used resolved distance divided by bounded constant `2`, froze when collision returned no displacement, initialized phase zero, and never wrote a walking body selector. | high |

## System boundary and membership inventory

Native system: common hostile locomotion animation from constructor phase
seeding through cadence-aware requested movement, class wrapper, authoritative
snapshot, discrete client sampling, ordered limb/body texture selection, hit
pause, action interruption, and teardown.

| Member | Native source | Disposition after this pass | Proof contract |
| --- | --- | --- | --- |
| Common gait phase and requested-scalar cadence | `0x004763E0`, `+0x144`, divisors `25/8` | exact-ported | float32 recurrence at one/two represented ticks; blocked-motion advance |
| Common body phase/table | `0x004763E0`, `+0x148/+0x14C/+0x150/+0x158`, `0x00804F2C` | exact-ported | full five-value table, strict wrap, truncation, snapshot record sequence |
| Unarmed/unarmored Skeleton walk body | wrapper `0x004773E0`; body `1117 + 18*K + facing` | exact-ported | live walk changes both limb and body records |
| Sword/Mace/Flail/Axe/Pike Skeleton walk body | same wrapper; weapon `+0x231 != 0` | verified-already-at-parity after shared gait correction | body selector remains zero; limb records animate; each equipment overlay remains selector zero |
| Armored claw/weapon/Pike walk body | same wrapper; armor `+0x233 != 0` | verified-already-at-parity after shared gait correction | body selector remains zero; limb records animate |
| Skeleton Archer ordinary approach/retreat | wrapper `0x00477B40`; body `451 + 18*K + facing` | exact-ported | live/synthetic body records follow the common walk table |
| Archer optional STRAFING heading | `+0x268/+0x26C`; absent from retail `wave.txt` | out-of-system — Website has no custom MonsterRecipe author | existing complete authored-row census |
| Skeleton Mage ordinary movement | wrapper `0x00478380`; rest `+0x270` | exact-ported | gait changes while body stays constructor rest `0/1`; cloak branch remains directional-fixed |
| Claw/weapon/Pike/shot/cast actions | exact action writers to `+0x150` | verified-already-at-parity | existing complete action tables and strict-end tests; locomotion resumes only on next movement |
| Skeleton-family hit-pause movement gate | wrappers test common Actor hit field `+0x80` | exact-ported | hit interval advances neither position nor locomotion phases |
| Collision-blocked requested movement | animation builder precedes `MoveStep 0x00525800` | exact-ported | zero resolved travel still advances both requested-motion phases |
| Protocol/timeline/renderer | existing gait/body fields; `NativeEnemyView` layers | exact-ported | discrete round trip and actual rendered limb/body entry diagnostics |
| Zombie | direct common builder for gait; separate articulated torso/arms/head | exact-ported for shared gait; out-of-system for Skeleton body table | exact gait recurrence plus existing Zombie articulation tests |
| Imp, Wraith, Demon, Coffin | common/special movement wrappers but renderers do not consume Skeleton body selector | verified-already-at-parity after shared gait correction | renderer-family census; no invented body-table consumer |
| Maggot | separate grounded two-pose crawl program | out-of-system — does not consume Badguy `+0x144/+0x148` | existing Maggot program/tests |

No member is blocked by the browser platform. Constructor phase values use an
authoritative dedicated native-RNG stream with the exact inclusive `Float(4)`
primitive/domain. As elsewhere in the web enemy port, this does not claim the
retail process-global inter-object RNG call sequence.

## Native ownership thread and recovered behavioral contract

- `S = f32((actor+0x1A4) * (actor+0x70) * (actor+0x120))`. Normal hostile
  cadence represents two native ticks; both phase recurrences run twice before
  the one cadence-scaled movement request.
- Gait recurrence is `g = f32(g + S/25)` followed by `g=f32(g-8)` only for
  `g>8`. Body recurrence is `b=f32(b+S/35)`, then `b=f32(b-4)` only for
  `b>4`; selector is `[0,1,2,1,0.5][truncTowardZero(b)]`.
- Requested scalar owns animation. Downstream collision may shorten or erase
  displacement without rewinding either phase.
- Skeleton equipment/armor and Mage rest selection are post-common wrapper
  overrides. Archer retains the common selector. Action branches remain the
  higher-priority writer while active.
- The server owns both continuous phases and the selected body pose. Existing
  protocol gait/body fields remain sufficient; no renderer-local clock or
  protocol bump is needed.

## Web implementation consequence

- Delete `BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE` and the resolved-distance gait
  approximation across the shared enemy mover.
- Add exact float32 gait/body phase helpers and complete authored body table to
  `boneyard-skeleton-family-animation.ts`.
- Retain authoritative gait/body phase and Mage rest pose in each enemy actor;
  seed the two constructor phases independently from the dedicated native RNG.
- Apply Skeleton/Archer/Mage wrapper rules only after advancing the common
  phases. Do not animate equipped/armored Skeleton bodies or Mage bodies from
  the common table.
- Extend the focused Mac journey to require a real walking Skeleton with
  changing position, limb records, and body records before its attack proof.

## Validation contract

- Red test: movement with a resolver that returns no displacement must still
  advance exact gait/body phases and the applicable body selector.
- Per-member tests: unarmed Skeleton, every weapon and armor branch, Archer,
  Mage rest 0/1, action priority/resumption, hit pause, Zombie shared gait, and
  excluded renderer families.
- Differential: replay the stock table and eight clean walk records above.
- Mac browser: a real authoritative Skeleton must visibly walk before attack;
  actual Pixi limb and body entries must each change with empty error arrays.
- Run Mod Loader's registered static RE suite and Website's canonical
  `./scripts/validate.sh` on exact rebased trees before publication.

## Implementation validation receipt

- `boneyard-enemy-store.ts` now owns independent constructor-seeded gait and
  body phases, Mage's constructor rest selector, the requested-scalar
  two-native-tick recurrence, Skeleton/Archer/Mage post-common wrapper rules,
  and the inherited hit-field pause. Resolved collision distance no longer
  owns animation. The existing replicated gait/body selectors remain the only
  wire presentation state.
- Regression coverage includes strict endpoint/wrap behavior, all five body
  table values, zero-resolved movement, every Skeleton weapon with and without
  armor, bare Skeleton, Archer, Mage, Zombie shared gait, hit pause, and action
  priority/resumption. Renderer diagnostics report the actual submitted limb
  and body records, not inferred selectors.
- Mod Loader was rebased onto parent
  `923cab53ffdd16ab5676b3ceaf339f799ad70c30`; its regenerated enemy catalog is
  byte-identical to the checked-in result and the registered Mac CI-safe RE
  suite passed `491/491`.
- Website was rebased onto parent
  `aa9120340df91cac16435f9c859da0983d77c3b5`. The Mac canonical gate passed:
  backend build plus `16/16` contracts; frontend groups `4/4`, `43/43`,
  `232/232`, `1328/1328`, `9/9`, `42/42`, `11/11`, `7/7`, `17/17`, and
  `21/21`; desktop `5/5`; production build, media policy, and bundle budget
  (`415695` raw / `116365` gzip bytes). Only the eight existing Fast Refresh
  warnings remain.
- The current-main live Mac Chrome 151.0.7922.170 journey crossed the explicit
  cheat-enabled `CONTINUE LOCAL` boundary, then observed walking actor 1 at 106
  distinct positions across 109 samples. Gait poses covered `0..7`; actual
  limb entries were `1599,1617,1635,1653,1671,1689,1707,1725`; actual body
  entries were `1131,1149,1167`. Attack actor 2 then advanced body poses
  `4,5,6,7,8,9` and records `1203,1221,1239,1257,1275,1293,1311`; its
  early/late crop changed 2,987 pixels / 185,123 color channels. Pixi WebGL
  and all page, console, and failed-response arrays were clean.
- The sibling synthetic WebGL2 proof still covers all eight enemy-family roots.
  Skeleton action records `1189 -> 1315` changed 1,096 pixels / 90,877
  channels, while the independent head record `1477 -> 1494` changed 583
  pixels / 37,154 channels; every error array was empty.
- Task-owned Mac captures are under
  `/Users/jarrett/.codex-evidence/skeleton-walk-20260822/` with the
  `publish-web-skeleton-upper-body-*` and `publish-synthetic-*` prefixes.
  Publication to both `main` branches is authorized and pending; deployment
  remains a separate, unrequested operation.
