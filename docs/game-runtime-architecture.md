# Solomon Dark rebuilt runtime architecture

Status: accepted and implemented foundation, 2026-08-12

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
prediction-kernel identity and parameters, and a reserved resume token. The
v2 snapshot keeps session-owned players at its root and uses a discriminated
`world` payload, currently `kind: "hub"`; Boneyard extends that world union
without changing player identity. Unknown or malformed messages fail closed.

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

- Screen-space menus, Create/loadout, and HUD may remain React/DOM while their
  native-parity receipts continue to pass.
- World- and camera-space scenes move to a batched GPU canvas after the renderer
  experiment. Native draw plans, blend operations, render offsets, and painter
  ordering remain renderer-independent inputs.
- The existing Hub DOM painter is migration scaffolding. The simulation,
  collision, motion, extracted assets, and RE ledger are retained. Its wizard
  adapter consumes a renderer-independent player-character draw plan and is
  not owned by the Hub, so the same equipment/attachment presentation can be
  mounted by Boneyard before the GPU renderer cutover.

PixiJS and Electron are working choices, not irrevocable commitments. PixiJS
must prove the recovered world painter load on declared minimum hardware.
Electron must prove the child-process, loopback transport, packaging, and any
required platform-overlay integration. Stack changes require a failed measured
gate, not preference.

## Explicit deferrals

- peer NAT traversal beyond LAN/direct address and manual port forwarding;
- first-party relay, UPnP, WebRTC/WebTransport, or Steam transport selection;
- browser-to-residential-peer hosting, which is unsupported without a relay;
- host migration;
- automatic crash restart and seamless multiplayer rejoin;
- binary or delta snapshots before measured bandwidth requires them;
- cross-platform fixed-point determinism;
- final Electron-versus-Tauri and PixiJS-versus-lower-level renderer decisions;
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
5. Measure uncompressed JSON snapshot rates before deciding on quantization,
   deltas, or a binary codec.
6. Replay one input recording through loopback and cloud-hosted instances and
   compare discrete events plus declared continuous-state tolerances. Measure,
   but do not require, cross-platform hash identity.
7. Run a desktop acceptance path with external networking disabled: create a
   profile, start solo, save, exit, relaunch, and resume.

A host-language or renderer pivot is justified only by a failed recovered-load
gate after profiling and focused optimization. Until then, TypeScript/Node and
a GPU canvas are the lowest-risk continuation of the current work.

## Immediate migration sequence

1. Extend `GameSimulationState.world` and the v2 snapshot world union with the
   authoritative Boneyard state; retain root-level player characters.
2. Implement Boneyard collision as the world-side resolver for the existing
   player-character movement plan/commit seam.
3. Recover combat state and rules into focused shared kernels or authoritative
   world systems according to native ownership; do not pre-invent fields.
4. Provision the same host remotely for web sessions, then prove the desktop
   child-process packaging path.
5. Select and migrate the world renderer from measured evidence before the
   recovered combat painter load makes the DOM scaffolding a constraint.

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
  configured authenticated characters, while the React Hub only presents the
  discriminated world snapshot and every root-level player;
- the shared client reconciles acknowledged intent and automatically disables
  local prediction if the host advertises a different kernel;
- `npm run dev:game` supervises a real separate loopback host and the Vite
  client, with exact child-process teardown; and
- the static client accepts a platform-injected runtime endpoint, so a future
  desktop preload and browser provisioner configure the same client bundle
  without build-time forks; and
- the website provisions isolated browser sessions through a loopback-only
  supervisor, while the TLS gateway routes opaque session paths to the same
  authoritative host implementation used by development and future desktop
  packaging.

Electron packaging, encrypted direct peer hosting, save persistence, and the
measured GPU-renderer migration remain the explicit next product slices. None
requires replacing this protocol, client, kernel, or server boundary.
