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

## 2026-08-28 — production static-collision broadphase performance reopening

### Reported smell and parity question

- Reported production behavior: one ordinary two-player Random Boneyard became
  visibly laggy during its active run and reached repeated authoritative
  `simulation.tick_lag` recovery drops before both players died on wave 13.
- The parity question is representation-only: can the recovered zero-width
  direct-path query, fixed one-unit sampling, strict contacts, primitive order,
  gate overlays, and final movement collision remain byte-equivalent while the
  Website restores the native system's spatial lookup beneath point contacts?
- This is a secondary report in the system closed above. The prior pass
  recovered that native NavMesh and Region collision own spatial lookup cells,
  but its Website adapter validated route outcomes without profiling the
  authoritative 100 Hz loop under a 70-plus-enemy survival population. It left
  every sampled point scanning the complete Arena primitive inventory.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production runtime | deployed Website `6220c5a703a5bb922f14f892923baa1fe58d9e89`; shared run `cf0144334ad25fa3aff51db26e760402`; 2026-08-29 `01:55:02.553..02:08:00.885Z` | The two-player run reached wave 13 and emitted 18 rate-limited tick-lag warnings. The logged remainder total was 2,116 ms, maximum 836 ms; each warning occurs only after 25 catch-up ticks, so the maximum original debt was at least 1,086 ms. The process reached 109.05% CPU with stable 384..400 MiB resident memory, zero service restarts, and ample machine RAM/CPU outside the single event-loop lane. | high-live |
| Exact-tree Mac replay | detached `6220c5a7`, Node 22.23.2, generated Arena index 0, matching Ether/Body plus Water/Mind players, real wave director through wave 13 | At 70 live enemies, the unchanged simulation measured 3.499 ms mean, 10.848 ms p95, and 14.576 ms p99 per fixed tick on the M2 Mac; p95/p99 already exceed the 10 ms production tick budget before shared-Hub and snapshot work. | high |
| Named CPU profile | same replay, Node `--cpu-prof` at 500 microseconds | `boneyard-collision.ts` owns 52.18% of sampled self time. `firstContact` owns 49.98% self time; the direct-path `firstBoneyardPathBlockProgress` branch owns 39.47% inclusive time. Garbage collection owns another 8.38%. | high |
| Single-variable diagnostic | same wave-13 state, interleaved 500-tick branches, only static collision removed in the diagnostic branch | Normal collision measured 3.499 ms mean / 14.576 ms p99; the collision-free branch measured 0.920 ms mean / 1.387 ms p99, a 3.804x speedup while ending with 86 versus 85 live enemies. This is causal localization, not a legal implementation. | high |
| Host-work falsifier | same wave-13 state, two player projections | Both 20 Hz snapshot projections/frames/encodes cost 0.511 ms mean per broadcast. Both periodic save documents/encodes cost 12.166 ms once per 30 seconds. They can amplify a slow tick but do not own the sustained one-core saturation. | high |
| Current source audit | `boneyard-collision.ts::firstBoneyardPathBlockProgress -> canPlaceBoneyardBody -> firstContact`; all 12 generated Arena templates on `6d712227` | A path of `ceil(distance)` samples calls `firstContact` once per unit. Each call linearly visits all polygons, segments, and circles until contact; generated Arenas contain 419..542 primitives, including 386..503 circles. The hot collision/path files are byte-identical between the observed deployment and current main. | high |
| Existing native evidence | route/Region findings already recorded above: `0x005DD3A0/0x005DFF90`, `0x00524180`, `0x00525800`; spatial lookup cells and stable narrow-phase behavior | Spatial lookup is native ownership. Cell partition size is an internal broadphase representation and cannot change candidate order, contact equations, route decisions, or movement results. | high |

The simultaneous replication-baseline losses generally follow server tick-lag
events. Catch-up processes up to 25 ticks and emits every five-tick snapshot in
one callback, so slow simulation creates snapshot bursts; baseline recovery is
a downstream symptom and modest amplifier, not the root owner.

### System boundary and membership inventory

Native/web system: immutable Arena static-collision spatial lookup beneath all
authoritative point/body contact queries. The all-pairs narrow phase remains
the behavioral oracle.

