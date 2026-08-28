# 2026-08-26 — Corrective title MsgBox responsive-curtain ownership

## Reported smell and parity question

- Reported web behavior: the dark tint behind `PLAY THE TUTORIAL?` does not
  span the screen width. The prompt frame itself remains centered.
- This reopens the 2026-08-24 stock title MsgBox port and the 2026-08-25 phone
  dialog-fit claim. Those passes validated the native 1600×900 composition and
  semantic action stage, but silently treated a contain-fit native stage as the
  complete responsive title render target. That assumption is false whenever
  the browser aspect ratio is not 16:9.
- Stock behavior to preserve: common MsgBox renderer `0x005C4530` first dims
  its complete 1600×900 render target, then paints the content-sized frame,
  ornaments, text, and actions. Browser projection question: which owner must
  extend when the web title render target is wider or taller than the fixed
  native content stage?
- Falsifiers: the prompt frame should stretch with the browser; action hit
  rectangles should move out of native-stage coordinates; Kill Character uses
  another backdrop owner; a stock shared-UI plan may drop its curtain; or the
  title curtain already covers the full logical renderer viewport.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing retail closure | retail 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; MsgBox render `0x005C4530`, layout `0x005AB060`; clean 1600×900 Kill capture SHA-256 `26a83bb43c05592fcf60ed9472ba1b2c4bfba14b06d8b28d77f5adc9f871f256` | The native curtain covers the complete render target; content is separately centered and content-sized. | high |
| Current pure plan | `title-menu-prompt.ts` -> `planNativeUiMessage({ width:1600, height:900, dimAlpha:0.75 })`; `native-ui-plan.ts` `message:curtain = (0,0,width,height)` | Native plan is correct for a native-sized target. | high |
| Current title projection | `title-menu-renderer.ts` `promptStage.position = centerBounds`; plan remains 1600×900 while the Pixi application is `viewport.width × viewport.height` logical units | Curtain and frame share the centered fixed-stage container, so both are clipped to the native stage rather than only the frame. | high |
| Responsive geometry | `fixedGameViewportLayout` / `fixedGameStageBounds` at current Website `31c462bb` | `896×414` yields scale `0.46`, logical width `1947.826...`, centered X `173.913...`: the curtain occupies physical X `80..816`, leaving 80 px untinted on both sides. `2560×1080` leaves 320 px per side. A tall `900×1200` viewport produces the same defect vertically. | high (exact formula) |
| DOM semantic projection | `StockPromptDialog.tsx`, `.stock-prompt-stage`, `fixedStageStyle(center,center)` | Transparent YES/NO actions correctly remain over the native 1600×900 stage; widening this DOM stage would desynchronize hit geometry. | high |

No new retail function, address, asset, or table is required. The existing
Mod Loader title/MsgBox report remains authoritative; this is a Website
responsive ownership correction.

## System boundary and membership inventory

Native/web system: title-local MsgBox curtain projection across the variable
browser render target, while the exact native prompt composition remains in
its contain-fit 1600×900 content stage.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| full-target black curtain, alpha `0.75` | stock `0x005C4530`; `message:curtain` solid node | exact-ported through responsive title projection | covers logical `(0,0,viewport.width,viewport.height)` on every frame and resize |
| Tutorial offer | Website-authored copy inside stock MsgBox | exact-ported presentation projection | full curtain on fresh missing-save root screen; prompt frame/copy/actions unchanged |
| Kill Character confirmation | stock title caller `0x0058E260` | exact-ported | same full curtain on Play screen; exact four-line copy and YES/NO behavior unchanged |
| prompt background/frame/corners/header/text | UI 49, 10/79, 107..110, 17, 18; Fonts groups 3/1 | verified-already-at-parity | remains centered at native bounds `(550,268,500,362)`; no scaling/stretch beyond stage scale |
| primary/secondary visible controls | UI 101/102/54 | verified-already-at-parity | rendered bounds remain `(595,484,200,69)` and `(811,484,200,69)` |
| transparent semantic actions | `StockPromptDialog` | verified-already-at-parity | remain in centered native-stage coordinates and match visible controls at all aspect ratios |
| 1600×900 / 16:9 viewport | native identity case | verified-already-at-parity | responsive curtain equals the native plan exactly; no double dim |
| wide phone `896×414` | variable web render target | exact-ported browser projection | zero untinted left/right pixels; native content remains centered and fully clickable |
| ultrawide `2560×1080` | variable web render target | exact-ported browser projection | zero untinted left/right pixels; title cover backdrop remains unchanged |
| tall viewport `900×1200` | variable web render target | exact-ported browser projection | zero untinted top/bottom pixels; native content remains centered |
| resize/orientation change while prompt is open | title renderer `resize` / `applyTitleViewport` | exact-ported browser projection | curtain redraws to the new logical renderer dimensions without rebuilding prompt state |
| safe-area inset | `.main-menu-page` single padding owner | verified-already-at-parity | curtain covers the already inset title stage; no second `env()` application |
| prompt hover/press/busy state | title render frame | verified-already-at-parity | curtain dimensions and alpha do not change with action state |
| prompt close/title teardown | prompt frame null / renderer destroy | exact-ported | full-target curtain hides with prompt and is destroyed with title root |
| shared `planNativeUiMessage` consumers outside title | Inventory/trader/unforge/workbench/other scene owners | out-of-system for responsive title projection; shared primitive remains exact | default native plan still contains its stock-sized curtain; no global semantic change |
| title backdrop cover transform, account/quit/center/Solomon stages | existing title renderer owners | out-of-system except as dimmed descendants | animation, cover crop, anchor placement, and pointer input remain unchanged |

