# 2026-08-26 — Shared actor-motion scratch-state performance reopening

## Reported smell and parity question

- The exact committed Wraith-preload candidate `1e1e72ea` completed the
  self-validating 21-scenario Mac Safari matrix at display-paced 60 FPS, but
  its authoritative clock fell from about 100 ticks/second to `78.35` during
  the 89-enemy moving-and-shooting row. Browser frame rate alone hid a real
  gameplay slowdown.
- Three fresh, independently created 64-enemy controls minimized the owner:
  movement-only changed `100.10 -> 75.02` host ticks/second, shooting-only
  changed `100.09 -> 49.71`, and combined movement/shooting changed
  `100.02 -> 67.71`. Every activity was authoritative, had zero blocked
  gameplay frames, and retained about 60 browser FPS.
- The fix question is representation-only: can the web translation keep the
  exact native movement epoch while removing generic whole-object copies of
  closed `ActorPhysicsBody` records? Native collision geometry, ordering,
  strength transfer, and update cadence are not reopened.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Controlled Mac runtime | exact `1e1e72ea`, Safari, three fresh sessions with 64 explicit enemies plus the deterministic live wave | idle controls stay at 100 Hz; movement/fire inputs reduce only the authoritative host/snapshot rate while Safari remains display-paced | high |
| Process CPU | one-second Mac process samples around each eight-second control/activity pair | host CPU rises from averages `57.42..60.35%` idle to `90.81%` movement, `98.71%` shooting, and `95.57%` combined; active peaks reach `107.5..112.5%` | high |
| Native Mac stack sample | 15-second `sample(1)` capture of the session-supervisor process under sustained shooting | V8 `CopyDataPropertiesWithExcludedProperties` dominates the JavaScript timer stack; the hot compiled locations resolve to `resolveActorMotion` input spread and output object-rest copies | high |
| Named Node CPU profile | profiled exact game-host bundle, 500-us interval | hottest named gameplay path is `resolveActorMotion`; its two anonymous hot rows are the complete-body entry clone and `currentPushStrength`-excluding return clone, followed by collision `resolvePair`, `resolveMovement`, and `stepBoneyardWorldTick` | high |
| Current source | `core-kernels/actor-physics.ts` | every call spreads every source body into a `WorkingBody`, clones both vectors, then object-rest-copies every result solely to discard one scratch number | high |
| Native ownership | existing `0x00525800` movement epoch and dynamic response `0x00526520` closure in this ledger | current strength is transient epoch scratch at native `+0x4C`; it is not a persistent actor output field | high |

The harness's per-tick Lua health/mana restoration is present in every A/B
row and therefore cannot explain the activity-only delta. Level-up barriers,
hidden pages, and no-op input are excluded by the zero blocked-frame count and
the self-validating movement/primary actor receipts.

## System boundary and membership inventory

Native/web system: the shared host-authoritative `PlayerActor` movement epoch
translation in `resolveActorMotion`, including every current caller.

| Member | Caller / body membership | Required invariant |
| --- | --- | --- |
| Hub ordinary tick | players, Students, five fixed Courtyard actors, conditional Polisher, Skorcha; dynamic-grid broadphase | stable input/output order, region filter, Student/player/fixed strength semantics |
| Boneyard ordinary player pass | collision-enabled players plus every live enemy and Maggot | swept static/gate root movement, stable root contacts, shared circle response |
| Boneyard enemy movement callback | one driven enemy against the persistent player/enemy body map | exact driven flag, recursive recipient epoch, accepted roots committed back by ID |
| Player knockback pass | one driven player against players/enemies | ordered knockbacks and full-candidate Boneyard placement |
| Secondary enemy knockback pass | one driven enemy per contact | ordered secondary contacts and unchanged enemy commit semantics |
| All-pairs oracle | focused tests without `DynamicActorGrid` | byte-equivalent result to the broadphase path for deterministic mixed crowds |

