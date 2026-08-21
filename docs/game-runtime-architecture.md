# Solomon Dark rebuilt runtime architecture

Status: accepted; authoritative, GPU-client, shared-Hub party/chat,
desktop-solo, headless-crowd, and compact-replication slices implemented,
2026-08-21

This document records the load-bearing runtime decisions for the rebuilt game.
It does not replace `game-native-parity-re.md`: the native game remains the
visual and behavioral oracle, while this document defines where recovered
behavior lives in the clean rebuild.

## Product topology

Every play mode is an authoritative client/server session. "Peer hosted" means
that a player's desktop owns the authoritative server process; it does not mean
distributed or lockstep simulation.

| Mode | Client | Authoritative host |
| --- | --- | --- |
| Desktop solo | Packaged shared client | Server bundle spawned as a separate localhost process |
| Desktop host | Host's shared client plus remote desktop clients | The same server bundle on the host's machine |
| Desktop join | Packaged shared client | Peer-hosted or dedicated server |
| Web singleton party | Shared browser client | The process-wide shared Hub host; a party-scoped run instance after launch |
| Web multiplayer party | Shared browser clients | The same shared Hub host, then one party-scoped Boneyard run instance |
| Dedicated | Any compatible client | The same server bundle run headlessly |

The website is the control plane for browser admission, account identity,
subscribed content, cloud saves, and publishing. A packaged web-port client may
still provide local solo play with local identity and an empty content set, but
the Website no longer owns a DLL loader, custom-protocol launcher hand-off,
native-lobby directory, or native-save ZIP service.

Browser play has no launcher lobby directory or join-by-lobby URL. New Game
requests one single-use shared-Hub admission ticket, and the authoritative host
registers a singleton party when the completed character authenticates.
Players discover one another in the Courtyard itself, inspect a name-only
profile, and exchange party invitations over the gameplay protocol. The
current party leader alone can launch; that transition freezes the current
party roster and moves exactly those player entities into a party-scoped
Boneyard instance while unrelated Hub residents keep ticking in the shared Hub
instance.

The shared Hub and its in-world party system remain the only Website
multiplayer authority and entry path. The Dark Cloud browser may read a public
directory projected from that owner: it lists safe multi-member party summaries
and sends the player through ordinary shared-Hub admission. It does not expose
internal singleton memberships, invitations, credentials, content manifests,
private sessions, or a direct join edge. No launcher transport participates in
the rebuilt browser game's party model.

The same authenticated gameplay connection carries ephemeral text chat. A
public-Hub singleton sees Global; a grouped Hub participant defaults to Party
and may switch to Global; a Boneyard exposes Party only. Global reaches only
clients currently resident in the shared Hub. Party reaches only current
members of the sender's authoritative party, across the Hub-to-run transition.
There is no browser transcript service, whisper directory, cross-party route,
or chat persistence in saves.

## Shared identities and boundaries

The source tree owns four distinct modules:

- `core-kernels`: browser-safe deterministic movement, collision, and other
  explicitly predicted behavior. The client and server import the same source.
- `core-server`: authoritative world composition, actors, AI, RNG ownership,
  saves, and fixed-update scheduling. It imports the kernels; clients do not.
- `game-protocol`: versioned messages and one codec used by every transport.
- `game-client`: connection, input command production, prediction,
  reconciliation, interpolation, presentation snapshots, and teardown. The web
  and desktop shells use the same client implementation.

The authoritative session owns players in one dense ECS outside any particular
world. Stable player-entity IDs index separate identity, character-config,
locomotion, primary-cast, progression, skill-book, and stat-book component
stores. A whole
`PlayerCharacterState` is only a short-lived system or protocol projection; it
is not a second authoritative player record. The active world owns spawn
selection, static geometry, ambient actors, enemies, projectiles, and other
location rules. It may query player locomotion, resolve requested movement,
and commit locomotion components, but it neither owns nor clones player
progression. Hub-to-Boneyard placement resets the location-facing locomotion
slice while retaining the same player entity and progression books.
The skill-book column also owns first-learned public-row order, the selected
primary, two concentration slots and their replacement cursor, plus the eight
secondary intent slots. Inventory and SkillScreen presentation is shared by
Hub and Boneyard; scenes request the participant-owned screen but never clone
its state. Protocol 36 carries strict belt, primary, and concentration intents,
and the host applies them only to the authenticated participant before
publishing a new progression revision.
The session also owns the fixed-step accumulator and tick; neither clock is
nested inside a Hub ambient actor or another world-specific subsystem.

`PlayerId` identifies the connected participant. It is deliberately distinct
from the in-world character and from native gameplay-slot ordinals. This keeps
reconnect, future spectating, and world transitions from leaking connection
identity into position or actor behavior.

Party identity is also distinct from participant and world identity. Every
connected browser participant belongs to exactly one party. A new participant
creates a singleton party and is its leader. Accepting an invitation atomically
moves a singleton participant into the inviter's party; it never derives
authority from connection order. Leader disconnect promotes the earliest
remaining member. Invitations are invalidated when either endpoint disappears,
the target ceases to be a singleton, or the party starts a run.

Chat identity is never a fifth client-provided identity. A client chat command
contains only a channel and bounded text. The host derives player ID and
display name from the authenticated socket, resolves recipients against the
current party/world graph, allocates the ordered chat sequence, and echoes the
authoritative event. Client history is an 80-event presentation buffer, not an
authority store.

The browser supervisor owns one shared-Hub host for its process lifetime and a
bounded set of single-use admission tickets. It does not create one host per
player or party. The host owns a shared Hub simulation plus zero or more
party-scoped Boneyard simulations. Each socket receives snapshots only for its
current world instance, while party-control messages remain session-wide.
Leaving or a failed heartbeat removes the participant from its world and party;
an empty run retires independently, and an empty shared Hub remains ready for
the next ticket. Health reports active players, parties, and runs so deployment
safety does not mistake an empty resident Hub process for an occupied session.
The host also owns the safe public-party projection. A bearer-protected
supervisor control-plane read exposes that projection to the Website backend;
public clients receive only the bounded DTO from `GET /api/game/parties`.
Private per-session provisioning remains an explicit operations/test seam and
is not a browser New Game path.

