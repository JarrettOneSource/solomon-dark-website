# 2026-08-27 — enemy target tracking, Archer volley, and NavMesh reopening

## Reported smell and parity question

- Reported web behavior: Skeleton Archers shoot in the wrong direction and do
  not track the player as stock does. Audit every other enemy and finish any
  remaining pathfinding RE rather than applying an Archer-only facing patch.
- Stock behavior to recover: target acquisition, action-time target facing,
  Archer range/accuracy/multi-arrow construction, Arrow birth/flight
  orientation, common steering, blocked-goal NavMesh routing, collision
  submission, target loss, interruption, and teardown for the complete Website
  survival membership plus reachable GoodImp.
- Reproduction surfaces: moving target during Archer and Mage windup/recovery;
  all Archer accuracy/range/multi-arrow modes; normal/fire/poison Arrow; each
  mobile family approaching a target across unobstructed and obstructed
  Boneyard geometry; target death/reacquisition; no-target wander; route
  failure; Coffin stationary ownership.
- Falsifiers: stock Skeleton-family or Zombie action heading remaining frozen
  after windup begins; a native minimum Archer/Mage retreat radius; fixed
  Arrow speed/orientation countdown; an angular Scattershot; no route virtual
  above `PlayerActor_MoveStep`; Imp legitimately bypassing the common steering
  owner; or a mobile survival family whose vtable does not inherit the
  recovered route slot.

This is a secondary report in a ledger-covered system. The 2026-08-22 pass
violated the complete-membership rule in two concrete ways: it stopped the
causal trace at `Badguy_BuildChaseVector` without following vtable slot `+0x74`,
and it accepted named bounded Archer/Mage range and aim formulas even though
`0x00477B90`, the constructors, and their constants were fully extractable.
The earlier `verified-already-at-parity` projectile/path dispositions are
therefore reopened here.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same 0.72.5 image as every accepted enemy/path fixture. | high |
| Archer instructions | constructor `0x0048A6B0`; apply `0x00462790`; shot gate `0x00477A80`; schedule `0x00473B40`; action tick `0x0044D4F0`; volley/audio `0x00477B90` / `0x00477C54`; raw ranges `0x00477C59..0x00478158` | One randomized maximum range, per-tick current-target facing, exact `shootarrow` release/pitch draw, direct/lead/scatter/random modes, private RNG, chance-gated fan, forward origin, randomized speed, and distance-derived `+0x168` orientation countdown. | high |
| Mage/Skeleton/Zombie instructions | Mage ctor `0x0048ABB0`; shared throw action `0x0044D4F0`; Skeleton actions `0x0044BC20/0x00451A10/0x0044C400`; Zombie Beat `0x00449300` | Mage has its own randomized maximum range and shares current-target action tracking; all three melee Skeleton actions and Zombie Beat also write live target heading. | high |
| Arrow instructions | constructor `0x005E1000`; tick `0x005FEA00`; draw `0x0060F590` | Travel heading, draw orientation, `+0x168` orientation countdown, and `+0x174` opacity/retirement are distinct. Height starts `-25`, rises by `.75`, velocity damps by `.99`, and settled opacity drains from `5` by `.05`. | high |
| Route instructions | shared goal resolver `0x00483D40`; NavMesh ctor/build `0x005DD3A0/0x005DFF90`; endpoint `0x005DDDD0`; A* `0x005DFC90`; reconstruction `0x005DF860`; route wrapper `0x005DFF20`; collision executor `0x00525800` | Blocked direct LOS enters a real triangle-navmesh A*, retains two simplified portal waypoints, advances on `dot <= 100`, refreshes on the mode period, then uses normal collision movement. | high |
| Vtable/xref sweep | 21 refs to `0x00483D40`; five callers of `0x005DFF20` | Eighteen Badguy-family classes plus three Solomon classes own the virtual; Crow is the enemy-family exception. Shared Badguy, Solomon Dig, DriveBy, Memorator, and GameNpc are all direct solver callers. | high |
| Accepted native runtime | `Mod Loader/tests/fixtures/webgame/enemy-behavior-goldens.json`, fixture SHA-256 `f246c280e7fea7c90573eb6fcb2636adbc4e327f6f15b5caa12735bf0453a82e`; moving Archer/Mage traces | At every sampled ranged-action tick, heading equals the current target direction within float noise while actor position remains fixed. | high-supporting |
| Current Website causal trace | base `61a489c0`; `boneyard-enemy-modifiers.ts`, `native-enemy-pathfinding.ts`, `boneyard-enemy-store.ts`, `primary-spell-fire-effects.ts` | Web freezes ranged action heading; uses an analytic intercept, 4-degree fan, arbitrary scatter/random angles, fixed Arrow speed/countdown/root and age retirement, invented min/max range bands, no route state/A*, a clamped final turn, and direct Imp movement. | high |
| Fresh runtime attempt boundary | two task-owned isolated Windows instances, 2026-08-27 | Old staged loader first lacked a cached bot module, then crashed in stale quick-start before a sandbox sample. Both owned processes/listeners were gone; no result is used as native evidence. | high environment receipt |

