# 2026-08-22 — Clean gameplay leave save and periodic browser autosave

## Reported smell and parity question

- Requested web behavior: leaving an active game must save before returning to
  Title; authenticated players use cloud slot zero, anonymous players use
  browser slot zero, and active play must autosave at a reasonable interval.
- This reopens the 2026-08-20 save/load entry. That pass documented stock clean
  destruction and added five-second host checkpoints, but it did not make the
  gameplay `MAIN MENU` action wait for a final host document or durable browser
  acknowledgement. Concurrent private-College work has since made ordinary
  checkpoints participant-owned; this pass retains that complete membership.
- Current reproduction: `leaveGameplay` calls `session.destroy()` immediately.
  `destroy()` removes the server-message/checkpoint listeners before sending
  `client-disconnect`; host release deletes the departing player's save
  sequence/document and can publish only to players who remain. Work since the
  latest periodic checkpoint is therefore not part of the explicit leave.
- Falsifiers: stock clean destruction does not write the resumable run; the web
  leave already awaits the exact final sequence; a nonleader cannot be projected
  as one valid owner-only save; or Last Game reconstructs from presentation
  snapshots instead of the stored host document.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail binary | unmodified Beta `0.72.5` `SolomonDark.exe`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Same sealed retail executable as the G10 save corpus. | high |
| Fresh read-only Ghidra | `Game` destructor `0x005CD3A0`, wrapper `0x005CFA60`, run writer `0x005CBE10`, loader `0x005CC210`, Last Game constructor `0x005AAA30`, region request `0x005CDDD0`, Game Over `0x005CF4F0` | Clean destruction calls profile save and resumable-run save before object teardown. Run writer callers remain exactly run entry plus clean destruction; loader caller remains exactly Last Game. No periodic run-writer caller exists. | high |
| Durable native report | `Mod Loader/docs/reverse-engineering/native-save-format.md`, including the 2026-08-22 recheck | Retail separates profile/run/cache lifetimes, directly overwrites files, saves semantic boundaries, and invalidates resume on Game Over. | high |
| Current Website causal trace | Website `a10496c2`; `MainMenuScene.tsx`, `game-client-session.ts`, `game-host.ts`, `game-save-coordinator.ts` | Host already authors participant-owned documents and the coordinator serializes cloud/IndexedDB writes. Explicit leave bypasses both final publication and acknowledgement; periodic publication is five seconds. | high |
| Existing resume proof | save codec/store/coordinator suites plus shared-Hub restore regression | Last Game passes the opaque stored document to a fresh host; saved locomotion and Hub participant state are imported rather than replaced by spawn. | high |

The Ghidra sessions used read-only project replicas and no injected loader or
live process. No ASLR runtime address is used.

## System boundary and membership inventory

