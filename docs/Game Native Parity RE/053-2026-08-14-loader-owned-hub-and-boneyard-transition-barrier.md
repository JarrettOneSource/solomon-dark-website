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

## 2026-09-04 — Player-animation GPU readiness and Ring of Fire hitch

### Report, boundary, and evidence

The player reports occasional stutter near the end of Ring of Fire, appearing
less often after enabling the new reduced-light/flash setting. The referenced
`SDB - Noticeable performance improvement with reduced light.mp4` was not
present in the configured Windows Downloads folder during initial inspection;
its path was requested. The findings below are an independent controlled
reproduction, not a claim to have inspected that unavailable recording.

Native/web system: **GPU readiness of the complete player-character atlas in
each gameplay renderer context**, from the existing decoded texture map through
initial GPU upload, the first visible frame, later animation/skin selection,
and context teardown. The same atlas is consumed by Hub and Boneyard.

The earlier readiness pass proved the initial visible frame but skipped
GPU preparation for animation pages absent from that frame. Image decoding
and Texture/Source construction do not establish GPU residency. A later Cast2
pose consequently performed a synchronous first upload inside gameplay.

| Evidence | Result |
| --- | --- |
| Existing native loading contract | This entry and 041 retain work-bound loading, no artificial delay, initial-frame readiness, and input ownership. Retail identity remains 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`. No gameplay constant or native asset is changed by this browser resource correction. |
| Source trace at `69f402be0bc523c4c9f340ccfcf325f7df79d5a8` | `loadGameTextureEntries` waits for image load/decode and constructs ImageSource/Texture. `createPlayerWorldTextures` constructs atlas views. Boneyard does not call `renderer.texture.initSource` for unused player pages; Hub prepares selected ambient NPC textures but also omits the player atlas. |
| Controlled built Mac Chrome baseline | 1920x1080, Apple M2 / ANGLE Metal / WebGL2, same scene seed, player/target positions, skill/equipment, and native secondary RNG. Off/on/on/off casts have the same 30 MovingFire lights and Shockwave/contact output. After warm-up, both settings maintain approximately 16.7-ms frame intervals. |
| Direct WebGL upload instrumentation | The cold cast uploads `player-character-atlas-1-I-8wVOTz.png`, 2048x2048, from the Boneyard WebGL context after controls are live. At diagnostic CPU throttle 4, this single `texImage2D` takes 119.9 ms; the associated task is 143 ms and the frame gap is 133.3 ms. The following cast has no late image upload and a 16.8-ms maximum frame interval. Throttled figures are diagnostic, not a physical slow-device benchmark. |
| CPU-profile falsifier | Starting with reduced flashes On still puts approximately 122.7 ms of sampled time in `texImage2D`; subsequent On and Off casts do not repeat it. Profiling startup itself introduces debugger pauses, so profiled RAF maxima are excluded from performance conclusions. The unprofiled upload census supplies the timing above. |
| Actual setting consumers | `presentNativeSecondaryScreenOverlay` changes only final alpha by `0.2`. Both replays retain up to 34 light providers and the same actor/primitive populations. A setting-dependent lighting optimization is not justified by this trace. |

The independent first-cast hitch is confirmed. The reported toggle correlation
is consistent with reuse of an already-uploaded page on later casts; it is
not evidence that reduced flashes disable world lighting. The unavailable
video's exact end-of-effect timing remains uncorrelated with this reproduction.

### Complete membership and dispositions

The existing generated catalog is the complete data inventory:
`player-character-atlas.generated.ts` contains 100 named sheets, 7,931 packed
rectangles, and 12,403 authored cells (8,410 nonempty). Its full sheet and
rectangle tables remain byte-identical. Preparation enumerates the generated
page-source registry, not one Ring of Fire frame or a guessed page index.

| Member | Disposition | Required behavior |
| --- | --- | --- |
| Player atlas page 0, 2048x2048 | `exact-ported` resource timing | Upload once into each destination context before its initial-frame readiness can release. |
| Player atlas page 1, 2048x2048 | `exact-ported` resource timing | Includes the cold Cast2 witness; no first-use upload during combat. |
| Player atlas page 2, 2048x1750 | `exact-ported` resource timing | Same complete-page preparation despite different packed height. |
| Air/Earth/Ether/Fire/Water head, fixed robe, dynamic robe, and death sheets | `verified-already-at-parity` | All five authored families and every frame retain their generated coordinates and alpha policy. |
| Four primary/secondary hats, special hats, three primary/secondary robes, fixed robe layers, and their death variants | `verified-already-at-parity` | GPU timing changes no equipment selector, frame, transform, or draw order. |
| Six staff styles/bodies and death styles; base staff; wand and wand death | `verified-already-at-parity` | All retained sheets share the prepared pages. |
| Primary/secondary staff hands, bare attachments, unselected attachments and robe attachment | `verified-already-at-parity` | Cast2 and sibling action poses cannot discover an unprepared player page. |
| Hub renderer: Courtyard and every private region, first entry and new context | `exact-ported` resource timing | Prepare all player pages alongside the existing deferred ambient texture preparation. |
| Boneyard renderer: survival/tutorial, fresh entry, resume/rejoin, observer, and new run | `exact-ported` resource timing | Same preparation in the renderer construction try/catch, before initial render and readiness. |
| Viewport resize, existing-context scene sampling, and repeated casts | `verified-already-at-parity` | Do not repeat uploads on each draw, resize, or action. |
| Constructor failure and context destruction | `verified-already-at-parity` | Existing failure cleanup and texture/application teardown own any prepared GPU resources. |
| Reduced Screen Flashes On/Off, complex lighting/shadows, FOV, camera feedback | `verified-already-at-parity` | No change to any visual setting, native effect, or state producer. |
| Combat/loot/scenery atlases, procedural textures, screen overlays, and ambient NPC preparation | `out-of-system` | Different source owners; no broad warming of every loaded game texture is introduced. |
| Inventory/service/dialogue renderer's paperdoll atlas consumer | `out-of-system` | `createHubInventoryRenderer` directly consumes the same packed atlas for a modal model preview; it does not run gameplay action animation or release world-renderer readiness. Warming all pages for every dialogue would allocate unused GPU images. Its existing model-specific first render remains the owner. |
| Title/Create/editor renderers and non-gameplay UI | `out-of-system` | They do not call the shared gameplay player-texture factory; this correction does not change their readiness. |

The three pages already belong to both decoded gameplay texture maps. Their
base RGBA8 storage totals 47,890,432 bytes per context before driver overhead;
there are no new downloads, images, atlas frames, or duplicate source objects.
The confirmed Boneyard witness moves an existing 16-MiB page upload from the
first cast into renderer preparation.

### Implementation and verification contract

Both gameplay renderer constructors enumerate `PLAYER_CHARACTER_ATLAS_SOURCES`
and initialize the corresponding existing source with the active renderer's
texture system. Keep this within constructor error cleanup and before returning
renderer readiness. Do not warm a synthetic cast, alter gameplay, introduce a
timer, weaken animation quality, or change the accessibility multiplier.

Add browser regression coverage at the real GPU-upload seam: record image
uploads by WebGL context, mark the current world context before a cast, and
reject new player-atlas uploads during any tested secondary action. The old
Boneyard Ring of Fire must fail this assertion before the behavior change.
Prove the same contract in Hub, then run the complete Mac gate and repeat the
controlled first-cast/warm-cast measurements with normal and reduced flashes.
The before/after comparison must retain the same particle/light counts and
show zero late player-atlas uploads; report first-cast timing separately from
steady state and exclude profiler startup pauses.

### Implementation and Mac validation receipt

- Candidate and comparison base:
  `fe0543982bdc077c827cd438393e934d5d118784`. The production change is eight
  lines across the Hub/Boneyard renderer constructors: enumerate the existing
  generated atlas registry and initialize its existing texture sources inside
  construction error handling. No asset, sheet, frame, clock, gameplay rule,
  setting value, or protocol changed.
- The browser regression failed before the change with
  `Ring of Fire uploaded a player atlas during gameplay`, identifying page 1
  in the current Boneyard context. Afterward the real cast passes. Coverage
  also verifies that pages `[0,1,2]` are already present in each world context
  before gameplay, rather than relying only on a page used by one spell.
- The Hub proof correctly preserves rejection of Ring of Fire. Its ready
  context contains pages `[0,1,2]`. The positive Boneyard proof observes a
  separate context with the same complete page set, a real Ring of Fire cast,
  zero late player-atlas uploads, intact native player/combat texture alpha
  and addressing policies, and empty page/console/response error arrays.
  The initially attempted positive Hub cast was a probe setup error; no
  admission rule was changed to make that probe pass.

Exact-base, fresh-browser before/fix/restoration measurements used the same
1920x1080 scene, player, target, equipment, and RNG, with Off/On/On/Off order.
The lightweight sampler and upload observer were unchanged across versions.
All casts retained a peak of 32 secondary actors, 33 primitives, and 34 light
providers.

| Candidate/run | CPU throttle | First-cast maximum frame interval | Late player-page upload | Later casts, maximum frame interval |
| --- | --- | --- | --- | --- |
| Unchanged baseline | diagnostic 4x | 133.3 ms | page 1, 122.7 ms | 16.8 ms |
| Corrected | diagnostic 4x | 33.3 ms | none | 16.8 ms |
| Restored unchanged baseline | diagnostic 4x | 133.4 ms | page 1, 117.4 ms | 16.8 ms |
| Corrected, normal hardware speed | 1x | 16.8 ms | none | 16.8 ms |

The corrected 4x sample retains one 33.3-ms interval near tick 88 with an
approximately 18.36-MB heap decrease. It is a residual garbage-collection
observation, not a late image upload. At normal hardware speed all four
corrected casts have zero intervals over 25 ms, zero long tasks, and zero late
uploads. These results close the reproduced upload stall; they do not
establish the cause of the unavailable recording's precise end-of-effect
stutter.

- The complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` passed:
  19 backend integration tests, 2,663 Node tests, TypeScript, formatting,
  lint/boundaries, frontend/host builds, bundle budget, and media/CSP. Lint
  reports 11 existing warnings outside this change and no errors. Entry
  `Game-Bx3o7q4F.js` is 262,311 raw / 79,062 gzip bytes. Full-gate log SHA-256:
  `32f1ad42624503f18b25557e5cbb8366c7ef54ec9bebbe16f6da0370a192a14a`.