The failed fresh probes are neither stock observations nor counter-evidence.
Instruction truth and the already accepted moving-player fixture agree on every
material targeting conclusion used below.

## System boundary and membership inventory

Native systems:

1. `Badguy` target/route/steering owns nearest-target retention, action-facing
   inputs, direct LOS, NavMesh A*, route fields, gradual ordinary turning,
   family movement vectors, collision submission, target loss, reset, and
   teardown.
2. Skeleton-family action targeting owns current-target facing during queued
   actions. Archer additionally owns range/accuracy/multi-arrow evaluation and
   Arrow construction; Arrow owns independent planar travel and draw
   orientation.

| Member / branch | Native source | Disposition required by this pass | Proof contract |
| --- | --- | --- | --- |
| nearest eligible player, tie order, periodic retention, immediate invalid-target reacquisition | `0x00481A60`, `0x00483480` | `verified-already-at-parity` | two-target, tie, death, disconnect, and all-ineligible tests |
| direct LOS and blocked-goal decision | `0x00483D40 -> 0x00524180` | `exact-ported` | clear line stays direct; blocker enters route; opening blocker restores direct |
| NavMesh endpoint selection, A*, reconstruction, and simplification | `0x005DDDD0`, `0x005DFC90`, `0x005DF860`, `0x00483D40` | `exact mechanism with collision-representation adapter` | containing/nearest endpoint, disconnected failure, obstacle route, farthest-clear simplification; every adapter link must pass exact clearance collision and remain within one native lattice span |
| ordinary clearance-25 mesh | Arena builder `0x00644D4A` | `exact-ported` | Skeleton/Archer/Mage/Imp/Zombie/Wraith/Maggot/GoodImp blocker matrix |
| Demon clearance-50 mesh and selector | `0x00644E02`; Demon ctor `0x00479150` writes `+0x15D=1` | `exact-ported` | narrow lane rejected for Demon but accepted for ordinary family; broad route succeeds |
| clearance-15 mesh | `0x00644EBB` | `out-of-system` — no shipped Badguy constructor writes selector 2 | negative constructor-writer census |
| route refresh/countdown/TTL and two-waypoint fields | actor `+0x1DC..+0x208` | `exact-ported` | all `10/100/300/1000` modes, first/second passage, expiry, target move/loss |
| route failure 180 turn | `0x004840B2..0x004840D4` | `exact-ported` | disconnected graph turns once, retains requested destination, and retries on native clock |
| ordinary steering sign/deadband | `0x004763E0 -> 0x00410D60` | `exact-ported` | below-one, exact-one, overshoot, 359, and wrapped direction goldens |
| Skeleton claw/weapon/pike action tracking | `0x0044BC20`, `0x00451A10`, `0x0044C400` | `exact-ported` | moving target changes authoritative heading during every action program |
| SkeletonArcher action tracking | `0x0044D4F0` | `exact-ported` | stationary and moving target; windup, active marker, recovery; body facing follows sample |
| Archer construction/range modes 0..3 | `0x0048A6B0`, `0x00462790`, `0x00477A80` | `exact-ported` | `[280,450]` endpoints, exact factors, strict boundary, no minimum retreat, first mode-3 restoration |
| Archer accuracy modes 0..3 | `0x00477B90` | `exact-ported` | direct, distance/6 lead, two-draw radius-75 scatter, shared three-way random-mode selection |
| Archer multi-arrow modes 0..3 and extra counts 0..8 | apply `0x00462790`; volley `0x00477E58..0x00478158` | `exact-ported` | `Integer(100) <= [0,15,50,100]`, complete fan sequence and private draw order |
| Archer release audio | `0x00477C54`; registry entry 78 / object `+0xD80` | `exact-ported` | untouched `shootarrow.wav`; one positional request per volley at `1 + SignedFloat(0.1)` before random-mode/private draws |
| normal, fire, poison Arrow births | `0x00477B90`; type byte `+0x164` | `exact-ported` | payload/damage lanes, 30-unit origin, speed endpoints, `+0x168` countdown round-even, each arrow order |
| Arrow travel, orientation countdown, and opacity retirement | `0x005E1000`, `0x005FEA00`, `0x0060F590` | `exact-ported` | forward travel stays target-owned while shaft pitches, settles, and fades through its independent `5 -> 0` opacity lane |
| SkeletonMage action tracking and range modes | inherited ctor plus `0x0048ABB0`, `0x00462790`, action `0x0044D4F0` | `exact-ported` | `[312,462]` endpoints/factors and moving cast heading for fire/frost/lightning/poison |
| Mage Firebolt, GuidedMissile, and direct lightning birth direction | dispatch `0x0047FDE0` | `exact-ported` for target-facing birth; remaining projectile physics stays with the separately documented projectile system | per-element moving-target birth-heading test |
| Zombie Beat target tracking and ordinary route | `0x00449300`, `0x004863A0` | `exact-ported` | moving swipe target plus blocked/unblocked approach |
| Wraith chase/orbit/drain target ownership and route | `0x00486C30`, `0x00478EA0` | `exact-ported` | moving target through approach/orbit/contact/cooldown and blocker |
| Demon bomb fixed action facing and clearance-50 route | `0x00487300`; `Action_Demon_Spit::Tick 0x0044DF00`; ctor `0x00479150` | `exact-ported` | action tick changes controller/progress but not heading; bomb keeps action-entry facing; approach uses Demon-only navigation clearance |
| Imp hostile flight | `0x00485DC0`, shared vtable slot `+0x74` | `exact-ported` | no direct-vector bypass; blocker route, landing contact, escape handoff |
| reachable allied GoodImp | `0x0052C1A0`, vtable `0x00793D9C +0x74` | `exact-ported` | reversed target set, blocker route, target loss, lifetime release |
| Maggot crawl/bite | `0x0048B2A0`, shared route slot | `exact-ported` | emerge-to-crawl route, blocker, one bite, invalid Coffin cleanup |
| Coffin | inherited route slot but stationary `0x004A2760` | `verified-already-at-parity` — no locomotion call in live four-state owner | remains stationary while owned Maggots route |
| Badguy abstract; DemonSkull, GreenImp, DireFaculty, Spider/Cocoon, Portal, Heartmonger | shared route vtables | `out-of-system` — Website survival factory does not construct these native classes | negative Website factory census; recovered native membership remains documented |
| Crow | vtable `0x00786340` | `out-of-system` — Heartmonger-owned child and the nearby enemy exception without route slot `+0x74` | negative vtable/xref and Website factory census |
| Solomon Dig/Riff/DriveBy, Memorator, GameNpc direct solver users | five `0x005DFF20` caller census | `out-of-system` — NPC/script movement owners, not hostile mob targeting; Solomon Dig retains its separately ledgered escape contract | caller disposition test in Loader report |
| pause, run reset, scene teardown, actor death | store/world lifecycle | `exact-ported` | no route/target/private aim state survives pause mutation, retirement, Game Over, or new run |

