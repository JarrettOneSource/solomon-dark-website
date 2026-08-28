# 2026-08-28 — PlayerWizard movement during Staff actions

## Reported smell and parity question

- Reported web behavior: automatic melee leaves the avatar unable to accept
  movement while its Staff swing is active, so chained contact in a horde can
  pin the player in repeated action poses.
- Stock behavior to recover: StaffMelee and StaffSpin keep the ordinary player
  movement, collision, gait, and footstep lanes live while the action object
  independently owns pose, heading, marker contact, and competing-action
  exclusion.
- Reproduction inputs/scenes: generated Boneyard, Tutorial lesson 11, and a
  custom/mod Arena; ordinary and accelerated melee, Whirl, movement toward,
  across, and away from the contacted hostile; desktop keyboard and browser
  touch movement; local authority and observer presentation.
- Falsifiers: native action occupancy branches before `MoveStep`; movement
  cancels the action; locomotion may replace action heading; the marker remains
  fixed at the action-start root; or the Website can move during both action
  kinds without removing its explicit zero-movement input rewrite.

This reopens the 2026-08-20 Staff closure. That pass correctly recovered the
action slot, action programs, marker timing, outcomes, VFX, audio, and cast
exclusion, but inferred that the slot also suppressed locomotion without
following its checks back through the complete PlayerActor movement branch.
The resulting web seal was contradicted by the user's stock observation and by
the raw instruction order below. Under the whole-system rule, the false
locomotion assumption is corrected for every PlayerWizard action sibling here,
not only for the reported ordinary swing.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- || Reported stock observation | user report, 2026-08-28 | Retail permits movement throughout a melee swing; the web lock makes horde escape materially harder. | high-visible |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-08-28 | Exact program already supplying the movement, Staff, and animation goldens. | high |
| Fresh instructions | canonical Ghidra 12.0.3 read-only replica slot 2; `PlayerActor::Tick 0x00548B00`; `dump_insns_around.py 20 20` at `0x0054AD54`, `0x0054AFF1`, `0x0054B055`, `0x0054B06A`, `0x0054B0AB`, `0x0054B28D`, `0x0054B32F`, `0x0054B336`, `0x0054B592`, `0x0054B662` | The strict movement branch calls `PlayerActor_MoveStep 0x00525800` at `0x0054B050`. Only after that call do `0x0054B070` and `0x0054B28D` compare action slot `+0xE4`; nonzero jumps to `0x0054B336`, skipping only new Staff admission. | high |
| Existing durable native evidence | `Mod Loader/docs/reverse-engineering/native-movement-and-tick.md`, `native-animation-state.md`, `native-skills-and-spells.md`, and `native-input-model.md` | The input vector, velocity integrator, collision, complete PlayerWizard modes `1..11,21,22`, action pose priority, current-root marker footprint, and fixed-tick action lifetimes are already closed. The movement/action ordering is corrected in the first and third reports before implementation. | high |
| Current web causal trace | Website `origin/main` `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7`; `game-simulation.ts`, `boneyard-world.ts`, `player-staff-combat-system.ts`, `native-player-staff-action.ts`, `player-character-presentation.ts`, presentation timeline/renderers, and tests | `game-simulation.ts` collects active Staff owners and rewrites both casts and movement to zero before `stepBoneyardWorldTick`. Movement therefore decays/stalls for the whole action. The action system already follows the current player root and presentation already composes action pose over locomotion. | high |
| Defect provenance | Website commit `ba77b898` (`Port native automatic Staff combat`) and current blame | The explicit `movement: { x: 0, y: 0 }` seal was introduced with the original Staff system from the false 2026-08-20 ledger statement; no later owner requires it. | high |

No loader-injected runtime sample supplies a material conclusion. The user
observation is reconciled with fresh static retail instructions and the
existing clean-stock animation/movement evidence.

## System boundary and membership inventory

