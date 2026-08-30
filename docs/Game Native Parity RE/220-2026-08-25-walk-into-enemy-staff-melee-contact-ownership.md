# 2026-08-25 — walk-into-enemy Staff melee contact ownership

## Reported smell and parity question

- Reported web behavior: automatic melee appears not to work when the player
  walks into an enemy.
- Stock behavior to recover: an idle living wizard with an equipped Staff
  automatically starts the Staff melee/proc action from the native contact
  lanes; no attack button is required.
- Reproduction inputs/scenes: ordinary generated Boneyard after the Solomon
  run edge, stock Tutorial combat lesson 11 (`WALK INTO ENEMIES TO CLUB THEM`),
  custom/mod Arena (combat immediately enabled), every flags-`0x2` hostile
  family, Coffin, Maggot, another player, prelude gating, equipped Staff,
  equipped Wand, and empty weapon.
- Falsifiers: a real movement epoch can settle a player/enemy pair at the
  shared circle solver's legal separation without creating a Staff action; a
  walk-in collision needs a facing test; a marker applies physical contact to
  a departed target; a hidden Coffin or Wand/empty hands creates an action; a
  risen Coffin fails to create one; or the fix
  changes damage shapes, proc RNG, action timing, protocol, or presentation.

This reopens the 2026-08-21 Staff closure. That pass skipped the real
collision-to-action owner boundary: it collapsed two native contact sources
into one center-distance predicate and validated only a hand-staged exact-touch
fixture. Exact touch cannot be produced by the shared web solver after a real
overlap because that solver deliberately adds `0.1` clearance. The earlier
claim of a complete automatic Staff action/contact system was therefore too
broad.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Stock identity | retail Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-25; preferred base `0x00400000` | Same sealed retail image as the Staff and movement goldens. | high |
| Fresh instructions | Ghidra 12.0.3 canonical read-only replica; `PlayerWizard_Ctor 0x0052B4C0`, `GoodGuy_Ctor 0x0052A410`, `PlayerActor::Tick 0x00548B00`, instruction windows `0x0054AFF1..0x0054B336` | GoodGuy owns a current-contact list at `+0x13C/+0x144/+0x150`. A movement epoch separately arms and clears a Region result list, consumes it first, and sends a flags-`0x2` collision directly to Staff action creation without a heading test. Only a zero-result movement epoch falls back to the GoodGuy list and strict heading delta below 50 degrees. | high |
| Fresh instructions | `PlayerActor_MoveStep 0x00525800`, dynamic response `0x00526520`, append windows `0x005267E5..0x00526832` and `0x005268EB..0x00526925`, circle responses `0x00521E00/0x00521EF0` | Root dynamic contacts are retained by identity before the caller consumes them, although resolved centres are separated to `radiusA + radiusB + 0.1`. Recursive response does not publish a root contact. | high |
| Fresh xref census | `0x00537AA0` has one caller, `0x0054B331`; `PlayerWizard_StaffContact 0x0053B9F0` has one caller, action callback `0x00550180` | Admission and marker contact have one PlayerWizard owner chain; there is no sibling input/button dispatcher to port. | high |
| Existing durable evidence | `Mod Loader/docs/reverse-engineering/native-skills-and-spells.md`, `native-movement-and-tick.md`, `native-class-loadouts.md`, `native-audio-events.md` | Staff type `0x1B5C`, alternating melee banks, all five proc outcomes, exact action/marker timing, damage shapes, contact side effects, audio, and lifecycle are already recovered. The two contact-source distinction is corrected in this pass. | high |
| Current web trace | origin/main `1428269151a5be725a29707f0b1fb0cd7ed47b9f`; `actor-physics.ts`, `boneyard-world.ts`, `native-player-staff-action.ts`, `player-staff-combat-system.ts`, and tests | The solver returns only resolved positions and settles at radii plus `0.1`; both web Staff admission and physical contact recompute only radii, and both require facing. Existing unit/integration tests place the target at exact radii sum and never traverse real movement collision. | high |