No member is browser-blocked. The variable-aspect render target is directly
representable by a viewport-local Pixi solid behind the native prompt content.

## Native ownership thread and recovered behavioral contract

- Stock MsgBox owns two geometrically distinct outputs even though both share
  one 1600×900 coordinate space: a complete-target curtain and a centered,
  content-sized dialog. The web port collapsed them into one contain-fit
  container; non-16:9 rendering exposes that false equivalence.
- The responsive title renderer already owns the complete logical viewport and
  recalculates it in `applyTitleViewport`. It therefore owns the browser
  projection of the curtain. `promptStage` continues to own only the native
  content plan at `centerBounds`.
- `planTitleMenuPrompt` must preserve the stock 1600×900 curtain when passed
  native dim alpha `0.75`. The title renderer requests its content-only
  variant to prevent double dim, then paints one viewport curtain at the same
  exact alpha and immediately below prompt content.
- React remains an accessibility/hit projection only. It must not paint a CSS
  tint or expand its fixed stage to simulate the renderer correction.

## Nearby-system findings

- Durable finding: fixed-stage containment is correct for authored UI geometry
  but is not a valid owner for full-render-target effects such as modal
  curtains. Future title-wide flashes/fades must declare which space they own.
- Evidence: exact `fixedGameViewportLayout` transform plus current Pixi stage
  hierarchy; no new native finding.
- Native report/catalog update: none required.

## Confidence and open questions

- Confirmed: native full-target ownership, current false container sharing,
  exact wide/tall gap sizes, both title prompt consumers, action coordinates,
  resize lifecycle, and direct browser representability.
- Inferred: none material.
- Unknown: none.

## Web implementation consequence

- Add one title-root `promptCurtain` immediately below `promptStage`; redraw it
  directly from the current logical viewport during initial layout and every
  resize, and toggle it from the same nullable prompt frame.
- Render the unchanged prompt plan without its embedded curtain only in this
  title projection. Keep default `planTitleMenuPrompt` output, native frame,
  text, buttons, DOM stage, and action semantics unchanged.
- Use the existing title viewport diagnostics plus actual screenshots for
  browser acceptance; do not ship a second prompt-specific diagnostic API.
- Do not add a CSS backdrop, viewport-unit patch, minimum width, overflow, or
  aspect-ratio exception.

## Validation contract

- Focused pure/source tests: the `0.75` prompt plan retains one 1600×900 curtain;
  title content-only plan contains none; renderer draws one root curtain from
  exact logical viewport dimensions and does not stretch `promptStage` or
  `StockPromptDialog`.
- Browser: fresh Tutorial and seeded Kill prompts at stock `1600×900`, mobile
  `896×414`, ultrawide `2560×1080`, and tall `900×1200`; for each, diagnostic
  curtain bounds equal the complete logical canvas, alpha remains `0.75`, frame
  bounds remain native-centered, both actions remain clickable, and resize
  while open updates coverage. Capture empty page/console/failed-response arrays
  and inspect representative wide/mobile frames for zero untinted strips.
- Run the complete canonical Website gate on the byte-identical Mac candidate.

## Implementation validation receipt

- Implementation: `title-menu-renderer.ts` now owns one black Pixi
  `promptCurtain` at root depth 29 and alpha `0.75`, immediately below native
  prompt content at depth 30. Initial layout and every resize redraw it as
  `(0,0,viewport.width,viewport.height)`. `planTitleMenuPrompt` takes an
  explicit dim alpha: native tests request `0.75`, while the title renderer
  requests `0` so the responsive curtain is painted exactly once. The stock
  frame, bitmap copy, action art, centred `promptStage`, transparent DOM hit
  stage, copy, callbacks, and CSS are unchanged.
- Red/green contracts: the Mac baseline failed because `promptCurtain`, the
  content-only plan, and full-target ownership did not exist. The implemented
  focused native-UI/title suite passes `19/19`; changed-file oxlint reports zero
  warnings/errors and TypeScript test configuration passes. Logs:
  `evidence/red-focused.log` and `evidence/green-focused-final.log`.
- Production Chrome 151 matrix: both `PLAY THE TUTORIAL?` and Kill Character
  pass at stock `1600×900`, mobile `896×414`, ultrawide `2560×1080`, and tall
  `1200×1000`, plus a live mobile-to-tall resize while Tutorial remains open.
  Mobile keeps the native physical stage at X `80..816` and both action rows at
  exact 0.46 scale while the canvas/tint spans X `0..896`. Ultrawide keeps the
  native stage at X `320..2240` and exact 1.2-scale actions while tint spans
  X `0..2560`. Tall keeps the native stage at Y `162.5..837.5` while tint spans
  Y `0..1000`. `NO` closes each shared curtain; page, console, and failed-
  response arrays are empty in every case. Log:
  `evidence/title-prompt-production.log`.
- Visual inspection of
  `evidence/title-prompt-production-mobile-tutorial.png` and
  `evidence/title-prompt-production-ultrawide-kill.png` confirms uniform
  edge-to-edge dimming with no bright side/top strips, double tint, stretched
  prompt art, displaced actions, or title-backdrop regression.
- The complete Mac canonical Website gate exits zero with all backend,
  frontend, native UI, Boneyard/game, Tutorial, ML, desktop, lint, type, build,
  and media-policy contracts. Production entry `Game-C5nETtmE.js` is `474712`
  raw / `133117` gzip against limits `524288` / `133120`; the strict budget was
  not raised. Log: `evidence/canonical-compact.log`.
- No new native fact or Mod Loader report change was required. No browser-
  platform difference or material unknown remains.
