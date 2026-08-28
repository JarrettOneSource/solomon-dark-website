# 2026-08-24 — Boneyard combat-event lane ordering correction

## Reported smell and parity question

- Reported web behavior: production Safari disconnected `Sirmin` from the
  Tutorial with close code `4008` and
  `frame.world.enemyEvents eventIds must increase` after 104,098 ms. The
  browser submitted diagnostic row 25 at `2026-08-24T12:07:49Z`; the game,
  Website, and Caddy units remained active with zero restarts.
- This reopens the retained Boneyard combat-event system. Earlier passes proved
  each event producer and each once-only consumer independently, but skipped
  the cross-producer case where two authoritative subsystems reserve event IDs
  during one simulation tick. That missing membership row allowed an invalid
  wire lane despite the prior closure claims.
- Stock behavior to preserve: native combat calls occur in one authoritative
  update order. The Website's semantic replication projection must preserve
  that order exactly across simultaneous enemy, player, staff, primary,
  secondary, reward, audio, and terminal edges.
- Falsifier: if the authoritative state is strictly ID-ordered before frame
  construction, `createGameSnapshotFrame` or entity reconstruction must be
  reordering it. If two individually ordered producer batches become invalid
  inside `finishGameSimulationTick`, lane aggregation owns the defect.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production diagnostic | NFO `DiagnosticLogs.Id=25`, deployed Website `171667d79cf96586693df76407d308cd362ba7fe`, protocol 70 | iPhone Safari decoded one delta frame containing a non-increasing `enemyEvents` array and failed closed with the exact protocol error. | high |
| Production checkpoint | authenticated slot-zero revision 25, saved at tick 39000 / Tutorial stage 3 | The last accepted retained lane was strictly ordered `895..921`, while `enemies.nextEventId` was 922. Restore-counter drift, capacity overflow, and integer wrap are falsified. | high |
| Web causal trace | `boneyard-world.ts`, `game-simulation.ts`, `boneyard-enemy-store.ts` at `171667d7` | One `BoneyardEnemyStore.nextEventId` allocates all combat IDs. The world step returns its current batch separately; later staff, Mindblowing, reflection, secondary, and primary paths append higher IDs to `world.enemyEvents`; the final concatenating retention call can then append the earlier lower-ID world batch after them. | high |
| Wire trace | `host/game-snapshot.ts`, `protocol/entity-replication.ts`, `protocol/game-protocol.ts` | Full snapshots and delta frames copy the authoritative array without reordering. The strict decoder correctly rejects adjacent IDs that do not increase. Delta reconstruction is not causal. | high |
| Existing native evidence | retail 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; prior enemy, damage, spell, and player-receiver entries | Native event effects are called in authoritative update order; the monotonic retained lane is the established browser replication mechanism for reproducing those once-only edges. No new retail fact is required. | high |

## System boundary and membership inventory

Native system: authoritative Boneyard combat-event allocation, aggregation,
retention, replication, and once-only consumption for one run.

