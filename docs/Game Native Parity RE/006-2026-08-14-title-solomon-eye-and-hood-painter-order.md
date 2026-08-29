# 2026-08-14 — Title Solomon eye and hood painter order

## Reported smell and parity question

- Reported web behavior: Solomon's red eyes on the main menu sit above the
  hood, so outer eye pixels bleed across the hood edge.
- Stock behavior to recover: determine whether the eye crop or the animated
  cloak/hood owns their overlap and preserve that relationship through all
  five cloak frames and crossfades.
- Reproduction inputs/scenes: returning-player title root at `1600 x 900`,
  reduced-motion web frame zero, and a directly launched stock title with its
  beta dialog left open so the unobstructed left Solomon remains visible.
- Falsifiable questions: an asset-registration defect would remain after the
  native painter order is restored; an eye-above-hood model would require the
  native eye draw to occur after the cloak submissions.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; owned direct process PID `22016`, started `2026-08-14T12:22:23-04:00`, then stopped; `C:\Users\User\AppData\Local\Temp\solomon-stock-title-eye-order-20260814.png` | The stock hood covers the outside ends of the eye artwork. The captured process path was the abandonware executable and its enumerated modules contained no loader or mod DLL. | high |
| Instructions | clean image base `0x00400000`; `MainMenu_Render` `0x00598780`; draw calls `0x005991CB`, `0x005992C4`, `0x00599442`, `0x005994FF`, `0x005995E3`, `0x00599693` | Body record 3 is submitted first, eye record 8 second, current cloak twice third/fourth, and next cloak twice fifth/sixth. The immediate painter has no later depth sort. | high |
| Asset/data | `Title.bundle` SHA-256 `f6f1e5956427bfa45bc5e28c87cb2574a25169da96feca62e7efe8691d2b99d8`; `Title.png` SHA-256 `86b8bb40b3f7ece277cf0d1038b118bf095b8489bdc344738b2fe8cbe1160ff2`; records 3, 8, 11..15 | The Website body, eye, and five cloak PNG hashes exactly match the pixel-verified native-report extractions. The mismatch is not crop content. | high |
| Web runtime | Website `6a823b268063417ef26cb04982fec04ae333c893`, PixiJS `8.19.0`, Chrome `150.0.7871.124`, `1600 x 900`; `/home/user/.codex-evidence/title-eye-order-20260814/web-before.png` | The outer red eye pixels render over the hood. `stageSprite(...eyes..., zIndex 1)` gives the eyes a nonzero depth while cloak sprites retain depth 0. Pixi enables parent sorting when the nonzero child is attached, so it moves every cloak before the eyes. | high |

## Native ownership thread

- Owner and construction path: `MainMenu` construction at `0x0058D940`
  installs vtable `0x007980CC`, starts `solomondarktheme`, calls `Title_Build`,
  initializes its menu/grave storage, and zeros the animation fields.
- Upstream state producers/callers: vtable slot `+0x08`,
  `MainMenu_Tick` at `0x005A51B0`, advances cloak phase at
  `MainMenu + 0x400`; global tick `0x0081F658` supplies the eye sine phase.
- State representation and transitions: the five cloak records form one
  cyclic animation. `floor(phase)` and the next wrapped index select two
  records; the eye crop is a single separately translated record.
- Downstream consumers/callees: vtable slot `+0x0C`, `MainMenu_Render`, submits
  body and cloak records through scaled helper `0x00414EA0` and eyes through
  unscaled helper `0x004142E0`, using normal source-over drawing.
- Sibling systems sharing ownership or data: `Title.bundle` record 9 is the
  logo, records 16..24 are the three grave rows, and `0x005A0960` is the
  separate menu/header renderer. None participates in Solomon's internal
  overlap.
- Entry, interruption, reset, and teardown: layout is vtable slot `+0x04`
  (`0x005A51A0` -> `0x0059A9D0`). Deleting destructor `0x00592E10` delegates
  to `0x0058DA70`, which releases the grave vectors and embedded controls.
  Solomon has no independent actor lifetime beyond the active title owner.

