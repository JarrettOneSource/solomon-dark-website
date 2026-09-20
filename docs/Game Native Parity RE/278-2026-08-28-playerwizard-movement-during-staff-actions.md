# 2026-08-28 — PlayerWizard movement during Staff actions

> **2026-09-20 reopening:** the blanket primary/secondary cast exclusion below
> conflated occupied action-list count `+0xE4` with no-interrupt byte `+0x1EC`.
> The final section supersedes its secondary/belt exclusion claims. Movement,
> primary admission, Staff contact programs, and authored timing remain intact.

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

## 2026-09-20 — Secondary casts during automatic Staff combat

### Report, boundary, and prior closure failure

Ring of Fire and other secondary spells reportedly wait until a wizard is safe
from a horde. At Website base `82cc95d7`, two `game-simulation.ts` input seals
replace the complete cast record with `{ primary: false, quickbar: null }`
while automatic Staff melee/Whirl owns an action. Repeated contact can therefore
hide a valid belt press from the secondary dispatcher. Ordinary health damage
itself changes neither cast admission nor action state (entry 096).

Native system: PlayerWizard belt admission and action coexistence during automatic
Staff combat, including actionless/rejected branches, occupancy, and retirement.
The earlier closure skipped the membership sweep of the no-interrupt byte's
writers and treated the action count as that byte. Its claim that all casts
stay sealed during melee was unsupported. This reopening corrects that shared
assumption across every category-2 row and both automatic Staff action kinds.

### Evidence and provenance

Retail Beta 0.72.5 was rehashed on September 20: 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`. Static recovery used the canonical
`Decompiled Game/ghidra_project/SolomonDark.gpr`, program `SolomonDark.exe`,
read-only replica slot 03, and the existing Mod Loader wrapper (SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`).
No Mod Loader file was modified. Disposable logs are task-owned under
`/tmp/secondary-cast-damage-20260920-*`.

| Evidence | Observation | Confidence |
| --- | --- | --- |
| Fresh `decompile_targets.py`, belt dispatcher `0x005D5600` | Category-2 admission checks Game `+0x1ABE`, PlayerWizard `+0x1EC`, common and private cooldowns, then invokes the spell dispatcher. It never checks action-list count `+0xE4` or recent damage. Category-1/3 selection has its own branch. | high, instructions corroborated |
| Fresh constructors/updates `0x0044AE50/0x0044B580` and `0x00448750/0x004487D0`; complete `find_writes_to_offset.py 0x1ec` census | Neither StaffMelee nor StaffSpin writes the no-interrupt byte. Their existing alternating pose programs, marker 3/end 8, and 18-turn Whirl remain unchanged. | high |
| Secondary dispatcher `0x0054CC50`, weapon selector `0x005297D0`, action selector `0x0044F5F0` (`0x0044FEFA..0x0044FF0D`), manager tick `0x00483000`; independently recovered list owner in entry 301 | Successful ordinary casts append mode 4/7/10 according to Staff/empty hand/Wand through the manager at `+0xDC`. Existing actions continue in insertion order. `+0xE4` is its count, not a replaceable action pointer. Dampen appends mode 21 and then weapon-selected Cast2 through the shared tail. The temporary smart-reference copy at `0x00641000` does not replace the actor action list. | high |
| No-interrupt writers `0x0044B770`, `0x00448860`, `0x00448DF0`, `0x00448F60`, with Cast2 destructors `0x0044A400/0x0044ACC0/0x0044AD50` | Cast2/CastSpin own a real lock, with teardown clearing it. A nonempty secondary action also prevents automatic Staff admission through the shared action count. | high |
| Existing complete category-2 contract, entry 083; `native-secondary-abilities.ts` | All 23 IDs and authored rank/cost/cooldown/effect tables already exist. Actionless branches are Firewalker off and Mindstar/Regenerate on/off. Planewalker off still installs Cast2. | high |

The user report is the visible symptom. New stock evidence is static instruction
recovery, not a new clean-stock horde capture or an injected observation.

