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