| Member / branch | Disposition | Required invariant |
| --- | --- | --- |
| Polygon, capsule-segment, and circle base primitives | `exact-ported` | Candidate pruning may remove only primitives whose AABB cannot touch the query circle; retained candidates keep original kind and source-array order. |
| Moving Gate leaf segments | `exact-ported` | Per-tick overlays remain after base segments and before circles; no stale leaf root or cached pose. |
| Direct zero-width enemy LOS | `exact-ported` | Keep `ceil(distance)` samples, strict bounds/contact comparisons, first blocked sample, and ten-step fractional refinement exactly. |
| Player/enemy movement and eight-step sweep/slide | `verified-already-at-parity` | Same first contact and normal, same binary sweep candidates, same accepted root. |
| Spawn placement and four-direction mobility probe | `verified-already-at-parity` | Same ring/RNG/policy sequence and first legal candidate. |
| Weather and secondary point/body queries | `verified-already-at-parity` | Bounds-free collision semantics and ignored-source behavior remain unchanged. |
| Gravestone/scenery source filtering | `exact-ported` | Both circle and optional polygon for an ignored source remain excluded, without excluding siblings. |
| All 12 generated Arenas, Tutorial, mod-authored Boneyards, and restored saves | `exact-ported` | Index builds from the actual primitive arrays, lazily when no constructor-owned cache exists; no scene-specific inventory or seed assumption. |
| Line-ray obstruction for spells/projectiles | `verified-already-at-parity` and outside this point-query optimization | Nearest obstruction and native mask order remain the existing analytic owner. |
| Snapshots, save schema, hashes, and protocol | `verified-already-at-parity` | The broadphase is module-private, weakly owned by collision-world identity, and never serialized or replicated. |

### Recovered behavioral and representation contract

- Preserve polygon-before-segment-before-circle traversal and ascending source
  index inside each family. First-contact identity is authoritative because its
  normal drives movement slide.
- Partition immutable primitive AABBs into deterministic internal cells.
  Query every cell touched by `center +/- radius`, deduplicate candidates, and
  restore source-array order before the unchanged narrow phase.
- A cell extent is a representation tuning value, not a native gameplay
  constant. It must not appear in state, saves, snapshots, hashes, or protocol.
- Reuse the immutable base index across moving-Gate views. Test the live Gate
  segments as ordered overlays so their current endpoints remain authoritative.
- Keep a complete all-pairs oracle and prove indexed/all-pairs equivalence for
  contact booleans, source IDs, path-block progress, and final movement roots.
- Rebuild lazily for restored or hand-constructed collision worlds; constructor
  paths may prewarm the same cache before the first combat tick.

### Web implementation consequence and validation contract

- Add one module-private static collision grid inside
  `core-server/boneyard-collision.ts`; do not change path cadence, skip samples,
  replace collision with NavMesh containment, coalesce enemies, lower tick rate,
  or add crowd thresholds.
- Add a deterministic all-pairs constructor/test seam. Randomized differentials
  must cover negative/cell-edge coordinates, radii including zero, every
  primitive family, overlapping first contacts, ignored source IDs, moving Gate
  overlays, all generated Arenas, path progress, and movement output.
- Re-run the exact two-player wave-13 replay and named CPU profile on the Mac.
  Acceptance requires identical deterministic final state, no p99 regression in
  the non-collision remainder, and a material reduction from the 3.499 ms
  high-crowd mean / 14.576 ms p99 baseline.
- Run the complete Mac Website gate, then a built Mac Chrome Random Boneyard
  journey that records authoritative tick advance, enemy motion, page/console/
  response/wire errors, and confirms no combat-bound crossing.

### Implementation validation receipt

- Exact runtime candidate `ca87fac9a5962ab108f0e335e40554ab7e96946e`
  is one focused commit over current-main parent
  `f50a41c7663463d68cf4943ac783098f03d2ef02`. The collision owner now keeps a
  module-private ordered static grid and complete all-pairs oracle. The existing
  one-unit direct query, narrow-phase formulas, primitive-family order, moving
  Gate overlays, source filtering, path cadence, route state, snapshots, saves,
  and protocol bytes are unchanged.
- Arena-owned ordinary, Demon, and Solomon meshes now build in the packaged
  `boneyard-navigation-worker` during the existing match-loading barrier. The
  worker receives immutable geometry and preparation requests only; the host
  freezes and installs its returned mesh data before exposing the Boneyard.
  A fresh three-mesh Mac probe took 1,483.915 ms off-thread while a two-ms main
  loop completed 587 turns with a 2.892 ms maximum gap. Repeated worlds sharing
  the same authored scene identity reuse the installed cache.