### Complete membership inventory

Every category-2 row below is `exact-ported` for belt admission during Staff
actions, proven by its own assertions from both melee and Whirl.
There is no new authored table: this correction consumes the complete existing
category-2 dispatch membership and the existing action-mode/pose programs.

| ID | Member | Action on an accepted press | Disposition |
| --- | --- | --- | --- |
| 11 | Call Leviathan | Cast2 appends beside Staff action | exact-ported |
| 12 | Planewalker on/off | Cast2 appends in both directions | exact-ported |
| 15 | Phasing, destination found/blocked | Paid Cast2 appends beside Staff action even when relocation fails | exact-ported |
| 21 | Ring of Fire | Cast2 appends beside Staff action | exact-ported |
| 23 | Firewalker | On appends Cast2; off adds no action | exact-ported |
| 27 | Magic Storm | Cast2 appends beside Staff action | exact-ported |
| 30 | Prismatic Shock | Cast2 appends beside Staff action | exact-ported |
| 35 | Ring of Ice | Cast2 appends beside Staff action | exact-ported |
| 41 | Earthquake | Cast2 appends beside Staff action | exact-ported |
| 45 | Raise Golem | Cast2 appends beside Staff action; the existing summon-cap replacement remains | exact-ported |
| 46 | Stoneskin | Cast2 appends beside Staff action | exact-ported |
| 48 | Teleport | Cast2 appends beside Staff action | exact-ported |
| 49 | Magic Circle | Cast2 appends beside Staff action | exact-ported |
| 50 | Magic Trap | Cast2 appends beside Staff action | exact-ported |
| 51 | Dampen | CastSpin and Cast2 append beside Staff action | exact-ported |
| 54 | Magic Shield | Cast2 appends beside Staff action | exact-ported |
| 72 | Acid Rain | Cast2 appends beside Staff action | exact-ported |
| 73 | Fire Wall | Cast2 appends beside Staff action | exact-ported |
| 74 | Ether Drain | Cast2 appends beside Staff action | exact-ported |
| 76 | Call Comet | Cast2 appends beside Staff action | exact-ported |
| 77 | Turn Undead | Cast2 appends beside Staff action | exact-ported |
| 78 | Mindstar on/off | State-only change preserves Staff action | exact-ported |
| 79 | Regenerate on/off | State-only change preserves Staff action | exact-ported |

| Other member | Disposition | Proof |
| --- | --- | --- |
| Both melee pose banks; normal, Knockback, Disabling Hit, Critical Hit; Whirl | verified-already-at-parity | Same secondary admission and concurrent action lifetime; no outcome-specific lock |
| Staff, Wand, empty-hand Cast2; Dampen CastSpin | exact-ported | Existing action durations/locks remain; no new automatic melee is admitted while they are live |
| Insufficient mana, common/private cooldown, unavailable caster | verified-already-at-parity | Rejection preserves melee and charges no successful cast |
| Ordinary direct damage and repeated hits | verified-already-at-parity | No extra admission gate; repeated damage cannot cancel accepted Cast2 |
| Primary input during automatic Staff action | verified-already-at-parity | Existing separate primary exclusion remains |
| Category-1 primary selection and category-3 concentration | exact-ported | Preserve belt dispatch independently from primary firing |
| Already emitted Staff contact, knockback, and VFX | verified-already-at-parity | Existing action and children keep their native clocks and terminal paths |
| Generated/custom Boneyard and Tutorial with unlocked belt | exact-ported | Shared host path; existing scene/input seals remain |
| Hub, prelude, pause, level-up, death, disconnect/world reset | verified-already-at-parity | Existing admission/teardown gates remain; no deferred press queue added |
| Keyboard, mouse, touch, controller; local/remote snapshots | verified-already-at-parity | Existing shared belt input and authoritative action projection |
| Enemy damage/AI and secondary effect art/audio payloads | out-of-system | independent owners; consume accepted cast/retained-child state unchanged |

### Implementation and validation contract