The TLS edge is part of the browser-game release contract, not an out-of-band
host prerequisite. The release artifact carries the checked-in Caddy site;
deployment compares its expected hash with the live site even when the runtime
SHA already matches, validates a candidate before installation, backs up and
atomically installs changed configuration, reloads Caddy gracefully, and
restores the prior site with the runtime rollback. Shared `/game-hub` and
private `/game-sessions/*` handlers must precede the ordinary Website
fallback.

Browser connection diagnostics use endpoint-class correlation rather than a
credential: `shared-hub` for the resident host, a 32-character private
session id, or `null` before endpoint selection. Client and backend validate
that same closed set; arbitrary labels are rejected.

Platform shells remain deliberately different. A desktop shell can supervise
a child process and access local storage; a browser shell asks the website to
provision a remote instance. Those adapters may differ without creating a
second game client or game server.

The portable server release identity is:

`server bundle hash + content manifest hash + protocol version + pinned Node version`

The JavaScript server bundle is identical across supported platforms. Each
distribution carries the pinned platform-specific Node runtime. The game host
does not run inside Electron's Node runtime and must not acquire native npm
dependencies without revisiting this release invariant.

## Authority and time

- All gameplay mutations happen in `core-server` through deterministic fixed
  ticks. The current Courtyard evidence establishes a `100 Hz` tick for the
  reconstructed Hub.
- Render cadence, network snapshot cadence, and simulation cadence are separate
  clocks. Protocol messages identify simulation ticks, not wall-clock time.
- The server owns actors, collision response, AI, RNG, pause policy, and save
  serialization. Clients submit intent rather than positions.
- Boneyard loot is one authoritative subsystem, not a renderer consequence.
  Hostile death publishes the actor-private seed at the enemy owner; the
  Boneyard loot store alone advances the shared native stream, applies native
  collision placement, allocates Gold/Orb/Sack/Bonus actors, advances Goodies,
  resolves strict pickup order, and emits semantic audio/text edges. Currency,
  resources, inventory, and Bonus state are committed at the session-owned
  player-entity boundary after that one accepted pickup.
- Gameplay Pause Menu state is world-instance-owned rather than client-local.
  The ESC menu, player Inventory, and Skill Book share one source-qualified
  first-request barrier. A shared-Hub pause freezes every Hub resident while
  party Boneyard instances keep ticking; a party-run pause freezes every party
  member without pausing the shared Hub or another run. A pause owner closes
  its matching modal or disconnects to release only that world-instance
  barrier. Resumption never turns elapsed pause time into catch-up simulation.
- The shared player input record carries normalized movement, a nullable world
  aim point, and independent primary/secondary held levels. Browser mouse edges
  publish immediately; the authoritative queue preserves each level transition
  on its own fixed tick, while unchanged held state and same-level aim updates
  may coalesce. Spell systems consume this seam later rather than importing DOM
  button events or browser coordinates.
- The client predicts only explicitly shared kernels needed for the local
  player. Remote actors and server-only systems are presented from buffered
  authoritative snapshots.
- A party-owned run lifecycle is `hub -> active -> game-over -> loadout -> hub`.
  An all-eligible-dead edge freezes the terminal Boneyard world while the
  session tick and two replicated Game Over clocks continue. The entry/hold
  clock opens input at 1000; host acknowledgement starts a nullable 400-tick
  exit clock. World retirement and the retained-loadout reset occur atomically
  on the following fixed tick, so neither client rendering nor acknowledgement
  can destroy the image beneath an active fade. After retained-loadout
  confirmation, the same party and player entities merge back into the shared
  Hub; no private post-run Hub may remain resident.
- Player-character movement uses a two-phase shared kernel: first plan native
  intent/velocity, then let the active world resolve collision, then commit the
  resolved position plus native heading/gait state. Hub and Boneyard geometry
  therefore vary at the world seam without forking character behavior.
- A single pinned build on one platform must replay the same input script
  reproducibly. Cross-platform bit-identical floating-point results are useful
  measurements, not a correctness dependency. There is no fixed-point or
  lockstep requirement unless redundant cross-machine authority is introduced.
- Chat is a transport/UI sideband outside the fixed-step simulation, snapshots,
  saves, Hall eligibility, and Lua state. Opening the HTML composer stops only
  that client's gameplay input; it does not acquire the world pause lane. Its
  five-second readable hold and fade are client-local wall-clock presentation,
  refreshed by local or authoritative incoming activity.

## Protocol and transport rails

There is one gameplay protocol and codec over an authenticated message
transport interface. A transport rail may select different connectivity and
trust mechanisms without changing game messages or authority:

- desktop solo: `ws` over loopback plus an unguessable bootstrap credential;
- provisioned web or remote dedicated: `wss` with ordinary public PKI, normally
  terminated by a gateway;
- desktop peer host: an authenticated encrypted direct or platform transport;
  pinned-certificate `wss`, Steam Networking Sockets, and an optional relay are
  eligible adapters after connectivity evidence is gathered.

The host binds only to loopback by default. Non-loopback binding is explicit
host intent and the v0 Node listener permits it only behind an explicitly
trusted TLS gateway with a nonempty origin allowlist. Direct desktop peer
exposure remains deferred until the encrypted transport adapter is chosen. A
localhost listener still authenticates, validates `Host`, and
rejects unapproved browser origins: arbitrary websites can initiate localhost
WebSocket requests. Bootstrap secrets travel through an inherited private
channel or environment, never a visible command-line argument in a packaged
launcher.

A website-origin game client never connects to localhost, RFC1918, or another
private-network address. Browser clients use provisioned remote instances. This
is an architectural ban, not a dependency on volatile browser mixed-content or
Local Network Access exceptions.