- The exact Mac collision benchmark covers four clear paths in each of all 12
  generated Arenas, five repetitions, and identical checksum 240. All-pairs
  direct queries measured 4,363.475 microseconds each; indexed queries measured
  108.197 microseconds, a 40.329x speedup. Receipt SHA-256:
  `88e840d44d15ebb7f7a007b0633bc52f2a0eac2be29d9ecc14fd0d979ae3e681`.
- The exact two-player Ether/Body plus Water/Mind replay retained the same wave
  transition ticks, final 89 enemies, maximum 93 live enemies, and maximum 583
  dynamic actors through 62,500 ticks. Against the observed-tree baseline,
  mean fixed-tick cost changed `1.429 -> 0.492 ms` (65.6% lower, 2.91x faster),
  p99 changed `12.099 -> 3.128 ms` (74.1% lower, 3.87x faster), and total wall
  time changed `92.219 -> 32.233 s` (65.0% lower, 2.86x faster). In the
  interleaved 70-plus-enemy wave-13 window, mean changed
  `3.499 -> 1.237 ms` (64.7% lower, 2.83x faster) and p99 changed
  `14.576 -> 4.310 ms` (70.4% lower, 3.38x faster). Receipt SHA-256:
  `c0cad078f19f43b9906e9281afd4728af5eb9bd84bd645807ba295a99a7099b0`.
- The complete Mac Website gate exited zero on the exact candidate: all 28
  backend contracts, lint/architecture/generated checks, every registered
  frontend/runtime/ML/desktop suite, both production builds, media policy, and
  bundle budget passed. The Boneyard lane passed 1,689/1,689. The production
  Game entry is 262,749 raw / 79,697 gzip bytes under both caps, and the
  packaged navigation worker is present. Gate log SHA-256:
  `5a31d494686de88ca87fbc4fc2bcbad1c3bc273a2829ebbd2367ace766bb78f7`.
- Built Mac Chrome completed the deterministic Random Boneyard opening with
  status `ok`: Solomon Dig/dialogue/escape, `8 + 3` authored opening births,
  eleven independently moving/steering enemies, 1,605 snapshot sequences, no
  outside-combat enemy sample, and empty page, response, and wire error arrays.
  Receipt SHA-256:
  `18b4212a5a9d484c6baf48833ad3e87889c7e6a75ac17a6da28b9cfc11f326a7`;
  inspected combat frame SHA-256:
  `6768809cb06b6b68a0fe13655fb541448ff98a60a2fa38065c31a3e7a1dd3587`.
- No browser constraint or intentional behavior difference remains. This
  receipt is the sole post-validation documentation write; no runtime, test,
  build, asset, protocol, or browser byte changed afterward.

### 2026-08-28 — navigation-worker release packaging correction

- Live deployment of `bce83468` proved that the preceding receipt's
  "packaged navigation worker is present" statement was too broad. The
  frontend build did emit `dist-game-host/boneyard-navigation-worker.mjs`, but
  `backend/Server.csproj` did not link it into `GameHost/` and both guarded
  release manifests named only the existing ML worker. Production therefore
  reached the new revision healthy while the first Boneyard start would have
  failed to spawn its navigation worker. No player entered during this window.
- This is a publication-contract failure, not a navigation-model failure. The
  complete worker membership is the build entry, .NET publish content link,
  artifact required-file list, staged-release required-file list, and deployed
  `GameHost/` member. Every row must name
  `boneyard-navigation-worker.mjs`; successful compilation alone is not a
  deployment receipt.
- Add one backend content row, both guarded release-manifest rows, and a
  validation contract that enumerates both server workers across build,
  publish, and deployment owners. Re-run the complete Mac gate, push normally,
  and prove the live release contains a nonempty worker before any gameplay
  claim.
- Exact correction candidate
  `80fe1b678df34189a97d5e5bac2f8540c0613646` is one focused commit over
  current-main parent `1ec8b1f3674a4b3c138f8450c735cc4b836eeaef`.
  The new deployment contract first failed on the absent Boneyard worker, then
  passed after the .NET content link and both guarded release lists named it.
  The existing active-rejoin integration now waits for the host-authoritative
  disconnect edge before requesting its capability, removing a socket-close
  scheduling race without changing runtime behavior.
