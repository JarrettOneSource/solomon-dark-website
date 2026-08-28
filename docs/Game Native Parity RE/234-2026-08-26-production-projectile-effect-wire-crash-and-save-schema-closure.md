# 2026-08-26 — Production projectile-effect wire crash and save-schema closure

## Reported smell and parity question

- Reported behavior: inspect the newest production crashes and fix them. Two
  protocol-80 shared-host clients independently submitted browser diagnostics
  after the same authoritative frame failed at
  `frame.world.entities.samples[282]`; both transports then closed with code
  `4008`. The game and Website processes remained active with zero restarts.
- The fuller client log also contained a sustained
  `save.sync_failed: The browser game save schema version is not supported`
  stream. The deployed browser encoded schema 15 while the deployed backend
  inspector still accepted only through schema 14.
- Stock behavior to preserve: learned Chill Wind retires only an eligible
  hostile Arrow and hands its exact record-2 `Anim_SpinAway` state to the
  independent world-effect owner; its initial life/opacity value is six and
  falls by `0.1` per fixed tick. Every other projectile transient retains its
  own authored alpha, light, atlas, frame, and retirement contract. Browser
  continuation checkpoints must be accepted atomically by every consumer of
  the current schema.
- This is a secondary report in two systems already covered by the ledger. The
  earlier Air/Water and projectile passes tested authoritative SpinAway motion
  but skipped the type-6 keyframe/delta codec for that sibling. The College
  pass bumped the frontend save schema but skipped the backend-inspector
  sibling and a cross-stack version assertion. Those omitted membership rows,
  rather than either visible error string, are the process failures reopened
  here.
- Falsifiers: a valid default Hub producing the same sample failure, an
  authored enemy/death-effect row producing it without Chill Wind, a stock
  SpinAway life at most two, or a schema-15 backend acceptance receipt would
  disprove the leading model. The first three were tested and rejected; the
  deployed backend rejected schema 15 directly.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production diagnostics | NFO `/var/lib/solomon-dark-revived/sdr.db`, `DiagnosticLogs` rows 40/41, captured `2026-08-26T19:45:14Z`, deployed SHA `d43fb6a3534e7bc052ba60d0c31ab47525ced8d7`, protocol 80 | Two clients rejected sample index 282 and closed cleanly with code 4008; one retained 96 repeated schema-rejection warnings. | high |
| Production runtime | NFO `RuntimeEvents` rows 866..868 and `solomon-dark-game.service` journal | A two-player default Boneyard began at tick 449097; both players rejected the same frame around tick 466506. Website/game units stayed active with `NRestarts=0`, so this was a shared client decoder crash, not a process exit. | high |
| Exact web call path | `boneyard-spell-combat.ts -> tumbleBoneyardArrow -> projectBoneyardEnemyProjectileEffects -> createGameSnapshotFrame -> uniqueEntityEntries` | Chill Wind creates type-6 `arrow-tumble` with alpha/life `6`; both full-snapshot and replicated-sample validators imposed the sibling GuidedMissile maximum `2`, making every early SpinAway frame invalid. | high |
| Diagnostic differential | clean Mac worktree at exact deployed SHA | Default Hub survived 500,000 fixed ticks with 8..15 Students and every sample valid. All 680 retail wave rows (114 unique enemy/flag rows) completed enemy/death-effect codec lifecycles without an invalid sample. A real long-run checkpoint with 48 enemies and 432 valid death effects further falsified the sample-index-equals-Student assumption. | high |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; hash rechecked this pass | Same canonical executable and image base as the durable Air/Water/projectile reports. | high |
| Existing instructions | Water handler `0x00543860`, Arrow vslot `0x005E5EC0`, `Anim_SpinAway` vtable `0x0079D530`; `Mod Loader/docs/reverse-engineering/native-skills-and-spells.md` | Learned Water passes `mPushback*0.3199999928474426`; the first eligible Arrow crosses its threshold, retires, and creates record 2 with life six, loss `0.1`, unit direction damped by float32 `0.98`, and the recovered rotation RNG sequence. Firebolt/GuidedMissile and low-mana Water do not enter this branch. | high |
| Save contract | `game-save-contract.ts`, `game-save-document.ts`, `WebGameSaveInspector.cs`, production warning detail | Frontend schema is 15 with legacy 1..14; backend current was 14 with legacy 1..13. This exact one-version split rejected every current cloud checkpoint. | high |