Protocol compatibility is exact-match until a proven compatibility policy is
needed. The first handshake carries the protocol version, server tick rate,
session content manifest, complete player-character configuration,
prediction-kernel identity and parameters, and a reserved resume token.
Protocol `36` welcomes a client with one complete snapshot plus its sequence.
Subsequent messages keep session-owned players at the frame root and use a
discriminated world payload. Both Hub and Boneyard carry a compact
replicated-entity lane. Boneyard keeps encounter, gate, and wave-scheduling
state in its direct world payload, while enemy actors, enemy projectiles,
Maggots, and independent enemy-death effects use registered entity descriptors
and dynamic samples. Run-scoped
semantic enemy events remain a separate ordered lane so interpolation cannot
invent, duplicate, or erase combat edges. Unknown or malformed messages fail
closed.

Loot and Goodie use their own registered descriptors and fixed numeric samples;
the nested carried item remains in authoritative server state until pickup and
is projected through the player's economy afterward. A separate ordered loot
event lane carries drop settlement, pickup, and Goodie edges so sound and the
native 300-update notification manager consume each event once rather than
inferring a disappearance between snapshots. Item trees, generated FX, wearable
colors, actor IDs, and event order are bounded and recursively validated.

Each player projection includes level/XP thresholds, a monotonic progression
revision, compact nonzero permanent/effective rank rows, and at most one
ordered pending skill offer. Immutable stat metadata, descriptions, caps, and
native icon records are content-versioned client/server assets rather than
repeated in every snapshot. Each offer option carries its authoritative next
rank so the client can render the stock rank suffix without reconstructing or
mutating book state. A skill-choice command names both the offer
sequence and skill ID; the host accepts it only for that connection's current
authoritative offer. While a choice is pending the server ignores normal player
input, matching the mandatory native pause boundary. Renderers continue
presenting the complete frozen world behind the SkillPicker curtain; the
barrier stops simulation, not world membership or painter traversal.

Each client acknowledges the newest complete snapshot sequence it has
reconstructed. The host computes entity spawn, retire, and dynamic samples
against that acknowledged baseline rather than assuming delivery. It sends a
complete entity keyframe when the baseline is unavailable, the client requests
recovery, or the five-second recovery interval expires. A missing descriptor,
invalid sample, or sequence gap makes the client request a keyframe; it never
guesses missing entity state.
Authenticated clients also measure application-level transport RTT with a
nonce ping that the host echoes immediately outside the simulation and snapshot
clocks. The measurement is client-local diagnostics state and never enters an
authoritative world snapshot.

Protocol 49 adds the chat sideband. Client text is trimmed, nonempty,
control-character-free, and bounded to 180 UTF-16 code units and 512 UTF-8
bytes. The host admits five messages per authenticated client in a rolling
five-second window, returns a bounded rejection for a valid but unavailable or
rate-limited request, and does not log message content. Global routing requires
the sender and recipients to remain in the shared Hub; Party routing derives
the current party membership at receipt time. Chat events are not snapshot
deltas and gaps in their host-global sequence are expected when other parties
receive intervening messages.

## Saves, identity, and content

- The authoritative game host is the only producer of browser-save contents.
  It emits one explicitly versioned normalized document at semantic
  progression/world boundaries and bounded active-run checkpoints. Browser
  code transports that opaque document but never derives authority from a
  rendered snapshot.
- The first browser slot is always zero. An authenticated website account uses
  its owner-scoped transactional database row; an anonymous browser uses an
  IndexedDB row on that device. Both adapters store the same host-authored
  document and revision contract. Retired launcher-native ZIP slots are not a
  browser-save surface.
- `Last Game` gives the stored document to a fresh game host during the
  authenticated handshake. The host bounds, validates, and revives its
  simulation and loaded-Boneyard state before issuing the welcome checkpoint.
  New Game replaces slot zero only after the new authoritative host produces
  its first valid checkpoint.
- The first authoritative transition from an active run to Game Over emits a
  delete checkpoint. The adapter serializes that delete after prior writes, so
  the completed run cannot be resumed or recreated by an older in-flight
  checkpoint.
- Website slot writes use optimistic revision checks and a content hash. The
  document is capped at 8 MiB. Schema version two carries the immutable session
  content manifest and one bounded normalized `sd.state` snapshot per active
  Lua mod.
- Local profiles and direct-host identities require no website account. Website
  or platform identities are optional attestations; public rankings can only
  trust sessions whose authority and identity they can verify.
- The handshake reserves the exact active content set as
  `(id, version, content SHA-256)`. This follows the existing host-manifest
  contract.
- A Website account owns `ModSubscription` rows. Subscription controls Library
  membership; `enabled` controls the next admission snapshot. The backend
  resolves exact latest published versions, validates the complete dependency
  graph, reopens and hashes every package, and sends only accepted Lua and typed
  Boneyard members with the single-use Hub ticket or private-session request.
- In the shared Hub, each admitted player retains that immutable content
  payload. Party launch requires every member to have the same exact manifest;
  the run then owns one isolated Lua VM per active Lua member and a party-local
  Boneyard catalog. Other Hub residents and other party runs cannot observe or
  mutate that content. Subscription changes affect only a later admission.
- On resume, the title owner compares the save manifest with the next-admission
  manifest before requesting a ticket. Exact matches restore matching mod
  state. Added mods start empty; removed or version/content-changed mods discard
  their old state only after explicit Continue. Cancel leaves the save and
  active subscriptions untouched.
- The web package contract rejects DLL entry points, native `images/`
  replacement overlays, and arbitrary untyped native `data/` overlays. Those
  mechanisms require a mutable process filesystem and compiled native atlas
  destinations that the browser authority does not own. Accepted packages are
  sandboxed Lua, typed Boneyards, or both.

### Global leaderboard authority

The Website backend seals an authenticated account id into each single-use Hub
or private-session admission. The supervisor retains it as server-only ticket
material, and the game host associates it with the authenticated socket. It is
never accepted from a gameplay packet or exposed in a snapshot.

When the authoritative simulation archives a completed Hall row, the host
serializes the immutable row with that account id and signs the opaque payload
with a domain-separated HMAC. Protocol 47 introduced the signed receipt carried
only to
the matching client. The leaderboard API accepts only that receipt, verifies
its signature and account id against the caller's JWT, revalidates every Hall
bound, and persists the sealed values. The browser cannot choose score fields,
and the client bundle receives neither the supervisor/signing secret nor an
account-id override.

