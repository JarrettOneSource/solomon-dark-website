# 2026-08-22 — Coordinated deployment checkpoint, disconnect, and app restart

## Reported smell and parity question

- Reported web behavior: the machine-local deployment worker validates a new
  `main` revision but defers indefinitely while any browser game is occupied.
  A direct supervisor restart closes players with generic WebSocket code `1012`
  and does not wait for the browser save adapter.
- Required behavior: a validated deployment must stop accepting admissions,
  checkpoint every connected player through the existing anonymous IndexedDB
  or authenticated cloud-slot owner, show a game-updating disconnect message,
  restart the complete Website/game application, and reload open `/game` pages
  into the exact deployed revision.
- Reproduction inputs/scenes: signed-out and signed-in players in shared Hub,
  party Boneyard, private-session Hub/Boneyard, Game Over/loadout, an idle title
  tab, and a browser that disappears or cannot finish its final storage write.
- Falsifiable questions: whether the host can produce a final owner projection
  for every party member; whether cloud storage remains reachable until all
  acknowledgements finish; whether new admissions can race the cutover; whether
  a generic `1012` failure can replace the requested update UI; and whether the
  browser can distinguish the old release returning `200` from the target
  release becoming live.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native save evidence | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; clean-destruction writer `0x005CD3A0`; the 2026-08-20 save entry above | Retail clean game destruction owns a final resumable-run write. Browser process loss cannot provide the same synchronous destructor, so an explicit pre-restart handshake is required. | high |
| Current deployment worker | Website `0574fa68b6362f527d4fa85a8323c6ca5a797895`, `ops/local-ci/deploy-main.sh:260-264,426-445` | A nonzero `/health.sessions` count exits successfully as deferred. Only a zero-count cutover stops and starts the Website and game units. | high |
| Current host/client path | `game-host.ts:1585-1678,2378-2399`; `game-session-supervisor.ts:606-623`; `game-save-coordinator.ts`; `Game.tsx` | The host emits semantic and five-second checkpoints, the page serializes them to cloud or IndexedDB, but shutdown closes code `1012` without a storage acknowledgement. | high |
| Live production observation | NFO supervisor health and local deployment journal, 2026-08-22 12:36 EDT | With one active run/player, revision `0574fa68` validated and logged `deployment deferred because 1 game session(s) are active`; production remained at `4589ab84`. | high |

This operational pass reuses the settled native save ownership and does not
claim a new retail multiplayer/deployment mechanism. No injected process,
runtime address, or new Mod Loader fact is used.

## System boundary and membership inventory

Native system: clean game-destruction save ownership at `0x005CD3A0`; web
extension boundary: validated-release drain from admission closure through one
final host checkpoint per browser, storage acknowledgement, scoped service
cutover/rollback, and exact-revision page reload.

