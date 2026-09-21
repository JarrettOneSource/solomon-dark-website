# Mage Air light-registration lifetime repair — September 21, 2026

Baseline: `bfa35bd3dcc2f39a5141d873d2c34d975a7d84f6`.

Failure evidence (read-only):
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/eleventh-free-mana-20260921`.
The eleventh Fire-on-Mac / Water-on-Windows run stopped at wave 37. Its Windows
client recorded `Mage Air factory 28139 emitted a light without native manager
registration`; the retained interpolation reproduction admits a newer pulse at
presentation tick 103 while the newer Mage actor is not yet sampled.

## Causal model and repair

The authoritative pulse previously stored the Mage ID and its independently
allocated body/source/contact painter registrations, but not the creator's
actor-manager light registration. Both the simulation light query and the
renderer later looked that registration up through the current enemy array.
Enemy and pulse interpolation have deliberately different membership rules,
so the lookup could fail at a valid pulse birth. The simulation query had the
same lifetime error and silently omitted the light after owner removal.

Each pulse now captures an immutable copy of its creator's exact actor-manager
registration at authoritative emission. That value is projected, encoded,
saved, copied during interpolation, materialized by the pulse view, and passed
with the age-zero path-light batch. Simulation and presentation consume the
pulse-owned value directly. `ownerActorId` remains provenance and participates
in the existing secondary-effect append-ordinal match, but it is never
dereferenced to recover light ownership.

This changes no native light geometry, intensity, shadow flag, contact
attachment, body/source/contact lifetime, pulse retention, or append ordering.
It also removes the renderer's legacy `pulse.id * 3 + index` painter fallback:
creator and painter registrations must be present, actor-lane, nonnegative,
and mutually distinct, with exactly three painters for world contact and two
for target-attached contact.

## Boundary audit

The complete Mage pulse boundary includes authoritative emission, store
retention, host projection, object snapshots, compact keyframes/deltas,
presentation interpolation, pulse-view ownership, scene and simulation light
queries, current/prior saves, and finite retirement. Regression coverage
exercises:

- a first pulse admitted from the newer snapshot before its Mage membership;
- a retained pulse after its Mage leaves membership;
- every live age and retirement at the five-age bound;
- target-attached and world-contact painter counts;
- age-zero path-light replay from an orphan pulse and ordering by the captured
  registrations rather than pulse or array order;
- non-aliased projection/interpolation copies and frozen authority/compact-view
  registrations;
- object and compact malformed registrations, missing old compact columns,
  and duplicate creator/painter ordinals;
- compact keyframe and delta round trips;
- current orphan-save round trips, exact schema-36 migration from a present
  owner, and rejection of missing, stale, mismatched, duplicate, or
  unrecoverable legacy ownership.

The sibling sweep found no equivalent sampled-enemy lookup in Chain or
Blizzard. Replicated secondary MiscLight actors already carry their own light
registration and append ordinal. Player primary Air still uses its player
entity's registration; player/transient authority and presentation membership
are coupled at this boundary, so no Mage-derived fallback was added there.

## Version cutover and offline archive adapter

The compact pulse frame grows from 17 to 18 columns by appending the creator
registration ordinal. The game protocol moves from 128 to 129. Production
protocol decoders reject length-17 frames and object pulses without the field;
they do not infer ownership. The save schema moves from 36 to 37. Production
save migration may fill a schema-36 pulse only from the exact actor row with
the same `ownerActorId` and its valid actor-lane `lightRegistration`; an orphan
legacy pulse is rejected. The backend save inspector has no separately
maintained current-version ceiling, so no backend constant changes with schema
37.

Old protocol-128 diagnostic archives require an explicitly offline adapter.
For each object pulse or 17-column compact pulse, the adapter must locate the
exact owner actor registration in the same authoritative archived state at
that pulse birth, append/copy that ordinal, validate it is distinct from the
pulse painters, and only then rewrite the archive protocol metadata to 129.
If the exact owner row is absent, the archive cannot be losslessly adapted and
the adapter must fail. It must never derive an ordinal from `ownerActorId`,
`pulse.id`, painter registrations, neighboring actors, or current registration
counters. No such compatibility guessing exists in production code. The
parent owns any adapter needed for replay tooling.

## Parent-owned verification

Run the focused suites sequentially on the Mac:

```sh
cd /Users/jarrett/codex-acceptance/solomon-perf-6a583nbx/frontend
/opt/homebrew/bin/node --experimental-strip-types --test \
  src/game/core-server/boneyard-enemy-store.test.ts \
  src/game/core-server/boneyard-world-light.test.ts \
  src/game/host/project-boneyard.test.ts \
  src/game/client/boneyard-presentation-timeline.test.ts \
  src/game/protocol/entity-replication.test.ts \
  src/game/protocol/game-protocol.test.ts \
  src/game/renderer/native-mage-lightning-pulse.test.ts \
  src/game/save/game-save-document.test.ts
/opt/homebrew/bin/node ./node_modules/typescript/bin/tsc \
  -p tsconfig.test.json --noEmit

cd /Users/jarrett/codex-acceptance/solomon-perf-6a583nbx
./scripts/validate.sh
```

After those gates, browser acceptance must explicitly cross a Mage spawn
boundary and an owner-removal boundary with zero page/console errors. The
parent then owns publication and the restarted invulnerable, unlimited-mana,
autocasting Fire-on-Mac / Water-on-Windows wave-100 stress run.

This worker intentionally ran no test, TypeScript, lint, build, browser,
benchmark, validation, publication, or live-runtime command. Results remain
pending parent execution.

## Integration verification

The continuation corrected the pre-first-tick save case: an enemy store may
legitimately have `lastStepTick = -1`, but no nonnegative pulse birth may fit
that unstepped store. All 49 save tests and TypeScript checks pass.
`tools/check-mage-light-browser.mjs` verifies both world and attached contacts
at birth and without a creator row through the actual scene-light manager and
WebGL renderer, with zero page/console errors and complete finite retirement.
The full release gate remains a separate required publication check.
