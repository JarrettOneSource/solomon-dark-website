# Solomon Dark rebuilt runtime architecture

Status: accepted; authoritative, GPU-client, desktop-solo, headless-crowd, and compact-replication slices implemented, 2026-08-14

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
| Web solo | Shared browser client | Private remotely provisioned server instance |
| Web multiplayer | Shared browser client, with compatible desktop clients allowed | The same remote server instance |
| Dedicated | Any compatible client | The same server bundle run headlessly |

The website is an optional control plane for browser provisioning, account
identity, cloud saves, public discovery, and published content. The packaged
desktop client must still provide local profiles, local saves, solo play, LAN
or direct joining, hosting, and locally installed content while the website is
unreachable.

Browser discovery and native-launcher discovery are separate products even
when they share the `/parties` presentation page. Steam/launcher hosts continue
to announce through `/api/lobbies` and join through the registered
`solomondarkrevived://` transport. Discoverable rebuilt-web sessions live only
under `/api/game/lobbies`, join through an ordinary `/game?party=<id>` URL, and
are projected directly from the live game-session supervisor. They do not
create Steam-shaped SQLite lobby records or enter launcher counts.

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

The authoritative session owns one identity-keyed collection of
`PlayerCharacterState` records outside any particular world. A player
character carries its selected appearance/loadout and the native locomotion
state that must survive a Hub-to-Boneyard transition. The active world owns
spawn selection, static geometry, ambient actors, enemies, projectiles, and
other location rules. It may resolve a character's requested movement, but it
does not create a second Hub- or match-specific character implementation.
The session also owns the fixed-step accumulator and tick; neither clock is
nested inside a Hub ambient actor or another world-specific subsystem.

`PlayerId` identifies the connected participant. It is deliberately distinct
from the in-world character and from native gameplay-slot ordinals. This keeps
reconnect, future spectating, and world transitions from leaking connection
identity into position or actor behavior.

A discoverable browser session also separates control-plane lobby identity
from participant identity. Creating the lobby reserves host authority but does
not create a player character. The creator's host credential and the joiners'
guest credential assign authority when their complete character configurations
arrive, so a guest that finishes Create first cannot become host by timing.
After the reserved host has connected, the existing authoritative host handoff
may select the earliest remaining participant if that host disconnects.

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
- The shared player input record carries normalized movement, a nullable world
  aim point, and independent primary/secondary held levels. Browser mouse edges
  publish immediately; the authoritative queue preserves each level transition
  on its own fixed tick, while unchanged held state and same-level aim updates
  may coalesce. Spell systems consume this seam later rather than importing DOM
  button events or browser coordinates.
- The client predicts only explicitly shared kernels needed for the local
  player. Remote actors and server-only systems are presented from buffered
  authoritative snapshots.
- Player-character movement uses a two-phase shared kernel: first plan native
  intent/velocity, then let the active world resolve collision, then commit the
  resolved position plus native heading/gait state. Hub and Boneyard geometry
  therefore vary at the world seam without forking character behavior.
- A single pinned build on one platform must replay the same input script
  reproducibly. Cross-platform bit-identical floating-point results are useful
  measurements, not a correctness dependency. There is no fixed-point or
  lockstep requirement unless redundant cross-machine authority is introduced.

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
Protocol `9` welcomes a client with one complete snapshot plus its sequence.
Subsequent messages keep session-owned players at the frame root and use a
discriminated world payload. The Hub world carries a compact replicated-entity
lane; Boneyard currently carries its small world payload directly until its
first replicated enemy family exists. Unknown or malformed messages fail
closed.

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

## Saves, identity, and content

- The server is the only writer of the save format. Desktop and cloud adapters
  choose storage location. Cloud saves synchronize the same format rather than
  defining a second one.
- Local profiles and direct-host identities require no website account. Website
  or platform identities are optional attestations; public rankings can only
  trust sessions whose authority and identity they can verify.
- The handshake reserves the exact active content set as
  `(id, version, content SHA-256)`. This follows the existing host-manifest
  contract.
- Authoritative-state mods execute on the host or are host-loaded data.
  Desktop hosts may distribute hash-verified data and art to joining desktop
  clients without the website.
- Executable content from an arbitrary peer is never automatically installed.
  Client code or scripts require an explicit trusted installation path. Browser
  instances accept only the web service's published subset.

## Rendering boundary

There is one composed client, not one DOM client and one canvas client.

- Loader, Title, and Create/loadout pixels render through one scene-scoped
  PixiJS/WebGL canvas, just like the gameplay worlds. React owns
  transparent semantic controls, focus, gamepad/touch routing, status text, and
  the HUD; those overlays are input/accessibility surfaces, not a second visual
  game renderer.
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
  The recovered mode-1/2 darkness compositor remains a small screen-space
  post-process between the world canvas and HUD.
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
- a binary entity wire codec, compression, or per-client spatial interest sets
  until a declared product load crosses the measured adoption gate;
- a general ECS dependency until several large entity families demonstrably
  need shared component-membership queries;
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
   authoritative Boneyard state; retain root-level player characters.
2. Implement Boneyard collision as the world-side resolver for the existing
   player-character movement plan/commit seam.
3. Recover combat state and rules into focused shared kernels or authoritative
   world systems according to native ownership; do not pre-invent fields.
4. Provision the same host remotely for web sessions, then prove the desktop
   child-process packaging path.
5. Migrate the Courtyard world to WebGL, preserve the recovered painter plan,
   and prove keyboard, controller, and touch presentation in real browsers.
6. Package the same client with a pinned external Node host for desktop solo.

No menu or Create rewrite, ECS adoption, alternative host language, relay
network, or speculative orchestration layer belongs in this foundation.

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

Every future enemy family must satisfy this contract before entering the lane:

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

Boneyard frames remain direct world payloads today because no enemy entity
family exists in that world yet. The first enemy implementation must add its
codec to the registry, extend the Boneyard entity lane, bump the exact-match
protocol version, and pass connected-client recovery tests. The current Student
codec is infrastructure for that work, not a claim that enemies already
replicate.

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
is production transport. Re-evaluate the binary lane when a declared,
representative scene exceeds `64 KiB/s` per client at P95 or snapshot encoding
becomes a measured server phase; a synthetic `256`-Student stress case already
shows that future high-population combat may cross that gate, while the stock
roster does not justify mixed text/binary tooling today.

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
