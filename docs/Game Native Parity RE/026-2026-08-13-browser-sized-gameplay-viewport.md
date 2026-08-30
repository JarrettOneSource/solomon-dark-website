# 2026-08-13 — Browser-sized gameplay viewport

## Reported smell and parity question

- Reported web behavior: the Hub and Boneyard live inside a fixed `1600 x 900`
  frame. `hubDisplayScale` uniformly shrinks that complete frame into the
  browser, and the enclosing menu stage keeps a `16:9` aspect ratio. A `16:10`
  desktop therefore receives horizontal letterboxing and a wide mobile browser
  receives vertical letterboxing instead of additional camera field of view.
- Requested behavior: make the gameplay surface follow the available browser
  rectangle without distorting world geometry. Preserve a minimum logical
  viewport on small devices, resize/re-anchor the HUD, and let only the camera
  field of view change.
- Reproduction surfaces: Hub Courtyard, all four private Hub rooms, Boneyard
  environment modes `0..2`, `1280 x 800` desktop, `844 x 390` coarse-pointer
  landscape, portrait orientation, and runtime resize.
- Falsifiers: any non-uniform world scale, simulation/collision coordinate
  change, fixed `16:9` gameplay bars, camera clamp still using `1600 x 900`, HUD
  anchors still using a 900-pixel bottom, or a darkness/fade surface that does
  not cover the resized camera would disprove the implementation model.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean-stock ledger | `SolomonDarkAbandonware/SolomonDark.exe`, verified size `4,723,200` and SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; clean 2026-08-11 PID `157624`, preferred image base `0x00400000`, runtime base `0x00CB0000` | The parity reference is the unmodified `0.72.5` executable and its `1600 x 900` backbuffer. No stale runtime address is used for this browser-only change. | high |
| Native instructions | `Region` fields `+0x80`, `+0x8BCC..+0x8BD8`; projection `0x0063ED80`; inverse `0x00462110`; Arena/Courtyard/private-room late view writers listed in `native-camera-control.md` | View origin, width, height, and world-to-screen scale are Region presentation state. Projection is `(world - origin) * scale`; changing the view rectangle does not rewrite actors or collision. | high |
| Native HUD instructions and live census | HUD `0x005D2520`, belt `0x005D3E10`, cursor/fade tail `0x005D3D48`, and `native-hud.md` | The HUD is a screen-overlay consumer of the active viewport. Top, bottom, center, and pointer anchors are recomputed from viewport dimensions; the world camera does not own HUD geometry. | high |
| Current web trace | `MainMenuScene.tsx`, `main-menu.css`, `HubScene.tsx`, `BoneyardScene.tsx`, both WebGL renderers, their render contracts, and `smoke-game-devices.mjs` at base commit `846e87e` | The menu stage constrains gameplay to `16:9`; both scenes transform a fixed frame; both WebGL renderers keep fixed logical dimensions and resize only backing density; Hub and Boneyard camera clamps and the Boneyard darkness compositor also use fixed dimensions. | high |

This pass reuses already durable native camera and HUD recovery. It adds no new
native address, layout, or reusable stock-system fact, so the corresponding Mod
Loader reports do not need a duplicate update.

## Native ownership thread

- The application/backbuffer supplies the drawable viewport. Each Region owns
  its primary, expanded, and culling view rectangles and rewrites them late in
  its fixed update; the renderer then projects world points through the
  Region-owned origin and scale.
- Courtyard normal and `1.25` southern camera banks consume the same primary
  view center in separate translation scopes. Private rooms consume the same
  Region camera contract. Arena/Boneyard uses the sibling Region view path.
- The screen-overlay pass consumes the viewport after world presentation. HUD,
  cursor, fade, and clipping remain independent of simulation position and
  world painter order.
- In the web port, `MainMenuScene` owns the browser stage, each gameplay scene
  owns resize observation and its screen overlays, and each scene-scoped WebGL
  renderer owns logical render dimensions, camera projection, backing density,
  and teardown. `ResizeObserver` disconnect and renderer destruction are the
  resize lifecycle boundary.

## Recovered behavioral contract

- Stock world units, actor positions, collision geometry, fixed ticks, network
  snapshots, painter order, and native Hub/Boneyard camera scale remain
  unchanged.