| Member (class/variant/scene/branch) | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| GitHub pull-request/push validation | `.github/workflows/validate.yml` | `out-of-system` (validation never owns production processes) | workflow invokes only `./scripts/validate.sh` |
| anonymous shared-Hub singleton | host owner projection -> IndexedDB slot zero | `exact-ported` | final sequence persists before ready acknowledgement |
| authenticated shared-Hub singleton | host owner projection -> account slot zero | `exact-ported` | final sequence receives successful cloud PUT before acknowledgement |
| shared-party leader in Hub or Boneyard | party state and mod runtime -> leader adapter | `exact-ported` | leader final document resumes at the drained state |
| shared-party non-leader in Hub or Boneyard | same authoritative party state projected to that player | `exact-ported` | every member receives and persists an owner-only continuation, replacing the earlier leader-only product rule |
| private-session authority and additional players | private host state projected per connected player | `exact-ported` | every authenticated socket receives its own final document |
| Game Over and loadout | terminal save-clear lineage | `exact-ported` | final ordered clear is acknowledged; no completed run is recreated |
| outstanding Hub tickets, private provisioning, and new WebSocket upgrades | supervisor control plane | `exact-ported` | drain state rejects each admission edge before checkpoints are captured |
| browser checkpoint storage queue | `GameSaveCoordinator` | `exact-ported` | restart waits for the exact final sequence after all older writes/deletes |
| coordinated browser disconnect | protocol and client session | `exact-ported` | update-specific signal and close reason do not render the generic failure page |
| idle Title/Create `/game` tab without a socket | immutable deployment manifest poll | `exact-ported` | target revision change reloads the tab without inventing a game save |
| Website and game supervisor units | NFO atomic release cutover | `exact-ported` | only `solomon-dark-revived.service` and `solomon-dark-game.service` restart; Caddy reloads gracefully if changed |
| database/Caddy/runtime rollback | deployment error trap and retained release | `exact-ported` | SQLite backup/integrity and prior release remain authoritative |
| unresponsive, crashed, or storage-failing browser | browser process/network boundary | `blocked-by-platform` (a dead or nonresponsive browser cannot execute IndexedDB or authenticated HTTP) | bounded grace expires and deployment continues; its last prior owner checkpoint remains resumable if one exists, but a party guest with no prior continuation cannot acquire one after its browser stops responding |
| desktop-local and native Steam sessions | separate platform shell/runtime | `out-of-system` (the NFO browser deployment does not own those processes) | no desktop/native process command in the worker |

The predicted visible platform difference is confined to an already dead,
unresponsive, or storage-failing tab: it may resume from its last acknowledged
owner checkpoint instead of the final drain tick. A party guest with no prior
owner checkpoint may have no continuation because the server cannot write that
dead browser's IndexedDB or authenticated cloud slot. A responsive browser must
acknowledge the final exact checkpoint before it is disconnected.

## Native ownership thread

- Owner and construction path: retail `Game` destruction invokes the recovered
  run writer. In the web port, `game-host` owns authoritative bytes,
  `GameSaveCoordinator` owns ordered persistence, the supervisor owns admission
  drain, and the local deployment worker owns the service cutover.
- Upstream state producers/callers: the eleven recovered semantic profile
  writers, periodic five-second host ticks, terminal Game Over, and the
  authenticated deployment control request carrying the exact target Git
  revision.
- State representation and transitions: `serving -> draining -> checkpointing
  -> disconnecting -> stopped -> target-live`; the supervisor rejects admission
  from `draining` onward. Each client transitions `playing -> saving-update ->
  waiting-for-target -> reload`.
- Downstream consumers/callees: cloud slot-zero PUT/delete, IndexedDB
  write/delete, client ready acknowledgement, WebSocket update close, systemd
  Website/game stop/start, Caddy reload, target revision manifest, and Last Game.
- Sibling systems sharing ownership or data: private sessions, shared Hub,
  parties/runs, per-party Lua state, account JWT storage, anonymous browser
  storage, Game Over invalidation, diagnostics, TLS routing, and rollback.
- Entry, interruption, reset, and teardown: new admissions close before capture;
  disconnecting clients cannot mutate the frozen host; terminal clears remain
  ordered; the old site stays available for cloud writes until readiness; the
  target manifest, not a guessed delay or bare HTTP `200`, triggers reload.

## Recovered behavioral contract

- Deployment remains gated by exact-main validation and immutable artifact
  construction, but active occupancy is no longer a reason to defer.
- The supervisor control plane authenticates the drain request with the existing
  secret, freezes host input/ticks, rejects every admission path, and asks every
  connected player for one forced final checkpoint.
- Every responsive client serializes that exact sequence through its already
  selected account or anonymous adapter and acknowledges only successful
  persistence. The Website remains running until the acknowledgement grace
  completes so authenticated cloud writes cannot be cut off by deployment.
- The grace is bounded because a browser process cannot be compelled to run.
  Unacknowledged clients are reported in the deployment receipt and
  disconnected. They retain a prior owner checkpoint if one exists; they never
  cause the new release to wait indefinitely.