The native evidence is static retail evidence. No loader-injected observation
is used for a material conclusion in this entry.

## System boundary and membership inventory

Native system: **PlayerWizard automatic Staff contact bridge**, from the
fixed-tick root movement epoch and persistent GoodGuy contact membership,
through action admission, marker-time damage/physical effects, replication,
presentation, and teardown. The disposition column records the closure target
for this pass; the receipt below must prove every `exact-ported` row before the
entry can be called complete.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| root player movement overlap and ordered Region result capture | `0x0054AFF1..0x0054B050`, `0x00526520` | `exact-ported` | shared solver reports root contacts before post-response positions erase overlap |
| recursive push recipient | dynamic-response `param_3 != 0` append gates | `exact-ported` negative | recursive recipients move but do not fabricate a player root-contact result |
| legal post-response clearance | `0x00521E00/0x00521EF0`, `+0.1` | `exact-ported` | Staff current-contact projection uses the shared exported clearance, never a duplicate literal |
| nonempty movement-result ownership | `0x0054B062..0x0054B288` | `exact-ported` | result order is retained; any nonempty list suppresses the GoodGuy-list fallback for that tick |
| flags-`0x2` movement contact | `0x0054B0AB..0x0054B0B5` | `exact-ported` | first hostile result admits without a heading test or attack input |
| zero-result GoodGuy current-contact fallback | `+0x13C/+0x144/+0x150`, `0x0054B28D..0x0054B32F` | `exact-ported` | stored-order member needs strict absolute heading delta `< 50` |
| Skeleton `1001` | flags `0x2`; shared hostile contact owner | `exact-ported` | real walk-in action and marker damage |
| Skeleton Archer `1002` | flags `0x2`; shared hostile contact owner | `exact-ported` | per-family admission assertion |
| Skeleton Mage `1003` | flags `0x2`; shared hostile contact owner | `exact-ported` | per-family admission assertion |
| Imp `1004` and recursively born Imps | flags `0x2`; shared hostile contact owner | `exact-ported` | parent/child admission assertion |
| Zombie `1006` | flags `0x2`; shared hostile contact owner | `exact-ported` | per-family admission assertion |
| Wraith `1007` | flags `0x2`; shared hostile contact owner | `exact-ported` | per-family admission assertion |
| Demon `1009` and recursively born Demons | flags `0x2`; shared hostile contact owner | `exact-ported` | parent/child admission assertion |
| Coffin `1013`, hidden | constructor `0x00479940` clears `+0x14/+0x36` | `exact-ported` in the 2026-08-30 reopening | no collision result, action admission, or marker damage |
| Coffin `1013`, rising/holding/opening/open | `0x0049A670`, `+0x36 = 1`, grid attach, `+0x14 = 0x2` | `exact-ported` in the 2026-08-30 reopening | real walk-in admission and radius-based physical contact; independent normal/Critical/Whirl root shapes retain their exact membership |
| Coffin-owned Maggot | living hostile flags/member; shared GoodGuy contact path | `exact-ported` | real target membership and admission assertion |
| another player (`0x801`) | non-`0x2`, non-`0x20` dynamic result | `out-of-system` (not a Staff target) | collision result suppresses fallback but creates no Staff action |
| flag-`0x20` GoodGuy/NPC interaction | separate branch `0x0054B0BB..0x0054B278` | `out-of-system` (dialogue/contact owner) | no Staff action; existing Hub NPC system remains owner |
| empty dynamic-result list | branch at `0x0054B06A` | `exact-ported` | current-contact fallback remains reachable |
| target leaves contact before action marker | current GoodGuy list read at `0x0053BD05..0x0053BFC4` | `exact-ported` | no physical hit-world/Ether/Pike effects for the departed target |
| ordinary / Knockback / Disable trapezoid | `0x0053B9F0`, shared normal polygon | `verified-already-at-parity` | existing footprint, candidate, damage-share, proc, VFX, and audio tests retained |
| Critical trapezoid | selector `3` | `verified-already-at-parity` | existing large-footprint/full-list tests retained |
| Whirl circle | selector `4`, `0x00642090` | `verified-already-at-parity` | existing radius, countdown, contact, and full-damage tests retained |
| Air, Fire, Water, Earth Staff physical contact | common callback, non-Ether branch | `verified-already-at-parity` after shared membership correction | per-element contact uses the same corrected list and existing impact cue/vertical response |
| Ether Staff contact, Pike break, five-tick push | `0x0053BE75..0x0053BFC4`, `0x00484EA0` | `verified-already-at-parity` after shared membership correction | existing exact RNG/feedback tests plus corrected current-contact gate |
| equipped Staff `0x1B5C` | `0x00537AA0` | `verified-already-at-parity` | action admitted only with Staff |
| equipped Wand / empty weapon | same item-type check | `out-of-system` (no Staff action) | real movement contact remains actionless |
| occupied Staff action and alternating lane | Player action `+0xE4`, player `+0x240` | `verified-already-at-parity` | no duplicate action; lane toggles once per admitted melee |
| primary/secondary cast occupancy, death, pending level offer | PlayerWizard/progression admission owners | `verified-already-at-parity` | current gates remain unchanged |
| Solomon prelude before first run event | retail encounter admission owner | `verified-already-at-parity` | collision is retained but no action/RNG/audio edge is admitted |
| generated Boneyard after run edge | retail Arena/PlayerWizard owner | `exact-ported` | ordinary UI walk-in journey |
| stock Tutorial lesson 11 | same PlayerWizard owner; equipped tutorial Staff | `exact-ported` | lesson text, spawned hostile, walk-in action/contact/damage |
| custom/mod Arena with no retail Solomon encounter | web-authored scene boundary | `exact-ported` | immediate combat admission and same contact bridge |
| host authority and observer presentation | native host action/damage; Website authoritative simulation | `verified-already-at-parity` after server-only contact bridge | no client-authored contact or protocol field; replicated transient/HP/audio remain existing owners |
| world exit, death, disconnect, and replacement | action/transient/player teardown | `verified-already-at-parity` | no contact identity or action survives replacement |

