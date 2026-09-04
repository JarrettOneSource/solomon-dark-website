# 2026-08-27 — enemy target tracking, Archer volley, and NavMesh reopening

## 2026-09-04 — repeated static collision candidate selection

The optimization starts at Website `3c5e76d6`. A Mac M2 CPU profile of the
existing 62,500-tick deterministic runtime replay attributed 593 ms to
`PrimitiveCellGrid.selectCells`. The replay reached 100 live enemies and 573
dynamic actors. Repeated placement and movement checks often select the same
128-unit cell rectangle while their exact coordinates differ.

This is a representation change to the existing static collision adapter.
The native collision and route contracts recovered below remain the oracle;
no new native behavior, geometry, tick cadence, or tolerance is inferred.

| Member | Disposition | Preserved contract |
| --- | --- | --- |
| Circle, segment, polygon candidate grids | `exact-ported` | Reuse only the immediately preceding cell rectangle's ordered candidate indices; exact contact still runs for each query. |
| Radius queries and line/bounds queries | `exact-ported` | All four cell bounds participate in reuse, including negative coordinates and cell crossings. |
| Single-cell, empty, multi-cell, and oversized global primitives | `exact-ported` | Same candidates, duplicate removal, and source-array order. |
| All generated Arenas, enemy clearance sizes, players, projectile collision, client prediction | `verified-already-at-parity` | Shared adapter consumers keep their precise geometry and first-contact formulas. |
| Gate changes, scene replacement, and teardown | `verified-already-at-parity` | Each immutable collision view owns its grids; replacing geometry creates a fresh view. No query cache is shared between worlds. |
| Dynamic actor collision and native NavMesh A* | `out-of-system` | No dynamic-body candidates or route results are cached. |

The collision view quantizes the query bounds once for all three primitive
grids and retains one result with four cell coordinates. Its indices already
use immutable cell arrays or each grid's existing scratch array, so memory
does not grow with the number of visited cells. A different
rectangle replaces the cached selection. Remove the duplicate mutable
selection interface, whose fields already match `CollisionBroadphaseSelection`.

Validation: sequential query and geometry-replacement regressions, the existing
all-pairs comparison across every generated Arena, identical full-runtime
state hashes and population counts, Mac canonical validation, and browser
movement acceptance. Performance conclusions require before/after measurements.

### Validation receipt

- Initial validation base: `132774b6992fc766c255e319cdbbdcddeef8135b`.
  All ten changed files matched byte-for-byte on the Mac before validation.
- Mac M2, Node `22.17.0`: `./scripts/validate.sh` passed, including 19 Python
  tests, the configured Node suites, lint, type checks, builds, and media
  policy. The collision all-pairs oracle still covers every generated Arena.
- The final 62,500-tick, seed `1372610135`, Arena-0 replay preserved all 125
  periodic hashes, wave events, population totals, and the final hashes
  `5d41b07ca048bb71` / `79eec76cfadc6f7e:808304`. It reached 100 live enemies
  and 573 dynamic actors. Instrumenting the actual selection entry counted
  6,346,049 cache hits in 7,682,462 queries (82.60%, including navigation
  preparation). No instrumentation remains in production source.
- Isolated before/candidate/restored comparisons across the first three
  generated Arenas, radius 25, 256 query locations, 500,000 calls, and eight
  consecutive queries per location measured candidate costs of
  `0.038..0.114 us/query`, versus restored baseline `0.237..0.678 us/query`:
  approximately 5.3–6.2 times faster. Candidate and baseline checksums match.
  Miss-only measurements and full replay wall times varied; these results
  do not establish a uniform reduction in total server tick time.
- Production-bundle Mac Chrome, hardware Apple M2/Metal, 1600x900: stormy
  Boneyard idle/movement samples reached 340.54/347.30 FPS with the 400-FPS
  presentation cap and browser vsync disabled. Movement traversed 2,573
  presented positions; native light samples, 569 rain drops, 300 splashes,
  static paint count, and resident visibility checks passed. Page/console
  errors and failed responses were empty. This is desktop evidence, not a
  physical-phone measurement or a demonstrated before/after FPS gain.
- Scoped Node coverage for the collision adapter: 100% lines, branches,
  and functions. A regression seeds the existing deduplication counter at
  rollover and verifies exact candidate membership through subsequent queries.
  Cyclomatic complexity passes the configured maximum of 21. Additional
  unavailable quality gates are recorded with the Region planner receipt.

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
  `(-25/height)*launchSpeed*.25` pitch term, `+0x168` orientation countdown,
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

### Implementation and validation receipt

- Exact runtime commit `5fd901b5144989f6a018b7a7e37998c904f0b386`
  and focused browser-smoke commit
  `0f16f23dab1f9f7461c860036e0d355c53da7655` sit directly above current-main
  base `9f26f3eb538867cad5b4c3959ee7da63fd805ba6`. The runtime commit extracts
  every death/projectile-effect step into `boneyard-transient-effects.ts`,
  removes redundant freezes, reuses stationary vectors, and leaves the store,
  save, projection, protocol, IDs, order, RNG, and tick model unchanged.
- Seven focused contracts cover source immutability, sibling branches,
  Bouncer RNG/settling, Arrow float32 motion, all seven death kinds, all ten
  projectile-effect kinds, catch-up ranges, delayed birth, and strict lifetime
  edges. The repository-owned replay additionally hashes the complete state and
  order-sensitive JSON while recording every dynamic population and wave phase.
- Three uncontended interleaved Mac pairs ran 62,500 ticks each against exact
  main and the runtime candidate. All six ended with stable hash
  `8c0e14e77c940eb6`, JSON hash `568aade0bc2dbd60:746248`, 54 phase
  transitions, 87 peak live enemies, 363 peak dynamic actors, and identical
  population sums. The paired-median gains were 2.79% wall time, 2.81% mean
  tick, 4.06% p50, and 1.62% p90; the 70-plus-enemy window improved 1.60% mean,
  2.57% p50, and 0.74% p90. P99 remained noise-flat: paired medians improved
  0.51% overall and 0.46% in the crowd window, while paired means changed
  -0.24% and -0.75%. No tail-latency gain is claimed.
- The matched named profile explains the bulk improvement: `stepDeathEffect`
  self samples fell `4,726 -> 3,810` (19.4%) and its population wrapper fell
  `173 -> 83`. One GC sample moved `2,458 -> 2,597`, so no GC improvement is
  claimed. Pre-sized survivor arrays were separately rejected: they were 1.5%
  faster in an isolated step loop but created holey arrays and did not improve
  the full-system paired runs reliably. The provisional requirement above that
  p99 and GC must both materially improve was therefore falsified, not silently
  counted as passed; neither is a parity requirement, and neither showed a
  reliable system regression.