No member is blocked by the browser platform. The browser can represent the
same authoritative target, graph, route clocks, float geometry, RNG, and fixed
ticks. Internal native pointer identity is replaced by semantic actor IDs, but
that is the existing authority representation rather than a visible
approximation.

The sole representation adapter is below native behavior: stock receives one
Region collision-line set, while Website collision is already materialized as
overlapping polygon, circle, and capsule primitives. The browser builder
clearance-expands those primitives, inserts their recovered constraint vertices
and intersections, builds the Delaunay triangle graph, and restores a locally split constrained
adjacency only when the authoritative clearance query accepts the complete
center segment and it is no longer than one native lattice span. It cannot
cross collision, change the destination, or bypass the two-waypoint/TTL owner;
the returned route prefix remains subject to native progressive-clearance
simplification and final movement collision.

## Native ownership thread and recovered behavioral contract

- `Badguy::Badguy 0x00473390` constructs common steering and route fields.
  Recipe application selects target refresh mode and the navigation-mesh class;
  Arena construction derives the NavMeshes from the Region collision owner.
- `Badguy_BuildChaseVector` first builds the wander/flank/target goal. Shared
  vslot `+0x74` then returns that direct goal or a retained waypoint. Only the
  resulting unit vector is scaled and passed to `PlayerActor_MoveStep`.