Keep primary firing suppressed during automatic Staff actions while preserving
belt input. Reuse the secondary dispatcher for costs, cooldowns, effects, and
choice of action. Keep the existing melee/Whirl action and its children running
when Cast2 or CastSpin is appended. The current renderer already gives the later secondary
pose priority. Prevent new automatic Staff admission while any secondary
action is live. No protocol, arbitrary safe delay, damage immunity, input queue, or browser approximation is needed.

Mac regressions must cover all 23 IDs from live melee and Whirl, actionless and
rejected branches, repeated direct damage, independent action retirement, and no
melee re-entry during Cast2/CastSpin. A real Mac Chrome journey must enter a
Boneyard, trigger automatic melee by contact, cast Ring of Fire while the action
is live and enemies are attacking, and observe an immediate authoritative cast
alongside the live Staff action, replicated effect/audio, and empty page/console/failed-response arrays. Run the
complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact candidate.

### Shared-function membership and nearby correction

The fresh incoming-reference census is complete for the recovered player
entry points. Belt `0x005D5600` has callers at `0x005D8337/0x005D8440/
0x005D8533/0x005D862C` in `SettingsControl_HandleAction 0x005D8120`,
`0x00674192` in `0x00674110`, and `0x006717A6` in `0x00671470`.
All reach the same corrected belt contract (`exact-ported`); browser mouse,
keyboard, touch, and controller already share that host input lane.
`0x005297D0` has the single dispatcher caller `0x0054CF68`.
The shared no-lock tick `0x0044B580` is referenced by vtable entries
`0x00784A08/0x00784A54/0x00784C1C`, and Whirl tick `0x004487D0` by
`0x0078456C` (`verified-already-at-parity`: no new per-pose suppression).
ActionManager tick `0x00483000` is called by PlayerActor at `0x00549022`
(`verified-already-at-parity` for concurrent ticking) and by Badguy at
`0x00483725/0x004838D6` (`out-of-system`: enemy ownership, already recovered
in entry 301). Ordinary damage remains owned by entry 096.

The nearby correction is that PlayerActor `+0xE4` must be described as an
action-list count. The earlier singular-slot terminology could lead a future
fix to cancel a swing or its pending hit when adding a secondary. This port
keeps both actions and the existing later-secondary pose priority; no new list
representation, wire field, or renderer fallback is needed.

### Mac/browser implementation receipt

- Product changes are confined to the two host input seals and the Staff
  admission check. The existing secondary kernel still owns costs, cooldowns,
  effects, action selection, and release. No dependency or protocol change.
- Mac red regression at the original product base failed secondary admission
  (`castSequence` remained zero) for ordinary casts, toggle branches, and the
  Ring of Fire repeated-hit case. The corrected focused run passed 189 tests,
  including all 46 secondary/Staff-action combinations, toggle-off variants,
  rejection branches, sustained damage, independent marker/retirement, no new
  Staff during Cast2/CastSpin, and normal snapshot encode/decode. Existing
  secondary data tests and Staff/Wand/empty-hand action timing tests also
  passed.
- Mac Chrome `153.0.8010.48`, macOS `26.6.2`, Node `22.17.0`: the production
  bundle journey entered the Hub and a generated Boneyard, completed the
  Solomon admission/arena seals, then introduced eight ordinary Skeletons
  through the existing enemy constructor. Their real attacks reduced health
  from 50 to `44.023999999999944`. A browser movement key created Staff action
  1; right mouse requested Ring of Fire at tick 2338 and it committed at 2339,
  while the same Staff action advanced from age 0 to 1. The latest direct hit
  was tick 2316. Browser samples contained MovingFire and attachment pose 9;
  the audio probe observed `big-fire`. Page, console, and failed-response
  arrays were empty. The ordinary Ring of Fire combat/presentation journey
  subsequently observed 70 distinct ticks and passed its existing maximum-set
  effect, damage, camera, and cooldown checks.