- The update signal owns bespoke player copy. Coordinated close uses WebSocket
  restart code `1012` with reason `game updating`; the client keeps the update
  surface mounted rather than converting the expected restart into a fatal
  connection report.
- The published release contains a no-store revision manifest. Active clients
  poll it rapidly after saving; idle production `/game` tabs poll it at a
  bounded background cadence. Reload occurs only when its 40-character revision
  matches the announced target or differs from the currently executing build.
- Cutover remains scoped to the two Solomon Dark services. Minecraft and all
  unrelated services remain outside the worker's ownership.

## Nearby-system findings

- The earlier first-slot entry's `party guest writes` disposition is superseded
  by this explicit product requirement. The existing owner-only serializer can
  project the same authoritative party world for each participant, so no shared
  account slot or client-authored snapshot is needed.
- A generic SIGTERM remains crash/manual-stop behavior. CI/CD must use the
  authenticated pre-stop drain endpoint; treating the existing `1012` shutdown
  close as a save protocol would recreate the unreliable browser-destructor gap.
- The local worker is installed outside the release archive. Activating this
  policy therefore requires the new supervisor/client release to be live before
  refreshing the installed worker; the legacy worker must retain its zero-session
  bootstrap gate until then.

## Confidence and open questions

- Confirmed: native clean-destruction save ownership, current web checkpoint
  authority and storage adapters, current shutdown behavior, all supervisor
  admission edges, NFO unit scope, and the live defer behavior.
- Product policy: every connected browser player owns an individual slot-zero
  continuation at deployment, including a party non-leader; deployment proceeds
  after bounded grace rather than waiting forever for an unresponsive browser.
- Unknown: none material. Browser inability to execute code after process loss
  is the named platform block; a prior owner checkpoint is retained when one
  exists, while a never-checkpointed unresponsive guest cannot acquire one.

## Web implementation consequence

- Correct owner/module: host creates per-player final documents; supervisor
  coordinates drain; page-level save coordinator proves storage completion;
  deployment worker performs cutover; revision monitor owns reload.
- Shared model change: strict protocol 53 adds deployment-restart and ready
  messages. Deployment-final shared/private publication becomes per-player;
  ordinary semantic and periodic publication remains continuation-authority
  owned.
- Stock behavior preserved: authoritative state remains the only save source,
  clean teardown writes before destruction, Last Game resumes owner-only state,
  and Game Over clears the lineage.
- Browser-specific approximation: an unresponsive tab falls back to its most
  recent acknowledged owner checkpoint if one exists.
- Obsolete path to remove: nonzero-session deployment deferral and generic
  expected-restart failure presentation.

## Validation contract

- Focused automated test: strict protocol shapes/version; per-player Hub,
  party-run, private-session, and terminal-clear checkpoints; coordinator exact
  sequence wait and storage failure; supervisor auth/admission drain/ack/timeout;
  update close copy; manifest comparison/polling; deployment script ownership.
- Browser/runtime journey: one anonymous and one authenticated browser enter a
  real run, mutate state, receive the deployment signal, show the custom update
  message, persist to IndexedDB/cloud, acknowledge, disconnect without a fatal
  report, observe the new manifest, reload, and enable Last Game for the exact
  drained checkpoint.
- Stock-versus-web comparison: reconcile the explicit final host write with
  retail clean-destruction writer `0x005CD3A0`; the account/IndexedDB transport,
  deployment control plane, and reload UI remain labeled Website extensions.
- Measurable acceptance criteria: active sessions never defer a validated
  cutover; admissions are closed before capture; every responsive socket is
  counted and acknowledged; target revision matches after restart; both stores
  resume; custom update copy is visible; unrelated services are untouched.

## Implementation validation receipt

- Runtime and protocol: strict protocol 53 carries `server-deployment-restart`
  and `client-deployment-ready`. `game-host` freezes fixed ticks/input, emits a
  forced owner-only final checkpoint for every connected shared/private player,
  waits for exact-sequence acknowledgements, then closes code `1012` with reason
  `game updating`. Normal semantic/five-second publication remains party-leader
  or private-host owned; terminal Game Over/loadout clears every participant
  that can own a deployment continuation.