- The complete Mac Website gate exited zero on the exact candidate, including
  all 29 backend contracts, 1,696/1,696 Boneyard tests, every remaining suite,
  both production builds, bundle budget, and media policy. The Game entry is
  263,161 raw / 79,873 gzip bytes. Gate log SHA-256:
  `656baf7c6581915900e29e62e132a4fc6e06ed385e8dd823a2295944893cdfd1`.
- A clean Mac `dotnet publish --no-restore` produced nonempty
  `GameHost/boneyard-navigation-worker.mjs` beside the supervisor and ML
  worker. The built Boneyard worker is 34 KiB with SHA-256
  `f4104902b7e28c36146f779419446e8dcec75818a7597944f05720bfd9713ee3`.
  Production acceptance requires this same member beneath the deployed
  `GameHost/` directory.

## 2026-08-29 — authoritative Boneyard dynamic-population storage reopening

### Reported smell and parity question

- The collision broadphase removed the production path-query bottleneck, but
  the surviving fixed-tick implementation still reconstructs rich immutable
  objects for every enemy, Maggot, projectile, projectile effect, and death
  effect. A recovered late-wave run can retain hundreds of those independent
  actors at 100 Hz.
- The long-term parity question is representation-only: can one deep
  Boneyard-owned runtime keep native registration order, actor identity,
  fixed-tick clocks, RNG order, family state, collision submission, semantic
  events, replication, saves, pause, and teardown byte-equivalent while hot
  scalar populations move from per-tick object graphs to stable dense slots?
- This reopens the complete dynamic-population owner rather than optimizing one
  visible effect class. A lane may be converted first for differential proof,
  but no selectable legacy runtime, load threshold, or second authority model
  may remain after the cutover.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Prior production and Mac evidence | production run and exact-tree receipts in the preceding 2026-08-28 section | The accepted collision change preserved the same wave transitions, 89 final enemies, 93 peak live enemies, and 583 peak dynamic actors through 62,500 ticks. | high-live/high |
| Current deterministic replay | core files byte-identical between diagnostic `acad2d24` and current base `41ec3c8f`; Node 22.17.0; generated Arena 0; Ether/Body plus Water/Mind; invulnerable damage filter; 62,500 ticks | The current web model reproduced final stable hash `eef40ec5890ea1d4`, order-sensitive JSON hash `d4d73675c62f90eb:746170`, 87 peak live enemies, and 363 peak dynamic actors. Linux diagnostic timing was 0.980 ms mean / 5.419 ms p99 overall and 1.670 ms mean / 6.492 ms p99 for 70-plus live enemies. This is a design baseline, not a Mac completion receipt. | high-diagnostic |
| Current named CPU profile | same replay with only the final hash sampled; Node `--cpu-prof --cpu-prof-interval=500` | GC owned 8.53% self time. `stepDeathEffect` was the hottest named gameplay function at 7.78%; `finishGameSimulationTick` was 5.50%; actor motion, world stepping, spell combat, navigation, and collision followed. `stepBoneyardEnemyStore` dispatch itself was only 0.84%, falsifying a parent-enemy-only rewrite. | high-diagnostic |
| Current source audit | `boneyard-enemy-store.ts`, `boneyard-world.ts`, `boneyard-spell-combat.ts`, `native-secondary-world.ts`, projections, protocol, saves, Lua, and ML observers | Hot updates allocate arrays, maps, vectors, top-level records, nested family brains, and transient records. The same raw arrays are also read directly by combat, collision, projection, persistence, and developer consumers, so a single-lane private pool would be a shallow symptom patch. | high |
| Existing native evidence | this file plus ledger entries 081, 091, 234, and 242 | Native behavior requires independent registered actors, exact fixed-tick clocks, stable submission/retirement order, host-owned RNG, parent-independent transient lifetime, and complete pause/reset teardown. Native pointer layout is incidental implementation debt; semantic order and state are not. | high |