There are no `blocked-by-platform` members and no browser approximation.

## Native ownership thread

- Owner and construction path: common `GoodGuy_Ctor 0x0052A410` constructs the
  persistent actor contact list; `PlayerWizard_Ctor 0x0052B4C0` supplies Staff
  polygons and player state; the Region movement controller owns a distinct
  transient root-collision result list.
- Upstream state producers: PlayerWizard's fixed-tick movement vector enters
  `0x00525800`; `0x00526520` walks nearby actors, filters masks and contact
  reporting, captures root contacts, applies push/response, and leaves final
  positions at native clearance.
- State transitions: no current player action plus either (a) first flags-2
  movement result or (b) zero movement results and first facing-qualified
  GoodGuy contact calls the sole `0x00537AA0` Staff dispatcher.
- Downstream consumers: the action advances on the 100 Hz clock. Its sole
  marker callback `0x00550180` calls `0x0053B9F0`, whose damage shape query and
  current physical-contact pass have separate membership owners.
- Siblings: NPC flag-`0x20` collision, nonhostile player collision, hidden Coffin,
  primary/secondary cast admission, and enemy melee consume nearby movement or
  collision state but do not inherit Staff action consequences.
- Entry/reset/teardown: contact results are one movement epoch only; current
  contact is derived from the live authoritative bodies; actions/transients
  retire under their existing clocks and are discarded on player/world
  replacement.

## Recovered behavioral contract

- Timing: all ownership is fixed-tick, 10 ms. A movement collision can admit
  on the same tick after response; StaffMelee still marks at progress 3 and
  ends strictly above 8, while StaffSpin contacts at countdown zero after 18
  turns.
- Geometry/order: dynamic overlap is strict circle intersection; response uses
  radii plus `0.1`. Movement-result order precedes the current-contact fallback
  and hostile collision has no facing gate. Fallback and marker physical
  contact use strict heading delta `< 50`. Damage footprints remain their
  independent trapezoid/circle queries.
