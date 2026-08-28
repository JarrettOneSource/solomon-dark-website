# 2026-08-26 — User-authored mobile HUD layout editor

## Reported smell and parity question

- Owner request: add a Mobile UI editor to Game Settings. It must begin from
  the shipped touch layout, present the HUD on a plain silver landscape page
  with a snapping grid, and let a player select, drag, resize, pinch-scale, and
  rotate each requested control. The editor page itself must pan and zoom far
  enough for precise placement.
- This is an explicit Website extension. Retail `0.72.5` has no mobile input
  profile or HUD editor; the native question is therefore preservation: can a
  saved touch-only presentation transform move the existing semantic controls
  without changing their visibility gates, input producers, actions, scene
  membership, fixed simulation clocks, or desktop placement?
- Reproduction surfaces: Settings from Title, Dark Cloud, Hub, and Boneyard;
  Hub and Boneyard at coarse-pointer landscape sizes; reload and reset; fine
  pointer desktop as the negative control.
- Falsifiers: merely opening or resetting the editor changes default runtime
  geometry; a custom transform affects fine pointers; a moved element loses
  its existing action or tutorial gate; Hub grows a right joystick; positions
  are stored in device pixels; pinch on a control zooms the page instead of
  the control; pinch on empty page resizes a selected control; or any of the
  requested members is absent from the editor.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Current Website owner trace | `GameSettingsDialog.tsx`, `game-settings.ts`, `MainMenuScene.tsx` at `49f7bec6` | All four Settings entry contexts share one dialog. Existing game settings use browser-local persistence and publish presentation changes without crossing the game protocol. | high |
| Current HUD owner trace | `GameHud.tsx`, `SkillQuickbar.tsx`, `GameMenuSkull.tsx`, `TouchJoystick.tsx` at `49f7bec6` | The skull is stage-owned; diagnostics, eight slots, inventory/tome/XP/potions are HUD-owned; joysticks are scene-owned Pointer Events controls. Each can consume presentation variables at its existing DOM owner. | high |
| Existing mobile geometry | 2026-08-23 compact-touch-HUD entries; `mobile-quickbar-layout.ts`, `hub.css`, `touch-joystick.css`, `main-menu.css` | Default touch geometry is already adaptive across viewport width and UI scale. An absent customization record must continue to select these rules rather than serializing one phone's pixels as a new default. | high |
| Input and lifecycle evidence | 2026-08-13 touch lifecycle and 2026-08-21 unified quickbar entries | Touch joysticks retain pointer capture/release ownership; quickbar slots publish semantic slot identity; potions publish strict item consume; inventory, skills, and pause retain their current modal owners. | high |
| Platform boundary | retail executable `0.72.5`, preferred base `0x00400000`; prior mobile ledger system | Retail has no Pointer Events, phone viewport, touch HUD, or layout editor. No new executable fact or reusable Mod Loader fact is being claimed. | high |

No new static or live native probe is needed: the extension consumes only the
already recovered screen-overlay/input seams, and the preservation questions
are fully answerable from the current owners and browser behavior.

## System boundary and membership inventory

System: local coarse-pointer HUD presentation profile. It owns a versioned
browser-local transform for the complete requested membership, the Settings
editor that authors it, and the touch-only projection of those transforms.
The boundary ends before semantic click/hold handlers, tutorial availability,
scene mounting, session state, audio, replication, and simulation.