- The exact final commit passed `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac: all 29 backend contracts, 1,720/1,720 Boneyard tests, every other
  registered suite, both production builds, bundle budget, and media policy
  passed. `Game-DG5nKRQx.js` is 264,578 raw / 80,327 gzip bytes. Gate-log
  SHA-256: `e5db808b2340254215067d1fade6ad1dc313691095e99f0c8fb2d83570496f02`.
- Built production Mac Chrome completed two target-specific real-host journeys
  with empty page, failed-response, and wire error arrays. The death journey
  retired a naturally damaged Skeleton, rendered its Bouncer/Unbind handoff,
  left through the real save path, opened Last Game, reconnected, restored the
  same run, and retained all 19 effects live at capture. Receipt SHA-256:
  `02ad2ab7d008bbc1b37ec4b3541eb657297e3f82192621ed87b858560b079a8e`;
  combat frame SHA-256:
  `f5f1ecc1d1e8aabe4c4f90ea37f7da746961ab11e93a80f1a45e94158eec8354`.
  The projectile journey tumbled a real hostile Arrow into effect ID 1 at
  alpha 6, replicated/rendered it, and proved host/wire retirement. Receipt
  SHA-256: `028c79f90b8e9360bd6b1f3e8154f2f85a3cde5f860ad187bce629e7bad27d50`;
  frame SHA-256:
  `1a51f64d491a8483ba897b3bb6d2835d2ec2776c8f87ba0c47cf54fd9ab7e783`.
- Browser diagnosis also found that the general smoke required Lantern
  intensity `0.55..0.75` even though the authoritative signed flicker is
  `0.35..0.75`; production legitimately sampled `0.403342`. The smoke now
  derives both bounds from the native constants. Its independent retired-entry
  movement assertion remains outside this storage reopening, so the new
  death-effect lane skips that check explicitly instead of weakening it or
  claiming the general all-purpose journey passed.
- This receipt is the sole post-validation documentation write. No runtime,
  test, benchmark, build, asset, protocol, or browser byte changed afterward.

## 2026-08-29 — exact fixed-tick hot-path representation closure

### Reported smell and parity question

The accepted persistent object runtime remained dominated by several exact but
representation-heavy operations: frozen death-effect spreads, full-crowd
non-pushing enemy motion, endpoint-triangle full scans, repeated static
clearance scans, sorted point contacts, and unchanged scenery-derived sets.
The parity question is representation-only. Protocol, snapshot/save schema,
100 Hz authority, 20 Hz projection, RNG, actor registration, collision and
target order, strict numeric edges, gameplay output, and teardown are not
reopened.

An initial Mac candidate over base `e7addc2b` supplied useful diagnostic
evidence: three 62,500-tick generated-Arena replays retained all 125 checkpoint
hashes, final stable and order-sensitive JSON hashes, population sums, wave
logs, and geometry hashes. That candidate is not the publication receipt. Code
review found two representation falsifiers that the normal-coordinate replay
could not expose:

- a dense navigation array sized from global coordinate extrema could throw or
  exhaust memory for finite, widely separated mod geometry; it was rejected in
  favor of the collision owner's sparse ordered broadphase plus bounded global
  fallback rows;
- a two-slot strong target-row cache retained prior hostile populations beyond
  run teardown while measuring neutral within noise; the cache and the entire
  spell-combat stage were removed rather than adding lifecycle machinery.

### System boundary and membership inventory

| Member / branch | Disposition | Required invariant |
| --- | --- | --- |
| All seven death-effect kinds | `exact-ported` explicit closed-row clone | Same 28 keys and canonical key order, values, vector identity policy, painter registration, RNG, clocks, opacity/frame equations, and retirement; no unknown field or second transient owner. |
| NavMesh endpoint containment | `exact-ported` sparse triangle lookup | Candidate cells are an exact superset of the epsilon-inclusive test; slivers, large boxes, unsafe coordinates, and out-of-extent points fall back without omission. Ranking remains containment, edge distance, then triangle id. |
| Polygon/circle/segment route clearance | `exact-ported` through the existing collision broadphase | Query the padded segment box, retain original family/source order and dynamic overlays, then run the unchanged pure predicates. All-pairs worlds remain the oracle. |
| Out-of-bounds route endpoints | `verified-already-at-parity` early rejection | This is the first check already performed by every prior endpoint-to-center clearance attempt. |
| Primary point-contact winner | `exact-ported` linear minimum | Lowest cell-binding order wins; strict replacement preserves the stable-sort winner on ties. Eligibility, cell, radius, and strict contact checks are unchanged. |
| Sealed-arena scenery cleanup | `exact-ported` identity-preserving filter | Return the source array only when every row survives; otherwise return the same ordered survivors as `filter`. No consumer mutates the arrays or rows. |
| Gravestone traversal-source set | `exact-ported` weak identity memo | The set contents derive only from the immutable scenery array. Weak ownership cannot retain a retired run. |
| Strong per-store target-row cache | `rejected representation` | Removed: bounded size did not satisfy world teardown and had no reliable performance value. |
| Protocol, saves, snapshots, hashes, tick rates, gameplay and renderer | `verified-already-at-parity` | No field, cadence, branch, or presentation contract changes. |

No member is blocked by the browser platform.

### Validation contract

- Focused oracles must prove the non-pushing mover against the general solver,
  triangle and blocker candidate supersets (including widely separated finite
  geometry), unchanged transient JSON projection, and all existing targeting,
  collision, navigation, combat, pause, save, and teardown contracts.
- Compare pristine current main and the final rebased candidate over the same
  62,500-tick, crowd-70 replay for generated Arena indexes 0, 1, and 2. All 125
  checkpoint hashes, final hashes, population sums, wave logs, and geometry
  hashes must match in each pair.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact final Mac
  candidate.
- Built Mac Chrome must enter a real Random Boneyard and prove authoritative
  tick advance, player/enemy motion, WebGL presentation, and clean page,
  console, failed-response, wire, host, and teardown arrays. Performance is
  reported separately from deterministic parity and may not waive any gate.

### Final implementation and validation receipt

- Runtime commit `29e50528befeb7a4f182fbf33f22fab02b39e7a7` is one focused
  commit over current-main base
  `7fbd6da48d282049f5727eddc41a7fcdf28e6007`. Rebase integration added
  the current 28th death-effect field, `painterRegistration`, in exact
  spawn-key order and corrected the older 27-key test fixture. The submitted
  strong target-row cache was removed completely. Navigation reuses the
  collision owner's sparse ordered grid; both collision and triangle indexes
  retain oversized or unsafe finite boxes as bounded global fallback rows.
- The complete Mac gate exited zero on the exact runtime candidate: all 28
  backend contracts, lint and architecture checks, 1,747/1,747 Boneyard tests,
  every other registered frontend/runtime/desktop suite, both production
  builds, media policy, and bundle budget passed. The Game entry is 264,741
  raw / 80,352 gzip bytes. Gate transcript SHA-256:
  `e9acd3ce32feb4a92d1de39afa3dca5b21333db60b10e4d94409ba8992e9010a`.
- Pristine base and candidate each ran 62,500 ticks with crowd threshold 70 in
  generated Arenas 0/1/2 using seeds `1372610135`, `987654321`, and `42`.
  Every pair retained all 125 checkpoint hashes, final stable and
  order-sensitive JSON hashes, population sums, wave log, peak membership,
  final tick, and geometry SHA-256. Final stable hashes were
  `550975d233ce5053`, `b524f457e7512cff`, and `4e00abd5a5b60365`.
  Mean tick cost changed `0.4983 -> 0.2171`, `0.6658 -> 0.3744`, and
  `0.4346 -> 0.2046` ms (56.4%, 43.8%, and 52.9% lower; equal-Arena mean
  50.2% lower). Arena-0 p99 changed `3.2018 -> 0.8540` ms; Arena-1 p99 was
  noise-flat/slightly higher in this single pair (`7.1580 -> 7.3045`), so no
  universal tail-latency claim is made.
- Built production Mac Chrome completed two real deterministic-host journeys
  with status `ok`. The opening journey crossed the Gate and Solomon sequence,
  rendered WebGL, admitted eleven authored enemies, and observed all eleven
  moving/steering with no outside-combat samples. Page, failed-response, and
  wire error arrays were empty; receipt SHA-256:
  `73781342f1b1adb791a4dc00951fd38c580d6b99187635884079348138be1680`.
  The terminal journey killed a real Skeleton, retired its body, rendered 20
  independent death effects, saved/rejoined, and restored 19 still-live
  effects. Its page, failed-response, and wire error arrays were also empty;
  receipt SHA-256:
  `ff317bdaf7c5154efa3e4a5c0ba873697b882f1cfbf3201fab5bd38ba0bf6a91`.
- No physical iOS device was attached, so this pass makes no fresh
  physical-device claim. No protocol, snapshot, save schema, tick rate,
  gameplay branch, renderer rule, or intentional browser difference changed.

## 2026-08-30 — late-wave client lag and retained death-effect view reopening

### Reported smell and parity question

- A tester was asked to leave and export when play became laggy. The two
  supplied stock-export archives were created at `2026-08-30T03:05:31Z` and
  `03:41:12Z` from the same Ether/Arcane wizard, Soggy, during one long
  two-player survival lineage.
- Stock export is a settled wizard/profile projection: it retains and patches
  the native source attachment but does not serialize the active browser Arena
  object graph. The production save checkpoint immediately preceding the first
  export is therefore the exact replay input.
- The parity question is representation-only: can the browser retain every
  recovered death-effect actor, painter registration, transform, texture,
  shadow, blend, lane, fixed-tick sample, and retirement while allocating and
  traversing only the display resources owned by that actor's actual variant?
  Host tick rate, effect counts/lifetimes, protocol, save bytes, and visible
  output are not reopened.
- Falsifiers are: authoritative tick lag in the reported private session; an
  ordinary Bouncer using Banish gradients/sprites; a death effect whose world
  tint does not bypass Region lighting; lazy view membership changing any
  pixel/painter order; or unchanged exact-state frame cost after removing only
  maximal-variant display ownership.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Tester exports | Windows Downloads `solomon-dark-stock-save-1788059131795.zip`, 28,974 bytes, SHA-256 `6b7c949ed5baeeb96fe09d59ba32213fabc5cd0c47432cb539a3de7c9c1e5eac`; `solomon-dark-stock-save-1788061272587.zip`, 28,986 bytes, SHA-256 `73584ff6c054d3a68aee31c146d1461c3f8a58cacab788bd3cddfdda026246a9` | Both launcher manifests and file hashes pass. They decode Soggy from level 17 to 31 with the same Magic Missile/More Missiles/Smart Missiles and Arcane loadout, but by contract carry no live browser world. | high bytes and identity |
| Production journal | deployed `ebf693b499aeca417ffe84c9ba0d0a305f55dd2a`; private sessions ending at `03:05:24Z` and `03:41:02Z` | Both exits precede their downloads by seconds. The reported private sessions emitted zero `simulation.tick_lag`; the later session emitted `replication.baseline_missing` at `03:38:11Z` and `03:40:40Z`, localizing the complaint to the client/projection side. | high-live |
| Exact durable checkpoint | pre-deployment SQLite backup `pre-6265aadf5525-20260830T025944Z`, Soggy slot revision 1779, document SHA-256 `4a3e40d26fe8bbd5ccbbd1ab9cc50af8803d511500ad08e3c6fc180a2b6d7159`, tick 618,000 | Generated Arena geometry `6a2b230a57042bb103d86b8b6ebdcefd0c3828d87f627a488e0bdd6cb9548c27`, wave 13 threshold: 43 enemies, 16 loot, 5 primary projectiles, 2 primary transients, and exactly 277 world-sorted shadowed Bouncers aged 42..698. | high-live |
| Exact-state Mac host replay | current main, M2 Mac mini Node 22.17.0, 2,000 continued ticks plus owner snapshots | Simulation mean/p99 is `0.600/2.321 ms`; two-owner-equivalent snapshot projection/JSON work is `0.570/1.254 ms` per 20 Hz sample. The state advances 2,000 ticks with no host-budget failure. | high |
| Production-build Mac Chrome replay | exact current-main production bundle, 1600x900 WebGL, same restored document | At native CPU speed, 277..174 effects hold `60.09 FPS` but consume 328 ms browser task time over 1.5 s. At 4x CPU slowdown, the same interval reaches `29.9/44.5 ms` p95/max frames; the continued 115..76-effect interval consumes 4,117 ms of 4.5 s browser time with `20.5/38.7 ms` p95/max. Page, console, response, and request-failure arrays are empty. | high |
| Held-world Mac control | production current main, synthetic lifetime-only extension of the same 277 Bouncer rows, pause after resume grace | A live 277..316-effect interval at 4x CPU uses 3,128 ms browser task time in 3 s and presents 47.63 FPS. Holding 297 effects and 42 enemies behind the authoritative pause uses only 252 ms browser task time in 3 s and presents 60.04 FPS. The pause also suspends the presentation loop, so this localizes the combined live snapshot/presentation pipeline but does not separate wire materialization from drawing. | high differential with named limitation |
| Current browser source | `native-enemy-death-effect-view.ts`, `native-enemy-death-effect-presentation.ts`, `boneyard-world-renderer.ts` at `ebf693b4` | Every view eagerly creates an effect sprite, shadow sprite, Banish `Graphics`, four Banish sprites, and a container. Every non-Banish frame still calls `clearBanish()`, hides four sprites, destroys gradients, and clears Graphics. The exact 277-Bouncer checkpoint therefore retains 1,385 unused display children and executes 277 irrelevant Graphics clears per presented frame. | high |
| Snapshot-to-UI causal trace | `EntityReplicationReconstructor`, `BoneyardScene`, `GameHud`, `NativeLootMessagePresentation` at `ebf693b4` | Each 20 Hz entity frame necessarily reconstructs current death-effect samples. Separately, ordinary active play publishes a fresh but semantically unchanged `run` object and a new empty loot-message array into parent React state; moving/pushed player position also republishes the entire Boneyard scene solely to keep a closed inventory action coordinate current. | high |
| Camera-membership census | revision-1779 checkpoint, saved local-player position, 1600x900 native frame at zoom 1.35 | Root-only conservative counts place 101 effects inside the exact camera rectangle, 118 inside +50 units, 144 inside +100, and 177 inside +200; at least 100 of 277 actors are far enough away that even a broad placeholder margin excludes them. Final admission must use complete transformed authored art, not these diagnostic root margins. | high population; diagnostic geometry only |
| Existing exact visibility contract | ledger entry 039; `boneyardVisibleWorldBounds`, `boneyardResidentIsVisible`, `boneyardTransformedArtBounds`; native atlas records | Browser renderability may exclude a resident only when its complete transformed painted rectangle, with the 32-world-unit interpolation guard, cannot touch the view. State, painter membership, depth, and re-entry update remain live. The earlier entry deferred dynamic actors because static art owned the then-measured cost; it did not prove dynamic off-camera pixels must be submitted. | high |
| Existing retail contract | canonical retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; recovered transient membership and painter/lifetime evidence in this entry | The 13 death-effect variants are independent registered actors. Bouncer sprite/shadow state and Banish gradient/four-sprite state are different variant memberships; stock does not construct the maximum union for each actor. | high |

The exported and recovered raw saves remain external task evidence. No bearer,
party-rejoin capability, credential, or account secret is a ledger artifact.

### System boundary and membership inventory

Native/web system: retained client presentation for all replicated hostile
death-effect actors, from descriptor birth through interpolated update,
lighting/painter submission, diagnostics, retirement, run replacement, and
renderer teardown.

| Member / branch | Disposition | Required invariant |
| --- | --- | --- |
| `banish` | `exact-ported` lazy heavy variant | Own six changing gradients in one Graphics plus four authored additive sprites; clear/destroy only resources this variant created. |
| `bouncer`, `smoky-bouncer` | `exact-ported` compact sprite variant | Own main sprite and authored shadow only; no Banish Graphics/sprites/gradients. |
| `fade`, `fade-additive`, `fade-perspective`, `fade-perspective-clipped`, `fade-scale`, `fire-array`, `late-splat`, `move-fade`, `sprite-array`, `unbind` | `exact-ported` compact sprite variant | Preserve atlas/entry, anchor, position/height, perspective scale, rotation, alpha, blend, tint, and optional shadow without Banish resources. |
| Shadow true/false | `exact-ported` conditional child ownership | A shadowed actor owns one shadow sprite; an unshadowed actor does not retain an invisible placeholder. |
| `world-sorted`, `pre-world-queue`, `direct-post-world` lanes | `verified-already-at-parity` | Stable painter registration, world-Y sorting, queue placement, foreground offset, and teardown remain byte-equivalent. |
| Dynamic effect camera visibility | `exact-ported` guarded visual traversal | Union main sprite, optional shadow, and Banish gradient/sprite transformed bounds; retain registration/state while fully offscreen, omit the invisible row from that frame's painter traversal, and restore the complete current sample/depth before the first entering frame. |
| Region-light tint pass | `exact-ported` no-op representation | All current death effects bypass world tint; no light-index query or per-view tint write may run for this population. |
| Keyed descriptor birth/update/retirement | `exact-ported` | One view per semantic ID, stable kind, interpolated sample updates, survivor order, immediate retirement, and complete destroy remain exact. |
| 20 Hz descriptor/sample reconstruction | `verified-already-at-parity`; profiled | Protocol fields, quantization, baseline ACK/recovery, IDs, order, and retirement stay unchanged. |
| Active-run UI lifecycle projection | `exact-ported` identity-stable publication | Active run, null Tutorial, and empty loot-message state retain their React identity until a semantic member changes; Game Over counters and real loot messages still publish at their native cadence. |
| Current player position for inventory actions | `exact-ported` ref-owned live coordinate | Ordinary movement updates one ref without rerendering the scene; opening Inventory snapshots the current coordinate, after which authoritative pause keeps it stable for item actions. |
| HUD mana/cooldown/health and ally rows | `verified-already-at-parity` | Their focused subscriptions remain live at snapshot cadence; this pass does not freeze a changing meter or lower HUD update frequency. |
| Per-frame diagnostic samples | `exact-ported` retained scratch representation | Local acceptance visibility remains complete, but stable rows/arrays are reused rather than allocating one object graph per frame. |
| Pause, SkillPicker, save/resume, Game Over, new run, context loss, renderer teardown | `exact-ported` lifecycle | Frozen views render unchanged; every owned sprite/Graphics/gradient is destroyed once and no prior-run child survives. |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- The host owns actor birth, fixed-tick state, RNG, lifetime, and retirement.
  Replication owns descriptors/samples; the presentation timeline interpolates
  them without inventing actors.
- The Boneyard React owner consumes snapshots only for semantic UI state. A
  decoded object having a new identity is not itself a UI transition. Active
  run fields, empty loot visuals, and a closed inventory's action coordinate
  must not rerender the complete scene merely because another snapshot arrived.
- The retained browser map owns exactly one variant view for each live ID.
  Variant identity is stable for that ID. An ordinary actor never transitions
  into `banish`; retirement and a new ID own later births.
- Main sprite, optional shadow, Banish Graphics/four sprites, and gradients are
  lateral variant resources, not mandatory base-class children. Lazy creation
  changes browser representation only.
- All death-effect variants bypass Region tint in the recovered native model.
  Their existing light-index loop computes a value that the view immediately
  discards; removing that loop preserves pixels.
- Dynamic painter order remains authoritative because Bouncers move in Y.
  This pass may reuse scratch rows/maps and toggle only Pixi renderability when
  the complete transformed art misses the guarded view. An invisible row may
  be omitted from that frame's painter traversal because it has no proxy,
  light, collision, or visible insertion; its native registration and state
  remain live. The pass may not retire the actor, cache a stale visible order,
  lower update rate, shorten lifetime, coalesce actors, or reduce effect
  membership. A culled view receives its complete current sample and painter
  depth before the first entering frame.
- Descriptor retirement, run replacement, Game Over, and renderer destroy own
  complete resource teardown, including lazily created gradients.

### Nearby-system findings

- The later private run fell behind replication twice without host tick lag,
  making baseline loss a downstream client-saturation signal rather than a
  reason to enlarge the baseline window first. The held-world control alone
  does not decide how that saturation divides between decode and render.
- After the second export, multiple resume attempts were rejected because an
  enemy projectile sample had `visualScale` outside `[1,1.25]`. That is a
  separate projectile projection/admission defect, not a death-effect lag
  explanation; its exact saved producer state was overwritten before the next
  database backup. It remains recorded here so a resume fix is not mistaken
  for this performance closure.

### Adjacent hostile-projectile resume admission correction

The second export made the adjacent mismatch directly observable. Between
`03:41:18Z` and `03:43:01Z`, six new private-session resume attempts
disconnected immediately with
`snapshot.world.enemyProjectiles[1].visualScale must be within [1,1.25]`.
The durable checkpoint containing that exact projectile was overwritten before
the next database backup, but no value guess is required: current authoritative
producers and the existing native projectile evidence fully determine every
reachable range.

| Projectile member | Authoritative producer range | Disposition |
| --- | --- | --- |
| Arrow normal/fire/poison | opacity lane starts at `5`, remains positive while live, and subtracts float32 `0.05` after landing; the last live value is about `0.049999`, and the next negative result retires before projection | `exact-ported` kind-specific `(0,5]` admission |
| Firebolt | fixed visual scalar `1` | `verified-already-at-parity` exact-one admission |
| Guided Missile cold/poison | constructor `0.9 + unit*0.2`, quantized at `1/1024` | `exact-ported` `[0.9,1.1]` admission |
| Demon Bomb | fixed visual scalar `1`; bounce/ground animation uses separate speed/height lanes | `verified-already-at-parity` exact-one admission |
| Poison Pool | starts `1`, grows `0.025` per tick, caps at `1.6` | `exact-ported` `[1,1.6]` admission |
| Entity sample quantization | nonnegative integer at scale 1024; Arrow's final live value quantizes to `51`, then the next nonpositive authoritative value retires without projection | `exact-ported` representation edge; zero is not a live Arrow sample |
| Save restore, keyframe, delta frame, and ordinary live frame | same `boneyardEnemyProjectileSnapshot` validator | `exact-ported` one shared kind-aware gate; no resume-only exception or compatibility bypass |

The current generic `[1,1.25]` check rejects ordinary stock-derived Arrow and
Poison Pool state. Replace it with one closed kind-aware predicate used by
every decode path. Focused tests must cover all endpoints, interior values,
neighboring invalid values, entity round-trip, and a mixed projectile snapshot
that previously disconnected. Protocol fields, quantization, visuals, and
authoritative producers remain unchanged.

### Web implementation consequence

- Deepen `NativeEnemyDeathEffectViews` into variant-owned retained resources:
  compact sprite/shadow views for twelve kinds and Banish-only Graphics/four
  sprites/gradients for `banish`.
- Remove non-Banish `clearBanish()` work and the unconditional death-effect
  Region-light loop. Publish parent React state only for semantic run, loot,
  Tutorial, inventory, and interaction changes; keep the current movement
  coordinate in the scene-owned ref until Inventory opens. Reuse diagnostic
  rows/arrays without weakening their complete local acceptance contract.
- Extend the existing exact transformed-AABB visibility owner to death effects.
  Main art, shadow, and all Banish children form one union; protocol/state/view
  identity remains complete, while only visible rows enter the frame-local
  painter traversal and Pixi render collection.
- Preserve the existing pure presentation plan as the visual oracle. Do not
  change host state, lifetime, protocol, save schema, painter law, visible
  effects, or add a quality/count/device threshold.

### Validation contract

- Focused red/green coverage must enumerate all 13 kinds, both shadow branches,
  all three painter owners, kind-stable updates, ID retirement/rebirth, Banish
  gradient cleanup, run replacement, and renderer teardown. It must assert
  exact presentation plans and exact owned display-child counts.
- Re-run the restored revision-1779 state on the Mac at native and 4x CPU, with
  matching effect-count windows. Acceptance requires identical rendered
  membership/painter samples, clean diagnostics, materially lower task time and
  frame tails, and no host/state-hash change.
- Run the 62,500-tick three-Arena deterministic replay, the complete Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate, and a built Chrome
  natural death/resume/retirement journey on the exact candidate.

### Implementation validation receipt

- The browser owner now constructs only the actual retained variant: Banish
  owns one Graphics and four sprites; the other twelve kinds own one main
  sprite plus only an authored shadow. Non-Banish views never clear Banish
  Graphics, and all death effects skip the provably discarded Region-tint
  lookup. Complete transformed main/shadow/Banish bounds use the existing
  32-world-unit guard; offscreen actors retain IDs, state, registration,
  diagnostics, and teardown while staying out of frame-local painter/Pixi
  traversal. Entering actors apply their current full sample before rendering.
- Ordinary active snapshots no longer republish identity-only run/empty-loot
  state or moving player position through the complete Boneyard React owner.
  Inventory snapshots the live ref when it opens. HUD meters, cooldowns,
  Tutorial, real loot messages, Game Over, and ally subscriptions retain their
  existing cadence. Renderer diagnostic arrays retain complete membership but
  reuse rows rather than rebuilding object graphs every frame.
- The shared full/compact hostile-projectile validator now owns the complete
  five-kind ranges: Arrow `(0,5]`, Firebolt exactly `1`, Guided Missile `[0.9,1.1]`, Demon Bomb
  exactly `1`, and Poison Pool `[1,1.6]`. This closes the six observed
  post-export resume disconnects without a resume-only bypass or protocol
  field change.
- Focused Mac red/green coverage passes across all 13 death-effect variants,
  both shadow branches, Banish bounds/resources, guarded visibility, semantic
  run/empty-loot identity, complete diagnostics, and every hostile projectile
  endpoint/neighboring rejection.
- Three matched 4x-CPU production-Chrome pairs held the same `277..316`
  death-effect stress population and ended at 315 actors, of which 181 were
  proven offscreen and 134 visible. Median FPS changed `45.50 -> 55.37`
  (`+21.7%`); browser task time `3260.99 -> 2973.58 ms` (`-8.8%`);
  script time `2761.29 -> 2456.91 ms` (`-11.0%`); p95 frame time
  `33.9 -> 25.7 ms` (`-24.2%`); p99 `63.0 -> 51.9 ms` (`-17.6%`); and
  maximum frame `80.9 -> 69.8 ms` (`-13.7%`). Baseline emitted two long
  tasks across the three samples; the candidate emitted none.
- The untouched revision-1779 continuation resumes in the built candidate at
  native CPU speed with WebGL, 41 enemies, and the complete live effect state.
  The inspected final frame retained Bouncer debris/shadows, Region darkness,
  player lighting, Magic Shield, and HUD while reporting `115 total / 56
  visible / 59 culled` death effects. Page, console, HTTP, and request-failure
  arrays were empty; inspected frame SHA-256 is
  `8194eb3763ea24398967ee85d1688b349427e8cac8cb5efb922ec772cb87d18b`.
- Base/candidate 62,500-tick replays match every 500-tick checkpoint, final
  state/JSON hash, geometry, wave log, population sum, and peak in generated
  Arenas 0/1/2. Complete parity digests are respectively
  `64d12918d8e120030740ad1fe7a45d363ab9fbe224b1dca5310bfb8ea149f3e4`,
  `7d49a4b97c051b02489cd9918416e67d3ef1226f9c1a8837ba2c23437013971a`,
  and `f603fcb47645679d277feda08fab7173cfc7b692c0181768be64831c668be4e9`.
- The exact byte-identical Mac candidate passed the clean canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` retry: all 28 backend/Website
  contracts, formatting, lint/architecture/generated checks, all 1,766
  Boneyard/runtime tests, every remaining registered suite, production
  frontend/game-host builds, bundle budget, and media policy. The production
  Game entry is 266,211 raw / 80,879 gzip bytes. The first full run had one
  unrelated 30-ms observer-drain timing miss at `1765/1766`; its exact test
  passed 3/3 alone and the uncontended canonical retry passed completely.