Native system: **PlayerWizard locomotion/action composition**, from one current
movement input sample through velocity, world/dynamic collision, action-slot
admission/occupancy, action-owned pose/heading and current-root marker contact,
to authoritative replication, rendering, interruption, and teardown.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| keyboard movement level and normalized vector | `0x005C6D60`, `0x0052C910` | `verified-already-at-parity` after seal removal | held movement reaches the same input vector while an action is active |
| touch joystick and gamepad movement | browser semantic-input producers | `out-of-system` (retail PC has no active equivalent) | both target the same authoritative movement lane and inherit the correction |
| velocity integration, cap, strict `>0.01`, damping | `0x00548B00`, `0x0054AD54..0x0054AD7B` | `verified-already-at-parity` | action presence changes none of the recovered recurrence/constants |
| static and dynamic collision, player/enemy push | `0x00525800`, `0x00526520` | `verified-already-at-parity` | movement during an action remains collision-resolved; no noclip escape path |
| empty player action slot | `+0xE4 == 0` after `MoveStep` | `verified-already-at-parity` | moving contact can admit exactly one Staff action |
| occupied player action slot | `0x0054B070`, `0x0054B28D` | `exact-ported` by this correction | movement completes; only duplicate action admission is skipped |
| mode 1 StaffMelee, primary alternating bank | `0x0044AE50/0x0044B580`, `actor+0x240` | `exact-ported` | movement continues while action id/pose/heading remain live |
| mode 1 StaffMelee, secondary alternating bank | same action and alternate pose row | `exact-ported` | same movement contract and independent pose row |
| normal StaffMelee outcome | selector 0 | `exact-ported` through shared mode-1 branch | moving action keeps normal marker/damage/audio timing |
| Knockback outcome | selector 1 | `exact-ported` through shared mode-1 branch | movement does not alter proc actor or push ownership |
| Disabling Hit outcome | selector 2 | `exact-ported` through shared mode-1 branch | movement does not alter status ownership |
| Critical Hit outcome | selector 3 | `exact-ported` through shared mode-1 branch | movement does not alter large footprint or damage factor |
| mode 2 StaffSpin / Whirl | `0x00448750/0x004487D0` | `exact-ported` | movement continues through all 18 turns while spin heading/pose remains authoritative |
| modes 3/4/5 Staff Cast 1/2/constant | complete action selector `0x0044F5F0` | `verified-already-at-parity` | existing movement/cast-facing tests retain concurrent locomotion |
| modes 6/7/8 hand Cast 1/2/constant | same selector | `verified-already-at-parity` | no Staff-only movement seal reaches them |
| modes 9/10/11 Wand Cast 1/2/constant | same selector | `verified-already-at-parity` | no Staff-only movement seal reaches them |
| modes 21/22 CastSpin/Sweep | same selector | `verified-already-at-parity` | secondary action presentation remains independent from movement |
| action-owned heading and movement-owned direction | heading `+0x6C`; action program owner | `verified-already-at-parity`, coverage strengthened | wizard may translate away/crosswise without the robe/staff turning out of the action |
| locomotion gait, robe strip, bob, and footsteps beneath action pose | player walk lanes plus `0x0054BA80` compositor | `verified-already-at-parity`, coverage strengthened | moving action advances walk cycle/footstep edge while action attachment pose wins |
| marker-time action footprint | `PlayerWizard_StaffContact 0x0053B9F0` | `verified-already-at-parity`, movement regression added | action sample follows current wizard root; escape before marker can carry the hit footprint away |
| primary/secondary cast input during Staff action | occupied action slot / action selector | `verified-already-at-parity` | casts stay sealed; removing locomotion suppression does not admit them |
| next Staff action while current action is live | `+0xE4 != 0` | `verified-already-at-parity` | no overlap/duplicate RNG/audio/action id |
| next action after strict retirement | common action owner | `verified-already-at-parity` | held/reissued movement may admit only on a later eligible movement epoch |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, hostile Maggot | complete flags-`0x2`/GoodGuy Staff target family | `verified-already-at-parity` after shared correction | one owner fix applies while all family contact/marker tests remain |
| Coffin, player, NPC, Wand, empty hands | nonhostile/equipment negative branches | `out-of-system` (cannot create Staff action) | ordinary movement/collision remains unchanged |
| Tutorial lesson 11, generated Boneyard, custom/mod Arena | shared PlayerWizard owner | `exact-ported` | movement-during-action works in all combat scenes |
| Solomon prelude, level offer, pause/modal, terminal/death locks | separate authoritative input/lifecycle gates | `verified-already-at-parity` | legitimate movement locks still zero input; Staff action no longer impersonates one |
| local authority and remote observer | host player state, transient projection, client timeline | `verified-already-at-parity`, coverage strengthened | position/velocity and action pose coexist in the same snapshots and interpolation window |
| world exit, death, disconnect, replacement | existing player/action teardown | `verified-already-at-parity` | neither input nor Staff transient survives its owner |