Native system: semantic/profile persistence, one resumable run, clean
destruction, Last Game load, and Game Over invalidation. Web boundary: final
leave request through owner-only host projection, durable account/browser
storage, periodic crash-loss adaptation, and fresh-host resume.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| clean gameplay `MAIN MENU` leave | `Game` destruction `0x005CD3A0` -> `0x005BE0B0` + `0x005CBE10` | `exact-ported` | menu remains connected until forced final checkpoint is durably acknowledged, then returns to Title |
| app/component orderly teardown outside the menu | same native destructor, but no guaranteed React/browser lifetime | `blocked-by-platform` (a document may be discarded without running or completing async cleanup) | latest acknowledged semantic/periodic checkpoint remains; no false unload guarantee |
| abrupt tab/process/power loss | native synchronous destructor has no browser equivalent | `blocked-by-platform` (IndexedDB/network completion cannot be guaranteed after process loss) | 30-second maximum periodic window plus immediate semantic checkpoints |
| periodic whole-run writer | no `0x005CBE10` periodic caller | `out-of-system` as native behavior; `exact-ported` as requested browser adaptation | one named 30-second authoritative-tick cadence |
| profile/economy/progression mutations | eleven `0x005BE0B0` caller census | `verified-already-at-parity` | accepted mutations publish immediately and round-trip |
| Hub/Boneyard transition and run entry | `0x005CDDD0`, `0x0050E5E0` | `verified-already-at-parity` | transition/entry checkpoints remain immediate |
| Game Over terminal invalidation | `0x005CF4F0` | `verified-already-at-parity` | first active-to-Game-Over edge clears slot and later progress cannot recreate it |
| authenticated owner | Website account adapter | `exact-ported` | final leave and periodic documents transact cloud slot zero with revision checks |
| anonymous owner | browser disk adapter | `exact-ported` | final leave and periodic documents transact IndexedDB slot zero |
| singleton/private-College player | owner-only host projection | `exact-ported` | forced leave checkpoint sequence persists before disconnect |
| shared-Hub party leader | owner-only shared projection | `exact-ported` | semantic, periodic, and leave paths persist this owner |
| shared-Hub party guest | owner-only shared projection | `verified-already-at-parity` for ordinary autosave; `exact-ported` for final leave | autosave and final leave persist this owner without peer actors |
| Last Game availability | `0x005AAA30 -> 0x005CC210` | `verified-already-at-parity` | valid stored slot enables Last Game; invalid/absent slot does not |
| Hub save resume | sole loader plus web shared-Hub merge | `verified-already-at-parity` | position, velocity, cast/facing, region, and transition survive fresh-host import |
| Boneyard save resume | sole loader plus loaded-run validation | `verified-already-at-parity` | exact run/content identity and authoritative state revive before welcome |
| New Game replacement | native retry/new-run cleanup | `verified-already-at-parity` | old slot remains until the new host publishes a valid document |

Predicted visible platform difference: closing or killing the browser may lose
continuous movement/combat after the most recent acknowledged checkpoint. The
explicit in-game `MAIN MENU` path has no such window because it stays visible
and connected until storage completes.

## Native ownership thread

- Owner and construction: retail `Game`/profile objects serialize; Last Game
  constructs through `0x005AAA30` and loads through `0x005CC210`. The web host
  remains the sole save-document producer; browser code owns storage only.
- Writers: profile semantic callers, region switch, run entry, clean
  destruction, and Game Over. There is no native periodic run writer.
- State and transitions: web `active resumable -> final leave checkpoint ->
  durable acknowledgement -> disconnected/title`; a write failure returns to
  `active resumable` without destroying the session. Game Over remains
  `resumable -> absent`.
- Consumers: account/IndexedDB slot zero, title Last Game summary, fresh-host
  strict parser, shared-Hub importer, and Boneyard restore.
- Siblings: every connected party member uses the same owner-only projection;
  deployment restart retains its separate bounded all-player drain.

## Recovered behavioral contract

- Stock performs its final run write synchronously before teardown. The web
  menu must reproduce the ordering, not the native unsafe file format.
- The final checkpoint is forced even when the normal cadence has not elapsed.
  WebSocket order carries the checkpoint before its correlated leave response;
  the client accepts and persists that exact sequence before disconnecting.
- Semantic saves remain immediate. Periodic autosave changes from five seconds
  to 30 seconds: semantic edges already protect valuable mutations, explicit
  leave is exact, and 30 seconds bounds abrupt browser loss without issuing 720
  whole-document cloud writes per player-hour.
- Ordinary semantic and periodic publication covers every connected player.
  Owner-only serialization prevents another participant's actor from entering
  a slot.
- Existing schema-four documents and conservative schema-three local-only
  migration remain compatible. No new migration, native-byte import, extra
  slot, or automatic Last Game launch is introduced.

## Nearby-system findings

- Browser unload is not an async persistence owner. `beforeunload`, `pagehide`,
  React cleanup, and ordinary WebSocket close cannot truthfully guarantee a
  cloud or IndexedDB completion; no unload shim will be added.
- Global-Hub and private-College admission choose different transport owners,
  but both converge on the same client session, coordinator, and slot-zero
  leave acknowledgement.