- Coffin's radius is 45, so legal player/Coffin separation is `70.1`. That
  root lies outside the normal Staff polygon's strict 70-unit endpoint while
  remaining inside radius-aware physical contact; Critical and Whirl retain
  their larger root shapes and can include it. Hostile membership must not
  inflate any Staff polygon to make every admitted action deal damage.
- Randomness/audio: contact admission consumes no RNG. `0x00537AA0` and later
  action/contact code retain the already recovered proc, timing, impact,
  Ether/Pike, VFX, and audio draw order.
- Authority/replication: the host owns collision identities, action creation,
  damage, and semantic audio/VFX. The movement-result list is ephemeral
  simulation data and is not a protocol member.
- Boundary: a browser port may project persistent GoodGuy contact from legal
  settled bodies using the exact shared `0.1` clearance, but it must retain the
  movement epoch's identity separately because final centres cannot reconstruct
  the no-heading walk-in branch.

## Nearby-system findings

- The Region movement result is a reusable gameplay channel, not diagnostic
  scratch. Any future port of a native consumer after `MoveStep` must not infer
  it solely from post-response centres.
- A nonhostile dynamic collision deliberately suppresses the current-contact
  fallback for that tick. Filtering the transient list down to hostiles before
  the Staff owner sees it changes ordering/branch behavior.
- Durable native reports updated before implementation:
  `Mod Loader/docs/reverse-engineering/native-skills-and-spells.md` and
  `native-movement-and-tick.md`.

## Confidence and open questions

- Confirmed: binary identity, sole admission/callback xrefs, the two contact
  lists and their offsets, root-only transient capture, hostile no-heading
  branch, zero-result facing fallback, post-response `+0.1`, equipment gate,
  and marker-time current-list use.
- Inferred: the web's persistent GoodGuy-list projection is the live hostile
  set at radii plus the exact solver clearance. This inference is constrained
  by the instruction-proven list consumer and the already recovered response
  rule; it introduces no independent constant or browser approximation.
- Unknown: none material to the Website contact bridge. Exact native
  player-versus-player/NPC list order outside the Boneyard does not affect the
  Website's authoritatively noncombat shared Hub and is dispositioned above.

## Web implementation consequence

- Correct owners: `actor-physics.ts` publishes ordered root pair contacts;
  `boneyard-world.ts` carries per-player movement-epoch body identities only
  to the same tick's simulation result; `native-player-staff-action.ts` owns
  native admission selection/current-contact geometry;
  `player-staff-combat-system.ts` consumes both lanes.
- Shared model change: report successful root pair response without changing
  positions; retain every dynamic body identity in order; movement-result
  hostile admission precedes the existing facing fallback; use
  `NATIVE_ACTOR_SEPARATION_EPSILON` for both fallback/current physical contact.
- Stock behavior preserved: action/proc timing, damage shapes/values, Staff
  lane alternation, casting gates, prelude gate, RNG, audio/VFX, protocol,
  replication, and teardown.
- Symptom path to remove: exact-radii-only contact predicates and the staged
  exact-touch integration fixture as proof of real admission.

## Validation contract

- Focused automated tests: shared physics reports ordered root contacts and
  excludes recursive-only response; every hostile family plus active Maggot
  and risen Coffin admits; hidden Coffin/other-player/Wand/empty weapon do not;
  legal Coffin separation keeps normal-root damage out while Critical/Whirl
  retain their existing membership; nonhostile movement results
  suppress fallback; strict 50-degree boundary remains excluded; radii plus
  `0.1` current contact admits and `+0.0001` does not; marker-time departure
  removes physical effects.
- Integration: start outside contact, hold ordinary movement through the real
  Boneyard solver, observe action creation on the overlap tick, legal settled
  separation, exactly one marker, enemy HP loss, retained contact audio, and a
  repeat action without debug teleportation.
- Browser: Mac Chrome ordinary UI journey through Tutorial lesson 11 and a
  generated post-run Boneyard; record player/enemy positions, action/contact
  transients, HP, audio play events, and page/console/failed-response arrays.
