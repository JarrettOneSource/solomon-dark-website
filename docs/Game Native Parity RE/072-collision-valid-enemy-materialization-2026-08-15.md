# Collision-valid enemy materialization — 2026-08-15

## Captured failure and ownership finding

The real-input waves journey exposed an authoritative spawn defect after the
projectile preload closure. A living Skeleton materialized at
`(1723.75, 2189.125)` in generated default Boneyard
`crv-fulltrio-fadf5a2-0724-client`. That point is inside the collision polygon
for `scenery:object-213`, the variant-10 grave at
`(1719.501953125, 2128.44189453125)` with overlay variant 8. Its exact polygon
is `(1681.501953125,2232.44189453125)`,
`(1684.501953125,2164.44189453125)`,
`(1746.501953125,2163.44189453125)`, and
`(1750.501953125,2233.44189453125)`.

Read-only checks against the same loaded scene established the failure before
any correction:

- `canPlaceBoneyardBody` rejects the captured point for radii 0, 1, 8, 12, 16,
  20, 22.5, and 25.
- At actor radius 16, `resolveBoneyardMovement` returns the unchanged captured
  point for every cardinal request from 0.5 through 40 units. The first
  endpoint-only jump that can escape is 50 units, far larger than an ordinary
  authoritative enemy tick.
- An exhaustive one-unit polar scan through the complete 40..135 Fire
  engagement band found no point that was both player-placeable at radius 25
  and connected to the trapped actor by the authoritative radius-22.5 Fire
  path. The smoke driver therefore had no legitimate input-only route or cast
  that could retire this actor.

The ownership trace is local and complete. `boneyard-wave-director.ts` owns
retail schedule order, RNG, target-neutral raw spawn intents, and their native
near-player/anywhere policies. `boneyard-world.ts` owns the loaded scene,
current gate leaves, and the authoritative `BoneyardCollisionWorld`.
`boneyard-enemy-store.ts` evaluates the actor recipe and therefore first knows
the actor's actual randomized collision radius; it currently copies the raw
intent point directly into every wave, Imp-child, and Demon-child actor. The
ordinary movement resolver cannot recover an actor whose initial body is
already embedded.

## Parity boundary and implementation contract

No preserved native evidence in this pass establishes the stock engine's exact
retry direction, distance, or sampling order. The correction is consequently
a named bounded Website safety rule, not a newly claimed retail placement
algorithm:

- Keep `resolveSpawnIntents` as the only wave-director seam so schedule state,
  intent IDs, RNG draws, target-neutral intent positions, and emission order do
  not change.
- After recipe evaluation and the native Imp construction guard, route every
  accepted actor materialization through one required world-owned placement
  callback with the evaluated collision radius. This includes top-level wave
  intents and both terminal-child paths; it does not move an already
  materialized actor.
- The Boneyard collision module accepts the raw point when it is placeable and
  admits an ordinary 0.5-unit movement probe. Otherwise it performs a
  deterministic eight-unit square-ring search and selects the first point with
  both properties. Exhausting the authored bounds is an error; an invalid actor
  must never be retained.
- Target selection remains nearest eligible, connected, living player from the
  final authoritative spawn point. Initial heading remains the direction from
  that same point to the selected target. Identity placement therefore leaves
  all existing targeting and heading results byte-for-byte unchanged.
- The placement search consumes no wave or actor RNG and neither allocates nor
  rejects an accepted ID. Spawned actor IDs, semantic event IDs, source intent
  IDs, event ordering, and evaluated configs must match an identity-placement
  control run.

The focused regression must use the captured object-213 geometry and raw spawn
point. It must fail on the direct-copy implementation, then prove that every
materialized actor is `canPlaceBoneyardBody`-valid and has at least one normal
tick-sized movement through `resolveBoneyardMovement`. A separate store seam
check must cover wave, Imp split, and Demon split materialization with their
evaluated radii while retaining target and heading semantics. App/test
TypeScript, focused Node tests, the supported lint/boundary gate, and the
Loader lifecycle diff contract are required. Browser rerun is deliberately
deferred until review of this product correction.

## Implementation validation receipt

- `BoneyardEnemyMovementRequest.purpose` now distinguishes ordinary movement
  from `spawn-placement` while retaining one required store-to-world collision
  authority. `materializeSpawnIntents` issues the placement request only after
  recipe evaluation and the native Imp construction guard, and supplies the
  evaluated `config.collisionRadius`. Its three callers remain the wave,
  recursive Imp, and Demon terminal paths.
- `resolveBoneyardSpawnPosition` and
  `BOUNDED_BONEYARD_SPAWN_PLACEMENT` now own the bounded eight-unit lattice and
  0.5-unit mobility probe in `boneyard-collision.ts`. `boneyard-world.ts`
  resolves `spawn-placement` against the current static world plus current gate
  leaves before the actor ID or spawn event is committed. Existing actors
  continue through the unchanged dynamic movement branch.
- The captured regression failed first because actor/source-intent 1 remained
  exactly `(1723.75,2189.125)`. With its evaluated radius
  `18.97256625443697`, the corrected actor materializes at
  `(1763.75,2149.125)`: `canPlaceBoneyardBody` accepts it and all four cardinal
  0.5-unit probes travel the full 0.5 unit. All ten actors in that opening burst
  satisfy both invariants.
- A no-grave control run retains identical wave-director state, actor configs,
  store RNG state, actor/event/source-intent IDs, spawn ticks, wave ordinals,
  target IDs, and semantic event order. The corrected actors retain nearest
  eligible target selection and derive initial heading from their final
  authoritative point. A separate terminal-path test observes the evaluated
  radius on both parents, both recursive Imp children, and all five Demon
  children while preserving native child headings and event ordering.
- The collision/store/world suite passes 53/53 and the two focused regressions
  pass 2/2. App and test TypeScript pass. `./scripts/validate.sh lint` passes
  backend formatting, frontend lint, and game-boundary validation with only the
  existing Fast Refresh warnings. `git diff --check`, the waves-smoke syntax
  check, and the focused Loader native/web lifecycle static contract pass. No
  browser run was made after this correction, as requested.