- `1600 x 900` remains the exact stock parity viewport. Browser adaptation is a
  designed-not-observed presentation policy: for available CSS size `(w,h)`,
  use the single uniform scale
  `s = min(1, w / 1600, h / 900)` and logical viewport
  `(w / s, h / s)`. Thus neither logical dimension falls below stock, the
  non-limiting axis expands the camera field of view, and no aspect ratio is
  stretched.
- The gameplay stage alone fills the safe browser content rectangle. Native
  title and Create surfaces keep their existing `16:9` stage and geometry.
- Hub camera clamps use `logicalWidth / 1.2` and
  `logicalHeight / 1.2`. Boneyard clamps and centering use the logical viewport
  with native zoom `1.35`. Courtyard southern-bank translation consumes the
  same dynamic view center while retaining its recovered `1.25` factor.
- The HUD remains screen-space, fills the logical viewport, re-anchors center,
  bottom, and right clusters to that viewport, and receives the same uniform
  small-screen scale `s`. The small-screen scaling is a browser policy, not a
  claim that retail uniformly scaled its HUD. Top-left, touch, map, modal, and
  status controls remain within the safe stage.
- WebGL backing resolution remains a device-pixel-density decision. It must not
  be reused as camera FOV or CSS size. Fade and Boneyard darkness surfaces cover
  the complete logical viewport after every resize.
- Keyboard/controller/touch intent and authoritative simulation are unchanged.
  Coarse-pointer portrait keeps the existing explicit rotate-to-landscape
  boundary; landscape must use the full safe viewport and keep a usable touch
  joystick.

## Nearby-system findings

- The existing renderer `resolution` diagnostic measures backing-pixel density,
  not game resolution. A browser-sized camera requires separate logical width,
  logical height, and uniform display scale.
- Hub private-room art is authored more narrowly than the stock camera. A wider
  browser may expose more of the Region background; stretching that art would
  violate both the request and the native world-space contract.
- Boneyard mode `1/2` darkness and Hub transition fade are screen-space siblings
  of the HUD. Leaving either at `1600 x 900` would make the viewport change
  visibly incomplete even if the WebGL canvas were correct.

## Confidence and open questions

- Confirmed: native camera/HUD ownership, projection formulas, web fixed-frame
  cause, all affected sibling scenes, and the separation between logical size
  and device backing density.
- Designed-not-observed: the `1600 x 900` logical floor and uniform small-screen
  scale. They preserve the exact stock reference while satisfying the browser
  and mobile product requirement without distortion.
- Unknown but non-material: stock retail behavior at a non-`1600 x 900`
  backbuffer was not newly captured. Native instruction ownership is sufficient
  to keep the browser adaptation out of simulation; a future native-resolution
  matrix could refine only the designed policy.

## Web implementation consequence

- Add one shared viewport contract below both scene components and renderers.
  It computes logical dimensions, display scale, and backing resolution inputs.
- Replace fixed translated native frames with browser-filling logical frames;
  pass the same viewport to camera, renderer, fade, darkness, HUD, and touch
  surfaces.
- Parameterize camera clamps and world centering by logical viewport dimensions.
  Rewrite fixed bottom/right HUD coordinates as native offsets from their
  actual anchors.
- Remove the gameplay-only `16:9` constraint and the fixed-size renderer resize
  path. Do not add CSS aspect-ratio exceptions or per-device breakpoints.

## Validation contract

- Focused contracts must lock the stock `1600 x 900` identity case, `1280 x 800`
  expansion to `1600 x 1000`, `844 x 390` expansion to approximately
  `1947.69 x 900`, invalid-size fallback, dynamic Hub/Boneyard camera clamps,
  and unchanged uniform scale.
- The real browser journey must enter Hub at desktop and mobile-landscape
  viewports, prove the gameplay stage exactly fills the available rectangle,
  prove renderer/camera/HUD diagnostics agree on logical dimensions, exercise
  touch movement, resize a live scene without remounting its canvas, and retain
  the portrait orientation boundary.
- Canonical acceptance is `./scripts/validate.sh` plus zero page/console errors
  in the focused Playwright journey. At `1600 x 900`, camera/HUD geometry must
  retain the native reference values.