Global eligibility starts only on a fresh account-bound admission. Initial or
live `Enable Cheats` state permanently revokes it for that connection; an
accepted authoritative Lua console request revokes it independently. Any
ineligible member taints the current party run for every participant. Local
Hall history remains available. Current save schema 3 validates and restores
state but carries no server authenticity proof, so a client-held resumed
lineage is deliberately local-only rather than being promoted into a signed
global score.

## Rendering boundary

There is one composed client, not one DOM client and one canvas client.

- Loader, Title, and Create/loadout pixels render through one scene-scoped
  PixiJS/WebGL canvas, just like the gameplay worlds. React owns
  transparent semantic controls, focus, gamepad/touch routing, status text, and
  the HUD; those overlays are input/accessibility surfaces, not a second visual
  game renderer.
- Player-authored chat is deliberately an HTML overlay: its real focusable
  `<input>` supports IME and the Steam Deck on-screen keyboard, while its
  semantic live region and textual channel labels remain usable without color.
  `T` opens chat by explicit product policy; the otherwise stock SkillScreen
  remains on its HUD tome and uses `K` as the Website keyboard shortcut.
- The Courtyard and Boneyard worlds and cameras now render through PixiJS
  WebGL canvases.
  Native draw plans, blend operations, frame selectors, render offsets, and
  painter ordering remain renderer-independent inputs.
- A loaded Boneyard composes its immutable stock-generator output once into
  bounded GPU tiles and tightly cropped resident main-layer textures. The
  recovered native effective-Y queue interleaves those main layers with GPU
  actors; camera motion transforms them and display frames update only their
  depths. Neither path reruns the Canvas2D native painter at the `20 Hz`
  snapshot cadence.
  Players, Solomon Dig, and moving gate leaves remain dynamic GPU residents.
  Loot actors and Goodie phases are also dynamic GPU residents in the recovered
  effective-Y queue. Gold/Orb pickup fades reuse the world effect lane; the
  screen notification layer uses the extracted native body-font atlas and is
  driven only by the ordered semantic event stream.
  `npm --prefix frontend run smoke:game:loot-drops` is the deterministic
  two-client browser acceptance for this boundary.
  The Region field owns engine-wide world darkness and every dynamic source.
  Modes 1/2 add a transparent, bounded record-18 player-light surface between
  the world canvas and HUD; it never fills or masks the viewport. The optional
  native record-9 target remains absent with its unmodeled target-grid actors.
- Gameplay camera motion is isolated at Pixi render-group boundaries. Boneyard
  owns one camera group; the Hub owns separate primary-Courtyard and recovered
  southern-parallax groups, plus one active private-room group. Group boundaries
  follow existing painter banks, so they never split an intra-bank z-order.
- Immutable Boneyard sprites carry their complete texture-frame world
  rectangles. Each display frame intersects those rectangles with a `32`
  world-unit padded camera view and toggles only static sprite renderability.
  Oversized and overhanging art stays resident whenever any part of its
  rectangle can be visible. Dynamic actors and moving gates remain uncullable
  live views.
- Hub static art is deliberately not camera-culled. Controlled physical-GPU A/B
  measurement found its complete baseline scene costs about `0.02 ms` per
  synchronous render, with no measurable benefit from per-sprite visibility
  checks. Keeping the castle bank, circular platforms, statue, fountain,
  telescope, and complete Astronomer ensemble live removes a visual-risk surface
  while the three existing camera render groups retain cheap transform updates.
- Boneyard culling does not prune the recovered effective-Y painter plan.
  Offscreen main layers remain in depth calculation, while tint and z-index
  writes are restricted to residents that will render; an entering resident is
  updated before the same frame is submitted.
- Actor and menu presentation is pooled inside the active GPU scene. The old
  per-actor and per-menu-art DOM/style painters are removed; React continues to
  own HUD semantics, accessibility text, focusable hit targets, and touch
  controls.
- Hub Student views cache discrete texture inputs and write body, head, and prop
  textures only when their heading, pose, reading state, scale, or palette
  changes. Continuous position, depth, bob, and prop transforms still update
  every display frame. Retired views enter a bounded scene-owned pool and are
  reset before reuse.
- Student visibility is currently instrumentation only. It reports conservative
  candidate counts without changing `renderable`. It never owns a Courtyard
  camera bank or any southern architecture, telescope, Astronomer, statue,
  fountain, tent, or other authored art.
- The client presents buffered server snapshots at display cadence. The Hub
  applies bounded local prediction through the shared movement kernel;
  Boneyard presentation interpolates received players and gate leaves without
  duplicating its authoritative collision simulation. The `100 Hz` simulation,
  `20 Hz` transport snapshots, and browser/display refresh remain separate
  clocks.
- Courtyard-owned cosmetic actors with native fixed-update state retain one
  scene-local clock. Astronomer and PotionGuy advance only through elapsed
  integer ticks, while repeated display samples render the current frame
  without replaying tick history. Their random-access reconstructions are
  parity/seek oracles, not display-loop painters.
- Texture residency is scene-scoped. The Hub keeps every wizard appearance
  available because authenticated remote participants may use different
  elements, while scenes outside the Hub do not retain its GPU textures.

WebGL is the production baseline. PixiJS keeps the renderer backend replaceable,
but WebGPU remains experimental follow-up work rather than a compatibility
requirement. Electron is the initial desktop shell and does not own simulation:
it serves the same static bundle and supervises a separately executable pinned
Node host. Stack changes require a failed measured gate, not preference.

## Explicit deferrals

- peer NAT traversal beyond LAN/direct address and manual port forwarding;
- first-party relay, UPnP, WebRTC/WebTransport, or Steam transport selection;
- browser-to-residential-peer hosting, which is unsupported without a relay;
- host migration;
- automatic crash restart and seamless multiplayer rejoin;
- a binary entity wire codec or per-client spatial interest sets until a
  declared product load crosses their measured adoption gates;
- a third-party/general-purpose ECS dependency. The focused dense player ECS is
  implemented because native progression introduces independently owned
  components with different lifetimes; other entity families keep their
  existing stores until shared membership queries justify a common library;