| Member | Owner/source | Disposition | Proof |
| --- | --- | --- | --- |
| `attack-marker` | enemy action program | verified-already-at-parity | existing family/action tests; shared ordered aggregation regression |
| `coffin-maggot-release` | Coffin/Maggot lifecycle | verified-already-at-parity | existing exact-count tests; shared ordered aggregation regression |
| `enemy-action-sound` | enemy action/audio RNG | verified-already-at-parity | existing sound-family tests; shared ordered aggregation regression |
| `enemy-damage-sound` | common damage receiver, shield branch, staff/primary/secondary damage | exact-ported ordering in this closure | simultaneous world-step plus later receiver event remains ID-ordered |
| `enemy-death` | common terminal receiver | verified-already-at-parity | existing all-family terminal tests; shared ordered aggregation regression |
| `enemy-death-sound` | family terminal presenter | verified-already-at-parity | existing family/audio tests; shared ordered aggregation regression |
| `enemy-retired` | actor/Maggot teardown | verified-already-at-parity | existing retirement tests; shared ordered aggregation regression |
| `enemy-spawned` | wave/Tutorial/split materialization | verified-already-at-parity | existing all-family spawn tests; shared ordered aggregation regression |
| `enemy-terminal-output` | eight family terminal presenters | verified-already-at-parity | existing per-output tests; shared ordered aggregation regression |
| `player-damage-sound` | accepted nonterminal PlayerWizard receiver | exact-ported ordering in this closure | same counter and ordered merge with enemy/staff events |
| `projectile-impact` | Arrow/Firebolt/Guided/Demon/Poison projectile contact | verified-already-at-parity | existing projectile-family tests; shared ordered aggregation regression |
| `projectile-retired` | projectile contact/expiry/arrow tumble | verified-already-at-parity | existing impact/retirement tests; shared ordered aggregation regression |
| `projectile-spawned` | enemy projectile action markers | verified-already-at-parity | existing projectile birth tests; shared ordered aggregation regression |
| `reward` | terminal attribution/reward handoff | exact-ported ordering in this closure | reward plus level-up Mindblowing receiver reproduces the cross-batch fault |
| world-step producer batch | `stepBoneyardWorldTick` | exact-ported ordering in this closure | lower reserved IDs merge before later subsystem IDs |
| staff, reflection, secondary, primary, Mindblowing, and Last Word batches | sequential `finishGameSimulationTick` receiver paths | exact-ported ordering in this closure | every batch shares one counter and one canonical merge rule |
| retained/save-restored prefix | world/save owner | verified-already-at-parity | valid checkpoint `895..921`, next ID 922; restored prefix remains ordered |
| one-second retention and 512-row capacity | lane owner | verified-already-at-parity | existing cadence/capacity tests run through canonical merge |
| full welcome and compact keyframe/delta frames | snapshot/entity replication | verified-already-at-parity | both transport shapes carry identical ordered rows |
| client event cursor | `game-client-session.ts` | verified-already-at-parity | late join suppresses history; each later run-scoped ID publishes once |
| audio, enemy view, world feedback, and Lua lifecycle consumers | Boneyard presentation/audio/Lua owners | verified-already-at-parity | all consume the same canonical lane without local reordering |
| run replacement, reconnect, save restore, and teardown | run/session owners | verified-already-at-parity | cursor and allocator reset only with their owning run |
| ordered Boneyard loot events | independent `BoneyardLootStore.nextEventId` and `previous.world.lootEvents` merge | out-of-system | the tick merge starts from the prior world, so no later producer can precede the world-step batch |
| Solomon encounter voice/dig and Tutorial narration events | encounter/Tutorial state-local allocators and cursors | out-of-system | these never enter `world.enemyEvents` or its retention helper |
| secondary-ability presentation events | `NativeSecondarySimulationState.nextEventId` | out-of-system | separate snapshot component, allocator, validation, and consumer cursor |

There are no browser-platform-blocked members. The semantic lane is a web
transport projection, but monotonic identity and deterministic order are fully
representable on every supported browser.

## Native ownership thread and recovered behavioral contract

- The native receiver/action call sequence is authoritative. The Website host
  projects those transient calls by reserving one strictly increasing ID from
  `BoneyardEnemyStore.nextEventId`; producer arrays are transport staging, not
  independent ordering domains.
- Every producer receives and returns the updated enemy store. Therefore the ID
  itself is the single durable order key across world-step, player damage,
  staff, reward-triggered Mindblowing, reflection, secondary, primary, and
  terminal paths, even when source-code control flow collects those batches at
  different times.
- Retention must merge already ordered batches by `eventId`, reject duplicate
  identity, then apply the native-tick age cutoff and capacity tail. Plain
  concatenation is valid only when every new batch was allocated after the
  complete retained prefix, which the integrated simulation does not promise.
- Snapshot and delta-frame construction must remain transparent; repairing or
  tolerating order at the client would replay/skip effects and weaken the
  protocol's correct fail-closed invariant.
- Fresh run construction starts allocator ID 1 with an empty lane. Save restore
  preserves both allocator and retained prefix. Run replacement/teardown owns
  their reset; no compatibility shim or client-side sorting is allowed.

## Nearby-system findings

- The submitted checkpoint proves the deployed Tutorial save lifecycle was
  internally consistent before the fault: stage 3, tick 39000, 27 retained
  attack markers, last ID 921, allocator 922. The earlier restore fixes are not
  implicated.
- Entity replication copies `enemyEvents` verbatim for both keyframes and
  deltas. Its strict decoder exposed the server invariant violation and should
  not be relaxed.
