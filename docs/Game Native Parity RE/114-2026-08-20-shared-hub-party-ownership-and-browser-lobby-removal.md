# 2026-08-20 — Shared-Hub party ownership and browser-lobby removal

## Reported smell and parity question

- Reported web behavior: every browser New Game reserves an isolated,
  discoverable web lobby and eventually provisions one authoritative host whose
  single world contains every lobby participant. A second player joins from the
  website directory rather than meeting the first player in the Hub.
- Requested behavior: every browser player enters one shared Hub instance and
  receives a singleton party. A desktop click or mobile tap on another player
  opens a name-only profile; the local player can invite that target, the target
  can accept, and the party leader can move exactly the current party into its
  own Boneyard while unrelated Hub players remain in the Hub. Browser lobbies
  and their directory, URLs, reservation roles, and lifecycle are removed.
- Stock behavior to preserve: Create owns the complete character configuration;
  the gameplay-owned player entity persists across Hub and Arena; private Hub
  regions are participant-local; an authenticated authority starts Arena with a
  frozen participant set; the loader barrier seals input before Arena materializes;
  and post-run native progression precedes re-entry to a fresh Courtyard.
- Falsifiable questions: can three separately admitted players see the same
  Courtyard without sharing a party; can selection distinguish player painter
  order from traders and gameplay aim on mouse and touch; can invitation
  acceptance change exactly one membership atomically; can a two-player party
  enter one run while the third player's Hub tick and movement continue; and can
  the party return without creating a private Hub or losing progression?

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions and durable report | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `origin/main` `a1876fb`; `docs/reverse-engineering/native-session-flow.md`; `Gameplay_CreatePlayerSlot` `0x005CB870`, `Gameplay_FinalizePlayerStart` `0x005CFA80`, `Gameplay_SwitchRegion` `0x005CDDD0`, and `Arena_StartWaves` `0x00465C00` | One gameplay-owned player actor survives world changes. Run entry is authority-authored, originates in Courtyard, freezes the authenticated participant set, seals input, attaches Arena, then releases after mutual materialization. | high |
| Captured native lifecycle | `session-flow-goldens.json`, isolated instance `flw-g13-final`, PID `33708`, capture loader SHA-256 `23c12dc955ae7cbf31906107e4b5a9f4596100578d5bf9095ed68205cb05a08c` | The complete graph has shared Courtyard, four participant-local private rooms, the loading barrier, Arena, Game Over, post-run front end, and Courtyard re-entry. | high |
| Existing parity ledger | player-character ownership, Hub private rooms, loader-owned Hub/Boneyard barrier, random Boneyard ownership, multiplayer teardown, and browser-save entries | The web port already preserves persistent character state, participant-local Hub room intent, 100 Hz simulation, 20 Hz snapshots, Boneyard loading order, run lifecycle, and explicit transport teardown. | high |
| Current web causal trace | Website `28c1927`; `Game.tsx`, `game-bootstrap.ts`, `GameSessionEndpoints.cs`, `GameSessionProvisioner.cs`, `game-session-supervisor.ts`, `game-host.ts`, `game-protocol.ts`, `MainMenuScene.tsx`, and `HubScene.tsx` | New Game creates `/api/game/lobbies`; the supervisor creates one host per lobby with reserved host/guest credentials; `/parties` lists it; the one host-wide `state.world` and `hostPlayerId` move every connected player into Arena. | high |
| Current interaction trace | Website `28c1927`; `HubScene.tsx`, `gameplay-input.ts`, `gameplay-pointer.ts`, `hub-world-renderer.ts`, and `hub-traders.ts` | The Hub already projects mouse/touch aim into authoritative world space and hit-tests traders, but has no player-selection owner, profile surface, party protocol, or mobile pointer path for actor selection. | high |

This investigation recovers no new reusable retail address or authored table.
The Mod Loader report already owns the complete native session graph, so no
Mod Loader file is changed for this deliberate browser multiplayer policy.

