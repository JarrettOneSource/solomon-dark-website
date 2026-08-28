# 2026-08-14 — Loader-owned Hub and Boneyard transition barrier

## Reported smell and parity question

- Reported web behavior: after the player commits a discipline, Create remains
  visible under the ordinary menu fade while the WebSocket session enters the
  Hub. From Hub to Boneyard, the web shell exposes a black scene with the live
  HUD and a small `Preparing the Boneyard...` status while the world renderer
  is still being built. Neither path presents the Mod Loader loading art or its
  lifecycle bar.
- Mod Loader behavior to port: one full-viewport, loader-owned barrier covers
  connection/materialization work with `Wizards_dire_BG`, a bottom scrim, an
  exact stage label, and a monotonic lifecycle bar. It also owns gameplay input
  until the destination is materially ready.
- Reproduction inputs: cold local `/game` at `1600 x 900`; Play -> New Game ->
  Fire -> Arcane -> Hub; then the native map button -> default Boneyard.
- Falsifiable questions: the overlay must start from real session/run work, not
  a timer; the fill must never regress or interpolate; Create/Hub/Boneyard input
  must not cross the barrier; and the overlay must not clear before the
  destination renderer has produced its initial frame.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Mod Loader source | Mod Loader `4cbaa4c14dfbe1b325304168e09fc9250912ee7c`; `SolomonDarkModLoader/src/loading_screen.cpp`, `loading_screen_renderer.cpp`, `loading_screen_renderer_frame_and_public.inl`, `multiplayer_join_flow/loading_screen_progress.inl`, and `multiplayer_local_transport/run_loading_barrier_sync.inl` | `LoadingScreenSnapshot` is the owner. Concrete connection, native arena, checkpoint, materialization, and mutual-visibility milestones advance one monotonic stage value. `GetTickCount64` records lifecycle time but never drives progress. | high |
| Live injected-loader capture | `tests/fixtures/webgame/menu-layouts/loading-screen.json` and `menu-reference-captures/loading-screen.png`; retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; capture loader DLL SHA-256 `f9c3357ddce217c4f6b0c13ad2511ec4cfcbf909974c335c865f21dfae53d289`; process `11752`, instance `menufx-v9p38` | The settled `materializing_participants` frame has six structural elements and exact `1600 x 900` geometry. This is loader-injected D3D9 evidence, not an unmodified-stock loading presentation. | high |
| Asset | `Mod Loader/assets/loading/Wizards_dire_BG.png`, `1920 x 1080`, SHA-256 `251365e025129972707b436d441d52ae2c5f8199bc3f80a1c4e03b2a28a1180c` | The renderer center-crops this exact image to cover the active viewport. | high |
| Durable native report | `Mod Loader/docs/reverse-engineering/native-menus-and-boot.md`, match/Boneyard loading overlay | The report independently records all 20 values, the `150 ms` reveal gate, exact geometry/colors/font, non-interpolated progression, immediate completion, and blocking input ownership. | high |
| Web source trace | Website `a272433eb7f755e0d03eac3c0c86455ce15a1eb1`; `Game.tsx`, `MainMenuScene.tsx`, `engine.ts`, `game-client-session.ts`, `HubScene.tsx`, and `BoneyardScene.tsx` | Session boot has two awaited boundaries (transport open and welcome snapshot). Boneyard entry has two ordered server messages (loaded content, then matching world snapshot). Both Pixi renderer factories render their initial snapshot before resolving. | high |
| Web baseline | Chrome `150.0.7871.124`, local Vite/game host, `1600 x 900`; `/tmp/solomon-transition-loading-baseline-hub.png` and `/tmp/solomon-transition-loading-baseline-boneyard.png` | Mutation receipts observed Create -> Hub and Hub -> Boneyard with zero loading-art nodes. Hub connection exposed only `Opening the grounds...`; Boneyard exposed the live HUD and `Preparing the Boneyard...`. There were no page or console errors. | high |

## Native ownership thread

- Owner and construction path: the injected loader initializes one process-wide
  `LoadingScreenState` and one D3D9 EndScene renderer. `BeginLoadingScreen`
  creates a sequence and chooses a concrete starting stage; native arena hooks,
  join-flow state, and the run-loading barrier advance that same sequence.
- Upstream state producers/callers: transport/lobby/authentication/checkpoint
  state produces connection stages. Arena load/generation/materialization and
  multiplayer visibility acknowledgements produce Boneyard stages.