## Implementation validation receipt

The shared contract is `frontend/src/game/renderer/game-viewport.ts`. Hub and
Boneyard scene owners now observe the safe gameplay rectangle, publish the
logical viewport, and pass it to their WebGL renderer. Camera clamps,
Courtyard southern-bank translation, Boneyard centering, transition fade,
darkness, HUD anchors, and touch controls consume that same contract. The
gameplay stage fills the browser while title and Create remain `16:9`.

Focused Node contracts cover the identity, large-screen, `1280 x 800`,
`844 x 390`, invalid-size, Hub/private-room camera, southern-camera, and
Boneyard clamp/centering cases. The canonical `./scripts/validate.sh` gate
passed with the new tests, architecture boundary check, production build, and
media-policy check. Its pre-existing Fast Refresh diagnostics remained
warnings only.

Google Chrome `150.0.7871.124` then completed the device Playwright journey
against an isolated development host:

- Steam Deck `1280 x 800` used the entire stage with logical `1600 x 1000`.
  Live resize to `1200 x 800` produced logical `1600 x 1066.6667`, scale
  `0.75`, and retained the exact mounted WebGL canvas.
- Mobile landscape `844 x 390` used logical `1947.6923 x 900`, scale
  `0.4333333`, and WebGL resolution `0.5`. Its joystick was `65.8667` CSS
  pixels wide and moved the authoritative player `63.1627` world units.
- The same phone session entered environment-mode-2 Boneyard. The WebGL canvas
  and darkness surface both covered `844 x 390`; camera diagnostics placed the
  player at logical `(763.5912,202.5)`, inside the expanded viewport.
- Portrait `390 x 844` retained the explicit rotate-to-landscape boundary.
- The run emitted no page errors. Visual receipts are
  `/tmp/solomon-dark-responsive-deck.png`,
  `/tmp/solomon-dark-responsive-mobile-hub.png`, and
  `/tmp/solomon-dark-responsive-mobile-boneyard.png`.

The broader two-player `npm run smoke:game` journey also passed at the exact
stock `1600 x 900` identity case with WebGL2 resolution `1`, no page/console
errors on either client, 24 distinct smooth player samples, all five walk
poses, animated Teacher and Solomon Dig frames, native painter bands on both
peers, and physical gate crossing from Y `150` to `365.99998`. Captures are
`/tmp/solomon-dark-responsive-boneyard-native.png` and
`/tmp/solomon-dark-responsive-boneyard-native-gate-open.png`.

No stock simulation rule, protocol, native asset, collision geometry, or Mod
Loader code changed. Non-landscape mobile gameplay remains intentionally
deferred behind the existing orientation boundary rather than inventing a
portrait camera/control mode.

## 2026-08-29 — Reopened: browser zoom-out exposes authored map edges

### Reported smell and parity question

- Reported web behavior: Ctrl plus mouse-wheel zoom-out can pull the gameplay
  camera far enough back to reveal the map surrounded by empty screen space.
  The owner described that exposure as the map wrapping around the screen
  edge.
- Stock behavior to preserve: retail presents one `1600 x 900` Region view;
  browser accessibility zoom and a genuinely larger display may change the
  Website presentation, but neither may manufacture world outside the active
  authored scene.
- Reproduction surfaces: Courtyard, all four fixed Hub rooms, every generated
  Boneyard, the stock Tutorial Boneyard, custom Boneyards, FOV settings
  `75..125%`, resize/fullscreen, Ctrl-wheel and Ctrl/Meta `+/-/0`, pointer and
  stick projection, HUD/fade/darkness/light surfaces, and renderer resize.
- Falsifiers: a repeated world texture rather than an oversized camera view;
  a scene whose authored extent is smaller than the stock reference view but
  changes at `1600 x 900`; a non-uniform scale; or a simulation/protocol write
  from the proposed presentation boundary would disprove the model.