The first complete six-lane dense candidate was a required falsifier. It kept
the exact final stable hash `8c0e14e77c940eb6`, order-sensitive JSON hash
`568aade0bc2dbd60:746248`, 54 wave transitions, all four population sums, 87
peak live enemies, and 363 peak dynamic actors, but changed Mac timing from
0.460 to 0.717 ms mean and 2.867 to 4.161 ms p99. The 70-plus crowd window
changed from 0.767/3.061 ms mean/p99 to 1.659/8.054 ms. Its profile proved why:
heterogeneous parents and live projectiles were encoded into numeric buffers,
then immediately materialized for their existing family/combat kernels. Two
materializers owned about 3.9% self time and dense-store construction another
1.5%, while GC remained 8.58%. Direct dense death-effect stepping fell from
7.78% to 0.80% self time, so the homogeneous transient lane is validated while
the convert-then-materialize parent layout is rejected.

The follow-up immutable hybrid was also a required falsifier. Direct readers
removed the 100-Hz presentation leak and flat births removed rich birth
records, but copying every retained transient's 19/24 scalars into a new
immutable buffer each tick still regressed an uncontended adjacent Mac control.
The remaining native/web owner is therefore the live Arena runtime, matching
the already accepted mutable Hub Student/runtime scratch ownership: dense
transient lanes mutate only during their authoritative fixed-tick epoch, while
snapshot/save/test projections are detached immutable records. Source audit
found no previous/current consumer of raw death/projectile-effect arrays;
ordered semantic events own births/retirements and every historical external
consumer already crosses a projection seam.

The mutable-dense follow-up then falsified the remaining ownership assumption.
The current functional store is intentionally persistent: one authoritative
state may be reused to evaluate two legal damage branches. Sharing a mutable
transient runtime caused one Mage-shield branch's particles and fade clocks to
contaminate the other, failing three lifecycle regressions. Copy-on-write or a
version journal would restore correctness by reintroducing the same retained
population copy plus substantially more interface complexity. No typed-array
Boneyard population candidate therefore satisfies both performance and the
existing branching contract. The accepted representation remains ordered
persistent object arrays; the measured hot transient step is deepened and
optimized within that representation.

The 710-plus-ms diagnostic maximum remains the known synchronous headless
NavMesh construction. Production builds the same meshes in the packaged
loading worker and therefore this storage reopening neither attributes that
spike to populations nor reopens navigation preparation.

### System boundary and membership inventory

Native/web system: the Arena-owned authoritative dynamic actor populations
from construction through fixed-tick update, collision/target submission,
semantic output, projection, persistence, pause, retirement, and world
teardown. The internal representation is below behavior and is never a protocol
or save-schema member.

| Member / branch | Disposition | Required invariant |
| --- | --- | --- |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, and Coffin parents | `verified-already-at-parity`; representation reopened | Stable actor ID, native registration/cell order, all family brain fields, target/path state, action/RNG clocks, lighting, hit/death state, and terminal output remain exact. |
| Coffin-owned Maggots | `verified-already-at-parity`; representation reopened | Parent identity, construction order, emergence/crawl/bite/death lanes, admission limits, route state, and parent teardown remain exact. |
| Arrow, Firebolt, GuidedMissile, DemonBomb, and PoisonPool | `verified-already-at-parity`; representation reopened | Birth order, payload, motion, contact, light, parent identity, and retirement clocks remain exact. |
| All ten reachable projectile-effect kinds | `verified-already-at-parity`; representation reopened | Descriptor-specific alpha bounds, authored art/blend/light data, parent-independent lifetime, stable IDs, keyframe/delta reconstruction, and teardown remain exact. |
| Bouncer, fade, move-fade, banish, sprite-array, fire-array, and unbind death actors | `verified-already-at-parity`; representation reopened | Complete family recipe fan-out, host RNG order including every Bouncer ground draw, art/transforms/physics/blend/shadow, stable IDs, delayed birth, retirement, and late-join state remain exact. |
| Mage lightning pulses | `verified-already-at-parity`; representation reopened | Direct-effect source/midpoint/endpoint/contact attachment, owner identity, seed, tick, and bounded retention remain exact. |
| Per-tick semantic events, damage, knockback, rewards, spawns, and retirements | `verified-already-at-parity` | They remain ordered ephemeral outputs, not retained dense entities or inferred snapshot deltas. |
| Player/Student/enemy dynamic collision bodies | `verified-already-at-parity` | Hostile populations project the same ordered closed `ActorPhysicsBody` rows into the existing broadphase and solver; no collision cadence or response changes. |
| Primary, Staff, secondary, Lua, and ML target queries | `verified-already-at-parity`; consumer seam reopened | Every consumer observes the same active membership, stable order, IDs, positions, radii, flags, health, configs, and family state without constructing a second authority list. |
| Entity replication and complete snapshots | `verified-already-at-parity` | Descriptor/sample contents, quantization, baseline recovery, event order, 20 Hz cadence, and protocol version remain unchanged. |
| Browser saves and restored runs | `verified-already-at-parity` | Disk projection remains the existing plain schema and restores the same persistent object populations. No schema bump or typed-array serialization is allowed. |
| Tutorial hostile hold, level-up/pause, Game Over, new run, and teardown | `verified-already-at-parity` | Held clocks and RNG remain unchanged; reset destroys every population; no slot, descriptor, transient, or scratch buffer crosses a run. |
| GoodImp, player primary/secondary actors, and loot | `out-of-system` for storage ownership | They retain their existing separate owners; shared collision/target projections do not merge their state into the hostile runtime. |
| Story-only enemy/projectile families listed in entry 091 | `out-of-system` | The Website factory still cannot construct them. Future reachability must add an explicit family row before exposure. |