- Browser log SHA-256:
  `338688c9144e191d5639dea95cba63e36718b6bb65d511a99f0eaa33c99cdfec`.
  Visually inspected immediate orange cast-flash/crowd capture SHA-256:
  `a2ab8969c7f941e8f6b036da2dc902f4316ce2130f78ba5eef0df0aaa51ba0e8`.
  The first driver attempt walked out of the crowd before waiting for a new
  swing; its timeout was not parity evidence. The corrected driver waits for
  actual damage before requesting movement/contact.
- No browser-platform limitation or visible approximation was introduced.
  Native conclusions are instruction-derived, not a fresh clean-stock horde
  recording. No required native fact remains unextracted in this boundary.

- Control run: the identical crowd driver against unchanged `82cc95d7` host
  code failed specifically with `Ring of Fire waited until the Staff action
  retired`. It reused the candidate client bundle, whose product source is
  unchanged by this host-only correction. Baseline log SHA-256:
  `1f73e5300facc8da3515cbe2ea35d115329b7c02494207d1e9aa8fb2dfc5794e`.
  This distinguishes the reported input delay from a visual-only observation.
- Raw static-evidence SHA-256 values: dispatcher/constructors
  `10bb8154c41fa095fabaafe37833d3114e77493e897475e45b40ffa3da2e136d`;
  no-interrupt writer census
  `c4a08b91322fefb0f007103dab4f2d2dd734af727e96e420ceb12ee6ff00005a`;
  complete belt/selector instructions
  `5b397681149f6a552c4e33d56a00481ef62cdc2c5abe8d58dde24f15d90a12b0`;
  ordered manager traversal
  `9a6df85c4d19cc49ea23cd8532c7ee048ed336aa26e879d32f886410dd744a0b`;
  incoming-reference census
  `d94404c1d6638da885d0667e815d9bd0b13bcd861b675cfd0d008a0880ae8bcd`.

### Dampen shared-tail correction found during final branch review

Raw retail instructions additionally supersede the earlier Dampen-only-CastSpin
assumption. After constructing mode 21 at `0x0054F102`, `0x0054F11B` jumps to
`0x0054CF66`; the shared tail calls `0x005297D0` at `0x0054CF68`. That helper
unconditionally appends weapon-selected Cast2 mode 4/7/10. The shared manager
at Actor `+0xDC` has vtable `0x0079E690`; append `+0x10 -> 0x00624610 ->
+0x04 -> 0x00468940` inserts at the existing count, rather than replacing the
spin or the Staff swing. Dampen therefore retains **both** its 73-tick spin
and the normal Cast2 clock/pulse. `castSpinTicksRemaining` and `castAction`
already represent both owners without a wire change. The generic-cast
exclusion for row 51 must be removed, and the old null-Cast2 assertion replaced
with independent clock and pulse coverage for all three weapon branches.

This is direct instruction evidence from the same rehashed retail image.
The supplementary read used GNU objdump 2.42 because the final Windows/WSL
interop invocation failed with `UtilAcceptVsock ... accept4 failed 110`.
The complete dispatcher and action manager had already been recovered through
the required Ghidra replica wrapper. The supplementary test/browser receipt below closes this recovered row;
publication is held until the final candidate gate completes.

The extended Dampen browser journey also exposed a stale driver assertion:
it still required 40-pixel flyout velocity even though entry 301's September 6
instruction recovery and current `native-dampened-spell.ts` use seven pixels
per tick. The driver is corrected to that existing native contract; no flyout
product behavior is changed. This is a stale oracle, not a casting regression
or a tolerance widened to hide a failure.

### Supplementary candidate verification

The Dampen regression failed before its implementation because Cast2 was null.
After removing the row-51 exclusion, the focused Mac suite passed **190 tests**.
For Staff, Wand, and empty hands, Dampen now carries both owners, emits its
opening pulse exactly once, releases Cast2 after 51/64/64 updates, and retains
CastSpin through its independent 73-update boundary. The shared 23-by-two
Staff/secondary matrix and snapshot round trips also pass with both Dampen
fields populated. The row-51 behavior is now `exact-ported`; publication still
requires the complete final-candidate gate.