`ActorPhysicsBody` is a closed record: `id`, `delta`, `position`, `radius`,
`pushStrength`, `pushResistance`, and optional `driven` / `pushEnabled`.
`currentPushStrength` is the only solver-private member. No caller is entitled
to pass opaque fields through the physics boundary.

## Recovered behavioral and representation contract

- Preserve one detached input body and detached `delta` / `position` vector per
  source record; the source array and its objects remain immutable.
- Preserve source order and optional `driven` / `pushEnabled` semantics.
- Keep current push strength in epoch-local scratch indexed by the same stable
  body index. Reset it only for a root move; transfer the multiplied value only
  to a recursive recipient exactly where the native solver does.
- Keep broadphase rebuild/update calls, candidate revision handling, root
  contact observation, collision predicates, placement calls, recursion
  recipient sets, formulas, strict comparisons, and return order unchanged.
- Return the already detached closed bodies directly. Scratch current strength
  must not appear in outputs, snapshots, hashes, callers, or persistence.

## Web implementation consequence and validation contract

- Replace generic input spread with one explicit closed-record clone helper.
  Store `currentPushStrength` in a parallel numeric scratch array and return
  the detached bodies without the second object-rest projection.
- Do not mutate caller bodies, cache results across ticks, change the dynamic
  grid, skip zero-delta roots, coalesce enemies, change tick rate, add a load
  threshold, or weaken exact all-pairs equivalence.
- Focused regressions must pin source immutability, output keys/order, detached
  vectors, optional flags, root-contact order, chained push behavior, and
  broadphase/all-pairs equality across the existing deterministic crowd set.
- Re-run the same fresh-session idle/move/shoot/combined matrix. Acceptance is
  restored authoritative cadence without a browser-frame regression, followed
  by the full element/UI/enemy/restoration matrix and physical iPhone proof.

## 2026-08-29 — non-pushing Boneyard mover specialization

### Reported smell and boundary

The late-wave replay still invoked the general persistent-body solver once per
enemy movement callback. Each invocation cloned the complete player/enemy
crowd even though Boneyard enemy collision bodies have `pushEnabled === false`,
only the requested enemy is driven, every dynamic pair is eligible, and that
native branch can correct only the mover. The representation question is
whether that closed branch can avoid the crowd clone without creating a second
collision law or changing any body, order, sweep, placement, or contact result.

The shared actor-response owner remains `core-kernels/actor-physics.ts`.
Membership and dispositions are:

| Member | Disposition | Required invariant |
| --- | --- | --- |
| Hub actors, Boneyard players, knockbacks, pushing and filtered pairs | `verified-already-at-parity` | Continue through the general movement epoch, broadphase, recipient recursion, and root-contact observer. |
| Ordinary Boneyard enemy movement callback | `exact-ported` specialized representation | One swept root move, then ascending-index unweighted separation against the complete current crowd with full-candidate placement. Only the mover position may change. |
| Newly admitted enemy during the same store step | `exact-ported` | Append once in native registration order and participate in every later callback that tick. |
| Pause, death, run reset, Game Over, and teardown | `verified-already-at-parity` | The per-tick crowd remains local; no solver result or cache crosses the movement epoch or run. |

### Shared representation contract

- General and specialized entries use the same separation and placement
  primitives, including the strict overlap edge, coincident-center rejection,
  `+0.1` separation epsilon, arithmetic order, swept world move, and
  `canPlace` acceptance.
- The specialized entry rejects any mover whose `pushEnabled` is not exactly
  false. Its caller supplies the same complete ordered body list and the prior
  all-pairs collision predicate.
- The source crowd is not cloned or mutated by the kernel. The Boneyard owner
  commits only the returned mover position into its tick-local body row.
- The optimization is not legal for player movement, knockback, pushing,
  filtered collision pairs, root-contact observation, or recursive recipients.

Focused differential coverage must compare the specialized result to the
general solver across blocked sweeps, rejected placements, player/enemy radii,
coincident bodies, and crowded randomized worlds while proving source
immutability. The complete fixed-tick replay must retain every checkpoint and
order-sensitive JSON hash before publication.