There are no `blocked-by-platform` members, no new authored table, and no
browser approximation. The complete PlayerWizard action-mode table remains the
one already extracted in `native-animation-state.md`.

## Native ownership thread

- Owner and construction: `PlayerControlBrain_Update 0x0052C910` publishes the
  current movement direction. `PlayerActor::Tick 0x00548B00` owns the velocity,
  `MoveStep`, collision-result capture, and action-slot decision. The action
  selector/constructors own the parallel pose/marker object.
- Upstream/call order: normalized input updates velocity and passes the strict
  movement threshold; Region capture and `MoveStep` complete at
  `0x0054AFF1..0x0054B055`; only then do both contact sources inspect `+0xE4`.
- State and transitions: `+0xE4 == 0` permits one action construction;
  `+0xE4 != 0` jumps over admission but does not rewind movement. StaffMelee
  retires only above progress eight; StaffSpin retires at its eighteenth turn.
- Downstream: the current player root/heading drives the action sample and
  marker footprint. The renderer composes the action attachment selector over
  the concurrently advancing position/gait lanes; host snapshots publish both.
- Siblings: every PlayerWizard action mode shares locomotion/action
  independence. Only Staff modes were wrong in the Website because only their
  transient-owner gate zeroed movement.
- Interruption/teardown: death and explicit modal/control locks can still stop
  locomotion and retire actions. Ordinary movement neither cancels nor shortens
  an action; action retirement releases competing cast/Staff admission.

## Recovered behavioral contract

- Timing: movement and Staff action advance on the same 100 Hz authority tick.
  Movement/collision runs first; the existing action then advances and samples
  the resolved current root. No arbitrary lock duration exists.
- Geometry/order: ordinary Boneyard collision remains in force. Melee/spin
  footprints translate with the current root at marker time, so escape can
  legitimately change which targets are contacted.
- Presentation: action pose/heading has priority, but world position, robe walk
  strip, gait bob, and footsteps continue. Movement direction need not equal
  visible action facing.
- Randomness/audio: movement consumes no Staff RNG and does not restart swing,
  proc, swoosh, hit, or Whirl audio. All existing draw order and one-marker
  rules remain.
- Authority/replication: the host consumes movement and advances the action.
  Clients interpolate authoritative position/velocity while sampling the
  replicated Staff transient; no client-side escape or pose cancellation is
  added.
- Boundaries: cast inputs and duplicate actions remain rejected while the Staff
  action is live. True Tutorial/Solomon/modal/death locks remain separate and
  unchanged.

## Nearby-system findings

- The 2026-08-20 Website ledger contained the exact false causal statement and
  commit `ba77b898` encoded it literally. Later native movement and animation
  reports already contained enough contradictory ownership evidence, but no
  residual audit reconciled the old web seal.
- A movement/action browser check must inspect velocity or directional
  displacement while the same action id remains live. Merely observing some
  post-contact motion can be residual damping and does not falsify the lock.
- Durable native reports corrected before implementation:
  `Mod Loader/docs/reverse-engineering/native-movement-and-tick.md` and
  `native-skills-and-spells.md`. Runtime architecture topology is unchanged.

## Confidence and open questions

- Confirmed: retail identity, movement-before-action-slot instruction order,
  exact action-slot branches, full action-mode membership, current web input
  rewrite, current-root action sampling, presentation composition, authority,
  and teardown.
- Inferred: none material.
- Unknown: none. Every recovered member is directly representable in the web
  simulation and renderer.

## Web implementation consequence

- Correct owner: keep action/cast exclusion in `game-simulation.ts` and
  `player-staff-combat-system.ts`, but pass the admitted movement vector through
  to `stepBoneyardWorldTick` for existing Staff action owners.
- Shared model: no protocol or state field is needed. Existing locomotion,
  action transient, current-root sampling, and presentation composition already
  express the native model.
- Preserve: action timing, alternation, proc RNG, marker/damage geometry,
  heading, VFX/audio, cast exclusion, repeated-action admission, collision,
  status/recovery, replication, and teardown.
- Remove: only the symptom-producing `movement: { x: 0, y: 0 }` Staff input
  rewrite and any test assumption that action occupancy is a locomotion lock.

## Validation contract