## System boundary and native membership inventory

Native system: gameplay participant, Hub-region, and Arena-transition ownership.
The new party and shared-host policy composes this native system but does not
pretend the retail executable contains Destiny-style social parties.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Create/loadout before actor construction | `0x00593C30`, `0x0058BCE0`, `0x005CB870` | `verified-already-at-parity` | existing Create and client-hello contracts |
| Persistent player entity across worlds | `0x005CB870`, `0x005CFA80`, `PlayerActorTick` `0x00548B00` | `verified-already-at-parity` | session-owned dense player ECS and save round trips |
| Shared Courtyard region 0 | Courtyard `0x00506490`, tick `0x0050C970` | `verified-already-at-parity` | Hub world/render/collision coverage |
| Mortuary region 1 | `0x005090A0`, tick `0x00509330` | `verified-already-at-parity` | participant-local Hub-region coverage |
| Library region 2 | `0x0050A360`, tick `0x00504BB0` | `verified-already-at-parity` | participant-local Hub-region coverage |
| StoreRoom region 3 | `0x00509B10`, tick `0x00504220` | `verified-already-at-parity` | participant-local Hub-region coverage |
| Office region 4 | `0x00509C70`, tick `0x00509F10` | `verified-already-at-parity` | participant-local Hub-region coverage |
| Authority-authored Courtyard-to-Arena edge | `Gameplay_SwitchRegion` `0x005CDDD0`; native-session G13 graph | `verified-already-at-parity` | existing host-only start command and loading barrier; party scope replaces lobby scope |
| Frozen run participant set and readiness | native-session report, run nonce/hash/250 ms stability | `verified-already-at-parity` | existing authoritative run membership and snapshot convergence |
| Arena region 5 and waves | `0x00464EE0`, `0x00465C00`, tick `0x0046E570` | `verified-already-at-parity` | Boneyard simulation and per-member run coverage |
| Game Over, retained loadout, and Courtyard return | `0x005CB570`, `0x005CF4F0`, `0x005A7F60`, `0x00589CD0` | `verified-already-at-parity` | existing game-run/save/lifecycle coverage |
| Name-only profile, player selection, invite, acceptance, and party leadership | no retail owner | `out-of-system` (intentional browser social policy) | requested product contract; isolated from native movement/render rules |
| One process-wide browser Hub and simultaneous party run instances | no retail owner | `out-of-system` (intentional server topology) | requested shared-Hub contract; native per-process world semantics remain inside each instance |
| Retired browser lobby directory/reservation flow | no retail owner | `out-of-system` (superseded browser policy) | removed rather than treated as native behavior |
| Steam/launcher lobby transport and `/api/lobbies` | loader/platform transport, not retail gameplay | `out-of-system` (separate product) | remains outside browser `/game` party ownership |
| Explicit private/dedicated session provisioning | operations transport seam, not retail gameplay | `out-of-system` (separate entry mode) | retained only for private smoke and external hosts |

## Web cutover membership inventory

Every row below must have executable proof before this entry can receive its
implementation receipt.