| Member | Existing owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Pause skull | `GameMenuSkull` / stage modal-back owner | `verified-already-at-parity`; custom geometry is out-of-system (Website extension) | one skull retains hidden/inert/available gates and backs out of the top modal before opening pause |
| FPS / Ping group | `GameHud` diagnostics | `verified-already-at-parity`; custom geometry is out-of-system | one editor member moves/scales/rotates the existing live counters together |
| Left movement joystick | `TouchJoystick lane="movement"` in Hub + Boneyard | `verified-already-at-parity`; custom geometry is out-of-system | same movement vector, capture, interruption, release, and teardown under a transformed hit region |
| Right primary joystick | `TouchJoystick lane="primary"` in Boneyard only | `verified-already-at-parity`; custom geometry is out-of-system | editor always exposes it; runtime remains absent in Hub and keeps the existing aim producer in Boneyard |
| Slot 1 | `SkillQuickbar` slot `0` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `0` and tutorial secondary anchor follows its live rectangle |
| Slot 2 | `SkillQuickbar` slot `1` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `1` |
| Slot 3 | `SkillQuickbar` slot `2` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `2` |
| Slot 4 | `SkillQuickbar` slot `3` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `3` |
| Slot 5 | `SkillQuickbar` slot `4` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `4` |
| Slot 6 | `SkillQuickbar` slot `5` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `5` |
| Slot 7 | `SkillQuickbar` slot `6` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `6` |
| Slot 8 | `SkillQuickbar` slot `7` | `verified-already-at-parity`; custom geometry is out-of-system | semantic slot remains `7` |
| Inventory button | `GameHud` backpack owner | `verified-already-at-parity`; custom geometry is out-of-system | opens the same inventory surface and retains tutorial visibility/anchor |
| Skillbook button | `GameHud` tome owner | `verified-already-at-parity`; custom geometry is out-of-system | opens the same SkillScreen and retains tutorial visibility/anchor |
| XP meter | `GameHud` progression presentation | `verified-already-at-parity`; custom geometry is out-of-system | live fill and progress semantics unchanged |
| Health Potion | `GameHud` strict Health shortcut | `verified-already-at-parity`; custom geometry is out-of-system | same first recursive owned stack, count, binding label, disabled gate, and consume action |
| Mana Potion | `GameHud` strict Mana shortcut | `verified-already-at-parity`; custom geometry is out-of-system | same first recursive owned stack, count, binding label, disabled gate, and consume action |
| Shipped adaptive default | existing coarse rules plus `mobile-quickbar-layout.ts` | `verified-already-at-parity` | no valid stored profile means no custom attributes or transform overrides; reset removes the profile |
| Selection, drag, grid snap, resize nodes, pinch-scale, rotate handle | new Settings editor | `out-of-system` (retail has no mobile editor) | selection border and nodes follow the chosen member; drag/resize/rotate update only its draft transform |
| Page fit, pan, wheel controls, and empty-page pinch zoom | new Settings editor viewport | `out-of-system` (browser authoring surface) | independent zoom state is never persisted into gameplay; zoom anchors under the gesture/focus point |
| Versioned local persistence and reset | new mobile-layout store | `out-of-system` (browser-local preference) | exact member set and bounded finite values; malformed records fall back to adaptive default; reset removes the key |
| Desktop/fine pointer | base HUD rules | `verified-already-at-parity` | custom declarations are unreachable outside `(hover: none) and (pointer: coarse)` |
| Health/mana meters, selected skills, allies, chat, party, map/help/loadout | existing HUD siblings | `out-of-system` (not requested) | no transform member or changed selector |

No member is blocked by the browser platform.

## Ownership thread and requested behavioral contract

- The Settings dialog owns one draft. `SAVE` commits a complete profile;
  `RESET DEFAULT` marks the adaptive default for restoration; leaving the
  editor through its back owner follows the same commit path. Gameplay owners
  subscribe only to the committed profile, so pointer-move drafts do not write
  local storage or churn the live scene.
- A valid profile stores each member's centre as percentages of the safe game
  stage, plus one uniform scale and rotation. Device pixels and editor-page
  zoom are not durable state. Values are finite and bounded; every serialized
  member is required, so partial or future-incompatible records fail closed to
  the shipped adaptive layout.
- When no profile is stored, the current responsive CSS remains the sole
  layout owner. The editor derives its silver-page seed from those same
  joystick, bank, dock, and stage constants at the current coarse-pointer
  landscape aspect and UI scale; a fine-pointer editor uses the established
  `896 x 414` phone reference.
- A selected member owns a drag contact. A second contact on that same member
  uniformly pinch-scales it. Resize nodes use the same uniform scale model;
  the rotate handle owns angular change. Empty-page contacts own page pan and
  pinch zoom. The grid is a square canonical-pixel grid and can be toggled;
  keyboard arrows retain a precise accessible adjustment path.
- Runtime projection changes geometry only. The transformed DOM element keeps
  the existing listener, disabled state, aria semantics, tutorial data anchor,
  z-order, and scene lifetime. Joystick direction remains screen-relative even
  when its presentation is rotated.

## Confidence and open questions

- Confirmed: owner boundaries, complete requested membership, current mobile
  geometry formulas, scene membership, settings/modal entry paths, and input
  lifecycle contracts.
- Inferred: none used as stock fact. Grid size, transform bounds, editor zoom
  range, and the silver authoring surface are explicit product choices.
- Unknown but non-blocking: physical-device grip comfort for an arbitrary
  player profile cannot be predicted. The editor makes that geometry
  user-authored; browser acceptance must still distinguish emulation from a
  real-phone receipt.

## Web implementation consequence

- Add a pure mobile-layout model/store with the exact 17-member catalog,
  adaptive-default geometry projection, strict versioned parsing, normalized
  transforms, reset semantics, subscription, and CSS-variable projection.
- Add a cohesive Settings editor component and stylesheet; widen only the
  editor page of the existing dialog and preserve every other Settings page.
- Consume the committed profile at `GameMenuSkull`, `GameHud` /
  `SkillQuickbar`, and `TouchJoystick`. Add touch-only override rules after the
  accepted coarse layout rules. Do not change protocol or simulation code.
- Add focused model and membership/owner tests, and a production mobile Chrome
  journey covering authoring, save, runtime projection, persistence, reset,
  all requested members, and empty page/console/failed-response arrays.

## Validation contract

- Unit: exact 17-member inventory; current `896 x 414` default projection;
  strict persistence parsing, bounds/normalization, reset, listeners, and
  malformed/partial fallback; page-aspect and snapping math; member drag,
  uniform resize/pinch, rotation, and page-zoom reducers.