No fresh native fact was required: the complete stock SpinAway contract was
already durable in `native-skills-and-spells.md`. The new finding is the web
codec and cross-stack schema-consumer omission, so no Mod Loader report is
changed by this pass.

## System A boundary and membership inventory — projectile-owned transient wire lifecycle

Native/web boundary: the complete reachable enemy-projectile transient family,
from the five live projectile parents and Water's Arrow vslot through transient
birth, fixed-tick state, type-6 descriptor/sample transport, late-join
keyframes, delta reconstruction, render/light ownership, parent-independent
retirement, and world teardown.

| Member | Native/web source | Disposition | Proof required by this closure |
| --- | --- | --- | --- |
| Arrow `arrow-tumble` / record-2 `Anim_SpinAway` | `0x00543860 -> 0x005E5EC0`, vtable `0x0079D530` | exact-ported | real Chill Wind producer; alpha 6 through retirement; type-6 full/delta round-trip |
| Arrow fire-contact `fire-burst-frame` | Arrow impact plus `Anim_FireBurst` 251..254 | verified-already-at-parity | exact alpha-one/frame/lifetime codec row |
| Arrow fire-contact `fire-burst-glow` | same impact, record 110, transient light | verified-already-at-parity | alpha `0.5`; sole type-6 light owner |
| Firebolt `firebolt-trail` | `0x006125B0` even-tick child | verified-already-at-parity | alpha-one envelope, 8-tick lifetime, 255..266 selector |
| Firebolt impact frame/glow | 16-visible-tick `Anim_FireBurst` | verified-already-at-parity | shared frame/glow rows tested for the Firebolt scale domain |
| GuidedMissile `guided-impact-main` | `Anim_FadeGM` | verified-already-at-parity | alpha 2, 20 states, cold/poison main selector |
| GuidedMissile `guided-impact-aura-one` | `Anim_FadeGM` first aura | verified-already-at-parity | alpha 2, record 111 and authored tint |
| GuidedMissile `guided-impact-aura-two` | `Anim_FadeGM` second aura | verified-already-at-parity | alpha 2, record 112 and authored tint |
| DemonBomb `demon-fire` pair | terminal Fire actors / DeadHawg 46..77 | verified-already-at-parity | both children, alpha one, 500-tick independent lifetime |
| PoisonPool `poison-pool-fade-inner` | `PoisonPool 0x806` second pass | verified-already-at-parity | sinusoidal alpha envelope at or below one for 200 fade ticks |
| PoisonPool `poison-pool-fade-outer` | `PoisonPool 0x806` first pass | verified-already-at-parity | alpha at or below `0.5` for 200 fade ticks |
| learned Chill Wind query | row 33, mask `0x1082` | verified-already-at-parity | hostile Arrow tumbles on first learned contact |
| underpowered Water | mask `0x2` | verified-already-at-parity | no projectile tumble or type-6 birth |
| Firebolt and GuidedMissile in Water query | native flag `0x100` versus Arrow `0x80` | out-of-system for tumble; their independent impact rows remain above | negative target-membership assertion |
| type-6 broad sample envelope | `REPLICATED_ENTITY_TYPE_REGISTRY` | exact-ported | admits the complete family maximum six without accepting negative/nonfinite/unsafe state |
| descriptor-specific alpha envelope | kind table plus full snapshot/reconstructor validators | exact-ported | exact maxima: 6, 2, 1, or 0.5 as authored per row; wrong-kind excess rejected |
| keyframe, delta, late join, parent retirement | entity baseline/reconstructor | exact-ported | effect survives parent removal, reconstructs, and retires by its own ID |
| Boneyard/run teardown | world replacement | verified-already-at-parity | no transient crosses a run identity |

All ten reachable kind rows are listed. No member is browser-blocked; WebGL
alpha can represent the native value and the existing painter already consumes
it. Story-only projectile families remain outside the established survival
Boneyard reachability boundary and are not silently assigned a type-6 row.

## System A ownership thread and recovered contract

- Water authority evaluates Chill Wind in the ordinary fixed-tick primary
  query. The Arrow owns the threshold and parent retirement; the resulting
  SpinAway is world-owned and remains after the Arrow disappears.