- No platform block or intentional visible difference remains. No commit,
  push, release, deployment, or production restart was performed.

## 2026-08-30 — frame-local Region painter workspace reopening

### Reported smell and parity question

- After the late-wave client fix, the remaining ECS question is whether the
  Hub Student dense-slot model should also replace authoritative Boneyard
  populations. The 2026-08-29 storage falsifiers already answer that boundary:
  Student state mutates inside one live owner, while a Boneyard enemy store is
  a persistent value that may feed multiple legal damage branches.
- The browser Region painter queue has the opposite ownership shape. It is
  rebuilt, consumed, and discarded inside one presentation frame; no save,
  protocol, simulation branch, or later frame may observe it as authority.
  Reusing its queue buckets and positioned rows is therefore the safe
  ECS-shaped seam.
- The parity question is representation-only: can one retained planner emit
  the same manager-registration order, Region rows, insertion causality,
  visibility filtering, static bands, dynamic depths, proxy depths, and
  foreground edge without allocating a second short-lived queue graph on every
  frame?

### Evidence, boundary, and consequence

| Evidence class | Exact source | Observation | Confidence / consequence |
| --- | --- | --- | --- |
| Prior authoritative storage falsifier | preceding 2026-08-29 section | Mutable Boneyard transient buffers contaminated a sibling Mage-shield damage branch; immutable dense materialization regressed the Mac benchmark. | high; do not introduce authoritative ECS, COW, a typed mirror, or a compatibility path. |
| Student ownership comparison | `hub-student-store.ts` and Hub simulation owner | Student slots are stable mutable SoA state with detached projection/clone boundaries. They are not persistent sibling-branch values. | high; the Student representation is not transferable to the combat store. |
| Current late-wave browser profile | revision-1779 candidate, 4x CPU production Chrome | Region painter planning remains a named frame cost after death-effect view/camera cleanup, but host simulation remains inside budget with no production tick-lag event. | high; optimize presentation scratch, not the 100 Hz authority. |
| Representative Mac microbenchmark | M2 Mac mini Node 22.17.0; 180 visible static rows, 43 enemies, 134 visible death effects; 10,000 builds after warmup | The current pure Boneyard planner costs `178.6..187.3 us/frame`; its prebuilt generic Region queue owns most of that cost at `138.6..191.9 us/frame`. | high diagnostic; retained Region scratch has a bounded sub-millisecond opportunity, not a claim that it caused the original lag. |