## Recovered behavioral contract

- Timing/ticks/thresholds: retain the existing fixed-rate phase update,
  `current alpha = 1 - fraction^3`, `next alpha = fraction`, and one-pixel
  vertical eye sine.
- Geometry/transforms/coordinate spaces: retain the recovered body, eyes, and
  cloak rectangles in the title stage; no coordinate nudge is supported by
  this finding.
- Render/hit/collision/traversal order: submit body, eyes, current cloak twice,
  then next cloak twice. Therefore every cloak frame is painter-above the
  eyes, including both sides of a crossfade. Menu hit testing is unrelated.
- Assets/audio/randomness: retain exact extracted records 3, 8, and 11..15.
  This correction changes no assets, audio, grave RNG, or cloak timing.
- Input/network authority/replication: the title composition is local
  presentation state and never enters authoritative simulation or replication.
- Boundary and failure behavior: title viewport clipping still cuts off the
  cloak below the client. WebGL failure remains explicit and has no alternate
  painter path.

## Nearby-system findings

- Durable finding: in PixiJS 8.19, attaching a child whose `zIndex` is nonzero
  invokes `depthOfChildModified()`, enables `parent.sortableChildren`, and
  sorts siblings by depth before collecting renderables. Insertion order alone
  is therefore not the title renderer's effective order once any child has an
  explicit depth.
- Evidence: installed `pixi.js` sources
  `scene/container/Container.mjs`, `container-mixins/sortMixin.mjs`, and
  `collectRenderablesMixin.mjs`, plus a direct two-child Node probe that sorted
  depth 0 before depth 1.
- Why it matters or may matter later: every retained-mode title subcomposition
  must assign a complete sibling depth contract rather than mixing one explicit
  layer with implicit zero-depth siblings.
- Native report/catalog also updated:
  `Mod Loader/docs/main-menu-solomon-visual-re.md` now records the exact draw
  call sites, owner lifetime, and `body < eyes < cloak` occlusion consequence.

## Confidence and open questions

- Confirmed: native owner and lifetime, exact immediate call sequence, bundle
  records and crops, web sort trigger, and the visible stock/web differential.
- Inferred: none required for the implementation.
- Unknown: the exact stock outer-loop frequency remains unchanged from the
  earlier title investigation and cannot affect painter order.
- Next falsifying probe if the unknown becomes material: trace the outer loop's
  call cadence around vtable slot `+0x08`; this is unnecessary for an ordering
  correction.

## Web implementation consequence

- Correct owner/module: `renderer/title-menu-render-contract.ts` owns the
  recovered painter-depth contract and `title-menu-renderer.ts` applies it to
  every Solomon child.
- Shared model change: define all three sibling layers explicitly as
  `body < eyes < cloak`, leaving the four cloak submissions stable within the
  cloak layer.
- Stock behavior preserved: geometry, assets, crossfade duplication, opacity,
  eye bob, fixed title stage, and scene lifecycle remain unchanged.
- Browser-specific approximation, if unavoidable: retained depth values encode
  the native immediate painter sequence; they do not approximate its visible
  output.
- Symptom patch or obsolete path to remove: replace the mixed explicit/implicit
  depths that let Pixi place the eye crop last. Do not mask or reposition eye
  pixels.

## Validation contract

- Focused automated test: create Pixi siblings at the shared contract depths,
  force sorting, and assert `body`, `eyes`, then all four cloak submissions.
- Playwright or runtime journey: load `/game` at `1600 x 900`, reduced-motion
  frame zero, capture the WebGL canvas, and retain page/console errors.
- Stock-versus-web comparison: compare the left hood/eye overlap against the
  owned direct-stock capture while holding the recovered geometry constant.
- Measurable acceptance criteria: no red eye pixel crosses either hood edge;
  the canvas remains one `pixi-webgl` surface at `1600 x 900`; asset-source,
  animation-frame, and error receipts remain unchanged.

## Implementation validation receipt

- Files/modules changed: `title-menu-render-contract.ts` now defines the
  complete native sibling depth contract; `title-menu-renderer.ts` applies it
  to body, eyes, and every cloak sprite; and
  `title-menu-render-contract.test.ts` recreates Pixi's sorting behavior and
  locks the six-submission order.