This is a secondary report against the viewport system previously called
closed. The earlier membership sweep covered minimum logical dimensions and
ordinary responsive expansion, but it never dispositioned the maximum-FOV
branch where the logical viewport becomes larger than the complete authored
Region. Its rule "the non-limiting axis expands the camera field of view" was
therefore incomplete: expansion needs a scene-owned terminal boundary.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing clean-stock recovery | retail Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Region projection `0x0063ED80`, inverse `0x00462110`, and the camera writers already cited above | Region owns a finite authored world and a `1600 x 900` reference backbuffer. No native zoom-out or toroidal-world branch exists. | high |
| Current Website causal trace | clean `origin/main` `8044e97eca6baa6a867d33aa7cee9cdae1dbf398`; `game-viewport.ts`, Hub/Boneyard scene resize owners, camera clamps, native-frame transforms, and renderer resize paths | `gameViewportLayout` caps `displayScale` at one and has no maximum logical size. Browser zoom-out increases CSS `clientWidth/clientHeight`; the scenes pass that whole rectangle to camera, culling, input, overlays, and WebGL. Camera clamps correctly center a view larger than the world, which exposes void. | high |
| Controlled Mac Chrome reproduction | detached Mac worktree at the exact commit above; Chrome `151.0.7922.174`; task Vite `127.0.0.1:4297`; `1600 x 900` then the downstream-equivalent `6400 x 3600` CSS viewport; temporary captures `/tmp/map-edge-*.png` | Hub grew from a valid `1333.33 x 750` world view to `5333.33 x 3000` inside the `2000 x 1024` Courtyard. Generated template 8 grew from `1185.19 x 666.67` to `4740.74 x 2666.67` inside `2538.52 x 3261.48`. Captures show one finite map centered in black, not a repeating texture. | high for the downstream behavior; the owner supplies the trusted Ctrl-wheel trigger because browser-chrome zoom cannot be synthesized by a page-level Playwright input |
| Authored Hub data | `HUB_REGION_DEFINITIONS` and `HUB_PRIVATE_ROOM_LAYOUTS` | Courtyard is `2000 x 1024`; Mortuary, Library, and Office are `1024 x 1024`; StoreRoom is `1075 x 800`. The smaller rooms already intentionally show the stock reference envelope, so the correction may prevent only *additional* exposure beyond that envelope. | high |
| Complete generated-Boneyard table | `NATIVE_GENERATED_BONEYARDS` rows `0..11` at the current commit | Bounds are finite and fully available to the scene owner; there is no need to guess a global maximum or inspect opaque pixels. | high |

### System boundary and membership inventory

Native system: **Region-owned camera extent projected through one uniformly
scaled browser gameplay frame**. The Website extension may expand FOV until it
reaches the complete authored scene; further browser space uniformly scales
the whole frame rather than extending the world.