| Web member | Required end state and proof |
| --- | --- |
| New Game bootstrap | one single-use shared-Hub admission; no lobby id, directory row, host reservation, join URL, or cancellation request |
| Authentication | each admission can authenticate once; replay and unknown tickets fail closed; configured desktop/private endpoints remain distinct |
| Party registration | successful browser hello creates exactly one singleton party led by that participant |
| Shared Hub presence | independently admitted players inhabit one authoritative Hub simulation and can observe each other's movement |
| Player hit test | desktop primary click and mobile primary tap select the topmost visible nonlocal player in the local Hub region using the shared visual target `x +/- 45`, `y - 110 .. y + 30` |
| Profile surface | modal exposes only the selected player's current display name and closes without leaking gameplay input |
| Invite | a connected Hub participant can invite the selected player to their current party; duplicates and self-invites are rejected |
| Accept | the named recipient alone can accept a live invite; acceptance atomically replaces their singleton party membership and invalidates competing invites |
| Party roster/leader | every connected player belongs to exactly one party; leader and ordered members replicate; disconnect promotes the earliest remaining member |
| Party launch | only the current leader in any stable Hub room can select a Boneyard; the roster is frozen across Hub rooms and every current member enters that one run |
| Nonparty isolation | Hub players outside the launched party remain in the shared Hub and keep simulating; another party may launch a separate run |
| Run return | post-run retained-loadout confirmation merges the same party and progressed player entities back into the shared Hub |
| Party HUD | Hub/Boneyard ally roster is party-scoped rather than every shared-Hub resident |
| Save/resume | each party leader owns only that party's checkpoint; a resumed singleton can enter a nonempty shared Hub without replacing other players |
| Pause/Lua | pause authority is party-run scoped; public shared-Hub Lua fails closed so it cannot mutate unrelated residents or another run, while private/dedicated Lua remains unchanged |
| Disconnect/heartbeat | participant actor, membership, invitations, and empty run retire together; empty resident Hub is reusable and reports zero occupancy |
| Backend/supervisor | `/api/game/hub` admits browser players; health reports Hub players, parties, runs, and private sessions separately |
| Browser lobby removal | delete `/api/game/lobbies*`, `?party=`, web lobby tables/types/helpers, reserved-host/guest credentials, smoke tooling, tests, docs, and lobby-only strings |

## Native ownership thread

- Owner and construction path: Create produces a complete character; the
  authoritative host consumes it and creates one persistent player entity. The
  shared Hub owns region intent and collision while a party-run instance owns
  Arena state. Party membership is session control state beside, not inside,
  either world.
- Upstream state producers/callers: New Game admission and client hello create
  the singleton party; world-space player selection produces a target id;
  invite and accept messages mutate party state; only current party leadership
  can produce a start-run intent.
- State representation and transitions: `singleton -> invited -> joined party`;
  party location `hub -> loading -> boneyard -> post-run -> hub`; participant
  Hub regions remain independently `courtyard|mortuary|library|storeroom|office`.
- Downstream consumers/callees: party projection drives profile/invite UI,
  party-scoped Ally HUD, start controls, save authority, snapshot routing, and
  the Boneyard participant set. Simulation and render modules consume ordinary
  player/world snapshots and do not infer party membership.
- Sibling systems sharing ownership or data: admission tickets, host heartbeat,
  save checkpoints, authoritative pause/Lua, loading barriers, player painter
  order, trader hit testing, touch pointer ownership, and final-player cleanup.
- Entry, interruption, reset, and teardown: unused admission tickets expire;
  disconnect invalidates invitations and membership; leader disconnect promotes;
  an empty party/run retires; post-run confirmation returns the party; host
  shutdown closes all sockets while preserving no lobby-shaped state.

## Recovered behavioral contract

- Timing/ticks/thresholds: retain native `100 Hz` fixed simulation and `20 Hz`
  snapshot defaults. Party commands are ordered transport messages, not frame
  timers. Arena loading retains the existing monotonic lifecycle barrier.
- Geometry/transforms/coordinate spaces: selection reuses the existing
  viewport-to-world projection and one visual actor target spanning root-local
  `x +/- 45`, `y - 110 .. y + 30`. Only players whose Hub region matches the
  local participant are candidates; reverse painter order resolves overlap. UI
  remains in fixed logical `1600 x 900` HUD space.
- Render/hit/collision/traversal order: player selection precedes trader/action
  activation for a hit player and consumes that primary pointer edge. It does
  not alter authoritative collision or player painter order.
- Assets/audio/randomness: no new stock asset, sound, or RNG lane is invented.
  The profile/party panels use existing semantic web UI surfaces.
- Input/network authority/replication: the server validates every target,
  invite, acceptance, membership, and start command against current connected
  state. Client DOM state never authors party membership. Mouse and touch share
  Pointer Events and one hit-test implementation.