- Tests and canonical gate: the regression first failed at TypeScript compile
  because the depth contract did not yet exist. After implementation,
  `./scripts/validate.sh` passed all `23` backend/contracts tests, all `315`
  frontend tests, all `5` desktop tests, backend formatting, frontend lint and
  architecture checks, both production builds, and the production media/CSP
  policy. Existing Fast Refresh and bundle-size notices remained warnings.
- Browser/native evidence: Chrome `150.0.7871.124` visited the built production
  preview at `/game` with status `200`, one `1600 x 900` `pixi-webgl` canvas,
  root screen/frame-zero diagnostics, and zero console or page errors. The
  retained frame-zero capture is
  `/home/user/.codex-evidence/title-eye-order-20260814/web-after-production.png`.
  A separate live pass observed and captured cloak frames `0..4`; every frame
  kept the eye pixels behind the hood. The result agrees with the directly
  launched stock capture at
  `C:\Users\User\AppData\Local\Temp\solomon-stock-title-eye-order-20260814.png`.
- Remaining implementation explicitly out of scope: no other title geometry,
  logo, menu control, background painter lane, or animation timing changed.

## 2026-08-28 — Reported Solomon flicker and black-box revalidation

### Reported smell and parity question

- Reported web behavior: the left title Solomon portrait flickers and presents
  a black box.
- Stock behavior to recover: revalidate the complete body/eye/five-cloak
  composition, frame wrap, crossfade, initial upload, GPU/context state, and
  responsive stage rather than deleting one of the visually suspicious
  duplicate cloak passes.
- Falsifiers: a frame-specific blank texture, wrong alpha/sampler state,
  geometry discontinuity, context-restoration failure, or web-only hard scene
  change aligned to the reported bounds.

### Evidence, membership, and result

| Member/evidence | Exact source | Disposition | Result |
| --- | --- | --- | --- |
| body, eyes, cloak `0..4`, wrap `4->0` | retail `MainMenu_Render 0x00598780`, calls `0x005991CB/0x005992C4/0x00599442/0x005994FF/0x005995E3/0x00599693` | `verified-already-at-parity` | the two current and two next cloak submissions are intentionally parameter-identical; body < eyes < all cloak passes remains exact |
| stock live cycle | clean task-owned 0.72.5 process, 60-FPS 1600x900 capture, 600 frames | `verified-already-at-parity` | all five frames and wrap remained stable behind the stock Beta prompt |
| web Windows/D3D11 cycle | production `0c510ce3`, Chrome/ANGLE AMD Radeon RX 9070 XT, 952 steady frames plus 494 loader-to-title frames | `verified-already-at-parity` | no black rectangle, missing texture, abrupt phase, page/console/response error, or context failure |
| web Mac/Metal cycle | production `0c510ce3`, Chrome/ANGLE Apple M2, 599 frames | `verified-already-at-parity` | all phases stable; maximum adjacent cropped mean-luma delta `.20078/255`, no scene score above `.08`, empty errors |
| alpha/sampler falsifiers | live WebGL state plus diagnostic forced straight-alpha and clamp samples | `out-of-system` as disproven causes | active normal state was already `SRC_ALPHA/ONE_MINUS_SRC_ALPHA`; neither override exposed or removed a distinct title artifact |
| responsive/title entry and teardown | existing renderer lifecycle and fresh-profile startup captures | `verified-already-at-parity` | renderer is fully populated before its first manual render and destroys scene-owned textures on exit |

No platform-specific difference or unresolved native member was found. The
reported symptom is not reproducible on current main across both supported
hardware paths; changing duplicate draws, alpha, sampler, geometry, or timing
would knowingly diverge from stock. The implementation consequence is a
stronger all-five-frame/wrap regression and repeated browser acceptance only,
with no speculative title production change.

### Validation contract and receipt

- Focused test: enumerate phase `0..5`, assert current/next record, exact
  `1-f^3`/`f` alpha, edge/non-edge geometry, four cloak submissions, eye
  occlusion, and continuous wrap.