- The final strengthened browser census was followed by passing Hub/Boneyard
  journeys and the supported Mac `./scripts/validate.sh lint` gate. No
  production code changed after the complete gate. The inspected Boneyard
  VFX capture SHA-256 is
  `dcc980a3744a89a7d01238525ae073dc19086f6efe1fff70f55c80c709e6e8d1`.
- Before/fix/restoration summary SHA-256 values, respectively:
  `b1b4f35bb4d3ddcd5c35d30863abf7f18dfba5c9721ea62a67ed05b95ff17198`,
  `0c3484fa066ed99f533aa95940b104cc647ec8089806348f70d7ce05cad9866d`,
  `8fc6ba10c977a4f3026c0f0cf3713c5e376ab84bca99f2e4bd0490f34ac63570`.
  Normal-speed summary:
  `465f9d8029f90e6a67cd3312e7b990090cefafcc8ae301e8cf130fee0cf809ca`.
  Final Hub/Boneyard browser log SHA-256 values:
  `9193f59e798ee0b4159bb7739d5d9732da87af54c5b18cc14adf0fb012a18746`,
  `4cd24def77c5b93d7841db2546fada0568e1edfd8015f88294a46ba919da7e77`.
- The initial handoff retained the source and Mac acceptance worktrees for
  review. The user's follow-up authorizes a normal push to `main`. All five
  candidate files initially matched the validated Mac tree byte for byte.
  Before the push, upstream rendering optimization
  `4335d52d5b21c44573e3e201a948b8d73154bcf2` landed; the focused fix rebased
  cleanly onto it. Publication requires repeating the full Mac gate and
  Hub/Boneyard browser checks on that integrated tree. Deployment is separate.
  Publication scaffolding consists of
  `/home/user/.codex-worktrees/solomon-website-ring-fire-lighting-lag-20260904-root`
  and `/Users/jarrett/codex-acceptance/ring-fire-lighting-lag-20260904-root/Website`;
  remove both and the task branch after verifying the remote commit. The
  temporary baseline worktree, profiling probes, captures, and raw logs were
  already removed at handoff. The referenced recording remains unavailable,
  so publication does not establish its exact end-of-effect timing.