Native/web system: frame-local browser painter planning from already projected
static/dynamic descriptors through immediate Pixi depth assignment and live
diagnostics. Authoritative world state, actor membership, registration
allocation, interpolation, art, lighting, collision, replication, saves, and
teardown are outside this representation change.

The retained planner owns reusable gathered-entry slots, row buckets,
duplicate-validation sets, positioned rows, static bands, and dynamic/proxy
result arrays. A build result is valid until that same planner's next build;
the existing pure builder remains a detached immutable-value interface for
editor/tests and other persistent consumers. Failed validation must not poison
the next frame. No row cache may skip a build, because moving actors and the
reference player can cross native two-unit row boundaries independently.

### Validation contract

- Red/green tests compare retained and pure planners across all manager lanes,
  same/future-row insertions, invisible roots, dynamic proxies, static bands,
  duplicate registrations, backwards insertions, a failed-then-valid reuse,
  and consecutive frames with changed rows/membership.
- Benchmark the same representative population on the Mac before/after using
  the production retained entry point. Accept only a repeatable reduction with
  identical ordered rows and a smaller allocation/GC surface; reject a
  convert-then-materialize layer.
- Re-run the complete Mac validation gate and the restored revision-1779 built
  Chrome journey. The prior three-Arena authoritative hashes remain valid
  because no host file or input changes; any host diff reopens that proof.