- Browser: retain the high-rate Windows and Mac current-main loops above after
  the combined candidate is built; page/console/failed-response arrays must be
  empty and no hard frame delta may appear.
- The production renderer now consumes a pure cloak-pass planner that
  enumerates all four native submissions without changing their textures,
  geometry, alpha, order, cadence, or lifetime. Its focused regression covers
  frame zero, an in-frame crossfade, all edge geometry, and continuous `5->0`
  wrap.
- The built combined candidate ran for 600 compositor-presented frames over
  ten seconds on Chrome/WebGL2 through ANGLE Metal on Apple M2. All five cloak
  frames appeared; page, console, and failed-response arrays were empty. The
  prompt crop stayed within `44.986..45.385/255` mean luminance with maximum
  adjacent mean absolute delta `.02229/255`; the Solomon crop's maximum
  adjacent delta was `.25222/255`. No presented frame contained a partial
  painter, black rectangle, missing texture, or hard phase edge. Screencast
  and analysis log SHA-256 values are respectively
  `678f42d7e6789df06c0e6ee3022fac787a45c38847d2964a77954a37b5d82c1c`
  and
  `1a5efe93f61ad63bad7296b01d3b765bf5284d36803fef60e34f30ad6e1aeede`.
- Together with the independent Windows/D3D11 and clean-stock runs above,
  this disproves a current renderer defect on both supported GPU paths. No
  speculative title behavior was changed. The publication pass still reruns
  the complete canonical gate after this receipt is recorded.

## 2026-08-29 — Right-edge seam correction: cropped records changed the wrap domain

### Reported smell and parity question

- Reported web behavior: the looming Solomon on the `/game` main menu has a
  visible black vertical line along his right edge even after the general
  precomposed-page alpha correction.
- Stock behavior to recover: retain the retail Title page's linear/wrap
  sampling domain around records 3, 8, and 11..15. A record crop is geometry,
  not a new texture page whose opposite edge may become the record's neighbor.
- Reproduction: current `origin/main` `d01cb94f8697d26731a633b6a85cefbaac0ecfd6`,
  production Chrome `151.0.7922.174` through ANGLE Metal on Apple M2 at
  `1600 x 900`. The prompt-darkened root frame shows a one-pixel seam at
  canvas x `325`; columns 325/326 have mean adjacent RGB deltas
  `5.7772/5.7089`, while columns 318..324 and 327..331 remain below `0.84`.
  Page, console, and failed-response arrays are empty. Screenshot SHA-256 is
  `65d2e06d41d6c5120504c554a5cac8a9f0f15e7430fe4f185dee3e2affe2ba62`.
- Falsifiers: changing global native wrap state, clamping a cropped record,
  padding with invented colors, changing Solomon geometry or duplicate cloak
  passes, or fixing only one cloak frame while sibling Title records keep the
  same false crop-page ownership.

The 2026-08-28 black-box revalidation above looked for a black rectangle,
missing texture, or hard animation discontinuity. It did not measure the
stable one-column silhouette seam, so its sampler falsifier and no-defect
conclusion do not cover this report.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean retail page | `Title.png`, SHA-256 `86b8bb40b3f7ece277cf0d1038b118bf095b8489bdc344738b2fe8cbe1160ff2`; `Title.bundle` records 3, 8, 11..15 | The Website's `native-ui-title-atlas.png` is byte-identical to retail. The texel immediately right of every cloak record has alpha zero and retained bleed RGB. | high |
| Website loose crops | `menu-solomon-{body,eyes,cloak-0..4}.png`; exact hashes match the pixel-verified Mod Loader artifacts | Every cloak crop's left column has 318 nonzero-alpha texels, including 279 or 280 opaque dark texels; its right column has only 13..16 translucent texels. | high |
| Web source policy | `TITLE_COMPOSITED_ASSET_SOURCES`, `nativeCompositedTextureFromImage`, PixiJS frame UVs | The prior correction uploads each tight crop as PMA but retains `addressMode: repeat`, so the crop's opaque left column becomes the right edge's bilinear neighbor. | high |
| Sampling equation | 183-source-pixel cloak drawn 366 pixels wide; WebGL pixel-center linear sampling | The final destination pixel samples source coordinate `182.25`: 75% record-right texel plus 25% wrapped crop-left texel. The two intentional cloak submissions compound the dark coverage. Native instead samples Title atlas column 355/539, whose alpha is zero. | high |
| Built browser | receipt above | The resulting stable line is visible at the exact drawn right boundary `-40 + 366 = 326`. | high |