- Boundary and failure behavior: stale/disconnected/self targets, duplicate or
  expired invites, nonrecipient acceptance, nonleader start, full/moving party,
  or non-Courtyard leader fail without world mutation. Protocol violations fail
  closed; ordinary stale UI races are rejected without disconnecting healthy
  clients.

## Nearby-system findings

- The previous browser-lobby design made one `GameSimulationState.world` and
  one `hostPlayerId` stand for an entire provisioned host. Replacing only its UI
  would still pull every Hub resident into the first party's Boneyard. World
  instance ownership, authority, saves, pause, Lua, snapshots, and teardown must
  therefore move together.
- The current Ally HUD derives every nonlocal snapshot player. In a shared Hub
  that would label strangers as allies, so it must consume party membership.
- Current save resume requires an otherwise empty host. Shared-Hub admission
  must import the resumed player's entity into the existing Hub rather than
  replace the shared simulation.
- The external Steam launcher uses `lobby` as the platform transport noun and
  remains a separate `/api/lobbies` system. This cutover removes every browser
  game lobby member under `/api/game/lobbies` without renaming Steam itself.

## Confidence and open questions

- Confirmed: complete native G13 membership and ordering; current web lobby,
  authority, world, snapshot, save, input, UI, and teardown owners; no authored
  native party/profile asset or table exists to extract.
- Inferred product policy: accepting an invitation is allowed only from the
  recipient's singleton party, preventing an implicit abandonment or orphaned
  group because no Leave Party action was requested.
- Unknown: none that requires a guessed native constant or browser-platform
  approximation. Party capacity follows the configured host connection limit
  until a distinct product limit is specified.

## Web implementation consequence

- Correct owner/module: a pure server-side party coordinator owns membership,
  invitations, leaders, and projections; a world-instance owner partitions the
  shared Hub and party runs; `HubScene` owns presentation-only player hit testing
  and profile UI.
- Shared model change: protocol party commands/state and per-client current
  world snapshots; supervisor single-use shared-Hub admissions; per-party
  authority and checkpoints.
- Stock behavior preserved: Create precedes actor construction; regions remain
  participant-local; only an authority starts a frozen run set; Boneyard loading,
  gameplay, Game Over, retained loadout, and re-entry keep their recovered order.
- Browser-specific approximation: none. The social/topology behavior is an
  explicit web product extension rather than an approximation of retail code.
- Obsolete path to remove: the entire discoverable browser-lobby control plane,
  reservation roles, list/join/cancel UI, direct query link, and tests.

## Validation contract

- Focused automated tests: party state creation/invite/accept/rejection/leader
  migration; protocol strict decoding; simulation partition/merge preservation;
  shared supervisor admission replay/expiry/health; three-client host flow;
  player hit-test painter/region/local exclusion; profile and touch pointer
  contracts; party-scoped Ally HUD; save/pause/teardown; absence scans for every
  removed browser-lobby symbol and route.
- Playwright/runtime journey: repeat the complete flow at desktop mouse and
  mobile-touch viewports. One real browser exercises visible invitation Accept,
  name-only profile, and player invite controls while three real WebSocket peers
  supply the party leader, second party member, and unrelated Hub resident. The
  leader starts; all three party members receive one run while the unrelated
  resident remains movable in Hub; no page, console, request, or protocol errors.
- Stock-versus-web comparison: retain matching Create-to-Hub, participant-local
  room, leader-authored loading barrier, Boneyard entry, Game Over, retained
  loadout, and Hub-return contracts against the cited G13 evidence.
- Measurable acceptance criteria: one supervisor Hub path; four unique player
  ids initially split across singleton parties; final party roster exactly
  `[leader,browser member,second member]`; one identical run id for those three;
  the fourth player's world remains `hub` and its position advances; zero
  `/api/game/lobbies` calls or `?party=` URLs; both mouse and touch activate the
  same profile target.

## Implementation validation receipt