- cross-platform fixed-point determinism;
- WebGPU or a lower-level renderer before a recovered-load WebGL gate fails;
- replacement of Electron before its package, lifecycle, or platform gates fail;
- player-count and cloud-capacity promises before native limits and product
  targets are recovered.

The protocol reserves a resume token and the server save design includes
periodic checkpoints so later reconnect and restart work does not require a
wire-format break. The first implementation only needs honest failure reporting
and preservation of the last complete save.

## Evidence program and pivot triggers

Current evidence proves that the reconstructed Hub core runs headlessly in
Node, contains no DOM or ambient clock, and is inexpensive at the current
Student population. It does not prove full combat scalability. The software-
rendered browser profile and the documented Chromium compositor failure show
that the DOM world painter is not a safe final endpoint; they do not constitute
a real-GPU benchmark.

Before final stack commitments:

1. Recover native worst-case actor, projectile, painter, and multiplayer loads.
2. Run that load through the headless Node core on the declared minimum desktop
   CPU and candidate cloud instance. Node passes if the `10 ms` authoritative
   tick never accumulates backlog over a sustained run.
3. Render the recovered painter load from authoritative snapshots through the
   candidate GPU renderer at the recovered presentation rate on declared
   minimum hardware.
4. Measure local server spawn, socket lifecycle, input latency, teardown, and
   failure behavior in the packaged shell.
5. Continue measuring compact JSON snapshots at each declared combat load;
   adopt the measured binary lane only when that product load justifies its
   transport and tooling complexity.
6. Replay one input recording through loopback and cloud-hosted instances and
   compare discrete events plus declared continuous-state tolerances. Measure,
   but do not require, cross-platform hash identity.
7. Run a desktop acceptance path with external networking disabled: create a
   profile, start solo, save, exit, relaunch, and resume.

A host-language or renderer pivot is justified only by a failed recovered-load
gate after profiling and focused optimization. Until then, TypeScript/Node and
a GPU canvas are the lowest-risk continuation of the current work.

## Completed foundation sequence

1. Extend `GameSimulationState.world` and the v2 snapshot world union with the
   authoritative Boneyard state; retain session-owned player entities.
2. Implement Boneyard collision as the world-side resolver for the existing
   player-character movement plan/commit seam.
3. Recover combat state and rules into focused shared kernels or authoritative
   world systems according to native ownership; do not pre-invent fields.
4. Provision the same host remotely for web sessions, then prove the desktop
   child-process packaging path.
5. Migrate the Courtyard world to WebGL, preserve the recovered painter plan,
   and prove keyboard, controller, and touch presentation in real browsers.
6. Package the same client with a pinned external Node host for desktop solo.

No further menu/Create rewrite, general-purpose ECS adoption, alternative host
language, relay network, or speculative orchestration layer belongs in this
foundation. The later focused player-ECS cutover is an evidence-driven
progression slice, not a broad entity-framework commitment.

## Foundation implementation receipt

The first vertical slice now exists in source rather than only as a target
design:

- session-owned player characters, the native movement kernel, generic actor
  physics, and the authoritative Hub world are separated by enforced import
  fences;
- the versioned protocol validates bounded messages, identifies the content and prediction
  kernel, and carries tick-indexed client intent plus authoritative snapshots;
- one Node game host owns all mutation and supports multiple independently
  configured authenticated characters, while the shared client presents every
  root-level player from interpolated session snapshots;
- the shared client reconciles acknowledged intent and automatically disables
  local prediction if the host advertises a different kernel;
- `npm run dev:game` supervises a real separate loopback host and the Vite
  client, with exact child-process teardown; and
- the static client accepts a platform-injected runtime endpoint, so the
  desktop preload and browser provisioner configure the same client bundle
  without build-time forks;
- the website provisions isolated browser sessions through a loopback-only
  supervisor, while the TLS gateway routes opaque session paths to the same
  authoritative host implementation used by development and future desktop
  packaging; and
- the Loader, Title, Create/loadout, Hub, and Boneyard visual scenes use PixiJS/WebGL,
  while React retains the HUD, semantic menu controls, accessibility surface,
  and Pointer Events joystick.

Encrypted direct peer hosting, save persistence, combat load recovery, and
minimum-hardware qualification remain the next product slices. None requires
replacing this protocol, client, kernel, renderer plan, or server boundary.

## 2026-08-12 implementation verification

The completed foundation passed the repository's canonical validation from an
isolated worktree: a warning-free .NET build, 22 Website/backend contracts,
backend formatting, the architecture import fence, 110 frontend tests, all
five desktop-shell tests, lint with only seven pre-existing Fast Refresh
warnings, and the production client plus game-host build. The desktop suite is
part of that canonical gate, and `npm audit --audit-level=high` reports zero
vulnerabilities.

The Linux x64 package is relocatable: its stored manifest names the relative
`solomon-dark` executable rather than the build worktree. A real packaged
Electron `43.4.0` smoke started the bundled, checksum-pinned Node `22.17.0`
runtime as a separate authoritative process, served the shared client from an
ephemeral loopback origin, entered the Hub through WebGL, and moved the player
from X `950.64` to `1000.89`. The host credential was absent from Electron and
descendant command lines, and the child host was reaped when the shell exited.
The client is served with a strict CSP; Pixi's static shader path does not add
`unsafe-eval`.

A real Chromium browser regression moved the authoritative player from X
`950.64` to `1043.83` while observing every native robe walk pose and 24
distinct display-rate samples between `20 Hz` snapshots. Controller-only Steam
Deck navigation reached the Hub and proved both stick and D-pad movement, a
real touch-event sequence moved the landscape mobile player, and portrait
mobile displayed its orientation gate. These
receipts validate the shared client and current Linux package boundary; they
do not yet qualify minimum physical GPU hardware, Windows/macOS packages,
encrypted peer transport, or save/resume.

The final integration pass also made touch ownership an explicit acceptance
contract. Snapshot-driven React renders may replace a joystick callback, but
only pointer release, pointer cancellation, or actual component unmount may
clear the held touch vector. A real `800 ms` mobile gesture must cross at least
`40` world units; the retained receipt crossed `61.89`. This prevents UI render
frequency from leaking into the authoritative input lifetime without adding
command polling or a mobile-only simulation path.