- Native report updated: `native-save-format.md` now records the fresh
  destructor/writer/loader recheck and explicitly separates the browser
  periodic adaptation from native behavior.

## Confidence and open questions

- Confirmed: retail binary identity and call graph, absence of a periodic
  run-writer caller, current web teardown race, owner-only party projection,
  storage coordinator ordering, and existing resume/import ownership.
- Inferred: none used for native behavior.
- Unknown: no material native unknown. Abrupt browser loss is the named platform
  constraint rather than an unexamined native branch.

## Web implementation consequence

- Bump the strict protocol and add one correlated save-before-leave request and
  response. Reuse the existing `server-save-checkpoint` document; do not create
  a second save format or client snapshot serializer.
- Add a client-session `saveBeforeLeave()` promise. The Main Menu awaits its
  returned checkpoint through `GameSaveCoordinator.waitFor(sequence)` before
  destroying the session and clearing gameplay UI.
- On failure, retain the live paused menu/session and show a concise storage
  error so the player can retry or resume.
- Retain semantic checkpoint publication for every connected participant and
  set its periodic browser cadence to 30 seconds. Keep private-College/global-
  Hub admission, deployment drain, and Game Over clear semantics unchanged.

## Validation contract

- Protocol tests: strict request/response fields, request correlation, checkpoint
  sequence ordering, duplicate/malformed rejection, and version bump.
- Host tests: forced leave checkpoint precedes response; every connected party
  member receives periodic owner-only documents; Game Over still clears.
- Client/coordinator tests: leave promise returns only the correlated latest
  checkpoint; durable write completes before `client-disconnect`; write failure
  leaves the session intact.
- Browser journeys: anonymous and authenticated New Game -> move between normal
  cadence boundaries -> gameplay Main Menu -> return to Title -> Last Game ->
  resume the final moved position. Capture page/console/request errors.
- Canonical gate: `./scripts/validate.sh` on the exact final Website tree and
  the native-save static contracts on the Mod Loader evidence tree.

## Implementation validation receipt

- Protocol 55 adds strict correlated `client-save-before-leave` and
  `server-save-before-leave` messages while retaining
  `server-save-checkpoint` as the only payload. `GameClientSession` resolves
  only the response naming its latest checkpoint. `MainMenuScene` then waits
  for `GameSaveCoordinator.waitFor(sequence)` before destroying the session.
  A failed store write leaves the session and pause owner intact and remounts
  the same native menu for retry.
- `game-host` forces one owner-only document for every explicit leave and
  changes only the browser-adaptation cadence from five to 30 seconds. Existing
  participant-owned semantic publication, schema-four integrity, private-
  College/global-Hub admission, deployment drain, and terminal clear ownership
  remain intact.
- Focused red/green and post-rebase coverage passed `118/118` across the strict
  protocol, client correlation/teardown, host publication, 30-second leader and
  guest autosave, deployment/Game Over preservation, and native pause-menu
  order. Type checking and lint/import boundaries pass. The Mod Loader's eight
  focused native-save contracts pass, including all three byte-exact goldens,
  lifecycle/caller ownership, corruption behavior, and provenance.
- The first loaded WSL canonical run passed every backend/tail/build gate and
  `1322/1323` broad cases; only the pre-existing Hub-pause no-catch-up timing
  assertion failed under concurrent load. That exact test passed immediately in
  isolation. No timeout or product assertion was changed.
- The clean exact-tree Mac gate at Website commit
  `4cc85192575e4b0d66b0ad7e1ebcea5f9a15e11d`, tree
  `b1f44722c68998ef4a86de47ba798fbfc96b8ed8`, passed `16/16`
  backend/contracts, `4/4` library, `43/43` loot, `232/232` prerequisite/save,
  `1323/1323` broad runtime, every weather/party/HUD/diagnostic/Hall/Hub UI and
  desktop tail suite, backend build/formatting, lint/import boundaries,
  production frontend/game-host builds, media policy, and bundle budget
  (`415695` raw / `116365` gzip bytes). The Mac was arm64 macOS `26.6.2`,
  Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Chrome
  `151.0.7922.170`.