- Type-6 descriptors own immutable kind, parent identities, atlas/blend,
  birth/lifetime/phase, and the one allowed transient-light registration.
  Samples own position, rotation, alpha, scale, record, tint, and age.
- A sample cannot select its exact alpha envelope without its descriptor.
  Therefore the standalone registry must admit the complete family maximum
  six, while full-snapshot and descriptor+sample reconstruction enforce the
  exact per-kind maximum. Applying GuidedMissile's maximum two to every row is
  the refuted shared assumption; removing validation entirely is not legal.
- Exact maxima are: `6` for `arrow-tumble`; `2` for the three guided-impact
  rows; `0.5` for FireBurst glow and PoisonPool outer fade; and `1` for
  demon-fire, FireBurst frame, Firebolt trail, and PoisonPool inner fade.
- The parent projectile, effect, renderer, and light lifetimes stay separate.
  No packet normalization, compatibility protocol, skipped sample, or client
  fallback is introduced.

## System B boundary and membership inventory — browser save schema acceptance

Native/web boundary: the portable browser checkpoint contract from schema
writer through parser/migration, local slot, authenticated cloud PUT/GET,
revision/hash metadata, deployment checkpoint acknowledgement, and restore.

| Member | Source | Disposition | Proof required by this closure |
| --- | --- | --- | --- |
| current schema 15 writer | `game-save-contract.ts`, College continuation fields | verified-already-at-parity | current document tests |
| current schema 15 frontend parser/restore | `game-save-contract.ts`, `game-save-document.ts` | verified-already-at-parity | Hub/Boneyard and College resume tests |
| current schema 15 backend inspector | `WebGameSaveInspector.cs` | exact-ported | authenticated PUT stores format 15 and exact bytes/hash |
| legacy schemas 1..14 | frontend parser plus backend inspector | exact-ported | contiguous cross-stack version contract; representative migrations/API saves |
| schema 16/unknown future documents | both parsers | verified-already-at-parity | fail closed as unsupported |
| local IndexedDB slot 0 | `GameSaveCoordinator`/store | verified-already-at-parity | local checkpoint and reload remain available |
| authenticated cloud slot 0 | `WebGameSaveEndpoints` | exact-ported | current create/update/revision conflict/load/delete |
| profile-only checkpoint | current envelope with null continuation | verified-already-at-parity | profile restore remains accepted |
| active Hub/Boneyard continuation | current envelope | exact-ported | sync succeeds at ordinary and deployment checkpoint edges |
| hash, size, revision, ownership | backend save endpoint | verified-already-at-parity | existing account-owned conditional-write suite at schema 15 |
| version-consumer synchronization | frontend/backend source contract | exact-ported | canonical gate fails if current or legacy version sets diverge again |

No save member is browser-blocked. Schema 15 adds no backend interpretation of
the College fields: the backend owns bounded envelope/storage inspection while
the frontend owns semantic restore. It must nevertheless accept the exact
current version and preserve every prior accepted version.

## Confidence and open questions

- Confirmed: exact production times/revision/protocol; simultaneous two-client
  failure; no service restart; SpinAway producer alpha six; both validators'
  maximum two; current save version split; all reachable projectile-effect
  kind maxima and owners.
- Inferred: index 282's exact type/id cannot be recovered from the bounded
  submitted client log because the rejected raw frame was not archived. The
  real source path is nevertheless deterministic: every early SpinAway sample
  is rejected by the exact thrown predicate, while the exhaustive Hub and all
  authored enemy/death-effect differential passes do not reproduce it.
- Unknowns material to implementation: none. A future diagnostic may add safe
  type/id context to protocol errors, but instrumentation is not required to
  justify or complete this fix.

## Web implementation consequence

- Put the ten-row alpha contract beside the projectile-effect kind registry and
  consume it from full-snapshot validation and descriptor-aware
  reconstruction. Keep the generic sample registry bounded by the true family
  maximum six.
- Extend the existing real Chill Wind regression through projection and type-6
  validation, then cover all ten kind rows and reject descriptor-specific
  over-max samples.
- Advance `WebGameSaveInspector` to current schema 15 with legacy 1..14, update
  the live API contract fixture, and add one cross-stack version-set assertion
  so the two sources cannot drift silently again.