| Member / branch | Source / authored extent | Disposition | Proof |
| --- | --- | --- | --- |
| stock `1600 x 900` identity and smaller browsers | shared viewport owner | `verified-already-at-parity` | exact existing identity, `1280 x 800`, and `844 x 390` assertions remain unchanged |
| ordinary larger browser/fullscreen before a world edge | shared viewport owner | `verified-already-at-parity` | `1920 x 1080` still expands FOV at scale one when the active scene contains it |
| Ctrl-wheel, Ctrl/Meta `+/-/0`, retained site zoom, and desktop accessibility zoom | browser chrome above `/game` | `exact-ported` browser policy: zoom remains enabled; every producer converges on the same bounded resize contract | source contract plus real resize-equivalent journey; no wheel/keyboard suppression |
| Courtyard | `2000 x 1024` | `exact-ported` maximum envelope | logical frame never projects more than the complete world on either axis |
| Mortuary | `1024 x 1024` | `exact-ported` maximum envelope with stock-floor exception | `1600 x 900` remains byte-for-byte geometry; zoom-out creates no additional exposure beyond the stock reference envelope |
| Library | `1024 x 1024` | `exact-ported` with the same stock-floor exception | per-region assertion |
| StoreRoom | `1075 x 800` | `exact-ported` with the same stock-floor exception | per-region assertion |
| Office | `1024 x 1024` | `exact-ported` with the same stock-floor exception | per-region assertion |
| generated Boneyard row 0 | `2101.429931640625 x 3698.570068359375` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 1 | `2044.0400390625 x 3755.9599609375` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 2 | `2186.52001953125 x 3613.47998046875` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 3 | `1877.0799560546875 x 3922.919921875` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 4 | `2289.219970703125 x 3510.780029296875` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 5 | `3233.2900390625 x 2566.7099609375` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 6 | `2654.260009765625 x 3145.739990234375` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 7 | `1843.530029296875 x 3956.469970703125` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 8 | `2538.52001953125 x 3261.47998046875` | `exact-ported` | reproduced row; focused and browser proof |
| generated Boneyard row 9 | `3420.449951171875 x 2379.550048828125` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 10 | `2927.989990234375 x 2872.010009765625` | `exact-ported` | per-row bounded-layout assertion |
| generated Boneyard row 11 | `3402.35986328125 x 2397.64013671875` | `exact-ported` | per-row bounded-layout assertion |
| stock Tutorial Boneyard | `2043 x 2053` | `exact-ported` through the loaded-scene bounds | focused fixture plus browser resize |
| custom/community Boneyards | validated positive `LoadedBoneyard.scene.bounds` | `exact-ported` generic branch | arbitrary non-native aspect fixture; no catalog-size assumption |
| generated transition and Tutorial camera sub-bounds | authoritative focus/clamp domains inside the same valid Boneyard scene | `verified-already-at-parity` | they constrain camera focus and cleanup, not the authored map extent; no scene-exterior pixel becomes valid |
| Hub/Boneyard HUD, fade, darkness, environment light, level-up/Game Over, touch controls | consumers of the one native-frame transform | `exact-ported` through shared layout | bounding boxes fill the CSS scene and retain one uniform scale |
| camera culling, southern Courtyard translation, audio view width, pointer/stick projection, mod overlays | consumers of logical viewport and unchanged configured camera zoom | `verified-already-at-parity` under the bounded producer | no second scale or guessed camera value is introduced |
| WebGL backing density | `devicePixelRatio * displayScale`, existing cap | `exact-ported` through shared resize | browser zoom-out DPR and compensating frame scale remain presentation-only |
| player/world simulation, collision, snapshots, multiplayer authority, protocol, RNG, audio events | authoritative fixed-tick owners | `out-of-system` (presentation-only correction) | no touched owner or wire change |
| Title, Create, loading fixed scenes, public Website, Boneyard editor | separate fixed-stage/document owners | `out-of-system` | existing fixed viewport and ordinary document zoom stay unchanged |

No member is blocked by the browser platform.

### Recovered behavioral contract

- The minimum logical viewport remains `1600 x 900` and the transform remains
  uniform. Existing stock/mobile identity cases cannot move.
- For an active scene with authored size `(worldWidth, worldHeight)` and the
  configured camera zoom `z`, the largest logical frame is
  `(max(1600, worldWidth*z), max(900, worldHeight*z))`. The stock minimum wins
  for a fixed room narrower than the retail reference envelope.
- Given measured CSS size `(w,h)`, the display scale is the greater of the
  existing minimum-fit scale, `w/maxLogicalWidth`, and
  `h/maxLogicalHeight`. Logical size remains `(w/scale,h/scale)`. This fills
  the browser, never stretches an axis, and guarantees the view cannot exceed
  the authored scene where stock did not already do so.
- Changing Hub region, FOV, Boneyard, viewport, fullscreen, or browser zoom
  recomputes the same owner. The renderer canvas is resized in place; no scene,
  input adapter, or authoritative state is remounted.
- Browser zoom remains available. No Ctrl-wheel, keyboard shortcut, viewport
  metadata, or accessibility-zoom suppression is part of the correction.
- Ground/road texture repeat stays native and limited to its authored mesh.
  The visible defect is not repaired by changing texture addressing.

### Confidence and open questions

- Confirmed: current unbounded producer, exact Hub and all generated/Tutorial
  Boneyard extents, downstream camera math, uniform-frame seam, reproduced
  void exposure, and absence of a repeated-map texture.
- Inferred from the owner's trigger plus browser semantics: trusted Ctrl-wheel
  reaches the same resize path. Playwright cannot command Chrome's browser UI
  zoom from page input, so final acceptance uses both a real owner-equivalent
  `25%` CSS geometry and a cancelation-negative source assertion.
- Unknown but non-material: the owner's browser/OS and precise zoom step.
  Every step and producer terminates in the same measured CSS rectangle.

### Web implementation consequence and validation contract