- State representation and transitions: 20 definitions bind stage id, label,
  and fixed progress. Advancement replaces the current definition only when
  the next progress is greater. Equal `.48` and `.66` alternatives therefore
  do not rewrite a sequence, and no caller can regress it.
- Downstream consumers/callees: the D3D9 renderer reads the snapshot once per
  frame, covers the viewport, center-crops the art, paints the scrim/bar/label,
  and records evidence. `BlockingOverlayOwnsGameplayInput()` seals gameplay
  ingress from begin until complete/cancel.
- Sibling systems: the stock process-start `MyLoader` artwork and numerator are
  a separate presentation already used by the web startup route. The special
  `waiting_for_host_loadout` barrier deliberately hides the progress bar; it is
  not part of these two requested transitions.
- Entry, interruption, reset, and teardown: visual presentation waits `150 ms`
  to suppress trivial flashes, but input ownership begins immediately. There
  is no minimum visible duration or post-ready hold. Complete publishes
  `gameplay_ready`, deactivates the snapshot immediately, and unseals input;
  cancel deactivates and unseals without claiming readiness.

## Recovered behavioral contract

- Timing/ticks/thresholds: the only timer is the `150 ms` reveal threshold.
  Progress is discrete lifecycle state with no easing, RAF ramp, fabricated
  byte count, or minimum duration.
- Geometry/transforms/coordinate spaces: art covers the viewport with a centered
  crop. The scrim is the bottom `18%`. The track is `60%` of viewport width,
  centered at `92.5%` viewport height, with height
  `clamp(height * .0083, 8, 10)`. At `1600 x 900`, the captured outer border is
  `[318.5,831,1280.5,841]`, the track is `[319.5,832,1279.5,840]`, and a `.92`
  fill ends at `1202.7001`.
- Render order and style: background, transparent-to-`#B3000000` scrim,
  `#E669522A` border, `#EB14110D` track, `#FFCAA14D` fill, then centered label.
  The live label is Segoe UI, native height `-24`, weight `600`, scale
  `clamp(height / 1080, .70, 1.50)`, color `#FFF2E5C7`.
- Assets/audio/randomness: the loading presentation is silent and deterministic;
  it uses the exact `Wizards_dire_BG` bytes and no random selector.
- Input/network authority: the barrier is presentation-local but the stages are
  derived from authoritative transport/messages/snapshots. While active,
  movement, aim, casting, mouse edges, touch, and gamepad state are cleared and
  dropped rather than queued for later playback.
- Boundary/failure behavior: session or renderer failure cancels the barrier and
  exposes the actionable error. Success clears it only after the matching
  destination snapshot and the destination renderer's initial frame exist.

## Nearby-system findings

- `server-boneyard-loaded` is broadcast before the matching Boneyard snapshot.
  That is an existing truthful content -> world ordering seam for `.83` ->
  `.92`; no protocol message or synthetic delay is needed.
- A non-host peer cannot know that host-side synchronous materialization began
  before the first server message. Its overlay therefore starts at its first
  real local milestone (`server-boneyard-loaded`) and still covers client world
  and renderer materialization. Inventing an earlier client stage would be
  false; adding a protocol event is unnecessary for the requested port.
- Both web renderer factories already call `render(initialSnapshot)` before
  resolving. Their success boundary can close the barrier without adding a
  browser-frame timeout.
- The ordinary menu fade remains valid for menu-to-menu navigation, but it is
  not the loading owner for Create -> Hub and must not impose an extra fixed
  hold behind the new barrier.
- No Mod Loader report update is required: the current source, live fixture,
  and `native-menus-and-boot.md` already own every reused native fact. This web
  investigation recovers no new executable address, stage, or renderer rule.

## Confidence and open questions

- Confirmed: source owner, all stage definitions, exact art/geometry/style,
  reveal and teardown rules, input ownership, web transport/message ordering,
  and renderer initial-frame boundary.
- Deterministic web mapping: Hub uses `connecting_transport .44` before the
  WebSocket await, `authenticating_session .52` after transport open,
  `receiving_host_checkpoint .66` after welcome, and
  `materializing_participants .92` while building the Hub renderer. Boneyard
  uses `preparing_boneyard .73` on the host request,
  `reading_boneyard .83` on loaded content, and
  `materializing_participants .92` on the matching world snapshot/renderer.
  Renderer success is `gameplay_ready 1.00` and immediate teardown.
- Unknown but non-material: the current web host materializes Boneyards
  synchronously, so it does not expose separate generation/serialization
  callbacks. The bar must not manufacture `.77/.80/.87` intermediate paints.