- Do not bump the game protocol or save schema: the wire shape and document
  shape are unchanged; this corrects validators that rejected already-authored
  current state.

## Validation contract

- Red/green: the real Chill Wind/Arrow producer must fail the current type-6
  registry at alpha six before the fix and pass through all 60 states after it.
- Family coverage: all ten projectile-effect kinds at exact maxima round-trip;
  negative, nonfinite, global-over-six, and wrong-kind over-max alpha fail;
  FireBurst glow remains the sole light row; parent retirement and effect
  teardown remain independent.
- Save coverage: authenticated schema-15 create/update/load; schema 14 remains
  legacy-accepted; unknown future schema rejects; frontend and backend current
  plus legacy sets compare equal in the canonical Python suite.
- Mac browser: a real Water/Chill Wind journey must tumble a hostile Arrow,
  observe record 2 through its effect lifetime, keep the session connected,
  and report empty page/console/failed-response/wire/host-error arrays. The
  same journey must publish and reload a schema-15 checkpoint without any
  `save.sync_failed` event.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact rebased Mac
  candidate. No Windows/WSL test or build is a completion receipt.

## Implementation validation receipt

- Implementation: `game-state.ts` now owns one complete ten-kind alpha table.
  Full snapshot validation consumes the descriptor's exact row; compact sample
  admission uses the true family maximum six, and reconstruction reapplies the
  descriptor-specific maximum before materialization. The native SpinAway
  producer, motion, renderer, and 60-state lifetime are unchanged. No protocol
  version, compatibility decoder, skipped entity, or normalization path was
  added.
- Save closure: the backend inspector now accepts current schema 15 and legacy
  schemas 1..14, matching the frontend exactly. The authenticated slot-0 API
  stores and returns schema 15 with its existing revision, byte count, SHA-256,
  ownership, conflict, and deletion contracts. A cross-stack canonical test
  now fails if either current or legacy version set drifts.
- Mac red/green: on the exact deployed parent, the real Chill Wind regression
  failed because the alpha-six type-6 sample returned false, the full snapshot
  decoder failed with `alpha must be within [0,2]`, and the save contract
  reported backend 14 versus frontend 15. On the rebased candidate, the focused
  projectile/protocol set passes `91/91`, including every one of the ten kind
  rows, descriptor-specific excess rejection, all 60 SpinAway states, full
  snapshot, delta, parent-independent lifetime, and teardown. The focused
  current-schema/version API set passes `2/2`.
- Exact-tree canonical gate: fresh detached Mac worktree at base
  `ec9c16c0f629d8fcb7fa61bb8fba81e9e023dbf3`, byte-identical to focused commit
  `384f9778`, exits zero through all backend integration, lint/boundary,
  frontend, Boneyard/game, ML, weather, party/Hub, desktop, type/build, bundle,
  and media-policy gates. Named counts include 24 backend/contract tests, 282
  prerequisite tests, and 1,580 Boneyard/game tests. Production entry
  `Game-DBfx4DFG.js` is `477160` raw / `133709` gzip bytes against `524288` /
  `134144`.
- Built Mac Chrome: the production-bundle Water journey completes the current
  automatic College dialogue, Create, generated Boneyard entry, and Solomon
  handoff before applying learned Chill Wind to one exact hostile Arrow. The
  wire receives type-6 effect ID 1 at alpha exactly `6`, the WebGL renderer
  reports that same effect ID, the host and reconstructed client retire it
  independently at tick 8722, and the player remains connected. Page errors,
  failed responses, wire decode errors, and outside-combat violations are all
  empty. Visual inspection confirms a coherent bright record-2 SpinAway at the
  Arrow root over the intact rainy Boneyard; the inspected PNG SHA-256 is
  `8bb92d497a12957b7ea4dad1b145e77377345ad6db980565c96ec323cf8fb770`.
- Acceptance-driver correction: the Boneyard smoke now completes the current
  authoritative Archchancellor dialogue before walking to Create and keeps the
  unrelated off-camera cleanup proof in its own existing mode. This changes no
  gameplay state or native contract.
- No browser-platform exception, material unknown, or new native fact remains.
  The existing Mod Loader native report already owns the complete SpinAway
  evidence, so the Website ledger is the only RE document changed here.