- Physical-Mac Chrome/WebGL anonymous leave advanced IndexedDB revision
  `1 -> 2`, saved tick `322`, and resumed at X `1039.0505779667071` after
  movement from X `950.64`. Authenticated cloud slot zero likewise advanced
  `1 -> 2`, saved tick `293`, and resumed at the same moved X. Both journeys
  returned through gameplay `LEAVE GAME` to Title and then Last Game with empty
  page, console-error, console-warning, and unexpected-warning arrays.
- The fault journey deliberately aborted the first cloud PUT. The page showed
  `The College is unreachable — check your connection.`, retained the live Hub,
  reopened the native pause menu, then retried, advanced cloud revision
  `1 -> 2`, saved tick `395`, and resumed at X `1039.0505779667071`.
  Only the injected `net::ERR_FAILED` and matching `save.sync_failed` warning
  appeared; unexpected error/warning arrays were empty.
- Inspected Mac captures copied locally are
  `/tmp/solomon-save-leave-anonymous-mac.png` SHA-256
  `bd8ec495e289eb633b2cc5f9c41922bc8edd6912cb1cb983ffd78130e241d2f7`,
  `/tmp/solomon-save-leave-cloud-mac.png`
  `a18a1d6426a26ebbee2283b37b6d02329ffa60aa3378140c37b2e0e284d015c8`,
  and `/tmp/solomon-save-leave-cloud-retry-mac.png`
  `69a37843ce347c933502cd4411df3fb38c4fc4a1e2d850c6873b95abc5bbc33b`.
- The only `blocked-by-platform` member remains abrupt browser/process loss:
  async browser storage cannot be guaranteed after the process is gone. The
  most recent semantic/30-second checkpoint bounds that loss; explicit in-game
  leave has the exact durable acknowledgement. Publication is authorized and
  pending; deployment remains a separate unauthorized operation.

## 2026-09-03 — Five-player checkpoint storm and latest-progress persistence reopening

### Reported smell and parity question

- A live five-player production run on the NFO host repeatedly stalled while
  ordinary gameplay and level-up choices produced very large owner saves. The
  user explicitly rejected constantly writing cloud saves and authorized
  correcting every measured lag owner before considering a renderer pivot.
- This reopens the browser adaptation in this entry, not the retail save
  lifecycle. The earlier pass correctly bounded abrupt-loss exposure to 30
  seconds and made leave/deployment terminal edges durable, but it treated
  every intermediate semantic state as a separately required cloud write and
  performed every owner projection synchronously in one event-loop turn.
- The parity question is whether the Website can retain one authoritative
  owner continuation, exact final leave, update-safe recovery, and Game Over
  invalidation while coalescing superseded progress and never serializing an
  entire multiplayer party in one uninterrupted burst.
- Falsifiers are: a skipped intermediate document is the only owner of a
  durable terminal edge; a later document can precede an older revision in
  storage; a level-up choice must resume combat before the group barrier
  closes; or one-client-per-turn publication changes the represented
  authoritative state rather than only when its bytes are materialized.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live NFO authority | production run `adea92b9b842f8859f618f8a970fa2d8`, revision `a2b19c2f`, `2026-09-03T03:20:59Z..03:40:23Z`; structured `solomon-dark-game.service` journal | 38 private `simulation.tick_lag` episodes occurred in 19m25s. The 25-step catch-up cap means each represented at least 253..431 ms of lateness; 36 also stalled the empty shared Hub and 17 landed immediately after a 3,000-tick autosave boundary. | high-live |