- Ordinary turn is fixed-sign, not remaining-angle clamped. Active action
  controllers are separate writers: Archer/Mage, the three Skeleton attacks,
  and Zombie Beat compute current target heading every tick, so action-facing
  remains exact even while ranged action position is held. Demon Spit changes
  controller/progress without rewriting heading and intentionally keeps its
  entry facing.
- Archer construction draws `280+Float(170)`. Mode factors are
  `1`, `1/1.8`, `1.5`, and `1/1.8`; mode 3 restores the original range after
  its first callback. Mage replaces the inherited range with
  `312+Float(150)` and applies the same factors. Both use one strict maximum,
  not a minimum/maximum band.
- Archer scheduling writes shared `Integer(1,000,000)` to the actor seed.
  Randomshot's three-way mode choice remains shared; scatter, fan jitter,
  speed, and the `+0x168` orientation countdown use the private stream in
  instruction order.
- Arrow birth point is `source + headingVector*30`; speed is
  `5.7+Float(0.6)`. Fan offsets are `0,-10,+10,-20,+20...` with 0.9..1.1
  jitter. The orientation countdown uses original source-target distance,
  independent of lead or scatter displacement.
- Arrow planar velocity moves and damps independently from draw orientation.
  The `-25` height, `.75` rise, `-3` landing edge, `.99` planar damping,
  `(-25/height)*launchSpeed*.5` pitch term, `+0x168` orientation countdown,
  and independent `+0x174 = 5` opacity drained by `.05` after landing are
  authoritative fixed-tick state. The distance-derived countdown does not
  retire the Arrow.
- NavMesh construction uses collision exclusion mask `0x80`, ordinary/Demon
  clearances 25/50, a 500-unit source lattice, a 200-unit boundary margin and
  spatial lookup cells, and one-unit portal inset. A blocked
  zero-width direct query runs A* across triangle adjacency; the actor retains
  two simplified waypoints and follows them until `dot <= 100` or route TTL
  expires.
- Target invalidation clears semantic identity immediately and reacquires the
  nearest eligible target. Actor death, run reset, Game Over, and scene teardown
  destroy action seed, range latch, route, and waypoint state with the actor.