- Supervisor and deployment: authenticated
  `POST /admin/deployments/restart` closes ticket/provision/upgrade admission,
  concurrently drains the shared Hub and live private hosts, tolerates already
  closing private sessions, reports saved/unacknowledged player counts, and
  cannot be deferred beyond the configured 30-second browser grace. The worker
  stages and backs up before drain, restarts only
  `solomon-dark-revived.service` and `solomon-dark-game.service`, recovers a
  drained old service on pre-cutover failure, retains atomic rollback, and no
  longer branches on active session count. Caddy-only reconciliation remains a
  graceful reload.
- Browser: `GameSaveCoordinator.waitFor(sequence)` exposes the exact cloud or
  IndexedDB result without poisoning later queue work. The page keeps gameplay
  mounted beneath `GameDeploymentUpdate`, displays `Game updating` and the
  saved/restart copy, suppresses the expected generic-failure route, and polls a
  no-store `/deployment.json` until the announced immutable revision is live.
  Idle production `/game` pages use the same manifest at a 15-second cadence.
  Vite emits the manifest itself, so the legacy zero-session worker can
  bootstrap the first protocol-53 application release before its machine-local
  worker is refreshed.
- Automated contracts: the exact Mac tree passed `15/15` backend/contracts,
  `4/4` library, `43/43` loot, `230/230` prerequisite/save/deployment tests,
  `1294/1294` broad runtime tests, `8/8` world weather, `29/29` party/chat,
  `11/11` level-up/HUD, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI, and
  `5/5` desktop tests, plus formatting, lint/import boundaries, production
  TypeScript/build, media policy, and bundle budget. The production Game entry
  was `399013` raw / `112049` gzip bytes. New coverage includes strict wire
  rejection, exact coordinator success/failure, every private player, a live
  shared-party non-leader and outsider, admission drain, responsive
  acknowledgement, and an unresponsive browser that still cannot defer the
  cutover.
- Exact-tree provenance: isolated Mac clone commit
  `72c4668feb144956bfab3eebd506d8530e7e85ab`, tree
  `8bf5e9d14fe864f3165d8cc6e30145d29c65a34b`, clean after validation; arm64
  macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`, .NET SDK `10.0.302`, and Chrome
  `151.0.7922.170`. Its emitted manifest was exactly
  `{"revision":"72c4668feb144956bfab3eebd506d8530e7e85ab"}`.
- Real Chrome/WebGL restart journey: anonymous IndexedDB advanced revision
  `1 -> 3` and final tick `1224 -> 1529`; authenticated cloud slot zero advanced
  revision `2 -> 3` and final tick `1000 -> 1181`. Each supervisor receipt was
  `players=1`, `savedPlayers=1`, `unacknowledgedPlayers=0`; both clients showed
  the custom update surface, closed without a fatal page, observed the announced
  manifest, reloaded automatically, and returned with Last Game enabled. Page
  and console error arrays were empty. Mac captures copied locally are
  `/tmp/solomon-deployment-update-anonymous-mac.png` (SHA-256
  `deae2e74f6ee27134a92aaf32470f25cf82deb1f164091e85ededecb9a160a3c`)
  and `/tmp/solomon-deployment-update-authenticated-mac.png` (SHA-256
  `9e202b9501f53a77ccc314b789e4a92c5eff267decd5aedad9af34d56f07ec92`).
- WSL diagnostic note: monolithic runs under load averages above 30 starved the
  same pre-existing three-second shared-Hub socket waits while all new
  deployment cases passed. No timeout was relaxed. The clean exact Mac gate is
  the decisive supported-suite receipt.
- Publication state: implementation commit is local only. Nothing was pushed,
  installed into the machine-local worker, or deployed to production; those
  remain separate operations.