## 2026-08-14 crowd, headless, and replication cutover

### Authoritative data and scheduling

Hub Students now live in a purpose-built structure-of-arrays store owned by
`HubStudentPopulationState`. Stable numeric slots hold hot scalar fields;
stable ID order remains the system iteration contract; retired slots are
reused only after removal. The `students` accessor is a scalar compatibility
adapter for snapshots and tests, not the hot storage owner. The current route
planner consumes scalar work views whose objects and nested vectors are reused
in place each tick; it does not yet claim to be a direct typed-array kernel.
This is an ECS-shaped data layout without a general ECS package or a whole-game
entity rewrite.

`HubWorldRuntime` owns reusable plans, body arrays, position maps, the Student
neighbor grid, and the generic dynamic actor grid. The grid is rebuilt from
stable source slots once per fixed tick and emits candidates in the previous
source-body order before narrow phase. Focused randomized tests retain the
all-pairs solver as an oracle and require identical candidate sets and final
motion. Static Hub collision and all render-only art remain outside this grid.

The ML seam is `HubHeadlessEnvironment`:

- `reset({ seed, studentCount })` creates an isolated deterministic Hub world;
- one packed six-float action carries movement, optional aim, and two cast
  levels;
- one fixed-stride `Float32Array` observation carries the player header and a
  bounded Student lane;
- `stateHash()` hashes canonical authoritative state, excluding runtime scratch
  buffers, for replay checks;
- `HubHeadlessBatch` steps many same-thread worlds into reusable packed output;
- `HubHeadlessWorkerPool` partitions isolated worlds across persistent Node
  worker threads and transfers packed buffers rather than cloning world graphs.

The ordinary game host remains the authoritative runtime. The headless seam
does not remove collision, AI, RNG, or lifecycle systems and does not depend on
Pixi, React, WebSocket, or wall-clock scheduling.

### Replicated entity contract

The Hub entity lane separates immutable descriptors from quantized dynamic
samples. Student type `1` sends scale, reading mode, and prop appearance only
on spawn/keyframe, then sends ID, position, heading, frame phase, and gait.
Position uses `1/16`-world-unit precision; headings and gait use `1/64` degree;
frame phase uses `1/1024` frame. Authoritative state remains full-precision
JavaScript numbers. Quantization is a transport decision and cannot feed back
into simulation.

Every future replicated family must satisfy this contract before entering the
lane:

1. Allocate a stable numeric type ID that is never silently reused.
2. Register strict descriptor and sample validators and bound every variable
   length before raising protocol limits.
3. Put immutable presentation/configuration in the spawn descriptor and only
   snapshot-varying presentation state in the dynamic sample.
4. Preserve full authoritative precision, stable lifecycle order, and semantic
   gameplay events outside presentation interpolation.
5. Add round-trip and maximum-error tests for quantization, spawn, retire,
   late join, periodic keyframe, missing-baseline recovery, and stale frames.
6. Materialize through the shared registry on every client; a sample without a
   known descriptor is a recovery gap, not a partially rendered enemy.
7. Keep the current near-state snapshot cadence until a separate interest/LOD
   contract proves that an approaching entity receives its descriptor and at
   least two samples before visibility, with hysteresis at both boundaries.

The registry now assigns type `1` to Hub Students, type `2` to Boneyard enemy
actors, type `3` to enemy projectiles, and type `4` to Coffin-owned Maggots.
Enemy descriptors freeze immutable family/configuration state; samples carry
only authoritative presentation fields such as position, heading, action,
the Skeleton/Mage head-facing offset, vitals, shields, effects, payload, and
lifecycle clocks. Protocol 32 adds that signed fixed-tick field to type 2's
54-component sample; clients hold it discretely and never reroll it. Wave
scheduling emits spawn intents and consumes the authoritative enemy store's
live count; it does not own a second enemy list. Connected-client coverage exercises spawn,
retirement, late join, periodic keyframes, missing-baseline recovery, strict
codec bounds, and stale-frame rejection for the Boneyard families.

### Measured gates

The warmed WSL Node 50-tick episodic benchmark now measures `0.1150`, `0.1421`,
`0.2578`, `0.5490`, and `1.9883 ms` per authoritative tick at `16`, `32`, `64`,
`128`, and `256` deterministic Students. The original `256` directional
baseline was `5.392 ms`, so the matching short-episode stress case is about
`63.1%` faster while the equivalence tests preserve current authoritative
outcomes.

The default training-oriented benchmark no longer hides later route and push
work behind frequent resets. It keeps the exact population active by reversing
routes and runs `1,000` uninterrupted ticks. Across three warmed runs, median
tick costs were `0.1246`, `0.1511`, `0.2990`, `0.8218`, and `2.8296 ms`; every
run produced the same deterministic hash for its population. The `256` lane
sustained `353.4` ticks per second, over `3.5x` the authoritative `100 Hz`
requirement on WSL Node `22.17.0`.

The five-second, `20 Hz` compact-JSON benchmark averages `20.61`, `31.77`,
`54.15`, `99.34`, and `190.55 KiB/s` per client at the same populations. That
is a `91.79%` to `95.04%` reduction from the legacy full authoritative Student
snapshot shape. At `256`, an ordinary delta frame is about `9,371` bytes and a
recovery keyframe about `47,907` bytes, versus `196,533` bytes for the legacy
full frame.

A benchmark-only packed entity lane estimates `5,548` bytes for the same
`256`-Student message and about `10.7 microseconds` of entity encoding. Deflate
reaches `4,278` bytes but costs about `143.8 microseconds` per message. Neither
was production transport at that measurement. Re-evaluate the binary lane when
snapshot encoding becomes a measured server phase or compressed representative
traffic exceeds its declared budget; the stock roster still does not justify
mixed text/binary tooling today.

### Browser WebSocket compression gate — 2026-08-20