- Extend the shared viewport module with one bounded-layout operation. Hub
  supplies the current `HUB_REGION_DEFINITIONS` extent; Boneyard supplies the
  exact loaded scene extent. Recompute when region, FOV, scene, or CSS size
  changes.
- Do not change camera zoom, camera clamps, scene textures, CSS overflow,
  browser zoom ingress, simulation, protocol, or Mod Loader.
- Focused tests first fail on an oversized `6400 x 3600` Courtyard and on all
  twelve generated Boneyards, Tutorial, a custom aspect, all five Hub regions,
  and FOV `75/100/125`. They then prove the logical view is inside the scene,
  the complete CSS rectangle is filled, and scale is uniform.
- Mac Chrome must traverse Hub and Boneyard, resize the same mounted canvases
  from `1600 x 900` to the Ctrl-wheel-equivalent `6400 x 3600`, and prove no
  scene-exterior world is visible, HUD/world surfaces fill the frame, pointer
  projection remains correct, and page/console/failed-response arrays are
  empty. The canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` gate is
  required on the exact candidate.

### Implementation validation receipt

- `boundedGameViewportLayout` now retains the existing `1600 x 900` minimum
  and ordinary larger-browser expansion, then raises the single uniform frame
  scale only when the configured camera would exceed the active scene extent.
  `HubScene` supplies the current one of all five `HUB_REGION_DEFINITIONS` and
  recomputes on region/FOV/resize. `BoneyardScene` supplies the exact loaded
  bounds and recomputes on Boneyard/FOV/resize. Camera zoom, renderer/input
  projection, textures, simulation, and protocol are unchanged.
- The focused Mac test was run red first and failed because the bounded owner
  did not exist. After implementation, Chrome-host Mac Node `22.17.0` passed
  `game-viewport.test.ts` `11/11`. Its new census exercises all five Hub
  regions, all twelve generated Boneyards, Tutorial, a custom non-native
  aspect, FOV `75/100/125`, stock identity, and ordinary `1920 x 1080` FOV
  expansion.
- Mac Chrome `151.0.7922.174` traversed Create, live Courtyard, and two live
  generated Boneyards while resizing the same mounted renderer canvases
  `1600 x 900 -> 6400 x 3600 -> 1600 x 900`. Courtyard now resolves the large
  frame to logical `2184.533333 x 1228.8`, scale `2.9296875`, and visible
  world `1820.444444 x 1024` inside `2000 x 1024`; the sampled Boneyards
  resolved exactly to their authored horizontal extents instead of the
  pre-fix `4740.740741` world width. Page, console, and failed-response arrays
  were empty, and the deployment poll was answered with the candidate revision
  exactly as in the maintained Vite smoke harnesses.
- Inspected post-fix captures were `/tmp/map-edge-hub-zoomed-out.png`, SHA-256
  `a37dde8a4b77e5186073e9043710279f09296349046a85cb9cc66965e827cff5`,
  and `/tmp/map-edge-boneyard-zoomed-out.png`, SHA-256
  `18f54294b7c9bdbfa79be4bd8661b508eb2cf1d75174278f88102a696ac3ab1f`.
  They were temporary evidence and were deleted after this result was recorded.
- The complete Mac gate was attempted twice on the byte-identical five-file
  implementation/document patch over `8044e97eca6baa6a867d33aa7cee9cdae1dbf398`.
  Backend `28/28`, backend build/format, lint/import boundaries/generated
  checks, and every viewport test passed. The large frontend group reached
  `1752/1753` and then `1751/1753`; only unrelated wall-clock host/supervisor
  tests failed while five separate native ML evaluators saturated the Mac.
  `developer observer watches one private run` and `private Colleges opt into
  discovery` both passed immediately when rerun alone on the unchanged tree.
  The owner explicitly directed this pass to skip waiting for a third complete
  gate on 2026-08-29. Therefore the canonical full gate is **incomplete by
  user direction**, not a passing receipt; production build stages after the
  failed group were not reached.
- At the time this pre-publication receipt was recorded, no commit, push,
  deployment, or live-production change had been performed. Exact publication
  SHAs belong in the external handoff. The focused local and detached Mac
  worktrees remained retained; all one-off probes, captures, and temporary
  logs were removed.