No member is blocked by the browser platform. The representation decision is a
V8 performance and persistent-state contract, not a browser capability gap.

### Recovered behavioral and representation contract

- Population array order is native registration order. Removal retains every
  survivor's relative order; later births append with new semantic IDs and
  registration ordinals.
- Each returned store owns persistent object arrays. A later tick or sibling
  damage branch cannot mutate an earlier store, actor, vector, descriptor, or
  transient record.
- Family-specific brains and transient kinds remain closed discriminated rows
  behind one deep hostile/transient interface. No consumer owns a second list.
- Hot stepping may reuse an unchanged nested position/velocity reference, but
  it must create a new top-level row for every authoritative scalar change.
  TypeScript readonly ownership replaces redundant `Object.freeze` calls on
  tick-local rows; save/snapshot projections remain detached where required.
- The complete death/projectile transient system is one module. It owns every
  kind's age, motion, opacity, frame, RNG callback, strict retirement edge, and
  parent-independent lifetime rather than scattering one-off optimizations by
  family.
- All narrow-phase equations, target/path decisions, action clocks, movement
  cadence, RNG calls, creation order, painter order, event order, and strict
  retirement edges remain byte-equivalent. No culling, coalescing, lower-rate
  crowd lane, alternate tick rate, or population threshold is allowed.

### Web implementation consequence

- Keep `BoneyardEnemyStore` as the persistent authoritative owner; do not add a
  general ECS package, typed mirror, compatibility path, or mutable sidecar.
- Extract one deep transient-step module for all seven death-effect and ten
  projectile-effect kinds. Its interface accepts the ordered prior arrays,
  tick, exact RNG callback, and native programs, then returns the next ordered
  arrays.
- Remove redundant hot-path freezes, avoid cloning stationary vectors, and
  keep one closed explicit record construction per changed effect. Do not alter
  births, RNG order, alpha/frame equations, IDs, or retirement.
- Add a repository-owned two-player late-wave benchmark and phase/profile
  reporting. Benchmarks are diagnostics; acceptance still requires the exact
  Mac candidate and the real browser journey below.

### Validation contract

- Red/green transient contracts cover source immutability, sibling store
  branching, every kind, delayed births, ground-contact RNG order, all strict
  retirement edges, stationary-vector reuse, and exact JSON projection.
- Differentially run the prior and deepened transient step over all ten
  projectile-effect and seven death-effect kinds, including catch-up tick
  ranges. Compare ordered states and RNG after every tick.
- Re-run the exact 62,500-tick two-player replay on the Mac. Acceptance requires
  identical wave transitions, final and checkpoint hashes, peak membership,
  dynamic sums, and JSON projection. Mean, p99, GC self time, and the named hot
  lanes must materially improve without regressing the non-population remainder.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact clean Mac
  candidate.
- Built Mac Chrome must enter a real Random Boneyard and observe opening
  parents, movement/steering, an authored projectile plus transient, a terminal
  death-effect handoff, snapshot continuity, save/restore, and clean new-run
  teardown. Page, console, failed-response, wire, save, and host-error arrays
  must be empty.