This is static retail data and a clean browser build. No injected runtime or
stale ASLR address participates.

### System boundary and membership inventory

Native system: **active MainMenu consumers of the Title texture page** — exact
record frames and their adjacent atlas texels through the existing title
painter, animation, and teardown.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| cloud base/shadow/detail | Title 0..2 | `exact-ported` from the complete retail page | record frames, source identity, tiling capture |
| Solomon body and eyes | Title 3/8 | `exact-ported` from the complete retail page | geometry/order and perimeter capture |
| grass, horizon, moon | Title 4..6 | `exact-ported` from the complete retail page | record frames and scaled Title capture |
| Solomon cloak frames and `4 -> 0` wrap | Title 11..15 | `exact-ported` from the complete retail page | all five frames, duplicate passes, right-edge probe |
| three grave-row variants | Title 16..24 | `exact-ported` from the complete retail page | all nine records and fractional/scaled capture |
| College title strip | Title 7 | `out-of-system` for MainMenu; separately owned by the College title lifecycle | existing College contract |
| stock gold logo | Title 9 | `out-of-system` under the approved Website branding override | ledger 004 |
| dormant 3x3 record | Title 10 | `out-of-system`; no compiled stock selector | existing exhaustive record census |
| Website logo, UI-button pieces, labels, and Hall background | no active Title-page record under this boundary | `verified-already-at-parity` under their existing PMA-composite policy | unchanged source membership and Title journey |

### Recovered contract and implementation consequence

- Native wrap belongs to the complete `2048 x 1024` Title page. Each record
  supplies frame UVs into that page; it does not create a standalone repeating
  image.
- The Title renderer must load the byte-identical `native-ui-title-atlas.png`
  as an NPM/linear/wrap stock source and derive active record textures from
  that source. Existing crop rectangles, logical geometry, painter order,
  phase, opacity, fixed tick, and teardown remain unchanged.
- All active MainMenu Title records sharing the false crop-page assumption move
  together. The Website logo, UI-derived chrome, rendered labels, and Hall
  background remain explicit PMA composites.
- Do not introduce clamp-to-edge or alter the shared stock/composite alpha
  policies. Retire the loose Title-record crops from `/game` startup and
  renderer ownership; the marketing-page Canvas2D Solomon is outside this
  `/game` renderer boundary.

### Validation contract

- Focused tests pin the complete active record map, exact Title atlas source,
  NPM/linear/wrap policy, absence of loose Solomon/background crops from the
  `/game` Title source sets, and unchanged cloak order/geometry/animation.
- Built Mac Chrome repeats stock, mobile, ultrawide, tall, and live-resize Title
  journeys with empty error arrays. A dedicated stock-size root capture must
  expose the Title source policy and show no dark column at x `325` or any
  sibling record boundary.
- Compare the exact before/after right-edge interval and inspect all five cloak
  frames plus `4 -> 0`. Run the final exact candidate through the canonical Mac
  `./scripts/validate.sh` gate.

### Implementation validation receipt

- Source ownership: `game-assets.ts` now loads the byte-identical native Title
  page and limits the Title PMA set to Website-authored logo/chrome/labels/Hall
  art. `title-menu-renderer.ts` derives cloud 0..2, Solomon 3/8/11..15,
  grass/horizon/moon 4..6, and graves 16..24 as exact frames of that NPM stock
  source. The renderer no longer loads or references loose Title-record crops.