### Implementation validation receipt

- `NativeRegionPainterOrderPlanner` now retains gathered-entry slots, row
  buckets, lane-registration maps, positioned rows, and its result array.
  `BoneyardPainterOrderPlanner` retains the static/dynamic adapter entries,
  bands, dynamic/proxy rows, stable static IDs, and scenery registrations.
  The renderer owns one planner for its lifetime and projects primary spell,
  secondary ability, and death-weapon painter rows once per frame for both
  lighting and depth consumers. The detached pure builders remain unchanged at
  their call boundary and freeze their persistent ordered rows.
- A fixed-seed Mac differential compared the untouched `ebf693b4` builders
  against the candidate over 5,000 valid randomized worlds plus duplicate
  registration, backwards-insertion, and duplicate-ID failures. All manager
  lanes, visibility branches, static proxies, and nested dynamic insertions
  matched exactly, including error text.
- The paired M2 Mac benchmark used the same 180 static / 43 enemy / 134 visible
  death-effect population, 15,000 warmups, nine alternating 7,500-frame
  samples, and explicit between-sample GC. Untouched median planner time was
  `175.687 us/frame` (`174.310..176.669`); the production retained entry point
  was `127.334 us/frame` (`127.147..127.881`), a `27.52%` median reduction.
  This removes about `48 us` at native speed or `0.19 ms` under the 4x stress
  throttle; it is an additional bounded gain, not the primary lag fix.