## Nearby-system findings

- `0x005DFF20` is reusable native point-to-point pathfinding, contradicting the
  old Mod Loader conclusion that stock exposed only collision-aware chase.
  Native NPC callers reuse it, but they do not broaden this web change beyond
  hostile/GoodImp navigation.
- No shipped Badguy constructor selects the third clearance-15 mesh. Demon and
  DemonSkull are the only `actor+0x15D` writers and both select mesh 1.
- Archer action scheduling uses `Integer(1,000,000)`; older loot documentation
  that grouped it with ten-million actor seeds is wrong for this writer.
- Durable native reports updated before implementation:
  `docs/pathfinding-investigation.md`,
  `docs/reverse-engineering/native-enemy-behavior.md`,
  `native-enemies.md`, `native-projectiles-and-effects.md`, and
  `native-enemy-catalog.json`.

## Confidence and open questions

- Confirmed: all formulas, branches, fields, clocks, mesh constants, vtable
  membership, solver caller census, action-facing writers, Arrow draw/travel
  split, and current web violations above.
- Runtime-supported: ranged action tracking and stationary ranged-action
  position from the accepted moving-player fixture.
- Unknown but non-material to this boundary: the editor display labels for
  numeric path mode 2 and the clearance-15 mesh's non-Badguy consumer. Neither
  changes a Website factory member or recovered behavior.
- The two new live-probe failures are tooling/environment failures only; no
  conclusion depends on their absent samples.

## Web implementation consequence

- Replace `BOUNDED_ARCHER_RANGE_BANDS`, `BOUNDED_MAGE_RANGE_BANDS`, and
  `boundedArcherAimHeading` with an exact native targeting kernel. Carry
  Archer randomized range, mode-3 latch, multi-arrow mode, and per-volley
  private seed as authoritative actor state.
- Keep the selected target current through every Skeleton claw/weapon/pike,
  Archer/Mage, and Zombie action tick. Preserve the recovered Demon exception:
  `Action_Demon_Spit` does not rewrite heading after entry. The actor sample
  already replicates heading; no new client-side target inference is allowed.
- Construct Arrow from exact per-arrow specs and keep travel heading,
  orientation countdown, and opacity retirement separate. Remove fixed
  speed/countdown/center-origin behavior.
- Extend `NativeEnemyPathState` with the recovered route clocks, two waypoints,
  index, and dot-product vectors. Add one world-owned collision/nav callback;
  absent callback means the native no-NavMesh branch used by isolated kernel
  tests, while the real Boneyard always supplies it.
- Build deterministic clearance-25 and clearance-50 routes from authoritative
  Boneyard collision geometry, run A*, simplify against current collision, and
  feed the retained goal back into the exact fixed-sign steering owner.
- Route hostile Imp and Fire GoodImp through the same owner; remove Imp's
  direct-heading bypass. Coffin remains stationary and Maggots retain their own
  actor route state.
- Preserve host authority. Hostile route/private aim state remains server-only;
  replicated position, heading, projectile motion/orientation, and semantic
  events remain the rendering contract. Reachable GoodImp already serializes
  its complete primary-spell continuation state, so protocol 96 adds the two
  route waypoints, index, prior vector, and route clocks to that existing path
  object rather than asking clients to infer navigation.

## Validation contract

- Focused targeting tests enumerate all four Archer accuracy modes, all four
  range modes, all four multi-arrow modes, extra counts `0..8`, all three
  payloads, RNG draw order, strict range/LOS boundaries, per-tick moving-target
  facing, exact birth roots/speed/countdown, and Arrow flight/orientation/fade
  edges.
- Focused path tests cover direct LOS, an obstructed connected route, a
  disconnected route, both mesh clearances, progressive simplification,
  two-waypoint passage, all target periods, target loss/reacquisition, route
  teardown, fixed-sign deadband/overshoot, and no hidden alternate target.