- Geometry and lifecycle: the existing crop rectangles, grave registrations,
  body/eye/cloak painter depths, four cloak submissions, five-frame phase,
  fixed 60 Hz update, responsive stage, and destroy path are unchanged.
  `TITLE_MAIN_MENU_ATLAS_RECORDS` gives every active member one reviewed row.
- Focused coverage: the Mac suite passed the new complete record-map test as
  frontend test `1681`, the unchanged Solomon order test as `1682`, and the
  source-policy contract as `1626`. The production smoke now asserts exact
  Title-page presence, loose-crop absence, and live alpha modes at every stock,
  mobile, ultrawide, tall, and live-resize prompt state.
- Pre-receipt canonical gate: the complete Mac `./scripts/validate.sh` run
  passed backend build, all 29 Website/backend integration contracts, strict
  frontend lint and architecture checks, every frontend suite (including the
  `1,701/1,701` Boneyard group), five desktop tests, both production builds,
  bundle budget, media policy, and CSP. Production entry `Game-BQ3QRwwu.js`
  measured `263,459` raw / `79,942` gzip bytes. Combined-log SHA-256 is
  `2ee79eb95454f3c8c9426336700700f617f0d1b7d5a6dda2d4ba037073bef07f`.
- Built browser proof: Chrome `151.0.7922.174` through ANGLE Metal on Apple M2
  passed all four viewport journeys with empty page, console, and failed-
  response arrays. Every receipt reported the Title/native sources as
  `no-premultiply-alpha`, Website composites as
  `premultiply-alpha-on-upload`, exact Title present, loose Title crop absent,
  and 19 decoded Title-scene sources.
  Smoke-log SHA-256 is
  `a1920e0f3018864835ab20c3746cfa8ce741ea9308b674d43c8e5c4eb1d8f4ac`.
- Pixel/visual proof: at the same prompt-darkened `1600 x 900` frame, mean
  adjacent RGB deltas at x 325/326 fell from `5.7772/5.7089` to
  `0.4467/0.4539`; the neighboring 322..324/327..328 interval is
  `0.4178..0.5789`. The former isolated edge no longer exists. The inspected
  candidate screenshot SHA-256 is
  `790fc6b5d8e86136c33aa542cbe50becf47905a77c11089e16f7591469fb35e5`.
  Static source census covers every cloak 0..4: each now samples its true
  alpha-zero retained-RGB atlas neighbor rather than the crop's dark left edge.
- Publication-rebase integration: upstream `acad2d24` initially prevented the
  Sprite-only Title application from mounting by requiring a Mesh pipe it does
  not own. The shared fixed-function installer now requires and installs its
  corrected batch owner for every application, installs the mesh shader only
  when a Mesh pipe exists, and remains strict when an existing mesh pipe lacks
  its shader. The new Sprite-only regression passes without weakening
  Create/Hub mesh or Boneyard Arena ownership.
- Rebased pre-final gate: the complete Mac gate passed again with all 29
  Website/backend contracts, strict lint/architecture checks, the central
  `1,701/1,701` frontend group, five desktop tests, both production builds,
  budget/media/CSP gates, and the Sprite-only regression. Production entry
  `Game-DvRi6pYb.js` measured `263,459` raw / `79,948` gzip bytes; combined-log
  SHA-256 is
  `8a10f0af23912a7baa66e48de253adbb8382ae9242efb92d8b0addf659ad4646`.
- Rebased browser proof: the same four viewport/live-resize journeys passed
  with exact Title present, loose crops absent, correct PMA/NPM policies, and
  empty page/console/response arrays. The former seam interval remained clean
  at `0.4817/0.4106` versus baseline `5.7772/5.7089`. Smoke-log SHA-256 is
  `b2eed90ee03a13457afb7629a35758c847f5fb7a27caf38b84dd84ab0e9a509d`;
  inspected screenshot SHA-256 is
  `b6fc9f4a5f0360a8ad5ec5a41d4bf17cb8b54d12c9e7c83c0cca4a146f8dd7df`.
- Screenshots and raw browser logs are task evidence and must be deleted after
  the recorded hashes and measurements. Publication, if authorized, still
  requires the exact post-receipt gate and separate remote SHA proof.