| Cloud persistence | `solomon-dark-revived.service` EF command metadata and `/var/lib/solomon-dark-revived/sdr.db`, same pre-update window | 602 owner-slot updates wrote 534.04 MiB; median document size was about 863 KiB and the database command itself was only 2 ms median. Persistence frequency and upstream document work, not SQLite throughput, owned the volume. | high-live |
| Recovered owner documents | read-only slot-zero summaries during waves 18..21 | individual documents were approximately 0.74..1.21 MiB and repeated one generated scene with 445 objects, 234 sprites, 36 roads, 27 fences, and three 300-plus-row scenery-target collections alongside the changing run. | high-live shape; no capability retained |
| Recovered continuation | revision `de814b46`, three-player update-safe continuation through wave 29, `2026-09-03T03:40:24Z..03:52:34Z` | no private tick-drop warning occurred at the lower load, but 131 site-wide owner writes still moved 116.51 MiB before the recovered session closed. The database remained 2 ms median. | high-live; includes brief concurrent sessions and is therefore site-wide rather than run-exclusive |
| Current host causal trace | `game-host.ts` at task base `f74a441c`: every `publishSaveCheckpoint` call loops all connected clients; level-up selection, reroll/save, pause, quickbar, primary/concentration, Hub, mod, tutorial, and lifecycle branches call it directly | one player's intermediate action can synchronously project, stringify, size-check, compress, and send every participant's 0.7-plus-MiB document. Five players choosing once is an N-by-N publication pattern. | high-static |
| Current browser causal trace | `GameSaveCoordinator.accept`/`persist` at `f74a441c` | every accepted sequence appends another store write to a promise chain. A newer progress checkpoint cannot supersede an older queued one even though only the newest continuation can be resumed. | high-static |
| Existing stock proof | retail 0.72.5 destructor/writer/loader evidence earlier in this entry | stock requires semantic/final writes and clean-destruction ordering but has no periodic cloud writer, browser revision queue, multiplayer owner fan-out, or network round trip. | high instruction-derived |

No raw production document, party-rejoin capability, credential, account ID,
or database copy is retained by this task. Counts and bounded structural
summaries are the durable evidence.

### System boundary and membership inventory

Native system: retail profile/run persistence and clean destruction. Website
adaptation: host-authored owner projections, checkpoint scheduling, browser
cloud/IndexedDB persistence, update-safe party recovery, and terminal invalidation.

| Member (scene/branch/lifecycle) | Native or Website owner | Disposition | Required proof |
| --- | --- | --- | --- |
| 30-second active progress checkpoint | browser abrupt-loss adaptation | `exact-ported` retained cadence | one owner document per connected participant, no NFO tick burst, at most 30 seconds of active progress exposed to abrupt process loss |
| intermediate multiplayer skill choices | mandatory native SkillPicker barrier plus Website owner save | `exact-ported` as one completed-barrier publication | choices remain authoritative in memory while the world is held; the final choice schedules one owner document per participant rather than one party-wide batch per click |
| level-up reroll | Website-only offer control | `out-of-system` as an individual durable write | no cloud write until a final choice/barrier completion, forced lifecycle edge, or periodic checkpoint |
| quickbar, selected primary, concentration, Hub inventory/service, tutorial, and player-local mod mutation | owner-specific durable profile state | `exact-ported` target-only publication | only the affected owner is scheduled; unrelated participants are not rewritten |
| pause-menu, Inventory, and SkillScreen open/close | no retail durable mutation | `out-of-system` as a save trigger | no checkpoint merely because presentation was paused |
| run entry, Tutorial entry, loadout completion, and party-recovery topology rotation | shared run/continuation lifecycle | `exact-ported` group publication | every affected participant receives one current owner projection |
| participant disconnect | recovery-lineage and remaining roster mutation | `exact-ported` group publication | surviving members receive current recovery ownership; the departing socket owns no later queued send |
| explicit gameplay leave | retail clean destruction plus Website durable acknowledgement | `verified-already-at-parity` forced synchronous edge | exact checkpoint sequence reaches durable storage before disconnect/title |
| deployment restart | Website update-safe recovery | `verified-already-at-parity` forced frozen-world edge | every connected owner acknowledges the target-revision checkpoint before code 1012 |
| Game Over | native resumable-run invalidation | `verified-already-at-parity` forced profile-only edge | pending progress is superseded and no later active continuation can recreate the run |
| host progress queue | Website event-loop adaptation | `exact-ported` latest-per-owner scheduling | requests coalesce by player and at most one expensive projection executes per event-loop turn |
| cloud and IndexedDB write queue | Website storage adaptation | `exact-ported` latest-wins pending persistence | first in-flight work may complete; all not-yet-started progress collapses to the newest document and every covered promise resolves only after that newer state is durable |
| optimistic revision conflict and write failure | Website storage adapter | `verified-already-at-parity`; coverage expanded | failed actual writes reject every covered waiter once and surface the existing diagnostic without pretending success |
| stream replacement, duplicate sequence, stale stream, and title replacement | `GameSaveCoordinator` | `verified-already-at-parity`; coverage expanded | strict ordering remains; replacement seals the old stream and cannot be overwritten by queued progress |
| UTF-8 16-MiB limit | save encoder/decoder | `exact-ported` allocation-safe check | ordinary small documents avoid a full temporary byte array; non-ASCII and near-limit documents retain the exact byte bound |
| host close/socket teardown | game host and scheduler | `exact-ported` | pending callbacks are cancelled and retain no client, document, or timer |