- Per-member store/world tests cover Skeleton, Archer, Mage, Imp, Zombie,
  Wraith, Demon, Maggot, GoodImp, and stationary Coffin against moving targets
  and blockers.
- Run the complete Mod Loader static RE suite and Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh` only on the exact Mac
  candidate.
- Mac Chrome acceptance enters a real Boneyard, observes an authored Archer
  action and Arrow lifecycle through the production renderer and replication
  stream, and records the opening population's authoritative movement and
  steering without a combat-bound crossing. Per-family moving-target and
  blocker outcomes remain authoritative host tests rather than synthetic
  browser-spawn substitutions. Capture page/console/failed-response/wire arrays
  and compare the ranged action law to the matching stock fixture samples.

## Implementation validation receipt

- Website runtime candidate `b6fb656e406271a55a7d2224b731ad5c80486598`
  (tree `fa6f1d705ecaeac67750f54fc3b94589333084f7`) was materialized at
  `/Users/jarrett/codex-acceptance/enemy-target-path-parity-20260827-root-r7/Website`.
  The Mac canonical gate passed all 27 backend/Website contracts, lint and
  architecture boundaries, every registered frontend/runtime/desktop suite,
  both production builds, media policy, and bundle budget. The complete
  `test:boneyard` lane passed 1,711/1,711, including the targeting,
  pathfinding, family membership, protocol, audio, and renderer contracts.
  `Game-D9IKL3BZ.js` is 251,319 raw / 76,433 gzip bytes under both caps.
  `validate-r7.log` SHA-256 is
  `930f7214d2a43c65053301fb23ef254030ce6debb3322b32406575f0394a22b7`.
- Mod Loader candidate `7cd8ad62e786106250bfa32a95f435e02bf2cd9d`
  (tree `f33ef0a057374d432c3b27db611e7d6ae3d1bd02`) was materialized beside it.
  The registered portable static RE suite passed 523/523 on the Mac. Its log
  SHA-256 is
  `cf95d500574e841a68f6eb26999f067c4e862105f773f0c0e65f3af8d56571b7`.
  The unfiltered local-artifact variant separately reported the expected 13
  unavailable retail/staged artifacts; none is a portable-contract failure.
- Production Mac Chrome completed the real deterministic Boneyard with status
  `ok`. The acceptance harness only fortified the browser player and selected
  one existing compiled Skeleton-Archer burst; it did not construct an enemy,
  action, projectile, motion sample, render sample, or retirement event.
  Authoritative actor 12 rendered `archer-shot` with enemy descriptor type
  `1002`. Its normal Arrow used projectile type `2010`, produced five distinct
  replicated motion samples, rendered at tick 30,495, and retired cleanly at
  tick 30,516. Reconstructed flight at age 3 retained heading `148.40625`,
  independent visual phase `159.5`, speed `5.59765625`, and vertical offset
  `-22.75`. All eleven opening actors moved between `7.69` and `22.76` world
  units over the sampled interval while retaining gradual stock steering; no
  actor crossed the owned combat bound.
- Browser page/console, failed-response, wire-decode, and combat-bound arrays
  are empty. The one-line receipt SHA-256 is
  `d8bb7b7c0db250e43e3196c3a55d5a09904af77348fe10160ac6d019dded3f98`;
  the inspected Archer-projectile frame SHA-256 is
  `e7274e18e53049c868f05eefb5ceee3422dc621e4af1d392dfbff695f32bd4e1`.
  The temporary harness branch was removed from both candidate trees, all
  task-owned browser/host processes exited, and both worktrees returned clean
  at the commit/tree identities above.
- No browser constraint blocks a member. The one declared representation
  adapter remains stock Region collision lines to the Website's existing
  polygon/circle/capsule collision owner; every inserted local adjacency is
  bounded to one native lattice span and must pass the authoritative swept
  clearance query. This receipt is the sole post-validation documentation
  write; no runtime, test, build, asset, protocol, or browser byte changed
  afterward.