- The exact revision-1779 document SHA-256
  `4a3e40d26fe8bbd5ccbbd1ab9cc50af8803d511500ad08e3c6fc180a2b6d7159`
  resumed through a private College against the just-built production assets.
  After resume grace the WebGL frame held 42 enemies, 95 death effects (53
  visible), and 196 painter rows at tick 618126 while reporting 60 FPS. Page,
  console, HTTP, and request-failure arrays were empty; the inspected frame
  SHA-256 is
  `cb3eca90f09cb60b80bb7a0f2c18188a37710fc61894d6d7e33f74e2fbd7bece`.
- The exact candidate passed the pinned clean Mac validation gate on Node
  22.17.0, npm 10.9.2, and .NET 10.0.302: all 28 backend/Website contracts,
  formatting, lint/architecture/generated checks, all 1,769 Boneyard/runtime
  tests, every remaining registered suite, production frontend/game-host
  builds, bundle budget, and media policy. The production Game entry is
  266,211 raw / 80,884 gzip bytes. This is the exact tree rebased over
  schema-23/protocol-110 main; the original schema-22 revision-1779 checkpoint
  migrated and resumed cleanly through that current boundary.
- No new host file changed during this reopening, so the preceding three-Arena
  62,500-tick state digests remain the authoritative simulation proof. No
  alternate ECS, fallback planner, feature flag, threshold, quality reduction,
  protocol field, save field, or intentional visual difference was added.

## 2026-08-30 — Arrow draw-angle interpolation correction

### Reported smell and falsifiers

- Normal Archer arrows visibly rotate away from their direction of travel;
  poison-arrow tracking can look disjointed. Fire and poison payload art is
  already part of the same Arrow owner, so this reopening covers all three
  payloads rather than adding a normal-only renderer adjustment.
- Falsifiers checked before implementation: a fixed atlas-orientation offset,
  opposite Pixi/native rotation signs, a renderer-local body rotation, linear
  rather than cyclic interpolation in stock, a different update order, a
  non-unit Puppet time scalar, or the Arrow sharing GuidedMissile's 720-degree
  presentation phase.

### Fresh native and web evidence

| Evidence | Exact source | Observation | Consequence |
| --- | --- | --- | --- |
| Arrow constructor and base time scalar | `0x005E1000`, base `0x006287D0` | `+0x120` is initialized to `1`; Arrow starts `+0x168=20`, height `+0x16C=-25`, opacity `+0x174=5`. Archer volley replaces the orientation countdown. | Existing fixed-tick decrement, height, and opacity ownership stays authoritative. |
| Arrow tick | `0x005FEA00`, raw `0x005FED25..0x005FEEA5` | The tick decrements `+0x168` by `+0x120`; while airborne it adds `.75` height, damps planar velocity by float `.9900000095367432`, and computes `atan2(originalX, -(originalY + (-25/height)*launchMagnitude*.25))`. The result is converted to degrees and normalized into `[0,360)`. | Correct the web pitch factor from `.5` to `.25`; retain travel heading, original launch speed, and draw angle as separate lanes. |
| Arrow draw and transform | `0x0060F590 -> Text_Draw 0x00415130 -> 0x00403120`; BadGuys record 2 | Draw passes `+0x170` directly at scale `1.25`. The transform helper internally applies the native screen-space sign; record 2 points upward at zero. There is no hidden 90/180-degree body correction. Fire alone adds 180 degrees to its overlay. | Keep the shared Arrow body rotation equal to the authoritative draw angle; do not patch the sprite or payload renderer. |
| Website host and client | `boneyard-enemy-store.ts`; `boneyard-presentation-timeline.ts` | Host used the right formula and update order except for the doubled `.5` pitch factor. Client interpolated every `visualPhaseDeg` on a 720-degree cycle, inherited from GuidedMissile; Arrow's `[0,360)` angles therefore take the long 340-degree route across `350 -> 10`. | Give Arrow a 360-degree interpolation cycle while preserving GuidedMissile's complete 720-degree aura phase. |

This is one authoritative Arrow presentation system. Normal, fire, and poison
share body record 2, `+0x170`, fixed-tick pitch, protocol field, interpolation,
and painter view. Payload differences remain limited to the already recovered
fire/poison overlay banks and contact effects. No host targeting, projectile
travel, collision, lifetime, protocol shape, atlas registration, or render
order changes.

### Validation contract

- A host regression must pin the `.25` pitch factor at an exact non-cardinal
  flight sample and retain the native landing/countdown branches.
- A client regression must prove Arrow `350 -> 10` takes the 20-degree route
  while GuidedMissile retains its 720-degree phase interpolation.
- Focused tests run red then green on the Mac mini. The final rebased tree must
  pass the complete Mac validation gate and a built WebGL browser journey that
  exercises normal, fire, and poison Arrow travel plus the already reopened
  Skeleton-family and Imp presentation membership.

## 2026-08-31 — Wraith flyby movement and contact-Dazzle correction

### Reported smell and parity question

- Reported web behavior: Wraiths move at approximately ordinary walking speed
  instead of flying rapidly in loops around the screen. Contact has no obvious
  result.
- Stock behavior to recover: the complete Wraith-specific construction,
  post-config speed initialization, two-substep flight vector, target flyby,
  speed/turn decay, strict contact, Dazzle, wisp, target-loss, collision,
  pause, save, death, and teardown lifecycle.
- Reproduction surfaces: a stationary and a moving player; initial flight;
  strict center-distance contact at 40 units; repeated overlap during the
  50-tick contact cooldown; target loss/reacquisition; a blocked Arena path;
  normal, Fast/Slow/Burning recipe scalars; save/restore; multiplayer
  projection and renderer interpolation.
- Falsifiers: an ordinary shared chase vector in Wraith vtable slot `+0x6C`;
  a native 200..800-tick pre-contact orbit wait; a staged drain action before
  damage; body-radius contact instead of a strict 40-unit center test; a
  constant player slow; or a renderer-only speed defect.