- Publication revalidation of candidate
  `493a4448264ec1fd3552902fdc5db362a6f10fa6` on parent `4335d52d` passed the
  complete Mac gate: 2,667 Node tests, 19 backend integration tests, and all
  formatting, lint, type, build, budget, and media checks. The gate log SHA-256
  is `664974dbb6b02edcbe2a26b8e35fa29c44c6e20fbc0a02fbcac7f935fde1fea1`.
  Built entry `Game-46blNuBz.js` is 262,311 raw / 79,057 gzip bytes. Fresh
  built Hub and Boneyard journeys each confirmed pages `[0,1,2]` before
  gameplay. Hub rejection remained intact; the Boneyard cast had zero late
  player-atlas uploads. Both journeys had empty page/console/response error
  arrays. Only this publication receipt changed after those checks.

## 2026-09-05 — Supplied recording and current-build follow-up

The previously unavailable `SDB - Noticeable performance improvement with
reduced light.mp4` is now present in Windows Downloads. Its SHA-256 is
`e24a42680cda49f55d75d73eda3cdf71f98bf6700b2d23877677fafec5bb45ca`.
It contains 463 frames at approximately 29.97 FPS, 1920x1080, over 15.46 seconds.
The container has no recording/build identifier; its filesystem modification
time does not establish the game revision used to capture it.