The existing `blocked-by-platform` member is unchanged: abrupt browser or
power loss cannot guarantee completion of an asynchronous cloud/IndexedDB
write. The user-authorized policy continues to bound that visible difference
to the latest 30-second or lifecycle checkpoint.

### Native ownership thread and recovered contract

- Retail still owns profile/run semantics, clean destruction, Last Game, and
  Game Over invalidation. The browser host remains the only save-document
  producer and storage adapters remain byte consumers.
- A progress checkpoint is replaceable only before its store write begins.
  Once a write is in flight its revision transaction completes normally; the
  newest pending document follows it and covers every superseded waiter.
- Explicit leave, deployment restart, and Game Over are nonreplaceable
  lifecycle outcomes. They cancel older unsent host work and remain directly
  awaited through their existing checkpoint sequence.
- The authoritative level-up barrier already prevents combat from advancing
  between party choices. Persisting its completed state once per owner retains
  every chosen skill without serializing each intermediate pending-player set.
- Host scheduling may delay byte materialization across event-loop turns, but
  cannot change simulation ticks, RNG, player choices, party membership,
  owner-only projection, save schema, revision order, or terminal behavior.

### Nearby-system findings

- `encodeDocument` currently performs `JSON.stringify` and then allocates a
  second complete `TextEncoder` result only to reject values over 16 MiB. A
  UTF-16 string shorter than one third of that limit is provably within the
  UTF-8 bound and needs no second allocation; larger/non-ASCII edges retain the
  exact measurement.
- The NFO database is not the optimization target. Its median update was 2 ms;
  reducing SQLite durability or weakening optimistic revisions would preserve
  the host/browser amplification and lose correctness.
- The same Node process owns shared Hub and private hosts. Removing long
  uninterrupted save batches addresses the measured cross-session stall; host
  process isolation remains a separate adoption decision only if controlled
  post-fix evidence still shows shared event-loop blockage.

### Web implementation consequence

- Add one host-owned latest-per-player checkpoint scheduler. Route ordinary
  progress through it, perform one projection per `setImmediate` turn, and
  publish one bounded batch-completion diagnostic with sources, target count,
  emitted bytes, synchronous work, and coalesced request counts.
- Replace level-up N-by-N publication with one group request when the barrier
  closes. Rerolls and pause presentation do not save independently; local
  mutations schedule only their owner; shared run/topology edges schedule the
  affected group.
- Deepen `GameSaveCoordinator` so a pending document can be replaced by a
  newer accepted sequence while all superseded sequence promises resolve or
  reject with the actual write that covered them.
- Preserve the current 30-second cadence, schema 28 bytes, forced lifecycle
  writes, cloud/IndexedDB adapters, party recovery claims, and strict revision
  checks. No compatibility format or second save path is introduced.

### Validation contract

- Host red/green regression: a five-player level-up barrier produces five
  final owner documents, not 25 intermediate documents; rerolls and pause do
  not publish; target-local settings publish only that owner; run/topology and
  periodic paths still cover their complete membership.