The compression deferral above is now closed. A hardware-Mac, two-browser Hub
sample on protocol 29 measured `109.37 KiB/s` of logical snapshot text per
client at `19.99 Hz` with only two players and `11..15` live Students. The
average delta was `5,419` bytes and the periodic recovery keyframe was `23,638`
bytes. Per top-level logical lane, players consumed `45.56 KiB/s`, secondary
abilities `31.12 KiB/s`, and the Hub world/entity lane `24.52 KiB/s`. This is a
representative product load above the earlier `64 KiB/s` adoption trigger, not
the synthetic 256-Student stress case.

The transport therefore negotiates `permessage-deflate` on both direct game
host browser connections and the public supervisor's browser-facing socket.
Compression is bounded deliberately:

- messages below `1,024` bytes remain uncompressed;
- both client and server disable context takeover, bounding per-connection
  zlib state and making each snapshot independently recoverable;
- server compression uses level `3`, memory level `7`, and global concurrency
  limit `4`; and
- the supervisor's loopback upstream socket explicitly disables compression,
  avoiding decompression/recompression on both sides of the same machine.

The wire change does not alter protocol 29, snapshot contents, the `100 Hz`
simulation, the `20 Hz` snapshot clock, acknowledgements, keyframe cadence, or
entity baseline semantics. The runtime measurement retains logical-byte lanes
for protocol-bloat diagnosis and adds a conservative independent-deflate
estimate for the negotiated no-context-takeover policy. Browser and Node
integration tests require the extension on direct and proxied connections;
sequence/tick/acknowledgement assertions remain unchanged.

The runtime network harness keeps those assertions topology-aware without
weakening its direct-host default. A local two-page run expects two players,
one shared broadcast sequence lane, identical ticks, at least 60 percent
independent-deflate reduction, and at most 64 KiB/s per client. Public New Game
provisioning intentionally gives each anonymous page its own one-player
supervised session, so production acceptance declares one expected player, no
cross-session sequence identity, and a 50 percent reduction floor while keeping
the same 20 Hz, acknowledgement, zero-gap, negotiated-extension, hardware-GPU,
and 64-KiB/s requirements. The values are explicit environment inputs rather
than URL heuristics. Launch-owned performance probes also close the browser as
the resource owner instead of awaiting every live page first; this prevents a
remote WebSocket page from retaining the probe process or supervised session
after a completed receipt.

### Scene code residency gate — 2026-08-20

The `/game` route formerly imported Hub, Boneyard, and SkillPicker presentation
owners synchronously through `MainMenuScene`. The production `Game` entry was
therefore `6,666,378` bytes (`4,165,490` gzip) before the title could execute,
even though none of those three scene owners was reachable on the title or
Create screens.

Hub and Boneyard now use React lazy boundaries at the same transitions already
owned by `MatchLoadingScreen`. Their chunk fetch does not create a new loading
state or clock: the existing Hub/Boneyard barrier remains visible and completes
only when the scene renderer calls its normal `onReady`. SkillPicker is also a
lazy member, preloaded as soon as an authoritative Boneyard snapshot arrives,
well before the first level threshold; its native reveal and barrier clocks do
not start until the authoritative offer exists.

The resulting production `Game` entry is `189,625` bytes (`55,559` gzip).
Hub, Boneyard, and SkillPicker retain distinct generated chunks, and the build
now fails if the entry exceeds `512 KiB` raw or `128 KiB` gzip or if any of
those three scene boundaries collapses back into it. This is code residency,
not asset-policy drift: the resident image/audio readiness program and every
native renderer asset remain unchanged.

### Low-rate diagnostics under transient populations

Student visibility instrumentation remains outside the render-authority path
and still performs its view census at most once per 120 presentation frames in
steady state. It now also refreshes on a Student population-count edge. Without
that edge, the diagnostic compared a stale visible count against a live native
birth/retirement count and could fail the performance harness (`15 != 14`)
while the renderer itself remained correct. The new predicate preserves the
steady-state cost and makes every performance receipt internally coherent.

`SDR_HUB_BENCH_STUDENTS` and `SDR_HUB_BENCH_SEED` inject a deterministic,
empty-player Hub fixture only into the development host. The count is capped at
the current `256`-Student protocol limit. This fixture alone reverses a Student
at each route endpoint so the population stays exact and moving throughout a
sample; the stock population retains native retirement. The measurement records
arrival, minimum, maximum, and final counts and requires all four to match.
`SDR_GAME_CDP_URL` lets the same measurement connect to a dedicated Windows
Chrome process so GPU identity and physical-device receipts are not inferred
from WSL software rendering. `SDR_GAME_PERF_MOVE_SCRIPT` accepts bounded
`w|a|s|d:milliseconds` steps so the same exact-population receipt can sample and
capture camera extrema rather than validating only the spawn view.

Headed Windows Chrome `151.0.7922.110` on the physical Radeon RX 9070 XT held
the exact moving fixture at the presentation ceiling with no frame over `20
ms`:

| Students | Average FPS | 1% low | Browser task time | Snapshot ingress |
| ---: | ---: | ---: | ---: | ---: |
| 16 | `130.673` | `123.023` | `0.491 s` | `34.034 KiB/s` |
| 64 | `130.897` | `120.069` | `0.666 s` | `67.994 KiB/s` |
| 128 | `130.582` | `120.482` | `0.839 s` | `110.383 KiB/s` |
| 256 | `131.605` | `123.239` | `1.316 s` | `201.790 KiB/s` |

The final post-guard two-page run on that same Windows machine received `101`
snapshots per page over `5.012 s` at `20.150 Hz`, sequences `3597..3697`, with
zero gaps, one keyframe per page, exact `256`-Student samples, and identical
shared ticks. Measured snapshot ingress was `207.141 KiB/s` per page; aggregate
ingress plus ACK egress was `417.100 KiB/s`. This is a two-client wire receipt,
not a claim about two distinct physical devices.

The exact-256 southern stress sweep reached player position `(1196.031,
1074.941)` at `131.645` average FPS and `122.699` one-percent low. A separate
zero-crowd camera-control run removed actor pushing from the path and reached
the true east extreme at `(1972.254, 1071.001)`, measuring `129.766` average FPS
and `123.457` one-percent low. Direct inspection of
`/mnt/c/Temp/sdr-hub-telescope-extreme-final.png` retained the castle row,
circular architecture, animated statue base, telescope, and Wizards. Both runs
reported all `16` southern architecture sprites, all `19` southern-bank
children, and no frame over `20 ms`. The scene guard verifies visibility and
parent ownership, rather than treating `renderable` alone as sufficient.