- Focused authority regression: with a live mode-1 melee action and separately
  a mode-2 spin action, submit movement from rest; on the next tick position,
  velocity, gait, and walk cycle advance while the same action id remains and
  action-owned heading wins. Primary/quickbar casts remain sealed.
- Natural integration: walk into a hostile to create one automatic Staff
  action, reverse away while that same id is live, prove velocity reverses and
  distance increases before retirement, then retain existing contact,
  no-stationary-repeat, next-action, damage, VFX, and audio contracts.
- Presentation/protocol: a moving player plus live Staff action keeps the
  locomotion draw lanes and action attachment pose simultaneously; snapshot and
  timeline tests retain both continuous movement and discrete action state.
- Membership regression: retain both alternate melee banks, all four melee proc
  outcomes, Whirl, every hostile family, negative equipment/contact branches,
  all sibling PlayerWizard action modes, scene gates, and teardown suites.
- Mac Chrome: run the ordinary `smoke:game:staff-melee` journey in the built
  candidate. Record one action id, start/end position and velocity projected on
  an escape direction while that id is live, action pose, eventual marker or
  clean miss from escape, a later successful contact/damage/audio edge, and
  empty page/console/failed-response arrays.
- Complete gates: affected focused tests and the Website's only canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the Mac mini; the
  byte-identical Mod Loader portable static-RE suite also passes there.

## Implementation validation receipt

- Implementation: `game-simulation.ts` no longer replaces movement with zero
  for an owner of `player-staff-melee` or `player-staff-spin`. The same branch
  still clears primary/quickbar cast input, and the Staff system still blocks a
  second action while the current transient is live. No protocol, action,
  collision, damage, RNG, VFX, audio, or teardown state changed.
- Red proof: on the detached Mac base
  `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7`, the test-only canonical gate
  reached Boneyard test 759 and failed exactly with `melee action suppressed
  PlayerWizard movement`; all preceding contracts, build, and lint stages were
  clean. The retained log is
  `/Users/jarrett/codex-acceptance/melee-movement-parity-20260828-root/red-validate.log`,
  SHA-256 `b93ab67a5d15d1d212b36b47bc74b0c9959fd52209dd5b33a87c7f6eb64d903e`.
- First green proof: after the one-line runtime correction, the byte-identical
  Mac candidate passed the complete canonical gate, including
  `1,719/1,719` Boneyard tests, every later group, backend/desktop tests,
  production frontend and GameHost builds, bundle budget, and media policy.
  The production entry was `Game-z0L7uwod.js`, `258,251` raw / `78,106` gzip
  bytes.
- Final static proof: the byte-identical Mod Loader candidate passed the
  portable CI-safe suite `524/524`. The strengthened Staff ownership contract
  pins movement-before-action-slot instruction order, retained locomotion, and
  continued competing-cast/duplicate-action exclusion. Log SHA-256 is
  `aa22cf7e2ddf57573b79b2b63aac402107497d7198bb39d62a2f00a92dcc45df`.
- Final browser proof: production Google Chrome `151.0.7922.174` completed the
  generated-Boneyard Staff journey. Action `1` began against staged Skeleton
  `1` at distance `43.48415805583727` within legal contact
  `43.55640219189227`. While that same action id remained live, reverse input
  changed its authoritative projected velocity from `-89.99955749511719` to
  `16.39027976989746`, produced positive escape displacement
  `0.18211421370506287`, retained action-owned heading index `0`, kept a live
  attachment/walk presentation sample, and consumed no mana. Its marker reduced
  HP `1000 -> 999`; movement then admitted action `3`, whose marker reduced HP
  `999 -> 998`. Staff swoosh and hit-wood audio both played; page, console,
  failed-response, wire-error, and outside-combat-enemy arrays were empty. The
  journey held `59 FPS` in its final diagnostic frame. Log SHA-256 is
  `4e056eb09d1a99a8a78c5a2be3f4fe264270c98a4099b0dc0fc223aa242bb75e`;
  inspected Staff screenshot SHA-256 is
  `7e4f3332890a156845371d1f1aa2e3709bbf39789c5effab9fd14f8a89064074`.
- The receipt-updated byte-identical Website tree is the final canonical-gate
  candidate. Its unchanged `./scripts/validate.sh` result and log hash are
  reported in the task handoff rather than rewritten here, which would create
  a new untested document tree.
- Publication/deployment: not requested and not performed. Both isolated local
  worktrees and the detached Mac acceptance root are intentionally retained.