- Implementation: `host/party-system.ts` owns singleton registration,
  invitation/acceptance, ordered membership, capacity, leader promotion,
  invalidation, and per-client projection. `host/shared-game-worlds.ts` owns the
  resident Hub plus party-scoped run partitions, fixed ticks, disconnect,
  save-state projection, post-run progression-preserving merge, and loaded
  Boneyard lookup. `game-host.ts` routes each client to its current world,
  publishes party-scoped authority/snapshots/checkpoints/pause state, rejects
  public-Hub Lua, and materializes only the leader's frozen party. Protocol 35
  adds strict invite/accept and local-party messages.
- Control-plane cutover: browser New Game now requests a single-use
  `POST /api/game/hub` admission to `/game-hub`; the resident supervisor expires
  and atomically consumes tickets and reports private sessions, Hub players,
  parties, and runs separately. Caddy routes `/game-hub`. The discoverable
  `/api/game/lobbies*` API, `?party=` entry, reserved host/guest credentials,
  web lobby table/types/helpers, list/join/cancel flow, and lobby smoke were
  removed. The separate Steam launcher `/api/lobbies` transport remains
  explicitly out of this browser-game system.
- Client/UI: `HubScene.tsx` and `hub-player-selection.ts` share one Pointer
  Events/world-projection hit path for mouse and touch, local/other-region
  exclusion, painter-depth selection, and the `x +/- 45`, `y - 110 .. y + 30`
  visual target. The modal shows only the current name plus invite/close actions;
  the party panel exposes ordered membership and received Accept controls.
  `AllyHud` filters shared-Hub strangers and keeps complete same-party run rows.
- Regression coverage: strict protocol round trips/rejections; singleton,
  invite, duplicate/self/full, acceptance, abandonment, disconnect, and leader
  migration; shared-world partition, independent tick, launch rejection, and
  post-run merge; admission replay/expiry/health; four-client host launch and
  heartbeat; desktop/mobile hit geometry; party-scoped ally rows; client party
  state/actions; and source-level absence of every retired browser-lobby seam.
- Canonical gate: Windows-native `./scripts/validate.sh` exited 0 on the combined
  tree rebased directly onto Website `origin/main` `b2b06dc`. It passed 25
  backend contracts, 40 loot tests, 155 prerequisite/save tests, 1,030 broad game/frontend tests,
  13 party/cutover tests, 5 level-up tests, 7 diagnostics tests, 14 Hub UI tests,
  5 desktop tests, backend formatting, frontend lint/import boundaries,
  production browser and standalone-host builds, the bundle budget (`235522`
  raw / `68984` gzip bytes), and production media policy. Lint emitted only the
  repository's existing Fast Refresh warnings. The Lua WASM path fixture now
  constructs native file URLs so the ownership assertion runs on Windows and POSIX.
- Browser proof: Windows Chrome `150.0.7871.124` ran the exact rebased source
  against an isolated backend and supervisor. At mobile `844 x 390`, touch accepted Basil's
  invitation, selected Cassia, opened her name-only profile, invited her, and
  entered run `49d77d11b0406e24deddb4db40fd12d0` with both peers; unrelated Daria
  remained in Hub and moved X `950.64 -> 966.3578985551`. At desktop
  `1600 x 900`, the mouse journey entered run
  `8ee9ad1aebbfc92d771f2223b05f6541` and Daria moved
  `950.64 -> 970.1110134938359`. Both runs reported
  `hubPlayers=1`, `parties=2`, `runs=1`, then
  `sessions=hubPlayers=parties=runs=0` after teardown. Both page-error and
  console-error lists were empty.
- Documents: this ledger, `game-runtime-architecture.md`, `backend-spec.md`, and
  `ops/nfo/README.md` now own the shared-Hub/party topology and operational
  contract. No Mod Loader file changed because the existing G13 native-session
  report already owned every reusable retail fact and this feature adds only an
  explicit browser social/topology policy.
- Remaining scope: no required member is unimplemented or browser-blocked.
  Deployment and production verification remain separate from this
  implementation receipt.