Direct observations:

- One Ring of Fire cast occurs around 6.4 seconds, followed by its flash and
  retirement. The HUD's one-second FPS estimate briefly reads 59 around
  8.0–8.75 seconds and otherwise reads 60 in the sampled gameplay frames.
- The adjacent 29–41 ms values are network ping (`GameHud.tsx:PingCounter`),
  not frame durations. The recording cannot reveal individual 60-Hz game
  frame intervals from its approximately 30-Hz capture cadence.
- At 12.4 seconds, the Tweak Performance panel shows Reduced Screen Flashes,
  Complex Lighting, Complex Shadows, Multiple Shadows, and Camera Shake Off,
  with Light Quality 100. The clip does not include an enabled-setting cast
  for a direct A/B comparison.

The current comparison tree is `a2197bf4a6b8bf8a5328030c63b555b269c65e65`,
which already includes player-atlas preparation commit `827c1ebd`. This
follow-up retains the complete page/consumer/lifecycle inventory above and
the final-overlay-only setting contract in entry 130. It does not reopen
native lighting constants or change the accessibility policy without new
evidence.

During the investigation, main advanced to
`9c0bfbe03705d9f8b868ba8cd28d7ee3c0d06606` with primary-spell barrier changes.
The atlas-preparation fix remains present. Measurements and the full gate
below remain tied to the stated comparison tree, rather than claiming that
the newer primary-spell change received the same measurements.

The controlled follow-up used the production build in Mac Chrome 152 on the
Apple M2 Metal renderer at 1920x1080. Each fresh-browser run used a fixed
Boneyard seed, restored player/enemy/equipment state and secondary RNG, the
recorded lighting settings, and Ring of Fire with the Burning Man set. The
existing secondary-ability browser fixture supplied the real UI, combat, and
input journey. A temporary sampler observed animation-frame intervals, heap,
long tasks, and context-specific WebGL uploads without forcing GPU completion
or starting a CPU profiler during capture. Four eight-second casts per run
included full effect retirement; the end window spans 500 ms on either side
of the last frame with secondary actors.

For the diagnostic baseline, reverse only the two renderer changes from
`827c1ebd` on the same `a2197bf4` tree. Keep all other source, assets, settings,
and instrumentation identical. Apply diagnostic 4x CPU throttling only after
renderer readiness, then repeat in fresh browsers with either setting first.