The rebuilt Mac Chrome journey (`SDR_SECONDARY_ABILITY_PRODUCTION=1`, IDs
`21,51`, `SDR_SECONDARY_STAFF_OVERLAP=1`) exited zero. The eight-Skeleton
Ring of Fire request at tick 4267 committed at 4268, retaining Staff action 1
at ages 0/1 after real health loss from 50 to `44.01799999999996`. The Dampen
journey asserted both authoritative actions, observed its two correctly
canceled projectile flyouts while preserving the negative Arrow, rendered
24 distinct ticks, and passed effect/audio/cooldown assertions. Page, console,
and failed-response arrays were empty. Final browser log SHA-256:
`755636d34ddd7ff9acccd7658c7910895bbc4dcda78881a63e997ad0af5403fa`;
visually inspected Dampen capture SHA-256:
`7a2f4de4d9bf5e211e2ccb17668c9cc651880f6fed87af78c00b5f962fe06cd9`.
Final focused log SHA-256:
`d8fab17624a03d996024465ea2003112de34f63fc22da82878b594ab5d1878fb`.
Supplementary retail branch-instruction SHA-256:
`e31a4f1dadc4ec8c838748b859b9149b8af50a417af8d6bf25aedf3471d6fc47`.

The first complete Mac gate exited zero, including renderer quality, on the
initial candidate before the supplementary Dampen correction. Its log SHA-256
is `62b3f03dce121ec2214931a521d4e6bb00ae66b5a12e13b978dc43363931ddcd`.
That receipt is not substituted for the required final-candidate gate.

### Final rebased acceptance — 2026-09-20

The focused change rebased cleanly onto `b1c8cd6590f0dffe549fac88da0045804b4d8802`;
`git range-diff` confirmed the implementation was unchanged. Local and Mac
changed-file SHA-256 manifests matched at candidate
`585bafe2d1c1e303512424d36c273bd6c886a4c2`.

The complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` exited **0**.
All configured backend/frontend/desktop suites, formatting, lint, type and
architecture checks, production builds, media/bundle budgets, and renderer
quality gates passed. The configured renderer scope measured 100% statement,
branch, function, and line coverage; mutation results were 379 killed, 20
confirmed test timeouts, 142 compile errors, 23 existing reviewed equivalents,
and no survivors or uncovered mutants. Gate log SHA-256:
`b4f1e49abcda8f2fd8cdde5d31b104db1efe8a57167eb3c1454eed7fd44a8cb6`.

The subsequently built-candidate Mac Chrome/WebGL2 journey also exited **0**.
With eight Skeletons attacking, real health fell from 50 to
`47.01699999999996`; Ring of Fire requested at tick 2750 committed at 2752,
while the same Staff action 1 advanced from age 0 to 2. The latest hit was
2734. This is two host ticks after the browser request, without waiting for
Staff retirement. The ordinary Ring and Dampen journeys observed 71 and 25
distinct ticks respectively, preserving their effects, audio, cooldowns,
Dampen's two action owners, and projectile cancellation. Page errors, console
errors, and failed responses were all empty. Browser log SHA-256:
`8c07caba4cfd7328014a43c0c32cc32a7c185b2397657a7693a2387155e75cdc`.
Visually inspected crowd/cast-flash and Dampen captures respectively:
`7b46b4b043933cf0f4e78f06188308ace087f0d78261ed738adc343038801501`
and `4ea1468840f602eb4297da5bb9bcd7ae05e2022c9169b65f207e60fad9ab00ce`.

This completion receipt is the only change after validation; product source,
tests, and the browser driver are unchanged. The earlier pending gate statements
are closed by this final receipt. No platform approximation or unresolved
member remains within the declared system. Publication is to Website `main`;
this receipt makes no production deployment or restart claim. Raw task receipts
and worktrees are disposable after the verified push, as required by the skill.