This is a second report against the Wraith row closed near the top of this
file. The earlier pass violated the complete-owner rule: it named
`0x00486C30` and `0x00478EA0` but did not recover either function's fields,
constants, transition order, or post-config initializer `0x00486BB0`. It then
called a bounded four-phase web invention `exact-ported`. The later dense-store
inventory repeated that unsupported disposition. Both claims are reopened and
superseded by this section.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | original stock and Website comparison, 2026-08-31 | Stock Wraiths fly quickly in a circular screen pattern and slow the player on collision; Website Wraiths appear to walk and contact is unclear. | high direct comparative observation |
| Retail image | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same retail 0.72.5 image as the accepted enemy ledger. | high |
| Factory/constructor instructions | factory `0x005B7080`; `Wraith::Wraith 0x00474470`; recipe apply `0x00462790`; post-config init `0x00486BB0` | Type `1007` allocates `0x234` bytes and installs vtable `0x00785FAC`. After recipe chase is applied, `baseFlybySpeed = chase * 0.8`; retained low speed is `base * Float(10)`; initial speed is `base * 25 * (1 + Float(2))`. The inherited body radius is exact `15 * recipeScale`, not the web bound 20. | high instruction-derived |
| Tick instructions | `Wraith::Tick 0x00486C30`, raw `0x00486C30..0x004871E7` | The tick owns bearing, flight/countdown decay, strict contact, damage/Dazzle, flyby reset, wisp emission, and body visibility. Contact is squared center distance `< 1600`; eligible contact creates `Mod_Dazzle 0x1B6E` with duration 50, while every overlapping tick resets the flight clocks. | high instruction-derived |
| Movement instructions and vtable | special vector `0x00478EA0`; Wraith vtable `+0x6C = 0x00478EA0`, `+0x70 = 0x00476B90`, `+0x74 = 0x00483D40`; common motion `0x004835F0`; movement wrapper `0x00475FE0`; executor `0x00525800` | Each normal motion epoch builds two special vectors. While flyby time remains, the goal is `target + unit(actor-to-target bearing) * 300`; otherwise it is the target. The special vector does not invoke the inherited NavMesh slot. It advances heading by `pathTurnFactor * currentTurnGain * status * signedHeadingDelta`, then returns `unit(heading) * pathSpeedFactor * currentSpeed * status * 0.25`. Wraith tick clears Arena `+0x498/+0x499`; those are movement-controller `+0x120/+0x121` through the embedded `+0x378` owner, selecting `0x00525800`'s direct-position branch instead of static/dynamic collision. | high instruction-derived |
| Constants | `.rdata` values at `0x00784818=.8`, `0x007DE960=25`, `0x007858F8=300`, `0x00786968=1600`, `0x007847C8=50`, `0x00784D08=2`, `0x007847B0=.025`, `0x007DE860=1.5`, `0x007852D0=7`, `0x007DE970=5` | Every material speed, geometry, cooldown, and turn value is directly extractable. | high bytes/instructions |
| Modifier instructions and current web consumer | `Mod_Dazzle 0x00623490`, reset/apply `0x00625680`; `boneyard-enemy-modifiers.ts`, `player-combat.ts` | Dazzle recovers from `1/50` to one across 50 ticks and multiplies the fresh player movement scalar. The existing player-side recovery formula is already exact; the defect is Wraith contact timing/production. | high |
| Current Website trace | base `41e15254`; `boneyard-enemy-store.ts`, `boneyard-enemy-config.ts`, `project-boneyard-enemies.ts` | Web uses collision radius 20, ordinary speed one, generic routed steering, a 52-unit reach, 200..800 ticks of slow tangent motion before a fabricated drain marker, and only then damage/Dazzle. It cannot produce stock initial displacement or immediate contact. | high |

Ghidra ran read-only through the canonical replica wrapper from the existing
Mod Loader checkout at revision `08bfba9e` (dirty documentation was not read or
modified). Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
the decompile, instruction, float, and vtable script hashes are respectively
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`,
`925d7d6f1655937180655da8767b518d904a743d0a3bad4597c9d31b0d50b15a`,
and `f7cef37b59004d2d1571a8cff2ef8ecf9d77ee6575450262c6cdcf26052e13ea`.

### System boundary and membership inventory

Native system: Wraith type `1007` from construction through authoritative
flight/contact, presentation outputs, persistence, and teardown. The five
retail schedule rows are all flag-free Wraith entries; custom authored recipes
also reach the shared Fast/Slow/Burning chase transforms.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Factory, constructor, recipe chase, inherited radius | `0x005B7080`, `0x00474470`, `0x00462790`, base `0x006287D0` | `exact-ported` | type/size, radius 15, recipe-scale and chase variants |
| Post-config initial speed/turn/random state | `0x00486BB0` | `exact-ported` | draw order and endpoint tests for retained speed `base*[0,10)`, initial speed `base*[25,75)`, initial 200..800 flyby ticks |
| No-target flight | `0x00478EA0` | `exact-ported` | deterministic far goal at actor tick/id heading times 225, 10,000-unit projection, state retained through target loss |
| Direct-target approach after flyby expiry | `0x00478EA0` | `exact-ported` | two sequential heading/vector substeps and exact speed/turn factors |
| 300-unit cross-target flyby | `0x00478EA0`, target bearing writer in `0x00486C30` | `exact-ported` | stationary/moving target traces form a curved pass and do not use tangent walk |
| Flyby, cooldown, speed, and turn decay | `0x00486D14..0x00486E08` | `exact-ported` | strict order for 50 cooldown, 200..800 flight, `-1`, `-.025`, `+/-2`, floor 1.5 |
| Strict contact and repeat-overlap reset | `0x00486E3A..0x0048704C` | `exact-ported` | 39.999 accepted, 40 rejected; damage once per eligible cooldown; every overlap resets speed/flyby/turn |
| Four damage plus 50-tick player Dazzle ramp | `0x00486EC9..0x00486FE9`, `0x00623490`, `0x00625680` | Wraith producer `exact-ported`; player consumer `verified-already-at-parity` | immediate semantic damage, first movement scale `1/50`, complete recovery, no re-hit before cooldown |
| Burning and cooldown Soul wisps; opaque facing body | `0x00487052..0x00487177`, renderer `0x00496220`, BadGuys 21 and 2070..2087 | `exact-ported` | one-in-four idle emission or every cooldown tick; body remains opaque and frame-free |
| Inherited route vslot | vtable `+0x74 = 0x00483D40`; special `+0x6C = 0x00478EA0` | `out-of-system` for the Wraith special vector: the override does not call the route slot | blocked-goal test proves neither LOS nor NavMesh is consulted |
| Collision-gated direct flight and actor registration | Wraith `0x00486E08..0x00486E34`; wrapper `0x00475FE0`; executor `0x00525800` direct branch | `exact-ported` | no static/player/enemy collision callback; direct summed delta; radius 15 remains query/body metadata; cell binding still follows final root |
| Target loss/reacquisition, temporary control, pause | `0x00483480`, `0x00625680`, Arena tick ownership | `exact-ported` | no fabricated phase reset; status scales special vector; paused tick holds all clocks/RNG |
| Death, reward, fragments, audio, retirement | `0x00495600` and previously closed Wraith terminal rows | `verified-already-at-parity` | existing terminal actor/audio/lifetime suites remain unchanged |
| Host projection, 20 Hz replication, interpolation, late join | existing enemy descriptor/sample lane | `exact-ported` through corrected authoritative position/action sample; no wire-shape change | displacement/action-wisp samples, baseline/late-join, no client inference |
| Browser save, old-save migration, restored active run | Website save document | `exact-ported` for new state; deterministic migration from the superseded web brain | schema bump, old/new save restore, current flight state survives round trip |
| Five flag-free retail Wraith rows | `native-retail-wave-schedule.ts` extracted schedule rows | `exact-ported` through the one Wraith factory | schedule census plus real authored-wave browser witness |
| Fast, Slow, and Burning custom recipe branches | shared config flag transforms plus Wraith `FLAMING` branch | `exact-ported` | chase-derived flight endpoints and wisp membership per branch |

No member is blocked by the browser platform. The browser host can represent
the exact floats, fixed clocks, RNG, contact geometry, collision bypass, and
authoritative position stream. The Website's collision primitive adapter is
not entered by native Wraith flight.

### Native ownership thread and recovered behavioral contract

- Factory construction installs Wraith-specific state. Recipe application
  first multiplies the ordinary chase field; virtual start `0x00486BB0` then
  derives the retained base, low, and initial high speeds from that evaluated
  value. Speed is not a renderer scalar and recipe scale is not part of the
  special movement magnitude.
- The tick recomputes actor-to-target bearing. A live 200..800 flyby countdown
  selects a point 300 units beyond the target on that bearing, making the
  limited-turn high-speed actor repeatedly overshoot into curved screen-wide
  passes. Countdown expiry returns the goal to the target; there is no tangent
  orbit phase and no drain action clock.
- One normal movement epoch owns two sequential substeps. Each substep turns,
  emits `0.25 * pathSpeed * currentSpeed * status`, and updates heading before
  the next. Wraith temporarily clears both movement-controller collision gates,
  so `PlayerActor_MoveStep` commits the combined delta directly. The inherited
  route slot remains present in the vtable but is not called by the special
  vector. Cell binding is refreshed from the committed root afterward.
- Contact is a strict center-distance test independent of body collision radius.
  At cooldown zero it applies ordinary Wraith damage and attaches 50-tick
  Dazzle. Whether eligible for damage or still cooling down, overlap resets
  cooldown to 50, speed to `base*50`, flyby to `200+Integer(601)`, current turn
  to one, and target turn to `7+Float(5)`. This forces continued flight instead
  of parking on the player.
- While cooling down, Dazzle is not reapplied. The player modifier recovers its
  movement multiplier by `1/50` per tick. Burning Wraiths emit record-21 wisps
  on the ordinary one-in-four roll and every cooldown tick; the body remains
  the same opaque 18-facing record.
- Target loss selects the deterministic no-target far goal without destroying
  Wraith flight state. Pause holds it. Death and run teardown destroy it with
  the actor. Multiplayer clients receive positions and presentation state only;
  they never run contact or steering.

### Nearby-system findings

- The exact inherited Wraith collision radius is 15 before recipe scale. The
  older 20-unit bound is refuted for every target, spell, Staff, dynamic-body,
  and save consumer and must be replaced in one pass.
- The prior Wraith `exact-ported` route disposition is false: vtable presence
  does not prove a caller. `0x00478EA0` constructs its own goal and never calls
  inherited `+0x74`. Future membership audits must trace the selected virtual,
  not stop at a vtable census.
- Existing player Dazzle behavior is correct. The ambiguous collision report is
  explained by the web's delayed producer, not a missing player multiplier or
  client visual effect.

### Confidence and open questions

- Confirmed: factory membership, constructor/start draw domains, every material
  movement/contact constant, field transition order, strict comparisons,
  Dazzle duration/ramp, Wraith vtable slots, renderer body membership, and
  current Website causal violation.
- Inferred: none material. Semantic IDs replace native pointers under the
  already accepted host-authority adapter.
- Unknown: none inside this boundary. A fresh stock trajectory capture is useful
  comparative acceptance evidence but is not needed to choose a constant or
  branch; all implementation inputs are instruction-derived.

### Web implementation consequence

- Add one cohesive native Wraith flight kernel and make the authoritative enemy
  store own its complete retained state. Remove the bounded `orbit/drain`
  action program and the 52-unit attack reach.
- Replace the Wraith radius bound 20 with inherited native 15 everywhere.
  Preserve ordinary path factors/status composition and cell rebinding, while
  bypassing both NavMesh goal substitution and static/dynamic movement
  collision for the special vector.
- Emit damage/Dazzle immediately on strict contact and expose cooldown progress
  only as presentation input for the already recovered Soul-wisp reconstruction;
  do not invent a body animation.
- Update ML clock projection, save schema/migration, host presentation tests,
  and every old fixture that encoded the fabricated phase machine. Protocol
  shape and client authority remain unchanged.

### Validation contract

- Red/green kernel tests pin constructor/start RNG order and endpoints, two
  sequential substeps, 300-unit flyby goal, no-target goal, speed/turn decay,
  strict 40-unit contact, repeated-overlap reset, and target loss.
- A blocked-world/player test must prove Wraith flight invokes neither LOS,
  NavMesh, nor the Website collision resolver and still refreshes cell binding
  from its direct final root.
- Store and simulation tests prove immediate damage/Dazzle, no duplicate damage
  inside cooldown, full player movement recovery, radius 15 across collision/
  spell consumers, pause/reset/death, config variants, projection, and old/new
  save restore.
- Run the complete `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the
  exact byte-identical Mac candidate.