- Contract: Settings has one Mobile UI page in every context; each runtime
  owner consumes exactly its member(s); all custom geometry is coarse-only;
  right stick remains Boneyard-only; unrelated HUD siblings and semantic
  handlers are unchanged.
- Gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini from a
  clean worktree containing the exact candidate.
- Browser: Mac Chrome production bundle, touch/coarse `896 x 414`: open the
  editor, verify the silver grid and 17 members, drag with snap, node-resize,
  element pinch, rotate-handle, empty-page pinch/page pan, deep zoom, save,
  enter Hub/Boneyard and prove transformed rectangles/actions, reload for
  persistence, reset and prove the stored key plus custom attributes disappear.
  Capture page, console, request-error, and failed-response arrays.
- Fine-pointer negative control: stored customization leaves desktop runtime
  geometry unchanged.

## Implementation validation receipt

- Implementation: `mobile-ui-layout.ts` owns the exact 17-member catalog,
  measured adaptive seed, strict version-1 local record, finite bounds,
  subscriptions, reset, grid/gesture math, and touch-only CSS projection.
  `MobileUiEditor` owns one Settings draft on a silver landscape canvas with
  selection border, eight resize nodes, rotate handle, drag, same-element
  pinch, grid snap, keyboard precision controls, independent empty-page pan /
  pinch, wheel/buttons, fit, and `35..400%` page zoom. `SAVE` commits once;
  `RESET DEFAULT` removes the record. Cross-tab writes and clears update live.
- Runtime: the existing stage skull, FPS/Ping group, scene joysticks, eight
  live quickbar slots, Inventory, Skillbook, XP, Health Potion, and Mana
  Potion consume only committed centre/scale/rotation variables under the
  coarse-pointer media gate. Their original semantic handlers, disabled /
  Tutorial gates, scene membership, concentration-capable hotbar behavior,
  input authority, and teardown remain. Joystick input stays screen-relative
  after visual rotation. Hub still mounts no right stick; Boneyard mounts both.
- Validated source candidate `a4e0318868eb590ab50ba45b6f3f46ed6942462f`
  is one commit over `49f7bec66264932afc7a4fb5151763dbbce195d1`.
  The local and detached Mac manifests for all 18 changed files were SHA-256
  identical before the final receipts.
- Focused Mac contract: `mobile-ui-layout.test.ts` (including the editor owner
  contract) passes `10/10`. The exact candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 24 Website/backend contracts,
  lint/import/generated checks, every frontend/desktop group (`2,379/2,379`
  total, including `1,624/1,624` Boneyard/game tests), production frontend and
  game-host builds, media policy, and bundle budget. `Game-C437hkMB.js` is
  `470,843` raw / `131,632` gzip bytes against `524,288` / `134,144`.
  Final gate log SHA-256 is
  `c6a5474efea1ae4c3f7011b16fbcd6d43b036ffc9bf8ae96114d7776912b7166`.
- Mac Chrome 151 production acceptance at touch/coarse `896x414`, DPR 2,
  captured 21 settled stops. The editor exposed all 17 members on the measured
  silver grid; drag, node resize, rotate, same-element pinch, empty-page pinch
  to `213%`, and one-finger pan from `(0,0)` to `(80,40)` all passed. The saved
  Inventory transform (`x 67.857%`, `y 73.430%`, scale `3`, rotation `90deg`)
  survived reload, projected onto the live Hub control, and still opened the
  authoritative Inventory. Reset removed the storage record and every custom
  runtime attribute before the accepted adaptive Hub/Boneyard journey.
- The same saved profile loaded in a fine-pointer `1600x900` context with the
  custom record present but computed transform `none`; Inventory remained at
  native desktop center `(763,855)`. The established journey also passed the
  orientation round trip, short-height dialogs, party/invitation/card/chat,
  Boneyard pause plus resume grace, and two-stick held/released input.
- Page errors, console errors, failed HTTP responses, unexpected request
  failures, backend errors, and supervisor errors were empty. Three `.mp3`
  `ERR_ABORTED` requests were the expected reload/scene audio-lane
  cancellations and are recorded separately. The task left no process or
  listener on its `5317/5318` ports. Receipt SHA-256 is
  `d3f92605d4ec839b76925e5005125be312dceac33eecc0ae552a98b1f34cea3e`;
  retained evidence is under Mac
  `/Users/jarrett/codex-acceptance/mobile-ui-editor-20260826/evidence-r16-final/`.
- Visual inspection confirms the editor grid/controls at deep zoom, the
  deliberately transformed live Inventory control, the unaffected desktop
  HUD, and the restored default Boneyard HUD. Screenshot SHA-256 values are
  `c856b33d...d1b2` (editor), `63c3ec10...e793` (custom Hub),
  `59abcdea...c80` (desktop isolation), and `f79d26f8...3969` (reset Boneyard).
  Chrome touch emulation is not a physical-phone ergonomics receipt; arbitrary
  authored layouts remain the player's choice. No browser-platform member or
  material implementation unknown remains. This implementation receipt is the
  sole post-validation documentation write; no runtime, test, build, or browser
  source byte changed after the receipts above.