- No Mod Loader document changes in this closure because the investigation
  recovered no new retail constant, branch, class, asset, or lifecycle fact.

## Web implementation consequence

- Correct owner: the shared retained-event merge in
  `core-server/game-simulation.ts`.
- Replace concatenation with one canonical ordered merge over the shared event
  identity. Keep strict duplicate rejection at the authoritative boundary.
- Do not sort or forgive malformed lanes in `game-protocol.ts`, the entity
  reconstructor, client cursor, renderer, audio layer, or save migration.
- Keep event types, RNG, ticks, payloads, retention duration, capacity,
  snapshots, and consumer behavior unchanged.

## Validation contract

- On the untouched deployed base, an integrated reward tick that emits a
  world-step `reward` and then a level-up Mindblowing damage event must recreate
  the non-increasing authoritative lane and the production protocol failure.
- After the correction, that exact case must retain every ID once in increasing
  order. Add ordered-left/ordered-right interleaving and duplicate-ID
  fail-closed assertions at the common merge seam.
- Re-run existing coverage for all fourteen event variants, staff, primary,
  secondary, reflection, player damage, retention/capacity, full/delta protocol,
  save restore, client once-only consumption, audio, renderer, and Lua consumers.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` and a real Mac Chrome
  Tutorial/survival journey against the exact candidate, requiring no protocol,
  page, console, failed-response, or host error and strictly increasing observed
  wire event IDs.

## Implementation validation receipt

- The shared retention owner now filters expired rows, restores the one
  authoritative order by `eventId`, rejects duplicate identity, and only then
  applies the existing 512-row tail. Event payloads, allocation, RNG, ticks,
  one-second retention, protocol 70, snapshot/frame encoding, and all clients
  remain unchanged.
- The behavioral regression ran red on the untouched deployed base
  `171667d7`: one integrated reward/Mindblowing tick produced the exact invalid
  lane `3,9,4,5,6,7,8`. The canonical Mac gate reported only that new failure
  (`1480/1481` Boneyard tests passed). After the owner fix, the base passed
  `1482/1482`, including the new duplicate-ID fail-closed case.
- The task commit rebased cleanly in runtime/test code onto stock-MsgBox main
  `0874972ef0ccb0e7e249b4886b22ffac742d92a2`; the sole ledger append conflict
  was resolved by retaining both complete system entries in chronological
  order. Local and Mac SHA-256 manifests were identical for all three changed
  files before the final run.
- On Apple arm64 macOS 26.6.2 with Node 22.17.0, npm 10.9.2, .NET 10.0.302,
  and Chrome 151.0.7922.170, the rebased canonical gate passed: backend build
  with zero warnings/errors; 22 backend contracts; formatting/lint/import
  boundaries; frontend groups `9/4/45/264/1484/6/77/9/63/12/14/7/36/33`;
  five desktop tests; production frontend/GameHost builds; bundle budget; and
  media policy.
- The built-production Mac Chrome/WebGL survival journey traversed title,
  Create, Hub, the physical Boneyard entry gate, Solomon contact/dialogue/run
  edge, and the 11-enemy opening burst. One browser reconstructed 1,703 server
  delta sequences through tick 8,505 and retained 32 combat events with empty
  wire, page, console, failed-response, and out-of-combat-enemy error arrays.
  The inspected 1600x900 combat capture is SHA-256
  `693d032133179d02858cafc044701a0ea1210d3614d7402c40257b4fb5a52c9c`;
  run-edge and speaking captures are
  `a8435a9f52fb6b7b7207378171863d26d73e9d0c192b6bdde3f457e3f94d16be`
  and
  `3e830e9c163e949fa8d5dcda82d5aa9265dd762b465b8d0d7b725cba77237c20`.
- The newly landed first-run stock prompt initially blocked the older wave
  harness before any game socket opened; the app had no error. A task-local
  prompt dismissal allowed the journey to run and was then removed. The final
  publication diff contains only this ledger, the two regressions, and the
  shared lane fix. No Mod Loader/native report changed because no new retail
  fact was recovered.
- The final manifest-identical documented tree repeated the complete canonical
  Mac gate with the same zero-failure group counts above. Publication,
  automatic deployment observation, post-deployment log verification, and
  task-scaffolding cleanup remain pending and are reported separately.