- Built Mac Chrome must reach a real authored Wraith in an unmodified survival
  wave, record authoritative position samples that demonstrate a fast curved
  flyby, contact damage plus Dazzle movement recovery, continued post-contact
  flight, the flag-free opaque body, clean snapshot projection, and empty page,
  console, failed-response, wire, host, and WebGL error arrays. Burning-only
  wisps remain a separate per-branch renderer assertion.

### Implementation validation receipt

- `native-wraith-flight.ts` now owns the complete retained native speed, turn,
  flyby, cooldown, no-target, contact, and two-substep vector program.
  `boneyard-enemy-store.ts` consumes it directly, bypasses inherited route and
  movement collision while retaining cell rebinding, applies damage/Dazzle on
  strict contact, and removes the fabricated orbit/drain phase machine and
  52-unit reach. Wraith body radius is exact 15. Projection uses cooldown only
  for the existing frame-free `wraith-drain` presentation state; ML observes
  native flight/flyby/cooldown without a second gameplay model.
- Browser save schema 26 carries the new retained brain. Schema 25 and every
  earlier accepted active-run save deterministically materialize native Wraith
  flight from the stored enemy RNG before resuming. Frontend/backend version
  admission and host checkpoint assertions moved together. Protocol shape and
  client authority did not change.
- The pre-fix red candidate on base `41e15254` completed the supported Mac gate
  through the Boneyard lane with exactly the three intended failures: radius
  15, immediate contact/Dazzle, and high-speed initial displacement. The other
  1,806 of 1,809 Boneyard/runtime tests passed, localizing the defect before the
  implementation.
- Final runtime candidate `4bd153feb13b9f123321152992339477c1afea4d`
  (tree `3c92ebccf26d38a25c3a6d454414c13cc05247b7`) is one focused commit over
  current-main base `344ab5c6a0c13c5ada9d696d1f3d347b04024630` and was
  materialized byte-identically at
  `/Users/jarrett/codex-acceptance/wraith-flight-contact-20260831-final`.
- The final Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` gate exited zero:
  all 28 backend/Website contracts, formatting, lint/import/generated checks,
  1,824/1,824 Boneyard/runtime tests, and every remaining registered suite,
  production frontend/game-host builds, media policy, and bundle budget passed.
  `Game-CH469l4K.js` is 264,039 raw / 80,422 gzip bytes. Captured gate stdout
  SHA-256 is
  `5d32f45449800cce407a07fed3cb269b7a75c23ff9e73345c56cee6b97a48813`;
  captured test-progress/warning stderr SHA-256 is
  `e51b181a24a6acf7d11f8d3b14037ae218a5f1195260b61b90d00e62be539857`.
- Built production Mac Chrome reached Wraith actor 31 from authentic compiled
  retail schedule row 24/source spawn intent 31; the harness did not construct
  the actor. Eight consecutive authoritative movement epochs covered
  `20.2609..27.4353` world units per two-tick epoch while heading advanced
  through a 21-degree span. Contact changed player HP `50 -> 46.001`, armed
  50 Dazzle ticks and movement scale `0.02`, reset Wraith speed to
  `baseFlybySpeed*50`, and the same actor moved another `94.9194` units on its
  next post-contact epoch. After expiry the authoritative movement scale was
  exactly one.
- The WebGL renderer presented the flag-free Wraith as opaque body record 2082
  with semantic `wraith-drain` contact state and no Burning-only auxiliary
  effect, matching the authored flags. The visually inspected frame retained
  the Wraith beside the contacted player in the lit/rainy Arena. Renderer was
  `pixi-webgl` / `webgl`; page, console, failed-response, wire-decode, host, and
  outside-combat arrays were empty. The 20 Hz wire reached sequence 98 with 35
  descriptors, 31 first enemy samples, 33 semantic events, and no decode error.
  The first replay captured Dazzle one scheduler tick later at 49 while the
  Wraith cooldown was still 50; the untracked harness was tightened only to
  detect the first damage state, then the repeated receipt captured the exact
  50-tick/`0.02` sample. No tracked candidate byte changed.
  Browser-log SHA-256 is
  `d8a413776de3fc22da7a7fa69dfda4d9e641f5ba348fa8018b09f295dd2020f2`;
  inspected-frame SHA-256 is
  `121eee78a398a3d45d9791c80def575178d32c93180e990a08e0f9e22eb0e5cf`.
- No member is browser-blocked and no intentional visible difference remains.
  Burning Wraith record-21 wisps, ordinary flag-free absence, fixed body,
  direct-flight collision bypass, target loss, pause/death/reset, save restore,
  and replication remain covered by the per-branch automated matrix. No push,
  release, deployment, production restart, or live-production claim was made.
  This receipt is the sole post-validation tracked write; no runtime, test,
  schema, build, asset, or protocol byte changed after the final receipts.