- Scheduler regression: repeated requests coalesce per player, publication
  executes once per event-loop turn, forced terminal publication cancels stale
  pending work, disconnected clients receive no later send, and close clears
  every callback/reference.
- Coordinator regression: while one store write is in flight, arbitrary
  progress sequences collapse to the newest pending document; duplicate and
  per-sequence outcomes remain stable; Game Over/replacement wins; a failed
  actual write rejects all waiters it covers, while `idle()` follows the newest
  requested checkpoint and is not poisoned after a later successful write.
- Encoder regression: ordinary ASCII documents avoid full byte materialization;
  multi-byte values on both sides of the 16-MiB edge retain exact admission.
- Mac browser journeys: anonymous and authenticated progress, multiplayer
  level-up, leave/resume, Game Over, deployment restart, revision conflict, and
  recovery all retain empty unexpected error arrays and exact persisted state.
- Controlled base/candidate Mac receipt: compare owner documents emitted,
  storage writes, peak uninterrupted checkpoint work, host tick cadence,
  process memory, and bytes under the same five-player scripted barrier/load.
- Run the complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on
  the byte-identical final candidate.

### Implementation validation receipt for the 2026-09-03 reopening

- `GameSaveCheckpointScheduler` now retains only the newest pending source per
  owner and publishes at most one owner document per `setImmediate` turn.
  Pause, level-up reroll, and intermediate choice states no longer publish;
  the completed SkillPicker barrier publishes once per owner. Local durable
  mutations target only their owner, while run/topology boundaries retain
  group coverage. Forced leave, deployment, and Game Over still bypass the
  scheduler and cancel an older unsent owner projection.
- The periodic boundary enqueues at tick 3,000; deferred materialization
  deliberately records the latest current tick rather than a stale copy of
  exactly 3,000. The regression therefore requires `savedAtTick >= 3000`,
  which remains bounded by the scheduler turns while preserving newer progress
  during CPU catch-up.
- `GameSaveCoordinator` completes the first in-flight storage transaction and
  replaces every not-yet-started document with the newest checkpoint. All
  superseded callers wait for the write that actually covers them. A failed
  transaction rejects only its covered callers; a subsequent successful
  checkpoint restores the newest `idle()` outcome. Exact stream, duplicate,
  replacement, optimistic-revision, and terminal ordering remain intact.
- Small save documents now use the provable UTF-16-to-UTF-8 upper bound before
  allocating a complete `TextEncoder` buffer. Documents in the ambiguous
  range still receive exact UTF-8 measurement, and both ASCII and three-byte
  Unicode 16-MiB edges have focused coverage.
- Three alternating measured Mac samples at production snapshot rate used the
  same benchmark source on untouched base `f74a441c` and the candidate. Median
  five-player, twenty-choice SkillPicker output fell from `100` to `5` owner
  messages and from `5,456,389` to `273,677` bytes: `95.0%` fewer messages and
  `95.0%` fewer payload bytes. A 100-request, 5-ms-store burst fell from `100`
  writes / `623.598 ms` to `2` writes / `11.180 ms`, with final document 100
  retained.
- The Mac browser save journey advanced local revision `1 -> 2`, persisted
  tick `398`, and resumed X `1039.0505779667071` after movement from X
  `950.64`; page, console, and unexpected-warning arrays were empty. The full
  deployment-restart journey passed for anonymous and authenticated owners,
  advanced each final revision `2 -> 4`, preserved the moved continuation,
  retained Game Over/profile-only behavior, and reported one saved and zero
  unacknowledged players on the second drain.
- The exact candidate passed the canonical Mac gate: zero-warning/error
  backend Release build, `19/19` Website/backend contracts, lint and generated
  boundaries, `2601/2601` Node tests across every frontend/desktop group,
  production frontend and game-host builds, media policy, and bundle budget.
  `Game-B8oK0i5p.js` measured `265,780` raw / `80,974` gzip bytes against
  `524,288` / `134,144` limits. No production push or deployment was performed.