- Stock-versus-web: compare the web event ordering to the instruction-derived
  native sequence `MoveStep -> retained collision identity -> Staff action ->
  marker -> current-contact effects` and exact circle clearance.
- Complete gates: affected focused tests, Website `./scripts/validate.sh`,
  affected Mod Loader static RE contracts, and the complete portable static RE
  suite on the Mac mini only.

## Implementation validation receipt

- Implementation: `actor-physics.ts` now publishes only successful root-epoch
  pair contacts, preserving solver order and excluding recursive recipients.
  `boneyard-world.ts` classifies every captured dynamic body at the contact
  epoch and carries the complete list to the same authoritative simulation
  tick. `player-staff-combat-system.ts` gives a nonempty movement-result list
  native priority, admits when any member was flags-`0x2`, suppresses fallback
  when all members were nonhostile, and otherwise uses the facing-qualified
  current-contact fallback. `native-player-staff-action.ts` uses the one shared
  `NATIVE_ACTOR_SEPARATION_EPSILON` for fallback and marker-time physical
  contact. No protocol field, damage footprint, action/proc clock, RNG draw,
  audio mapping, renderer, or teardown rule changed.
- Regression coverage: the shared solver proves ordered root reporting and no
  recursive leak; current admission and physical contact pin exact clearance
  and reject `+0.0001`; movement-result admission proves no-facing hostile and
  nonhostile suppression; real Boneyard simulation starts outside contact,
  walks through the shared solver, creates one action/contact, deals one damage,
  keeps mana unchanged, retains audio, and admits a repeat action; the world
  table covers Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, Coffin, and
  a live Maggot separately.
- Exact tree: local Website and Mac changed-file blob manifests matched for all
  14 files. The Mac detached acceptance tree is
  `/Users/jarrett/codex-acceptance/contact-melee-parity-20260825-root/Website`;
  the matching Mod Loader tree is the sibling `Mod Loader` path.
- Mac automated gates: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited
  zero; the affected Boneyard aggregate passed `1570/1570`, all later frontend
  and desktop runs passed, backend build/format and architecture/lint were
  clean apart from nine pre-existing warnings, production media policy passed,
  and exact-tree reruns kept the game entry at `474599` raw /
  `133076..133078` gzip bytes against `524288` / `133120`. The Mod Loader
  portable static RE suite passed
  `504/504`. Logs: `evidence/website-validate-final.log` and
  `evidence/loader-static-re-final.log`.
- Generated Boneyard Mac Chrome journey: ordinary New Game traversed the
  current first-player College Office and settled courtyard, entered a seeded
  generated Boneyard, crossed the real gate, completed Solomon's prelude, then
  approached the first natural opening Skeleton without an attack input. It
  created Staff action `1`, contact `2`, and repeat action `3`; exact centre
  distance `41.12410295046864` matched recovered legal clearance
  `41.12410295046866`; target HP fell `2.5 -> 1.5`; mana stayed `100`; both
  `staff-swoosh` and `staff-hit-wood` played; page/console/failed-response/wire
  errors were empty. Log and screenshot:
  `evidence/generated-staff-melee.log`,
  `evidence/generated-staff-melee-staff-melee.png`.
- Tutorial Mac Chrome journey: stock lesson 11 rendered its authoritative
  `WALK INTO ENEMIES TO CLUB THEM` instruction, then ordinary movement into a
  stock Skeleton created action `1` and contact `2`; distance
  `38.444163292703934` remained within legal `38.486989703401925`, HP fell
  `2 -> 1`, and mana stayed `100`. The same run retained the stock, 75-percent,
  large, and touch responsive receipts with empty console/page/failed-response
  arrays. Log and screenshot: `evidence/tutorial-responsive.log` and
  `evidence/tutorial-responsive-tutorial-staff-melee.png`.
- Unknowns / platform differences: none. Commit is local only; push and
  deployment were not requested or performed. Task worktrees and committed
  evidence remain retained because publication is not authorized.