| Version | CPU throttle | Reduced-flash order | Maximum frame intervals, cast 1–4 | Maximum in any effect-end window | Late player-page upload |
| --- | --- | --- | --- | --- | --- |
| Current | 1x | Off/On/On/Off | 16.8 / 16.8 / 16.8 / 16.8 ms | 16.8 ms | none |
| Baseline with atlas preparation removed | diagnostic 4x | On/Off/Off/On | 133.3 / 33.2 / 16.8 / 33.4 ms | 16.8 ms | first cast: page 1, 126.1 ms |
| Current | diagnostic 4x | On/Off/Off/On | 33.4 / 16.8 / 16.8 / 33.3 ms | 16.8 ms | none |
| Restored baseline, opposite initial setting | diagnostic 4x | Off/On/On/Off | 133.3 / 16.8 / 16.8 / 33.3 ms | 16.8 ms | first cast: page 1, 122.8 ms |

Both baseline upload stalls occur early in the first cast, approximately
205–239 ms after capture starts. Their fresh Boneyard contexts contain player
pages `[0,2]` before casting; current contexts already contain `[0,1,2]`.
This independently confirms the published cold-upload fix and shows that
Reduced Screen Flashes does not prevent that upload. It does not identify an
end-of-effect stall in the recording.

At normal hardware speed all four current casts have zero intervals over
25 ms, zero long tasks, and zero late uploads. At diagnostic 4x, the two
current 33-ms intervals occur 6.9–7.4 seconds into capture, after secondary
actors have retired, near world ticks 3,000 and 6,000. The same idle timing
appears in baseline runs. The sampler does not establish the owner of those
isolated intervals; neither a lighting regression nor garbage collection is
established by temporal association alone.

Corresponding first casts across runs peak at 33 secondary actors, 35
primitives, and 34 light sources; later casts peak at 32, 33, and 33. This
first-cast fixture difference is present with either initial flash setting.
The setting changes only final screen-overlay alpha to 20% of native alpha,
as specified in entry 130; the world-light and secondary-effect workload is
unchanged. Full effect retirement occurs in every captured cast.

The follow-up requires no additional production change: the reproduced
first-use defect is already fixed, and the reported setting-dependent tail
stutter is not reproduced under these Mac conditions. The recording's build
and the user's Windows renderer remain unidentified. A comparison on that
build/device is needed before attributing its reported tail stutter to the
screen-flash setting or claiming that this existing fix resolves it.

Measurement JSON SHA-256 values, in table order:

- `ccb17f3c9a7f103b5494c20dc0f0f52b971ef9ff9f2276dfce51d3554df9a4bb`
- `bf6bdaf7a812d0e27ce96e9825a69d58624e6eb65fcecc7f26f1d9c474fd0e6e`
- `e9a6e68037af2429bd0f4184f54ad34dc74ba3d41773576402eca9015e67a5e9`
- `b13826968388cfa32816ae85d3626417a1fe088cf3b7bfe39ace00cb1ff5c0e8`

Fresh validation on the Mac comparison tree:

- `/opt/homebrew/bin/bash ./scripts/validate.sh` passed all 2,675 Node tests
  and 19 backend integration tests, with no skipped Node tests. Formatting,
  TypeScript, import boundaries, generated-content checks, backend/frontend
  builds, bundle budgets, and production media policy passed. Built entry
  `Game-DCCWDgs-.js` is 262,311 raw / 79,058 gzip bytes. Gate log SHA-256:
  `920438ca98d7dd8ac5bd18a627713dc140a6fe2201e2df012700ca7ec811578f`.
- The gate exposed one unused import in
  `primary-spell-water-mesh-runs.test.ts`; removing that import was the initial
  code cleanup in this follow-up. Its seven existing tests and the supported
  Mac `./scripts/validate.sh lint` gate passed afterward. Final lint has 11
  pre-existing warnings and zero errors. No authored production code changed,
  so production complexity, Halstead, coverage, CRAP, mutation, duplication,
  and explicit-type metrics have no changed implementation scope in this
  follow-up; this is not a claim that the entire repository meets those gates.
  Focused-test and final-lint log SHA-256 values are
  `af29882cd9cfdd40aba324fc771ae7af99d2b5a8ee2368756be8a96f569c3673`
  and `66f3f33f2176ee6b41f946a63d6aa39ab55bd9d8ada9f8ec760d1ad91d45dec0`.