## Browser presentation rate

All Pixi game scenes submit through one client-local presentation scheduler.
The scheduler accepts at most `400` frames per second by default. Its internal
`setGamePresentationUncapped` and `toggleGamePresentationUncapped` controls can
disable that application cap for profiling now and for a future settings menu;
the default remains capped. The same controls are exposed to local diagnostics
as `window.__sdrGamePresentation` together with the accepted frame count. Until
the settings UI owns this choice, local diagnostics can call
`window.__sdrGamePresentation.setUncapped(true)` or
`window.__sdrGamePresentation.toggleUncapped()`.

Display-paced browsers stay on `requestAnimationFrame`. Sustained animation
opportunities below the `2.5 ms` cap interval select a deadline-aware timer path
for Chromium's unlimited launch mode. A persistent `MessageChannel` separates
successive timer tasks so the HTML nested-timer floor cannot reduce a requested
`400 FPS` ceiling to roughly `200 FPS`; the timestamp gate still rejects every
early wake and never catches up with a burst.

`SDR_GAME_PERF_UNCAPPED=1` launches benchmark Chromium with its own frame limit
and GPU synchronization disabled, but deliberately leaves the application's
`400 FPS` policy active. Adding `SDR_GAME_PRESENTATION_UNCAPPED=1` selects the
explicit full-send application path. Benchmark reports identify both settings
and compute FPS from accepted presentation frames rather than raw browser
callbacks.

This scheduler owns renderer submission and adjacent per-frame presentation
work only. It does not throttle or accelerate the authoritative `100 Hz`
simulation, `20 Hz` snapshot production, transport, non-render timers, or
headless environments. The setting is local and multiplayer-neutral.

On headed Windows Chrome `151.0.7922.138` and the physical Radeon RX 9070 XT,
the final exact-`16` Hub probe measured `143.54 FPS` in ordinary Chrome,
`374.16 FPS` with Chromium's frame limit disabled and the application cap on,
and `1,634.73 FPS` with both limits disabled. Every run retained `20 Hz`
snapshots, three camera render groups, `16` southern architecture sprites, `19`
southern-bank children, and the Astronomer ensemble without errors.

## Web Lua extension boundary

Lua is an authority extension, not another world model. The portable Node game
host owns one lazily initialized Lua 5.4 VM for the browser developer console
and one VM for each active mod in a private session or launched shared-Hub
party. Every VM imports `core-server` only through `host/lua` semantic adapters.
Core kernels, protocol codecs, snapshots, clients, React, and Pixi never import
a VM. Mod VMs never share globals, callbacks, timers, command queues, or state
maps.

The fixed-tick order is:

```text
accepted host console requests + per-mod due Lua timers + runtime.tick callbacks
  -> validate and apply queued semantic player commands
  -> pass queued enemy spawn intents into the existing Boneyard materializer
  -> authoritative simulation tick
  -> derive subscribed run/wave/enemy/gold/level notifications from before/after state
  -> dispatch Lua notifications (their commands wait for the next tick)
  -> publish ordinary snapshots/results
```

This preserves one mutation boundary and prevents Lua callbacks from entering
the simulation recursively. The host checks dynamic session host identity on
every console request. `Enable Cheats` controls only whether the browser
installs its DevTools API; it is never trusted as network authorization.
Initial and live setting state is nevertheless replicated as a separate
global-score eligibility input, and accepting a console request revokes that
eligibility even if a crafted client misreported the setting.
Authoritative gameplay pause freezes this fixed-tick Lua lane together with the
world; new console requests fail immediately while paused instead of waiting on
a tick that cannot run.

The developer VM is cold by default. Private-session mod VMs initialize before
the host listens; shared-Hub mod VMs initialize in canonical
dependency/priority/id order while the launching party is frozen, before that
party enters its run. Every entry script runs exactly once per runtime lifetime.
The JavaScript bridge is bundled into both portable server entry points and its
immutable Lua 5.4 WASM sits beside them. Creation, callback/timer registries,
UTF-8/JSON wire expansion, output capture, state, queued commands, and every
allocator have explicit per-VM and aggregate bounds. Instruction hooks
interrupt both entry chunks and stored callbacks. A package with no Lua member
creates no VM.

API `0.2.0` adds one host-owned content registry beneath the VMs. Admission
provides each mod only its validated immutable package files. During its sole
entrypoint, a mod may register bounded local sprite atlases, consumables, and
additive loot rows; a failed entrypoint rolls back the whole registration.
The registry publishes only validated PNG bytes, frame geometry, and immutable
content metadata. Stable native `sd.content.v1` identities cross Lua and JSON
as decimal strings so JavaScript never rounds a 63-bit item ID.

The simulation sees that registry through a narrow extension interface rather
than importing Lua. Custom loot enters the existing authoritative ground-actor
and pickup lanes. A consume action allocates one use ID, invokes the owning
callback for the actual participant, dispatches `item.consumed` to every mod
VM, and snapshots the bounded actor-attached effect. Synchronous
`damage.taken` and `mana.changing` filters run at the existing direct/poison
health and primary/secondary/overload/recovery/orb/potion mana writers. Filter
errors fail open for that handler; cancellation remains monotonic. Protocol 48
carries package assets, catalog entries, content-identified inventory/ground
items, and active effects together with the independently merged Unforge
state.

`sd.state` remains the only durable mod-owned value domain. Schema-three
checkpoints snapshot it as bounded JSON and restore it only for an exact mod
identity match; live Lua callbacks, timers, and active consumable effects are
run-scoped and deliberately not checkpointed. Client-authored Lua,
cross-mod buses, raw Lua networking, bots, input synthesis, time scaling,
navigation, recipe-backed dynamic items, and every native-memory/debug path
remain absent until their web owners exist.
The complete disposition is recorded in `game-native-parity-re.md` and the Mod
Loader's `web-lua-runtime-parity-contract.md`.