- Next falsifying probe if the host later becomes asynchronous: instrument its
  actual catalog/generation boundaries, then expose semantic progress from that
  owner before adding those already-recovered native stages to the web path.

## Web implementation consequence

- Add a dedicated match-loading model and presentation. Do not repurpose the
  blue stock process-start `NativeLoader` or merge their lifecycle owners.
- Register the exact background in the resident startup manifest so a
  transition never begins by downloading its own cover art.
- Expose semantic progress around the existing transport and welcome awaits;
  drive later stages from existing Boneyard content/snapshot notifications and
  renderer readiness.
- Let the full-screen overlay remain mounted but visually transparent during
  the `150 ms` reveal gate so input is sealed immediately.
- Add explicit input blocking at the browser input owner, clear held state on
  entry, ignore input while blocked, and require fresh input after unseal.
- Remove only the superseded Create -> Hub fade and Boneyard black/status
  transition path. Preserve menu navigation fades, scene renderer errors, and
  normal scene-local startup diagnostics outside an active match barrier.

## Validation contract

- Focused automated tests: exact 20-stage definitions and labels, monotonic and
  equal-progress behavior, reveal threshold, semantic engine progress order,
  input clear/drop/resume, and source-level transition ownership.
- Playwright journey: at `1600 x 900`, observe the overlay for discipline ->
  Hub and Hub -> Boneyard, sample non-regressing stage/progress values, compare
  background/bar/label rectangles and colors with the live fixture, verify no
  destination HUD is exposed over the cover, and confirm teardown only after
  each scene reports renderer ready.
- Input probe: hold/release gameplay controls across the Boneyard barrier and
  verify no held movement/cast is replayed after unseal.
- Acceptance: exact asset hash, center-cover crop, `.92` reference geometry,
  no timer-driven progress, no post-ready hold, both transitions reach their
  real scene, and zero page/console errors.

## Implementation validation receipt

- Implemented on isolated Website branch
  `codex/transition-loading-native-parity-20260814`. The web owner now copies
  the loader's exact 20-stage table, strict-greater advancement, `150 ms`
  visual reveal, immediate input seal, and ready/cancel teardown. The exact
  `Wizards_dire_BG` bytes are resident startup media under SHA-256
  `251365e025129972707b436d441d52ae2c5f8199bc3f80a1c4e03b2a28a1180c`.
- Hub progress is emitted at the existing transport, welcome, and renderer
  boundaries. Boneyard progress is emitted at host request, loaded-content,
  matching-snapshot, and renderer boundaries. A run-identity latch prevents
  steady-state Boneyard snapshots from reopening a completed barrier, and a
  renderer failure cancels the barrier before surfacing the scene error.
- Focused model, presentation, connection, integration, and input-barrier
  coverage passed after the final upstream rebase. The canonical
  `./scripts/validate.sh` gate then passed with a clean Release backend build,
  `23/23` Website/backend contracts, formatting and lint, `376/376` frontend
  tests, production frontend/game-host builds, and the deployment media/CSP
  policy. Diagnostics were limited to the repository's existing Fast Refresh
  and Vite chunk-size warnings.
- Chrome `150.0.7871.124` completed the real `1600 x 900` discipline -> Hub ->
  Boneyard journey through the local WebSocket host and production WebGL scene
  renderers. Hub samples advanced `.44 -> .52 -> .92`; Boneyard samples
  advanced `.73 -> .92`, while focused coverage pins the too-brief-to-sample
  `.83` loaded-content emission between them. Both overlays started with an
  immediate hidden input barrier, became visible after the native threshold,
  and disappeared only after the destination renderer's initial frame. Page
  errors, console errors, and failed responses were all empty.
- The browser geometry receipt matched the injected-loader capture: full
  `1600 x 900` cover, bottom scrim at `y=738`, label at `y=793.328125`, track
  `[319.5,832,960,8]`, and `.92` fill width `883.1875`, with the recovered
  colors and font. Barrier-time movement remained exactly stationary; a fresh
  post-ready `KeyD` moved the player by `58.0171978548169` world units. Final
  captures are `/tmp/solomon-transition-loading-hub-final.png` and
  `/tmp/solomon-transition-loading-boneyard-final.png`.
- The focused browser harness bypassed only resident PCM preload, which has its
  own smoke coverage, and applied temporary network latency so the transient
  frames could be compositor-captured. It still loaded the real image manifest,
  WebSocket session, host state, and Hub/Boneyard renderers. No Mod Loader file
  changed because its existing source and durable report already contained the
  complete recovered contract.