- Fresh production-build `smoke-secondary-abilities.mjs` journeys used
  skill 21, the native viewport, and separate Hub/Boneyard scenes. Both
  contexts had all player pages `[0,1,2]` ready. Hub admission remained
  blocked. Boneyard verified the cast pose, MovingFire/Shockwave/contact
  explosion, damage, flash, audio, cooldown, and zero late player-atlas
  uploads. Both runs have empty page/console/response error arrays. These
  instrumented default-settings journeys are contract checks, not the
  recorded-settings frame-timing comparison above. Their log SHA-256 values
  are `e33583bc5bb00bf039edff14bdf15cbfa2b6bb97135e1bfb60c95f896df86b81`
  and `98d2d8d24435f15d05738bcac438751298c4ddaf55b1c6745afee234ef3ef44e`.
  The inspected Boneyard capture SHA-256 is
  `c358bc722260e669c74029863a070f7a95452e2c116a11c5c223cfcdbc5fd996`.

The diagnostic baseline, temporary probes, captures, and raw measurement logs
were removed after recording their results here. Publication of this
follow-up contains the investigation record, unused test import cleanup,
and the smoke-fixture stabilization described below; it introduces no
rendering change or runtime deployment. The original Windows Downloads
recording remains untouched.

Publication revalidation encountered the previously documented randomized
enemy-spawn failure from entries 083 and 231: `resolveNativeBoneyardSpawnPosition`
could not find a dark collision-safe placement for radius
`19.79234754666686` from `(929.3023071289062, 1091.10009765625)`, aborting
the Boneyard host before the ability proof completed. This is a separate
open generated-map/spawn finding; it is not attributed to Ring of Fire or
the flash preference. The browser harness now consistently uses its existing
all-zero Boneyard seed, already used by the Phasing/Shield proofs and this
investigation's performance sampler. This makes the ability fixture
repeatable without changing or claiming to fix production spawn behavior.

Publication validation on parent
`530b7d2a4e4859af9d8603a52ee0a30ef9ab6e3d` passed the complete Mac gate:
2,682 Node tests, 19 backend integration tests, no skipped Node tests, and
all formatting, type, build, boundary, generated-content, budget, and media
checks. Built entry `Game-DbxCGrCZ.js` is 262,312 raw / 79,061 gzip bytes.
The gate log SHA-256 is
`f5043685513fa79807288a6e32dcdd7c7ab103a17c4260f467f5b0bfc2002daa`.
After stabilizing the browser fixture, the supported Mac lint gate passed
with 10 pre-existing warnings and zero errors; its log SHA-256 is
`e759425ad5d6071e6caa0eeb63aee3b2c370c54927b15ce03ae0222bb37ba5cc`.
No production code changed after the complete gate.

Both final fixed-seed built-browser journeys completed normally with exit
status zero, complete player pages `[0,1,2]` before gameplay, and empty
page/console/response error arrays. Hub still rejects Ring of Fire. Boneyard
observes MovingFire, Shockwave, the Burning Man contact explosion, the flash,
and zero late player-atlas uploads. Hub/Boneyard log SHA-256 values are
`285d3edd7d236b27f073ed0ebacdc504c89ae59cad16a79255f8c7c646aa633c`
and `bf5568cf46e05e9163d719d2701ea6177078b534cd0c31ec90ae1d06f73f5459`.
The inspected Boneyard capture SHA-256 is
`fc2c6bfc35fce4374ec69ad04b58d86280faa4ed51dbec5430e4e41d97e28f12`.
The rejected randomized-attempt log SHA-256 is
`e7f35593410f4dbc48575ce3c43484f10a67feb2324a9f3887a6c8d897097292`;
the successful fixed fixture does not establish random-map spawn closure.
