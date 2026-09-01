# 2026-08-23 — Reusable stock UI building-block system

## Reported smell and parity question

- Reported need: inspect the complete stock UI vocabulary and make it reusable
  so new messages, tabs, buttons, and related surfaces can be authored from
  stock assets instead of recreating their chrome and text per screen.
- Current web smell: `skill-picker-renderer.ts`,
  `hub-inventory-renderer.ts`, and `gameplay-pause-renderer.ts` separately
  implement atlas lookup, subtexture construction, bitmap measurement,
  kerning, wrapping, frames, and fills. `NativeGameOverPrompt.tsx` and
  `NativeLootBitmapText.tsx` repeat a second DOM glyph-layout path. The checked
  manifests expose full `UI`/`Inventory`/`Skills` records but only four of ten
  stock font wrappers and no single complete presentation-atlas interface.
- Stock behavior to preserve: positional bundle-record ABI, exact logical and
  trimmed geometry, finite bitmap-font glyph/kerning tables, deterministic
  painter order, native button/message/tab chrome, semantic hit geometry,
  local presentation ownership, and balanced texture/container teardown.
- Reproduction membership: every presentation/UI atlas and font wrapper; raw
  sprite, text, tile/clip, frame, button, tab, message, and SimpleMenu
  primitives; every stock layout, overlay, and composite consuming them; and
  the current WebGL/DOM implementations being consolidated.
- Falsifiers: one record or wrapper is absent; a record is inferred from pixels
  rather than parsed; selected tabs shift horizontally; selected labels fail
  to rise 8 px; buttons lose `UI.101/.102/.54`; unsupported text falls back to
  an OS font; visible and semantic bounds diverge; a screen state machine moves
  into the kit; or derived textures survive adapter teardown.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Exact 0.72.5 image used by every source atlas, layout golden, and static address below. | high |
| Asset/data | Mod Loader `native-content-inventory.json`, `native-atlas-consumers.json`, and new `native-ui-kit-catalog.json` | Twelve UI/presentation atlases contain exactly 1,259 records; Fonts groups 0..8 plus the ControlPanel wrapper contain 718 glyphs. Every PNG/bundle hash, record index, wrapper table, direct consumer, and disposition is enumerated. | high |
| Instructions | canonical read-only Ghidra project via replica slot 1; `decompile_targets.py 0x004F3590 0x0043BCD0 0x005C65A0 0x005C6A50 0x005A0960 0x00594FC0` | Re-confirms `UI` construction, `ExactText_Render`, labeled/unlabeled controls, shared panels, and Dark Cloud ownership. | high |
| Instruction membership sweep | `trace_singleton_register_offsets.py 0x008199E4 30` | 331 `UI` singleton loads; register-derived paths re-confirm HUD, Inventory, Hall, skills, Dark Cloud, panels, and controls, including UI.81/.82, UI.47/.48, and shared control vectors. | high |
| Disabled-control instructions/data | `UiLabeledControl_Render 0x005C60F0`, alternate `0x005C65A0`, unlabeled `0x005C6A50`; floats `0x007DE870=0.5`, `0x007DE978=0.25` | Disabled art/text uses alpha 0.5, followed by a control-rect overlay with RGBA `(0.5,0.5,0.5,0.25)`. | high |
| Settled stock observation | Mod Loader `native-menus-and-boot.md`, `native-menu-settlement.md`, 30 canonical menu layouts, one credentials overlay, one first-boot composite, and their reference captures | Pins exact art membership and painter/geometry behavior. Dark Cloud selected labels rise 8 px; `UI.13` brackets keep X fixed and grow from 51 to 65 px. | high |
| Current web causal trace | Website `origin/main` `40d165b5`; the three renderers and two DOM text owners named above; `skill-picker-native-assets.json`, `hub-trader-native-assets.json` | Native facts are duplicated across shallow local helpers; complete reusable extraction and one shared layout seam do not exist. | high |

No new injected-loader runtime fact is used. Existing clean-stock captures and
static data already close appearance and source membership; the fresh Ghidra
pass verifies the ownership and selection seam used by the reusable port.

## System boundary and membership inventory

Native system: stock presentation vocabulary below the screen state machines —
atlas pages/records, bitmap-font wrappers, reusable composition rules, semantic
hit rectangles, and adapter teardown.

The machine-readable one-row-per-record inventory is Mod Loader
`docs/reverse-engineering/native-ui-kit-catalog.json`. It is normative for all
1,259 asset records and all 32 screen consumers; the grouped table below keeps
this ledger reviewable without copying 1,259 identical dispositions.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| `Bonedit` records `0..83` | builder `0x004E41C0`, `Bonedit.png/.bundle` | `exact-ported` | complete parsed catalog/page |
| `ControlPanel` records `0..115`, including its 92-glyph wrapper | `0x004E7EF0` | `exact-ported` | complete parsed catalog/page/font ABI |
| `Controls` records `0..3` | `0x004E84E0` | `exact-ported` | complete parsed catalog/page |
| `Create` records `0..23` | `0x004E8680` | `exact-ported` | complete parsed catalog/page |
| `Fonts` records `0..626`, groups `0..8` | `0x004EA3D0` | `exact-ported` | all nine wrapper tables and page |
| `GameOver` records `0..2` | `0x004EA650` | `exact-ported` | complete parsed catalog/page |
| `Inventory` records `0..83` | `0x004EB0F0` | `exact-ported` | complete parsed catalog/page |
| `LevelPicker` records `0..7` | `0x004EBA90` | `exact-ported` | complete parsed catalog/page |
| `Loader` records `0..4` | `0x004EC1F0` | `exact-ported` | complete parsed catalog/page |
| `Skills` records `0..165` | `0x004ED280` | `exact-ported` | complete parsed catalog/page |
| `Title` records `0..24` | `0x004F3210` | `exact-ported` | complete parsed catalog/page |
| `UI` records `0..112` | `0x004F3590`, singleton `0x008199E4` | `exact-ported` | complete parsed catalog/page plus direct/register consumer sweep |
| raw atlas sprite | common descriptor at `0x00413B10`/`0x00413DE0` | `exact-ported` | exact packed frame, logical size, trim, transform, tint/alpha |
| bitmap text | `ExactText_Render 0x0043BCD0`; ten wrappers | `exact-ported` | shared finite-glyph layout consumed by WebGL and DOM adapters |
| tiled/clipped fill | shared sprite/clip paths | `exact-ported` | exact source record and caller rectangle |
| mirrored frame and nine-slice | common panel renderers and final-edge sampling | `exact-ported` | deterministic corner/edge/center plan |
| stock button | `UI.101`, pressed `UI.102`, ends `UI.54`, Fonts group 3 | `exact-ported` | idle/pressed/focus/disabled plan plus shared hit rectangle |
| stock tabs | Dark Cloud browser, `UI.13` | `exact-ported` | fixed X, resting 51 px/selected 65 px bracket span, label +8 px |
| stock message | native message-box family | `exact-ported` | `UI.107..110`, `.10/.79`, `.49`, `.17`, `.18`, `.8`, stock actions |
| SimpleMenu | `0x0058EA50`, `0x005A0960`, shared panel/control renderers | `exact-ported` | authored rows, owner timing, semantic hit bounds |
| 30 canonical layout consumers | exact list in `native-ui-kit-catalog.json` and `native-menus-and-boot.md` | `out-of-system` (each scene keeps state, input, actions, timing, and transitions) | complete consumer census; kit supplies art/composition only |
| `dark_cloud_settings_credentials` | typed credentials overlay | `out-of-system` (overlay owner) | catalogued overlay consumer |
| `beta_notice_first_boot` | dialog-over-picker composite | `out-of-system` (composite owner) | catalogued composite consumer |
| host simulation, save, protocol, replication, replay, RNG | no UI-art ownership | `out-of-system` (presentation-local system) | no new wire or authority state |

No member is blocked by the browser platform. Stock-dormant atlas records are
still exactly ported as available building-block art; they remain unreachable
from unchanged stock screens unless a new web-authored surface explicitly uses
them.

## Native ownership thread

- Construction: each generated bundle builder parses records in positional
  order into fixed runtime destinations. Fonts and ControlPanel additionally
  construct finite wrapper tables. Page acquisition is reference-counted.
- Upstream state: the active screen/controller supplies labels, selected and
  pressed state, rectangles, actions, animation progress, and visibility. The
  atlas never owns those values.
- Consumers: screen renderers select records or font wrappers, then shared
  sprite/text/panel helpers draw into the screen-space render context. Semantic
  input traversal belongs to the screen owner.
- Siblings: Title, Create, Settings/ControlPanel, Dark Cloud, Inventory,
  SkillScreen/pickers, Pause/SimpleMenu, Game Over, Hall, HUD, Loader, and
  Bonedit all consume the same lower vocabulary in different combinations.
- Teardown: screen containers and derived textures release before their source
  page set; no UI presentation object survives owner replacement, device
  teardown, disconnect, or scene destruction.

## Recovered behavioral contract

- Atlas records use exact source rectangles, logical sizes, and trim origins;
  all 1,259 records in this boundary have rotation zero.
- Bitmap layout performs wrapper-specific kerning and advance. Spaces use the
  wrapper advance. Unsupported glyphs emit nothing and never invoke a system
  font. Measurement and drawing share the same pure layout result.
- Frames preserve corner mirroring, exact edge slices, center fill, and painter
  order. Tiled and clipped fills preserve the caller's authored geometry.
- The standard long button uses `UI.101`; press uses `UI.102`; `UI.54` supplies
  mirrored end treatment; the label uses Fonts group 3 and native gold tint.
  Disabled art/text uses alpha `0.5` and the final gray control-rect overlay
  uses alpha `0.25`.
- A selected Dark Cloud tab raises its label exactly 8 px and extends its two
  `UI.13` brackets from y `136..187` to `128..193`. Bracket X never moves.
- The stock message family composes outer ornaments, repeated edges, a clipped
  interior, inner frame, skull/header, arrows, title/body text, and one or two
  standard actions in deterministic order.
- Rendering is local presentation. A block may expose a semantic action id and
  hit rectangle, but only the owning scene may interpret or authorize it.

## Nearby-system findings

- The existing web split already has the correct architectural direction:
  Pixi/WebGL owns exact visible art while React owns semantic controls and
  accessibility. The missing seam is one shared pure plan used by both.
- Full `UI`, `Inventory`, and `Skills` records already exist in checked web
  manifests; re-extraction must replace those parallel truths with one complete
  catalog rather than layer another partial manifest over them.
- The complete stock font vocabulary is larger than the currently shipped
  four-wrapper subset. Groups 2, 4, 6, 7, 8 and the ControlPanel face must stay
  finite and named by their proved role, not guessed typeface names.
- Durable native report updated:
  `docs/reverse-engineering/native-presentation-ui-fonts-and-loader.md`; new
  catalog and generator live beside it in Mod Loader.

## Confidence and open questions

- Confirmed: source identity/hashes, complete atlas/record/wrapper counts,
  descriptor grammar, all `UI` record live/dormant dispositions, key shared
  consumers, component geometry, ownership, and teardown.
- Inferred: none used as native fact. Human-friendly primitive names describe
  recovered compositions; their underlying records and geometry are exact.
- Unknown: no material unknown. A record whose stock consumer is indirect or
  screen-owned is still completely extractable and exactly reusable by index.

## Web implementation consequence

- Add one generated, hash-pinned asset catalog for all 12 atlases and ten font
  wrappers. Regeneration fails closed on source hash, size, count, geometry, or
  wrapper drift.
- Put record lookup, font layout, and declarative plans behind one deep native
  UI module. Add Pixi and React adapters at that seam; do not expose duplicate
  kerning tables or screen-specific asset manifests to new callers.
- Provide raw sprite/text/frame primitives and high-level button, tabs,
  message, and SimpleMenu plans. Plans return semantic hit rectangles from the
  same geometry used to paint.
- Migrate current duplicated helpers without changing screen behavior. Keep
  specialized screen state and transitions in their current owners.
- Add a development workbench that renders every record and live examples from
  the public interface, so new surface authors can inspect stock assets without
  copying crop coordinates.

## Validation contract

- Generator/static: exact executable/PNG/bundle hashes; 12 atlases; 1,259
  ordered records; ten wrappers/718 glyphs; eight primitives; 30 layouts, one
  overlay, one composite; zero unresolved dispositions.
- Focused module tests: every record lookup; every font wrapper; kerning,
  spaces, multiline wrapping, alignment, scaling, tint, and unsupported glyph;
  frame slices/order; every button state; selected/unselected tabs; one/two-
  action messages; shared visible/semantic bounds; adapter teardown.
- Migration tests: Pause timing/records and row bounds, SkillPicker atlas/text
  membership and offer geometry, Hub Inventory/trader messages/tooltips, DOM
  Game Over prompt, and loot text remain byte/geometry equivalent.
- Mac browser: workbench enumerates all records and shows message/button/tab
  examples; `/game` exercises Pause, skill picker/book, inventory/trader
  message, Dark Cloud tabs, loot text, and Game Over with WebGL2 and empty
  page/console/failed-response arrays.
- The exact candidate passes `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the Mac mini.

### UI Kit implementation validation receipt

- The supported interface is now exactly five entrypoints: `core.ts`,
  `assets.ts`, `pixi.ts`, `react-raw.ts`, and `react.ts`. The architecture test
  rejects every external deep import; the final sweep found none. The pure
  entrypoint remains free of browser image evaluation and the React seams do
  not pull Pixi into DOM-only callers.
- `NativeUiTabs`, `NativeUiSimpleMenu`, the complete semantic Settings row
  family, `NativeUiNotebox`, `NativeUiButton`, `NativeUiMessageBox`, and
  `NativeUiBoastMenu` are kit-owned modules. Gameplay Pause now supplies only
  lifecycle, action meaning, and reveal state; the superseded dedicated pause
  renderer and duplicate pressed-row CSS path are deleted. Settings,
  save-transfer, and mobile-layout callers consume the same semantic rows.
- The original corner report is enforced at the reusable seam: `UI.17` remains
  clean frame art, while the only game-source draw of `UI.8` is the stock
  three-piece group below Message/SimpleMenu frames. Mod Boast pagination uses
  `PREVIOUS`/`MORE` bitmap text and never moves the bottom ornament to the top
  of a panel.
- Local focused closure passed UI Kit `67/67`, Hub UI `90/90`, Web Lua `63/63`,
  protocol/save `89/89`, affected detached/shared-host `21/21`, lint/generated
  checks, both TypeScript builds, production build, host bundle, and the game
  budget at `264,039` raw / `80,406` gzip bytes.
- Mac Chrome 151 rendered the component workbench with all 12 atlases, ten
  fonts, Button, MessageBox, Tabs, SimpleMenu, Settings, and BoastMenu; page,
  console, and failed-response arrays were empty. The inspected 1600x900 stock
  Boast workbench frame hashes to
  `f69f91b0cb866488f7ddc100d3360dc7a058819e62b752b7735492376f1ebaf4`.
- The exact source/test candidate manifest
  `1354e942dbcc3e113faa3363423baf51a05313a455ba489ef4d7b1d5245289df`
  passed the Mac canonical gate: .NET Release build with zero warnings/errors,
  28 Website/backend contracts, lint with zero errors (19 pre-existing
  warnings), the 340-test prerequisite set, 1,807-test broad game suite, all
  named focused suites, desktop tests, production build, media policy, and
  bundle budget.
- At validation-receipt time the candidate was local, uncommitted, and
  unpushed. It was based on
  `2bcbdcf69f6c61e1c8d61bbd531def848302c304`; `origin/main` advanced during
  validation to `41e1525491649235c00e82207f67803084138943`, so the later publication
  request requires a fresh integration and validation pass.

### 2026-08-31 BoastMenu deepening

The complete `BoastBox` recovery in report 194 establishes one more justified
semantic composition. `planNativeUiBoastMenu` and `NativeUiBoastMenu` now own
UI 11/50/90..97, the exact menu/special-uppercase/medium text treatment,
mirrored icon placement, five-row action geometry, hover/focus selection, and
Website-only menu-font page actions. It does not reuse bottom-only `UI.8` as a
top-of-panel arrow. The Pixi Hub renderer and DOM workbench consume the same
plan; custom mod sprites enter only through the plan's bounded
`customIcons` placements and the shared prepared texture catalog.

Boast selection, failure, success, score, response, Notebox, save, and package
reconciliation remain outside the UI Kit. The kit accepts rows and action
callbacks and cannot mutate authoritative game state. Stock membership stays
one five-row page; pagination exists only when admitted mods extend it.

The implementation adds UI-plan coverage, DOM/Pixi workbench captures, the
registered stock Hub journey, and the Web Lua showcase's mod-expanded
second-page journey.

### Implementation

- `core.ts`, `assets.ts`, `pixi.ts`, `react-raw.ts`, and `react.ts` are the five
  supported seams. Consumers import through those seams; pure Node tests do not
  evaluate PNG modules.
- `NativeUiTabs`, `NativeUiSimpleMenu`, and the `NativeUiSettings*` family are
  semantic modules over the existing exact plans/records. `NativeUiNotebox`
  and its fixed-tick contract/styles now live inside the kit. The custom
  tutorial, mod-selection, party-list, directory, Cheat, and other screen state
  machines remain unchanged.
- `planNativeUiSimpleMenu` now owns the settled and opening frame spread,
  header/arrows, root opacity, exact N-row action bounds, and pressed label
  displacement. `GameplayPauseMenu` supplies only rows, reveal progress,
  disabled/back state, and action meaning. Its superseded Pixi renderer,
  manual `UI.102` pressed-row renderer, raw crop constants, and duplicate CSS
  path are removed.
- `NativeUiSettingsPanel`, Group, Range, Toggle, Action, Binding, ValueAction,
  and StaticRow own the exact shell and semantic row structure. Settings values,
  persistence, subpages, fullscreen, save transfer, mobile layout sharing, and
  scene return behavior remain in their prior owners. Standalone workbench use
  exposed and fixed an accessible-label CSS dependency; kit labels now use the
  self-contained screen-reader rule.
- The Mac Chrome 151 workbench exercised all 12 atlases plus semantic MsgBox,
  Button, Tabs, two-row SimpleMenu, and Settings controls. Pointer press,
  selection, slider, native font, and exact-record assertions passed with empty
  page/console/failed-response arrays. The reviewed DOM capture SHA-256 is
  `b781945f5463ea191966083d4088f65e6ee28c2d59ea074c9012a12e6766ba01`.
- The complete Pause journey passed Hub and Boneyard owner/waiting states,
  three pressed actions, Settings handoff, keyboard/Escape, chat coexistence,
  Notebox instruction/failure, fixed-stage geometry, pause authority, and
  teardown with no failed responses. Its receipt log SHA-256 is
  `f67cc28be1419860247708ff837e582d60bbe9ef5da4a2f3267ba0d39eebc886`.
- The coarse-pointer mobile menu journey passed Title, Dark Cloud SimpleMenu,
  Dark Cloud Settings/search, Hub SimpleMenu/Settings, scrolling, skull-back,
  and Player Card through the focused Hub stop. Receipt log SHA-256:
  `536c14b93e42e618642957369a3310ab7378522e8851e4d05b3b28ca105525d2`.
  The broader attempt reached those same checks and then observed the Boneyard
  skull still gated during `RESUMING...`; the separate complete Pause journey
  proves the Boneyard UI after readiness.
- Desktop and DPR-2 mobile Settings journeys passed title, Dark Cloud, Hub,
  and Boneyard contexts with empty errors. They retained four action arrows,
  15 row plates, four tracks, seven exact toggles, 28 ControlPanel text runs,
  `UI.17 x4 / UI.18 x2`, desktop `600 x 700`, mobile `600 x 389.1875`, and all
  five real-touch range changes. Receipt-log SHA-256 values are
  `e961703b5c4917c8efbc1da3d452d7a69809eede37b19ee3a2c34c5510fc3eb6`
  and `86065f18fc4ead2deb5abf869d7b0bbcc1e1bacf100c4d8ddee6897b051f40e3`.
- The Mac canonical Website gate passed all backend/contracts, lint/typecheck,
  every frontend/desktop suite, production build, media policy, and bundle
  budget. The game entry fell from 277,279 raw / 83,703 gzip bytes to 263,896
  raw / 80,337 gzip bytes after removing the dedicated Pause renderer.
  Publication and deployment were not requested.

## Implementation validation receipt

- `tools/extract-native-ui-kit.py` now fails closed over the retail executable,
  all 12 PNG/bundle hash pairs, dimensions, 1,259 ordered records, zero rotated
  records, ten font wrappers, and 718 glyph rows. Its generated
  `native-ui-assets.json` replaces the two former partial manifests and ships
  the seven previously unavailable complete atlas pages.
- `native-ui-catalog.ts`, `native-ui-text.ts`, and `native-ui-plan.ts` form the
  pure interface. `native-ui-pixi.ts` and `NativeBitmapText.tsx` are the two
  adapters. Gameplay Pause, SkillPicker/SkillBook, the compact selector,
  Inventory/traders, Hall, quickbar, Game Over, and loot text now consume the
  shared catalog/layout path; the superseded local atlas/font helpers and
  generators are removed.
- The development `/native-ui.html` workbench browses every atlas record and
  renders the reusable message, one/two-action button, tab, disabled-control,
  and raw-record plans. `docs/game-native-ui-building-blocks.md` owns the
  copy-ready author interface and teardown contract.
- Final rebased Website/Mod Loader candidates and their isolated Mac worktrees
  had byte-identical 46-file and five-file manifests. On Apple arm64 macOS
  `26.6`, Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, Python `3.14.7`, and
  Chrome `151.0.7922.170`, the Mod Loader portable suite passed `498/498`.
  The Website's canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` passed
  backend build/contracts, formatting, lint (zero errors and the eight existing
  warnings), architecture fences, every frontend/desktop suite, production
  build, media policy, and bundle budget (`441,038` raw / `123,998` gzip).
  Final log SHA-256 values are `84545d34cea03ab61644e94472600ccc0ec8d9c93ecb670c967657f739bbf6ee`
  (Mod Loader) and
  `320424fdad7b2d5abbd6cec89f58790f8187a9cc8a4e309b3553877c038f8a56`
  (Website).
- Mac Chrome/WebGL workbench acceptance exercised all 12 atlases, reported
  `1,259` records/ten fonts, switched through every atlas's final record, and
  returned empty page/console/failed-response arrays. The reviewed exact-stage
  capture SHA-256 is
  `ca9da0c04b1ca675cb51a2d68b1e05949ba6bc73392fa91a9db5a46ae8997afe`.
- Exact-SHA `/game` acceptance passed the authoritative Pause/Inventory/
  SkillBook/dialogue journey, SkillPicker in Hub and Boneyard, seven-family
  loot collection/text, two-client Fomentius/Luthacus/Hagatha/Shlorio service
  and message/unforge lifecycle, Dark Cloud desktop/mobile/landscape tabs and
  detail surfaces, and two-client Game Over/loadout/Hub return. All available
  page, console, and failed-response arrays were empty. Receipt-log SHA-256
  values are `56582545a9a053dac45d23a95469a22c25a25d8bafa6f9069b297ca0da0c9857`,
  `2645f910a3bda26753338fb521de86c8903e047653736db28294345349ccd039`,
  `cc4c502c59f88fd050be76ac07afb6c01a06df4c59579c0b7f709b75bf311318`,
  `35eddd8a4cff98a70dd4c8570ab4be5a4479a32b66ca73eb77a36ae9f9a02d8c`,
  `0607b5df6ed42e96d0d5e86dfb12876ba914de9b23e0d85952b044bb7ad9bd4f`,
  and `5e76024ef89226d3d3cbfa988ac9ff410cf3dc3768519e9e15e48b0b4b7b08ad`.
- No member is browser-blocked. The kit adds no host/protocol/save/replication
  state. Publication and deployment remain separate operations.

## 2026-08-31 — Reopened: frame corners versus bottom ornaments

### Reported smell and parity question

- Owner report: Party Settings shows little gold "tails" beside both top
  corners. `UI.8` belongs on the bottom of UI frames, as visibly demonstrated
  by the Esc/SimpleMenu family, not beside top corners.
- The 2026-08-23 reusable-kit pass catalogued every stock record, but its
  migration sweep stopped at the then-listed native renderers. It did not
  inspect the older DOM `art.cornerGold` crop or enumerate the Party Settings
  and Player Card consumers that later reused it. This violated the shared
  consumer and legacy-crop membership sweep.
- Falsifiers: the crop is wholly contained in one native record; `UI.8` is a
  corner member; another consumer still uses the composite after correction;
  or the Esc/message paths place `UI.8` anywhere except their bottom ornament
  group.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail-derived generated catalog | retail 0.72.5 `UI.png` SHA-256 `37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb`; `UI.bundle` SHA-256 `1db00ea8826e787ca9a320c90a33e726991cae00906baddfdc8bde31da697498`; `native-ui-assets.json` | `UI.17` is exactly frame `[743,588,80,83]`; adjacent `UI.8` is exactly frame `[824,587,49,112]`. Both have matching logical size, zero trim origin, and no rotation. | high |
| Legacy extraction trace | `tools/extract-assets.sh` crop `UI.png corner-gold 740 583 118 80`; emitted `frontend/src/assets/game/corner-gold.png`, 118 by 77, SHA-256 `6a5041e523a340c3004caa487d0fa898184fcb71d86ffa36c2a684244a982dfa` | The crop covers all 80 columns of `UI.17`, omits its final eight source rows, and also covers the first 34 columns and 76 rows of `UI.8`. ImageMagick trim cannot separate the two nontransparent records, so the visible "tail" is clipped arrow art rather than a corner member. | high |
| Current web consumer sweep | `PartySettingsDialog.tsx`; `PlayerCardDialog.tsx`; `assets.ts`; `party-settings.css`; `hub.css` | Exactly two components consume `art.cornerGold`, each twice and with the right copy mirrored. No other source consumer exists. | high |
| Correct sibling | `DarkCloudPanel.tsx`; `frontend/src/assets/game/dark-cloud/corner-gold.png`, 80 by 83 | Dark Cloud uses a clean corner image with no adjacent `UI.8` pixels. It is already correct and remains unchanged. | high |
| Stock composition owner | `planNativeUiMessage`, `planNativeUiSimpleMenu`, `pause-menu-contract`, `hub-inventory-renderer`; ledger entries 103 and 140 | Every live `UI.8` draw is one centre plus two 0.75-scale side ornaments below the message/menu frame. `UI.17` independently supplies the frame/nine-slice. | high |

### System boundary and membership inventory

Native system: exact `UI.17` frame membership and exact `UI.8` bottom-ornament
membership across every Website consumer, including web-authored DOM panels
that borrow stock chrome.

| Member | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| `UI.17` source record | generated UI catalog frame `[743,588,80,83]` | `exact-ported` | catalog/hash guard plus native-UI tests |
| `UI.8` source record | generated UI catalog frame `[824,587,49,112]` | `exact-ported` | catalog/hash guard plus native-UI tests |
| Party Settings left/right top corners | web-authored dialog borrowing stock chrome | `exact-ported` presentation membership; dialog semantics remain `out-of-system` | both decorations consume `NativeUiSprite` `UI.17`; no `UI.8` descendant |
| Player Card left/right top corners | web-authored card borrowing stock chrome | `exact-ported` presentation membership; card semantics remain `out-of-system` | both decorations consume `NativeUiSprite` `UI.17`; no `UI.8` descendant |
| Dark Cloud four frame corners | clean 80 by 83 crop | `verified-already-at-parity` | existing desktop/mobile Dark Cloud receipts; no composite crop |
| stock message bottom group | `planNativeUiMessage`; Hub notice renderer | `verified-already-at-parity` | exactly three `UI.8` nodes with centres below the frame bottom |
| Esc/gameplay/Dark Cloud SimpleMenu bottom group | `planNativeUiSimpleMenu`; pause renderer | `verified-already-at-parity` | exactly three `UI.8` nodes with centres below the frame bottom |
| legacy `corner-gold.png` composite and extractor row | no native record or authored composition | `out-of-system` (remove completely) | zero imports, zero source references, tracked bitmap deleted |
| unrelated atlas records and non-frame UI consumers | complete native UI catalog | `out-of-system` (unchanged) | source/reference sweep |

No member is browser-blocked. There is no timing, input, audio, simulation,
protocol, replication, save, or teardown state in this correction.

### Recovered behavioral contract

- `UI.17` and `UI.8` are separate records and must remain separately
  addressable through the generated native UI catalog.
- A top-corner decoration may draw clean `UI.17`; it must never contain any
  pixel from `UI.8`.
- `UI.8` is not a corner flourish. It renders only in the authored three-piece
  group below stock message and SimpleMenu frames, at the existing native
  centre/side scales and positions.
- Mirroring the right DOM corner mirrors `UI.17` only. Responsive scaling may
  resize that record but cannot change its membership.

### Web implementation consequence

- Replace both DOM panels' `art.cornerGold` images with the shared
  `NativeUiSprite atlas="UI" record={17}` adapter.
- Preserve each panel's current responsive positioning through CSS transforms
  on the exact 80 by 83 logical record.
- Delete the contaminated bitmap, its broad extractor row, and its now-unused
  `assets.ts` import/export. Do not add a replacement crop or compatibility
  alias.
- Strengthen the reusable plan test so `UI.8` identity and below-frame
  placement are contractual, then assert both browser panels expose exactly
  two `UI.17` decorations and zero `UI.8` descendants.

### Validation contract

- Mac focused native-UI test: pin exact `UI.17`/`UI.8` frames; require the
  three SimpleMenu ornaments to be `UI.8` and centred below the frame bottom.
- Mac production-browser journey: open Party Settings and Player Card at
  desktop and coarse-pointer landscape sizes; each has two visible
  `data-native-ui-record="UI.17"` corners, no `UI.8` descendant, fits the
  viewport, and closes normally.
- Exercise the Esc/gameplay pause menu and retain its three bottom ornaments;
  page, console, and failed-response arrays must remain empty.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac candidate.

### Implementation validation receipt

- `PartySettingsDialog` and `PlayerCardDialog` now render their two top
  ornaments through `NativeUiSprite atlas="UI" record={17}`. The right copy
  mirrors only that record. The 118 by 77 composite bitmap, its `assets.ts`
  export, and the `740 583 118 80` extractor row are deleted; no compatibility
  alias remains.
- The focused native-UI contract pins `UI.17 [743,588,80,83]`, `UI.8
  [824,587,49,112]`, and requires every SimpleMenu arrow to be record 8 with
  its centre below the frame bottom. The 62-test native-UI suite passes on the
  Mac mini.
- An isolated full-stack 896 by 414 DPR-2 Chrome journey passed 18 Hub/social
  stops with empty page, console, failed-response, and unexpected-request
  arrays. Party Settings measured 520 by 137 and Player Card 300 by 221; both
  exposed exactly two `UI.17` corners and zero `UI.8` descendants. Reviewed
  captures hash to `6241e4adfc56e6882fd93f002dadf55029e50871aa4902f94879247227969451`
  and `be7d6b365da8a954b27528d59713b97a03e37b10bb1ae87dbac278710f26f266`.
- The Esc/MsgBox `UI.8` ownership remains the existing three-piece bottom
  group; the stock Kill capture visibly re-proves it below the message frame.

## 2026-08-31 — Reopened: reusable DOM message and button interface

### Reported smell and parity question

- Owner request: expose a reusable message-box module that looks exactly like
  the stock Kill Character box, accepts caller-defined buttons, and exposes one
  reusable stock button so every caller shares the same visual states.
- The 2026-08-23 pass recovered the pure `planNativeUiMessage` and
  `planNativeUiButton` model plus a Pixi adapter, but stopped at a transparent
  semantic overlay for title prompts. `StockPromptDialog` therefore makes
  callers understand action rectangles and pointer/focus state while the
  renderer separately owns the art. That is a shallow caller seam, not the
  requested reusable UI module.
- Falsifiers: Kill Character uses unique chrome; message buttons are not the
  shared stock button; the DOM cannot express the plan without substituting OS
  fonts or CSS-drawn art; or another stock message/button path requires a
  second visual contract.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Settled stock MsgBox family | entries 087, 189, 203, and 228; ctor `0x004A98E0`, layout `0x005AB060`, render `0x005C4530`, line `0x005BCCB0`, action builders `0x005AB7E0/0x005AB980`, finalize `0x005AB5C0` | Kill Character is one ordinary two-action member of the common MsgBox family. The family owns curtain, frame, title/body bitmap text, bottom ornaments, actions, and hit rectangles. | high |
| Complete family census | 25 constructor references in 16 functions; 194 line-builder references in 22 functions, already drained in entry 189 | One shared primitive serves one- and two-action native dialogs; screen state and action meaning stay with callers. | high |
| Existing pure model | `native-ui-plan.ts`; `native-ui-text.ts`; generated 12-atlas/ten-font catalog | `planNativeUiMessage` composes the exact message frame and one/two `planNativeUiButton` fragments. Button states are idle, focused, pressed, selected, and disabled. | high |
| Existing adapters | `native-ui-pixi.ts`; DOM `NativeUiSprite`, `NativeUiNineSlice`, `NativeUiStrip`, and `NativeBitmapText` | Pixi can render every plan node. DOM has the underlying exact primitives but no plan adapter or semantic message/button module. | high |
| Current title bridge | `StockPromptDialog.tsx`; `title-menu-renderer.ts`; `stock-prompt-dialog.css` | Pixi paints the prompt while React duplicates transparent action rectangles and state callbacks. A new caller must coordinate both owners. | high |

### System boundary and membership inventory

Native system: the common MsgBox frame and stock Button presentation below
screen-specific state machines, exposed through one pure plan and two rendering
adapters.

| Member | Source | Disposition | Proof |
| --- | --- | --- | --- |
| pure stock button plan | `planNativeUiButton`; `UI.101/.102/.54`; menu bitmap font | `verified-already-at-parity` | existing all-state plan tests |
| pure stock message plan | `planNativeUiMessage`; exact MsgBox record family | `verified-already-at-parity` | existing one/two-action composition tests and stock captures |
| Pixi plan adapter | `native-ui-pixi.ts` | `verified-already-at-parity` | existing title, Inventory, Pause, workbench, and teardown receipts |
| DOM plan adapter | missing | `exact-ported` | render every plan node through the same catalog/text layout without copied record geometry |
| reusable semantic stock button | missing | `exact-ported` | one React button owns focus/hover/press/disabled state and renders `planNativeUiButton` through the DOM adapter |
| reusable semantic stock message box | missing | `exact-ported` | caller supplies title/body and one or two stock-button children; module owns frame, layout, art, and semantic bounds |
| stock Kill Character title prompt | `StockPromptDialog`; title caller | `exact-ported` through new DOM module | exact four-line copy and YES/NO actions; no transparent duplicate renderer |
| first-run Tutorial offer | Website-authored content in stock presentation | `out-of-system` content; `exact-ported` shared presentation | reuses the same module without claiming native wording |
| native one-button Inventory/trader messages | retained Pixi consumers | `verified-already-at-parity` | same pure plan remains their interface; no forced screen-owner migration |
| remaining native MsgBox callers | separate native screen state machines | `out-of-system` state; shared presentation `exact-ported` | prior complete constructor census |
| custom party/mod/directory dialogs | no native MsgBox owner | `out-of-system` for this pass | explicitly deferred by owner |

### Recovered interface contract

- The pure plan remains the only record, geometry, font, painter-order, and
  state truth. React and Pixi are adapters at that seam; neither duplicates
  native constants.
- A stock button's caller supplies semantic content and action only. The module
  owns idle/focused/pressed/disabled art, bitmap label, pointer/keyboard state,
  and the shared visible/semantic rectangle.
- A stock message caller supplies title, body, one or two stock-button children,
  and action handlers. The module owns the stock frame, curtain, wrapping,
  action layout, and bottom ornaments. Unsupported child counts fail closed.
- Screen-specific authorization, mutation, dismissal, and audio remain with
  the caller. The presentation module never becomes a state machine.

### Web implementation consequence

- Split the existing message planner into an independently reusable frame plan
  plus the existing composed one/two-action plan; preserve byte-for-byte node
  order for Pixi callers.
- Add one DOM plan adapter, then build `NativeUiButton` and
  `NativeUiMessageBox` on that interface. Do not add a parallel CSS skin.
- Replace the title prompt's Pixi-art plus transparent-button dual ownership
  with the reusable DOM message/button module. Retain the pure title plan as a
  stock contract/workbench fixture.
- Document the copy-ready React interface beside the existing plan/Pixi
  interface.

### Validation contract

- Focused tests preserve every plan node/action and verify independent message
  frame composition, one/two action layout, button states, and UI.8 bottom-only
  placement.
- The native UI workbench renders the same message and standalone button
  through both adapters.
- Mac Chrome title journey opens Kill Character and Tutorial prompts, observes
  one native message module with exact bitmap fonts and one/two shared stock
  buttons, activates mouse/keyboard/Escape paths, and reports no duplicate
  renderer prompt stage or browser errors.
- The exact candidate passes `/opt/homebrew/bin/bash ./scripts/validate.sh`.

### Implementation validation receipt

- `NativeUiPlanView` is the DOM adapter at the existing pure-plan seam.
  `NativeUiButton` owns semantic focus/hover/press/disabled state and renders
  `planNativeUiButton`; `NativeUiMessageBox` accepts one or two button children,
  renders the independently reusable message frame, and keeps visible versus
  accessible title/body copy distinct.
- `StockPromptDialog` now composes those modules directly. The title Pixi
  renderer no longer paints a second prompt or owns transparent duplicated hit
  boxes; the responsive full-stage curtain remains a separate DOM surface.
  Existing Pixi consumers retain the unchanged composed plan.
- `/native-ui.html` adds a DOM-components mode beside the Pixi plan and atlas
  modes. It rendered one stock message and three semantic stock buttons with
  empty page/console/response errors; the reviewed DOM capture hashes to
  `ed32656acb7afcea235073b134b82fce07ea8304be72fe05b08f8e11b21ed849`.
- Mac Chrome 151 passed Tutorial and Kill Character at 1600 by 900, 896 by
  414, 2560 by 1080, and 1200 by 1000. Every prompt exposed one message module,
  two 200 by 69 native action rectangles at stock scale, exact `menu`/`medium`
  bitmap fonts, a curtain equal to the complete viewport, and empty page,
  console, and failed-response arrays. Final stock/mobile Kill captures hash to
  `2151f14f25d3c536cd43b8df27cfd7a6cea35cacd672642c9b72e914bbd25340`
  and `04abcedb170a9febe2708a72a67d70ea2e3da96b5797d95df4da6092acd4b8a1`.
- The exact Mac candidate passed the canonical validation gate: lint 0 errors
  (19 pre-existing warnings), all backend/contracts and frontend suites,
  including the 340-test prerequisite set and 1,804-test broad game set,
  desktop tests, production build, generated host bundle, media policy, and
  bundle budget (`Game-CG_-oeee.js`, 277,279 raw / 83,703 gzip bytes).
  Commit, push, deployment, and production restart were not performed.

## 2026-08-31 — Reopened: supported game-wide UI Kit interface

### Reported smell and parity question

- Owner request: deepen the reusable stock UI work into an explicit UI Kit that
  game screens can consume without learning atlas files, plan implementation
  paths, duplicated pointer-state code, or Settings row structure.
- Published-state smell at Website `2bcbdcf69f6c61e1c8d61bbd531def848302c304`:
  32 files outside `native-ui/` import 15 different implementation paths.
  `GameplayPauseMenu` coordinates a Pixi renderer, transparent actions, and a
  separate DOM pressed-row renderer; `GameSettingsDialog` keeps its semantic
  group, range, toggle, action, and binding modules private while the kit
  exposes only their paint fragments.
- Stock behavior to preserve: the already recovered catalog, font, Button,
  MsgBox, Tabs, SimpleMenu, Settings, and Notebox contracts. This pass changes
  the web module seam, not any stock record, geometry, timing, state machine,
  action meaning, or authority owner.
- Falsifiers: callers still deep-import implementation files; a second button
  or Settings skin remains; Pause or Dark Cloud menu geometry/timing changes;
  a kit module starts owning screen navigation, saved settings, pause
  authority, audio, or network state; or the package facade pulls Pixi into a
  DOM-only caller.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Settled native UI system | this ledger's complete 12-atlas/ten-font inventory; retail 0.72.5 executable SHA-256 `03a834566ce70fd808f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | All native art, font, Button, Tabs, MsgBox, SimpleMenu, and Settings presentation facts needed by this consolidation are already exact and dispositioned. No new binary fact is required. | high |
| Current import census | Website `2bcbdcf69`; `frontend/src/game` imports excluding `native-ui/` | 32 consumer files name 15 internal kit paths, so file layout rather than a supported interface is the effective public contract. | high |
| SimpleMenu causal trace | `GameplayPauseMenu.tsx`, `pause-menu-contract.ts`, `renderer/gameplay-pause-renderer.ts`, `gameplay-pause-menu.css` | One native surface has three presentation owners: Pixi paints settled art, the screen owns semantic buttons, and a second DOM path paints the pressed row. Gameplay and Dark Cloud share the same host module. | high |
| Settings causal trace | `GameSettingsDialog.tsx`, `NativeSettingsPresentation.tsx`, `main-menu.css` | Exact paint records live in the kit, but five semantic row modules and the shell remain private to one caller. Save-transfer and mobile-layout actions separately reproduce the row class. | high |
| Existing real adapters | `native-ui-pixi.ts`, `NativeUiPlanView.tsx`, React stock modules | Pure plans already have two justified adapters. Package entrypoints can expose those real seams without adding a hypothetical abstraction. | high |

### System boundary and membership inventory

Native system: the Website-owned stock UI Kit below screen state machines,
including its supported pure, browser-asset, Pixi, raw React, and semantic
React interfaces.

| Member | Source | Disposition | Proof |
| --- | --- | --- | --- |
| catalog, fonts, text layout, and pure plan model | existing `native-ui-*` modules | `verified-already-at-parity` | complete catalog and focused plan receipts |
| Pixi adapter | `native-ui-pixi.ts` | `verified-already-at-parity` | existing renderer and teardown receipts |
| raw React adapter | sprite, strip, nine-slice, bitmap text, plan view | `verified-already-at-parity` | existing DOM workbench and prompt receipts |
| semantic Button and MsgBox | `NativeUiButton`, `NativeUiMessageBox` | `verified-already-at-parity` | title prompt and workbench receipts |
| supported pure/browser-asset/Pixi/raw-React/semantic-React entrypoints | missing | `exact-ported` | import fence plus every external caller migrated to one of five entrypoints |
| semantic Tabs | pure `planNativeUiTabs` exists; DOM owner missing | `exact-ported` | shared visible/action geometry and tab semantics in workbench |
| semantic SimpleMenu | pure/static plan plus split Gameplay/Dark Cloud presentation owners | `exact-ported` | one module owns plan painting, press state, focus, and action rectangles; callers retain lifecycle/action meaning |
| Settings shell, group, range, toggle, action, binding, and static row | exact fragments exist; semantic rows private to `GameSettingsDialog` | `exact-ported` | Settings, save-transfer, and mobile-layout rows consume shared modules |
| native Notebox module | exact contract/component at game root | `verified-already-at-parity`; kit ownership relocation | unchanged fixed-tick/fade/layout tests and Hub journey |
| Gameplay and Dark Cloud Pause owners | host pause state, close timing, audio, row meaning | `out-of-system` (screen lifecycle and authority) | existing pause protocol/scene tests remain owners |
| Settings values, page navigation, persistence, fullscreen, save transfer, and mobile editor | browser/application state | `out-of-system` (screen behavior) | existing Settings tests and journeys remain owners |
| tutorial, mod selection, party list, directory, and other custom layouts | no complete native screen owner | `out-of-system` for this pass | may consume the supported kit later without being restyled here |
| host simulation, protocol, save, replication, and RNG | no presentation ownership | `out-of-system` | no wire or authoritative-state change |

No member is blocked by the browser platform.

### Recovered interface contract

- External game callers use exactly five entrypoints: pure core, browser asset
  URLs, Pixi adapter, raw React adapter, or semantic React modules.
  Implementation-file imports are kit-internal and rejected by an architecture
  test. The pure entrypoint never evaluates PNG imports.
- The semantic interface accepts content, state, and action callbacks. It hides
  record selection, bitmap layout, painter order, hit rectangles, pointer and
  keyboard press state, and stock CSS structure.
- SimpleMenu callers continue to own open/close progress, audio, Escape/back
  meaning, and authorization. The kit owns only the rendered plan, focus,
  press state, and action dispatch.
- Settings callers continue to own values, persistence, subpages, and browser
  extensions. The kit owns the shell and exact row/control presentation.
- Raw records remain an explicit advanced interface for a recovered screen
  whose composition is not yet a semantic module; they are not a reason to
  recreate Button, MsgBox, Tabs, SimpleMenu, Settings, or Notebox locally.

### Web implementation consequence

- Add separate package entrypoints so Node/pure code does not import PNGs,
  DOM-only code does not import Pixi, and raw-record callers do not implicitly
  load semantic Settings styles.
- Add semantic Tabs, SimpleMenu, and Settings modules over the existing pure
  plans and exact presentation records.
- Move Notebox implementation/contract under kit ownership without changing
  its public behavior.
- Replace the Gameplay/Dark Cloud SimpleMenu's renderer/button/pressed-row
  coordination with the semantic kit module and remove the superseded renderer
  and CSS art path.
- Migrate Settings, save-transfer, and mobile-layout actions to shared semantic
  rows. Leave custom screen layouts and all screen state machines untouched.

### Validation contract

- Architecture test: every non-kit import crosses one of the five supported
  entrypoints; no external implementation-file import remains.
- Focused pure tests: all SimpleMenu row counts, reveal geometry/alpha, pressed
  records, action bounds, Tabs semantics, and existing Button/MsgBox contracts.
- Existing pause and Settings suites preserve lifecycle, exact record counts,
  touch geometry, values, keyboard bindings, and browser extensions.
- Workbench: render Button, MsgBox, Tabs, SimpleMenu, and Settings controls from
  the semantic interface with empty page/console/failed-response arrays.
- Mac Chrome: gameplay and Dark Cloud Esc menus, title prompt, desktop/mobile
  Settings, and Hub Notebox journeys retain exact actions and presentation.
- The exact candidate passes `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the Mac mini.
## 2026-08-31 — Reopened: shared Button surround and input-state projection

### Reported smell and parity question

- Owner report: the little glyphs beside the `OKAY` button on Hagatha's
  `YOUR MIND IS FULL!` message are in the wrong positions.
- Current web smell: the Hub renderer draws two complete 70 by 85 `UI.54`
  records centred inside the 353 by 69 button body and omits the continuous
  edge slice between them. Its Dowsing and content-sized MsgBox siblings repeat
  the same false composition. Separately, the reusable pure Button plan maps
  focus/hover to pressed `UI.102` and does not move the label on press.
- Stock behavior to recover: the complete standard Button body/surround/label
  composition, input-state writers, exact expansion constants, edge sampling,
  disabled branch, painter order, and every Website consumer of that primitive.
- Falsifiers: `UI.54` is two small centre ornaments rather than a surround;
  hover selects `UI.102`; press leaves the label fixed; an affected Hub member
  uses distinct native geometry; or semantic hit bounds are derived from the
  decorative surround rather than its owning control.

This is a secondary report in a covered system. The 2026-08-23 extraction
correctly identified `UI.54` and the 5-percent strip helper, but did not migrate
the Hub renderer's older two-centred-sprite path. The reusable DOM reopening
then called the pure Button plan already at parity without checking its state
projection against the previously recovered Button field writers. Both skipped
membership checks are corrected across the shared primitive here. The
supported UI Kit publication above makes `native-ui/core.ts` the public pure
owner used by this reopening.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed image as the UI catalog and earlier Button entries. | high |
| Button state instructions | constructor `0x00430430`; pointer down `0x00430890`; release `0x00430A40`; hover enter `0x00430AC0`; leave `0x00430AE0` | `Button+0x78` is the pressed byte. Pointer down sets it, release/leave clear it. Hover writes only `+0x79`; it never selects pressed art. | high |
| Labeled renderer instructions | `UiLabeledControl_Render 0x005C60F0`, raw tail `0x005C64EA..0x005C654A` | The body record is indexed only by `+0x78`; the bitmap label adds `6 * pressed` to both axes. The surround call receives body left/top minus 6 and width plus 12. | high |
| Standard surround helper | `FUN_00417E30`; 13 xrefs in ten functions; standard singleton operand `DAT_008199E4+0x2990` | Offset `0x2990 = 0x38 + 54 * 0xC4`, so the helper consumes `UI.54`. It draws one full left end, repeats the final five-percent horizontal strip, and mirrors one full right end. | high |
| Raw constants/assets | doubles `0x007852E0=6`, `0x007DE9D8=12`; float `0x007DE96C=0.95`; generated catalog `UI.54 [679,394,70,85]`, `UI.101 [266,482,353,69]`, `UI.102 [620,482,353,69]` | A 353 by 69 body has a 365 by 85 surround: left/top `-6`, 70-pixel full ends, 225-pixel connector, mirrored right edge. | high |
| MsgBox instructions | shared `MsgBox::Render 0x005C4530`, primary/secondary surround calls `0x005C4FA8` and `0x005C52D2` | Both actions use the identical `UI.54` helper and `-6/+12` geometry; button count and content sizing do not create a second composition. | high |
| Current web causal trace | Website `b686dccc`; supported `native-ui/core.ts` facade over `native-ui-plan.ts`; `hub-inventory-renderer.ts`; `hub-inventory-render-contract.ts` | The pure plan owns correct full-end/edge geometry but uses pressed art for focus and omits the `(6,6)` label shift. Hub bypasses it with centred end sprites and a duplicate state helper. The newly published facade exposes, but does not correct, that shared primitive. | high |

Fresh read-only Ghidra queries used canonical project
`SolomonDark/SolomonDark.exe` through Mod Loader revision
`08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py`, `refs_to_addr_decompile.py`, `dump_insns_around.py`, and
`dump_floats_at.py` were invoked read-only against preferred-image addresses.
The dirty Mod Loader checkout was not changed.

### System boundary and membership inventory

Native system: standard `Button` presentation from input-state bytes through
body selection, bitmap-label transform, `UI.54` surround composition, disabled
overlay, semantic control rectangle, and all Website adapters/consumers.

| Member / branch | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| idle body and label | `+0x78=0`, `UI.101` | `exact-ported` | record 101, zero label offset, complete surround |
| pointer/key press | `+0x78=1`, `UI.102` | `exact-ported` | record 102 and label offset `[6,6]`; release/cancel/leave restores idle |
| hover | `+0x79` only | `exact-ported` | body remains 101 and label remains fixed; no hover render branch |
| browser keyboard focus | no retail keyboard-focus visual | `blocked-by-platform` only for the required focus-visible outline | stock body stays idle; CSS outline remains the browser accessibility indication |
| explicit latched `selected` adapter state | Website authoring state with pressed appearance | `out-of-system` semantic state; exact Button pressed presentation | record 102 plus `[6,6]`, no second art path |
| disabled body/text/overlay | `UiLabeledControl_Render` disabled argument; `0.5`/`0.25` constants | `verified-already-at-parity` | idle body/text alpha 0.5, final gray overlay alpha 0.25 |
| full `UI.54` left end, 5-percent connector, mirrored right end | `FUN_00417E30` | `exact-ported` | surround begins six pixels left/up, extends six right, and keeps authored height 85 (ten below the 69-pixel body) |
| pure plan and Pixi/DOM adapters | `native-ui/core.ts`, `native-ui/pixi.ts`, `native-ui/react-raw.ts`, `planNativeUiButton` | `exact-ported` | one facade-supported reusable chrome/state plan, identical nodes in both adapters |
| semantic React `NativeUiButton` | shared DOM owner | `exact-ported` | pointer/key press only; hover keeps idle art; focus outline does not replace stock body |
| stock title Kill/Tutorial MsgBox buttons | `StockPromptDialog` via reusable DOM message | `exact-ported` | two action bodies/surrounds and pressed transition from the shared plan |
| Hagatha ordinary/Tonic full-mind `OKAY` | shared Hub notice path | `exact-ported` | corrected standard body/surround while authority remains entry 175 |
| Dowsing insufficient-gold and Hat/Robe `OKAY` notices | same Hub notice path | `exact-ported` | no message-specific glyph coordinates |
| Dowsing pre-roll action | standard UI.101/.102/.54 control with caller-specific copy baselines | `exact-ported` | shared chrome plus retained DOWSE/fee baselines and pressed offsets |
| Unforge confirmation primary/secondary and result action | shared content-sized MsgBox | `exact-ported` | each outer 85-pixel row resolves to body x/y `+6`, width `-12`, height 69 and a continuous surround |
| gameplay and Dark Cloud SimpleMenu rows | established `FUN_00417E30` sibling | `verified-already-at-parity` | existing 365 by 85 full-end/225-pixel connector composition and `(6,6)` pressed overlay |
| nonstandard alternate/unlabeled controls and tab brackets | `0x005C65A0`, `0x005C6A50`, `UI.53`, `UI.13` | `out-of-system` (different records/state geometry) | inspected as lateral siblings; no standard-Button helper substitution |

The focus-visible outline is the only browser-specific visible difference. It
appears only for keyboard focus and does not alter stock body, surround, label,
hit geometry, action meaning, or pointer behavior.

### Native ownership thread and recovered behavioral contract

- Screen owners construct and place a `Button`; its body rectangle remains the
  semantic action rectangle. `Button` alone owns pressed/hover bytes and the
  action callback. UI art never authorizes a transaction.
- Pointer down sets `+0x78`; release clears it before dispatch; leave clears
  both pressed and hover. Hover enter sets `+0x79`, which the standard renderer
  does not read for body or label presentation.
- `UiLabeledControl_Render` draws `UI.101 + pressed`, then bitmap copy at
  `[centerX, nativeBaseline] + [6,6] * pressed`. Disabled state changes alpha
  and adds the final control-rect overlay; it does not select a third body.
- After body and label, `FUN_00417E30` paints `UI.54` around the body rectangle
  expanded from `(left,top,width,69)` to `(left-6,top-6,width+12,85)`. Full
  70-pixel ends bound a connector sampled from UV x `0.95..1`; the right end is
  mirrored. Side ends are never centre glyphs.
- A screen may retain caller-specific label baselines, action hit rectangles,
  and content sizing, but it must consume the same chrome/state primitive. The
  surrounding art is non-interactive and never expands authority.
- Teardown remains adapter/scene-owned. The pure plan retains no texture or
  state, and the shared Pixi adapter releases derived `UI.54` slice textures
  with its source pages.

### Nearby-system findings

- The six-slot/one-Tonic rejection that exposed this button is exact Hagatha
  behavior, documented in entry 175; this correction intentionally changes no
  economy or capacity rule.
- `HUB_NATIVE_LABELED_CONTROL` duplicates the reusable Button state contract
  and enabled the older Hub composition to drift. It must be removed rather
  than kept as a compatibility alias.
- The alternate labeled control uses a different source record and a four-pixel
  state displacement. It cannot be folded into the standard Button merely
  because both call the same lower strip helper.

### Confidence and open questions

- Confirmed: exact retail identity; state writers; body index; press-only
  branch; six-pixel label displacement; surround expansion; record identity;
  edge UV; helper xrefs; all current Website standard-Button consumers.
- Inferred: none required for implementation.
- Unknown: none material. The browser focus outline is deliberate platform
  accessibility and explicitly isolated from native presentation.

### Web implementation consequence

- Expose the standard Button chrome/state fragment beneath
  `planNativeUiButton` through supported `native-ui/core.ts`; make the full
  plan, Pixi Hub consumers, and DOM adapter share it. Preserve caller-specific
  text baselines where native callers own them.
- Correct state projection so focus/hover retains idle stock art and only
  pressed/explicit-selected presentation chooses `UI.102` and shifts its label
  by `[6,6]`.
- Replace every Hub pair of centred `UI.54` sprites with the complete shared
  left-end/connector/right-end plan. For content-sized MsgBoxes, interpret the
  existing 85-pixel outer rectangles as surround bounds and derive body x/y
  `+6`, width `-12`, and height 69.
- Remove `HUB_NATIVE_LABELED_CONTROL`, `buttonSideCenters`, and
  `primaryButtonSideCenters`; add no aliases or screen-specific offsets.
- Preserve all semantic action rectangles, copy, audio, message lifetime,
  authority, and responsive fixed-stage mapping.

### Validation contract

- Pure-plan tests: all five adapter states; exact 101/102 selection; hover/focus
  idle; `[6,6]` pressed/selected copy; left/connector/right nodes at
  `[-6,+64,+width+6]`; UI.54 and UV `0.95`; disabled painter order.
- Hub contract/source test: no centred-side constants or local state duplicate;
  Dowsing, generic MsgBox, and content-sized MsgBox all call the shared chrome
  plan. Existing Hagatha capacity/economy tests must remain unchanged.
- Complete Mac mini `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  candidate.
- Real Mac Chrome production-bundle journey: reproduce one Tonic plus five
  ordinary outcomes, confirm both second-Tonic and ordinary full-mind notices,
  visually inspect idle and pointer-down `OKAY`, and measure the 208 by 85
  surround around the 196 by 69 body. Also visit Dowsing and one content-sized
  Unforge message; require continuous end/connector geometry and empty page,
  console, failed-response, WebGL-loss, wire-error, and host-error arrays.

### Implementation validation receipt

- `native-ui-plan.ts` now exposes `planNativeUiButtonChrome` through the
  supported `native-ui/core.ts` facade. The full Button plan consumes it, maps
  focus/hover to idle `UI.101`, maps press/explicit selection to `UI.102`, and
  moves pressed copy by `[6,6]`. SimpleMenu delegates that displacement to the
  same Button plan rather than applying a second offset. The DOM and Pixi
  adapters therefore share one body/end/edge state model.
- `hub-inventory-renderer.ts` consumes that chrome once for generic MsgBox,
  Dowsing, and content-sized Unforge actions while preserving their recovered
  caller-specific text baselines. `HubInventoryUi` now publishes primary and
  secondary pressed state; the old centred-side constants and duplicate Hub
  state helper are removed completely. Unforge semantic body rectangles are
  `[595,573,197,69]`, `[811,573,197,69]`, and `[703,564,197,69]`; their old
  209 by 85 rectangles remain only as the derived surrounding art extent.
- The test-first Mac red receipt was TypeScript `TS2724`: missing exported
  `planNativeUiButtonChrome`. After implementation and integration with the
  published UI Kit, the 68-test native-UI suite, 91-test Hub-UI suite, and
  50-test economy file pass. Coverage pins all
  five plan states, exact body records and copy offsets, complete UI.54 node
  geometry/UV, the absence of local Hub side constants, all three shared Hub
  call families, and full-six/one-Tonic authority.
- The exact candidate was materialized byte-for-byte in a clean detached Mac
  worktree at Website base `18a8ec9a1f29108e5b06bdd6e82075c80a9e2c8a`.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passes backend build and 28
  contracts, backend formatting, architecture/lint with 19 existing warnings
  and zero errors, every frontend suite, desktop `5/5`, production
  frontend/game-host builds, bundle budget, and media policy. The Game entry is
  264,039 raw / 80,414 gzip bytes under 524,288 / 134,144.
- Real Mac Chrome used the production bundle at 1600 by 900. Hagatha `OKAY`
  measured `[702,397.5,196,69]`; its idle top/bottom connector counts were
  340/204 bright pixels and its pressed counts 204/204, with both 70-pixel ends
  populated. Shlorio `DOWSE` measured `[675,265.5,250,69]` with continuous
  idle/pressed connector counts 610/375 and 366/375. Unforge primary/secondary
  measured `[595,573,197,69]` and `[811,573,197,69]`; idle primary and pressed
  secondary both retained populated ends and top/bottom connectors.
- Reviewed DOWSE idle/pressed captures hash to
  `71de26ce36777327ef36d2e240477d4f48831d12ddf27b5087f9bab3ff1ebb2d`
  and `8267a6881c391b34d6318198151f2947c8e922a2c8b963f81f320643b63c8a38`;
  the pressed Unforge confirmation hashes to
  `0446bcb0232bdf38c40b87afbfc2fea098cf7ab165f039055ff77d3c57543ca8`.
  Browser errors, failed requests/responses, WebGL losses, wire errors, and host
  errors were empty; the structured receipt is the SHA-256 recorded in entry
  175.
- Keyboard focus retains the named browser-only accessibility outline; no other
  member is browser-blocked and no material unknown remains. No runtime,
  protocol, save, audio, authority, or responsive-layout owner changed.
  Commit, push, deployment, and production restart were not performed.

## 2026-08-31 — Reopened UI Kit boundary: clipped SwipeBox content

The second BoastBox reopening in report 194 disproves the earlier flat-plan
model. Native BoastBox is not a five-row page: it is a `SwipeBox` with a 400px
scissor, 495px stock content, bounded content translation, and pointer drag.
The previous UI Kit exposed no nested clip primitive, so the Boast adapter
painted all content into the stage and compensated for mod rows with invented
pagination.

This adds one justified deepening to the supported UI Kit rather than a
Hub-specific mask:

- the pure plan vocabulary owns a nested clip node whose children retain stage
  coordinates and painter order;
- Pixi owns the native-equivalent mask container and DOM owns the matching
  overflow-hidden viewport; external custom art may enter the named clipped
  content container without bypassing the plan;
- a pure SwipeBox helper owns finite content extent and clamped continuous
  offset. Screen adapters own pointer capture and accessibility inputs, not
  geometry or bounds;
- BoastMenu consumes those shared primitives. BookBox and SellSpellBox retain
  the separately recovered selector contract in report 194; the remaining
  native SwipeBox-derived screens stay out of scope until their owners are
  recovered.

Required closure: recursive plan-node tests in both adapters, exact Boast
viewport/offset tests, DOM workbench drag proof, real Hub stock/mod drag proof,
the architecture import fence, and the canonical Mac validation gate.

## 2026-08-31 — Reopened: long Hub notices and readable action-row geometry

### Reported smell and parity question

- The owner reports that Hagatha's `YOUR MIND IS FULL!` `OKAY` control covers
  the message copy, is too narrow, and should move down. The separately reached
  `A WIZARD WOULD NEVER REMOVE HIS ROBE!` warning is also visibly broken.
- This is a secondary report in the shared Hub MsgBox path. The preceding
  Button reopening proved the stock compact HotRect and chrome, but treated
  placement as safe without measuring every complete authored message against
  that row. The missing membership check was content clearance.
- Stock retains the compact one-button row. The owner explicitly requests a
  Website presentation extension for the long Hagatha and protected-garment
  warnings: use the existing 250-pixel standard-button width and move its row
  down while preserving the fixed frame, copy, action, press state, and
  lifecycle.
- Falsifiers are a body layout whose last glyph clears the current surround, a
  protected-garment title which fits the current menu-font lane, a separate
  renderer/action rectangle which does not share the notice layout, or a
  short Dowsing message which must change to fix the reported members.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Owner report | 2026-08-31 report in this task | Hagatha's full-mind button covers copy and should be lower/wider; the robe-removal message is awkward and broken | high for desired Website behavior |
| Current Mac browser | Website `26f042ff7b5a04076e4afe320b7f51e582933eea`, macOS Chrome production bundle, 1600 by 900; temporary `/tmp/hagatha-dialog-grid-baseline-hagatha-capacity-rejected.png`, SHA-256 `b2f9ec603dd3f87482f8242e1d7923b904edda9ac185c207175045130fb6de2f` | The ordinary full-mind last line is painted through the narrow `OKAY` surround. The body is visibly occluded rather than merely close to the hit rectangle | high |
| Exact text-layout probe | `layoutNativeUiText`, `Fonts` medium/menu metrics, current authored strings and `HUB_DOWSING_MSGBOX` at the same Website revision | Ordinary full mind and Hat use eight body lines ending at baseline `406.5`; Robe uses nine ending at `423.5`; the current button body begins at `397.5` and its surround at `391.5`. Hat/Robe menu titles measure `596/617` pixels against the 382-pixel copy lane | high |
| Existing retail evidence | `MsgBox::Render 0x005C4530`, action constructor `0x005AB5C0`, shared `UiLabeledControl_Render 0x005C60F0`, retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Stock owns the 196 by 69 compact one-button body at y `397.5`; `UI.101/.102/.54`, pressed `[6,6]`, and 196-pixel HotRect remain the native baseline already recovered above | high |
| Current causal trace | `hub-inventory-render-contract.ts`, `hub-inventory-renderer.ts`, `HubInventoryUi.tsx` | Full-mind, Dowsing, Hat, and Robe all default to one frame and one button rectangle. Visible chrome and the semantic `NativeAction` both consume that rectangle, so a layout change must be shared by both consumers | high |

The baseline smoke completed both Hagatha rejection branches with empty page,
console, failed-request, failed-response, and WebGL-loss arrays. Its later
Shlorio sibling leg encountered a black canvas before its chrome probe; that
later unrelated failure is not used as evidence for this change.

### System boundary and membership inventory

Native system: the fixed Hub one-button MsgBox from complete authored title/body
content through text layout, button chrome and HotRect, input state, dismissal,
and teardown.

| Member / branch | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Hagatha ordinary full-mind warning | PerkShop rejection, shared MsgBox | `out-of-system` for compact placement by explicit owner request; stock copy/action retained | exact line-layout clearance plus Mac capture |
| Hagatha Tonic full-mind warning | selector-27 rejection, same MsgBox | `out-of-system` for shared Hagatha layout; stock copy/action retained | same roomy row and pressed-state browser assertion |
| protected Hat warning | InventoryScreen equipment rejection | `out-of-system` for shared protected-garment readability; stock copy/action retained | title-fit and body-clearance test |
| protected Robe warning | InventoryScreen equipment rejection | `out-of-system` for requested readable layout; stock copy/action retained | dedicated browser capture and title/body clearance |
| Dowsing insufficient-gold warning | DowsingShop rejection | `verified-already-at-parity`; compact native row remains | unchanged `[702,397.5,196,69]` contract |
| standard button idle/pressed/surround | `UI.101/.102/.54`, `0x005C60F0` | `verified-already-at-parity` | both compact and roomy rows use the same shared chrome plan and `[6,6]` press offset |
| semantic pointer/keyboard action | `Button` state writers plus Website accessibility adapter | `exact-ported` within each chosen body rectangle | visual and semantic rectangles come from one selected layout |
| notice reveal, curtain, audio, dismissal, and teardown | existing Hub renderer/UI owner | `verified-already-at-parity` | no state-machine or authority changes |
| Unforge content-sized primary/secondary/result messages | separate content-sized MsgBox branch | `out-of-system` for this reopening | existing geometry/tests remain unchanged |
| title Kill/Tutorial DOM MsgBoxes and SimpleMenu rows | reusable UI kit outside Hub standard notice owner | `out-of-system` | no caller consumes the Hub roomy layout |

No member is blocked by the browser platform.

### Ownership and behavioral contract

- The notice value selects compact versus roomy presentation; the renderer and
  semantic action layer must consume the same selected rectangle. The message
  still has one action and dismisses only on that action or its existing back
  route.
- Compact Dowsing remains `[702,397.5,196,69]`. The roomy row is centered at
  x `800`, uses the established DOWSE body width `250`, begins at y `450`,
  and keeps the established label baseline offset `42.5`, yielding baseline
  y `492.5`.
- The roomy surround begins at y `444`; the longest authored Robe body ends at
  baseline `423.5` and its full text layout ends at `439.5`, leaving a
  measurable glyph-to-chrome gap. Its body ends at y `519` and surround at
  `525`, inside the fixed inner panel ending at
  y `537`.
- Full-mind titles retain menu font. Hat/Robe titles use the existing body
  bitmap font so their measured widths `329/341` fit the 382-pixel text lane;
  body copy remains medium font with exact authored words and line breaks.
- This extension changes no economy rejection, equipment ownership, input
  suspension, gold, audio, network state, save state, or renderer lifetime.

### Web implementation consequence

- Represent the roomy row as an explicit standard-notice layout contract, not
  a title-string check or renderer-only offset.
- Tag both full-mind variants and both protected-garment warnings with that
  layout; keep Dowsing on compact native geometry and Unforge on its separate
  content-sized branch.
- Make the Pixi painter and `NativeAction` read the same button rectangle.
  Retain the common Button chrome/pressed owner without local sprite assembly.
- Select the smaller stock bitmap font for both protected-garment titles. Do
  not paraphrase, truncate, CSS-scale, or hide their authored copy.

### Validation contract

- Focused contracts pin compact and roomy rectangles, label baselines, all five
  notice dispositions, exact line endings, positive body-to-surround clearance,
  protected-title width, and shared renderer/action geometry.
- Mac Chrome at 1600 by 900 exercises ordinary and Tonic full-mind rejection,
  then the Robe warning. Each reports the roomy 250 by 69 action at
  `[675,450]`, retains populated idle/pressed `UI.54` chrome, shows complete
  unobscured copy, dismisses once, and leaves page/console/network/WebGL errors
  empty.
- Dowsing retains the compact `[702,397.5,196,69]` action, and Unforge retains
  its existing two-button/result layouts.
- The exact Mac candidate must pass the focused native-UI/Hub-UI suites and
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.

### Implementation validation receipt

- `hub-inventory-render-contract.ts` now owns explicit compact and roomy
  standard-notice button layouts. Full-mind and protected-garment notices
  select roomy data; Hat/Robe select the existing body bitmap font for their
  title. `hub-inventory-renderer.ts` and `HubInventoryUi.tsx` consume the same
  selected action rectangle, so visible chrome and semantic input cannot drift.
- The Mac red gate reached Hub UI with 64 sibling tests passing and failed only
  because the new `HUB_STANDARD_NOTICE_BUTTON_LAYOUTS` export did not yet
  exist. After implementation, the rebased `53ded170` candidate passed the
  complete `/opt/homebrew/bin/bash ./scripts/validate.sh` gate: 19 backend
  contracts, formatting/lint with zero errors,
  every frontend suite including Hub UI `92/92` and the complete Boneyard group,
  desktop `4/4`, production builds, media policy, and bundle budget. The Game
  entry remains below the 524,288 raw / 134,144 gzip limits.
- Mac Chrome at 1600 by 900 exercised ordinary and Tonic full-mind rejection
  and a real protected-Robe drag. Every `OKAY` action measured
  `[675,450,250,69]`; idle/pressed surrounds retained both ends and connector
  pixels, authored copy was unobscured, and Robe remained equipped after
  dismissal. The structured receipt has SHA-256
  `9754d79dce2cbedff3cb623bad06d1f0c9fb2fcff01dbf4ad4688676d130111f`;
  reviewed ordinary, Tonic, and pressed-Robe frames hash to
  `daf934022bf06f7dda6b224ce0508a09e9f320d30f249a953d55886ea268403c`,
  `cd6619725d6068c61090cc00244a82aa1ea06e315f3e1ffbf9730702fc6e565f`,
  and `4ae8b8cbf88a785afab92713e1c59bd87bca442484d3b4a6d33a996356182ba4`.
  Browser page, console, failed-request, failed-response, and WebGL-loss arrays
  were empty.
- Dowsing retains compact `[702,397.5,196,69]`; Unforge retains its established
  primary/secondary/result layouts. The older broad trader smoke's later
  DOWSE-chrome pixel threshold remains a separate current-main diagnostic and
  was neither weakened nor counted as this task's receipt; the task-owned
  `--hagatha-layout-only` lane stops after the affected members.
- No browser-platform approximation or material unknown remains. No economy,
  equipment, protocol, save, audio, or lifecycle behavior changed. Commit,
  push, deployment, and production restart were not requested or performed.

## 2026-09-01 — Reopened: native content-sized Hub MsgBox construction

### Reported smell and parity question

- The owner reports that `A WIZARD WOULD NEVER REMOVE HIS ROBE!` still does
  not match stock: its title face/size is wrong, its button appears too narrow,
  and its panel needs more height. The owner also requests the same RE for both
  `YOUR MIND IS FULL!` branches (the report said “mine”; retail text and the
  Website source both say `MIND`).
- This is a secondary report in a covered system. The 2026-08-31 long-notice
  reopening explicitly substituted a Website-only `roomy` layout, changed the
  protected-garment title from the native menu wrapper to the body wrapper,
  and treated a fixed Dowsing frame as if native MsgBox construction did not
  size itself from its complete line vector. That skipped the extractable
  constructor, wrapping, measurement, and finalizer rules. The `roomy` branch
  and title-font override are therefore refuted for every member that uses
  them, not tuned again.
- Stock questions: which wrapper each caller passes; how `Dialog_AddLine`
  wraps, measures, and advances each authored line; how the root panel and
  action rectangle derive from those lines; which callers share the path; and
  whether the suggested wider button is stock fact or a visual hypothesis.
- Falsifiers: protected-garment titles use a smaller wrapper; a long line is
  clipped rather than mutated at the native threshold; the panel is fixed;
  Hagatha and Inventory pass an authored wide action; or a sibling standard
  notice uses a different constructor/finalizer.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | task-owned clean copy of unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Exact retail 0.72.5 image; the task copy contained no `.sdmod` or mods directory and was launched directly. | high |
| Clean-stock robe observation | direct process PID `21268`, start `2026-09-01`, ASLR base `0x009E0000`; settled 1600 by 900 client capture `/mnt/c/Users/User/Documents/GitHub/SB Modding/Solomon Dark/.codex-tmp/hub-msgbox-stock-20260901-root/robe-dialog-2.png`, SHA-256 `95f340e85c677a53f368a91731922895cab39d24607ac83bcca523f553a27c6c` | The title uses the large stock menu face and wraps as `A WIZARD WOULD NEVER` / `REMOVE HIS ROBE!`; both body paragraphs retain their exact native breaks and the double space before `And`; the action is visibly the compact stock `OKAY`. | high |
| Clean-stock object read | same direct process; preferred global `0x00819EDC` rebased to `0x00DF9EDC` -> MsgBox `0x152A3740`; runtime vtable `0x00D68E04` maps to preferred `0x00788E04` | Root panel `[584.5,262.5,431,375]`; primary action `[702,543,196,69]`; five DataLines have extents `60,51,17,85,17`, fonts menu then medium, and the exact mutated strings visible in the frame. No injected loader was present and no memory write occurred. | high |
| Clean-stock systemic check | fresh direct process PID `25752`, ASLR base `0x009E0000`; beta MsgBox `0x035DBE30` | Twelve live DataLine extents sum to `438`; root height is exactly `438 - 12 + 50 + 100 = 576`. Panel `[580,162,440,576]` and action `[702,643.5,196,69]` reconcile the same line-advance, padding, footer, and button formulas. | high |
| String/caller instructions | canonical Ghidra 12.0.3 read-only replica; `A WIZARD...ROBE` at `0x00795690` -> `0x0056FC90`; `YOUR MIND IS FULL` at `0x00795418` -> `0x0056C340`; `NOT ENOUGH GOLD` at `0x00794F18` -> `0x0055FAF0` | Inventory constructs Hat/Robe with title, paragraph, blank, paragraph, trailing blank; Hagatha constructs one Tonic body or paragraph/blank/paragraph; Dowsing constructs title/body/trailing blank. Every title passes `Fonts + 0xE7D98`; body and blank rows pass `Fonts + 0x4D530`. | high |
| Shared builder instructions | ctor `0x004A98E0`; `Dialog_AddLine 0x005BCCB0`; native wrapper `0x0043D030`; width/height `0x0043C870/0x0043B5B0`; finalizer `0x005AB2C0`; renderer `0x005C4530`; primary/secondary builders `0x005AB7E0/0x005AB980` | MsgBox owns a mutable DataLine vector, content-sized root rect, one or two embedded Buttons, reveal/close state, rendering, hit rectangles, and teardown. | high |
| Raw constants/data | `0x0078E600` double `400`; `0x00787110` float `400`; `0x007DE968` float `25`; `0x007DE908` double `100`; `0x00799D54=196`; `0x0079250C=69`; `0x007849A0` double `60`; menu/medium live wrapper metrics `24/16` | Lines wider than 400 are mutated by the native wrapper; panel padding is 25 each side; action footer is 100; primary body is always 196 by 69 and sits 60 pixels above the panel bottom by its center. | high |
| Current web causal trace | `hub-inventory-render-contract.ts`, `hub-inventory-renderer.ts`, `HubInventoryUi.tsx`, `native-ui-text.ts`, `native-ui-plan.ts` at Website `419699d10457a22897cdb3fdb8bb7938c5141117` | Five standard notices share a fixed 529 by 384 Dowsing frame; four select an invented 250-wide row at y 450, Hat/Robe force `titleFont: 'body'`, and the generic web wrapper collapses whitespace and performs ordinary word wrapping instead of the recovered native mutation loop. | high |

Ghidra provenance: canonical project `SolomonDark/SolomonDark.exe`, preferred
base `0x00400000`, invoked through the existing Mod Loader checkout read-only at
revision `08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`search_terms_refs.py`, `decompile_targets.py`,
`trace_call_arguments.py`, `dump_function_instructions.py`,
`dump_insns_around.py`, and `dump_floats_at.py` were used through the replica
pool. The already-dirty Mod Loader checkout was not changed.

### System boundary and membership inventory

Native system: content-sized, one-action Hub/Inventory `MsgBox` construction
from authored DataLine calls through native wrapping/measurement, root-panel
finalization, frame/text/Button painting, semantic action dispatch, close
animation, and destruction. The reusable wrapper and MsgBox primitives are
inside the boundary; unrelated caller state/economy/equipment transactions are
not.

| Member / branch | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| Dowsing insufficient-gold notice | `0x0055FAF0`, three lines, primary action | `exact-ported` | native title/body/trailing blank derive panel/action; no fixed-layout exception |
| Hagatha ordinary full-mind notice | `0x0056C340`, title + paragraph + blank + paragraph | `exact-ported` | exact four-line-object construction and computed `[702,414,196,69]` action |
| Hagatha Tonic full-mind notice | `0x0056C340`, title + one body | `exact-ported` | exact two-line-object construction and computed `[702,381,196,69]` action |
| protected Hat notice | `0x0056FC90`, five line objects | `exact-ported` | menu title wraps to two lines; computed `[702,534.5,196,69]` action |
| protected Robe notice | `0x0056FC90`, five line objects | `exact-ported` | clean-stock line vector, `431x375` root, and `[702,543,196,69]` action |
| one-line, wrapped, blank, and explicit double-space input | `0x0043D030`, `0x0043C870`, `0x0043B5B0` | `exact-ported` | mutation-loop golden cases include Robe, both Mind branches, Hat, Dowsing, hard spaces, and existing newline input |
| menu title wrapper and medium body wrapper | caller operands `Fonts + 0xE7D98/+0x4D530` | `exact-ported` | no caller font override; 24/25 and 16/17 height/pitch contracts |
| dynamic root panel | `Dialog_AddLine`, `0x005AB2C0` | `exact-ported` | `max wrapped width + 50`; `sum(text height + authored gap) + 150`; caller anchor/clamps retained |
| embedded primary Button | `0x005AB2C0`, `0x005C4530` | `verified-already-at-parity` | fixed 196 by 69; UI.101/.102/.54, `[6,6]` press, label, and HotRect remain shared |
| frame/background/header/arrows | `MsgBox::Render 0x005C4530`, existing UI-kit records | `exact-ported` | existing exact chrome consumes the computed frame rectangle instead of one fixed Dowsing rectangle |
| pointer, keyboard, dismissal, reveal/close, curtain, and teardown | `0x005AB710`, Button handlers, owner removal | `verified-already-at-parity` | only geometry/text plan changes; one accepted action closes once and resources remain owner-scoped |
| Unforge content-sized confirmation/result | different explicit two-action/result caller contracts | `out-of-system` (not a standard Hub notice) | existing dedicated rectangles and tests remain unchanged |
| title Kill/Tutorial MsgBoxes | different two-action Title callers with already recovered explicit bounds | `out-of-system` (not one-action Hub/Inventory construction) | shared wrapping regression coverage remains; title prompt geometry is unchanged |

No member is blocked by the browser platform. In particular, browser bitmap
text can preserve the retail whitespace mutation and half-pixel rectangles;
there is no justification for a smaller title face or a guessed roomy row.

The complete direct `Dialog_AddLine` xref sweep found 194 calls in 22 owner
functions. Each owner is dispositioned below; counts are the complete direct
xref membership, not samples.

| Owner | AddLine xrefs | Primary / secondary xrefs | Disposition for this boundary |
| --- | ---: | ---: | --- |
| `WaveEditor_Generate 0x004BE620` | 2 | 1 / 1 | `out-of-system` editor-only two-action owner; xrefs inspected, caller preparation unchanged |
| `0x0050E5E0` | 2 | 1 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `0x00554690` | 2 | 0 / 0 | `out-of-system` HoverBox-only owner; xrefs inspected, caller preparation unchanged |
| `0x0055E2C0` | 3 | 0 / 0 | `out-of-system` HoverBox-only owner; xrefs inspected, caller preparation unchanged |
| `0x0055FAF0` | 3 | 1 / 0 | `exact-ported` Dowsing member |
| `0x0056C340` | 4 | 1 / 0 | `exact-ported` two Hagatha branches |
| `0x0056D1B0` | 2 | 1 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `0x0056EC30` | 7 | 2 / 1 | `out-of-system` separate one/two-action content; xrefs inspected, caller preparation unchanged |
| `0x0056FC90` | 8 | 1 / 0 | `exact-ported` Hat/Robe branches (shared body/trailing-blank callsites account for eight xrefs) |
| `0x00573E90` | 7 | 0 / 0 | `out-of-system` line-only owner; xrefs inspected, caller preparation unchanged |
| `0x0057C4B0` | 15 | 0 / 0 | `out-of-system` line-only owner; xrefs inspected, caller preparation unchanged |
| `0x0058DB90` | 12 | 1 / 0 | `out-of-system` beta/startup owner; clean systemic geometry check retained as evidence |
| `0x0058E260` | 3 | 1 / 1 | `out-of-system` separate two-action owner; xrefs inspected, caller preparation unchanged |
| `0x0058F500` | 2 | 1 / 1 | `out-of-system` separate two-action owner; xrefs inspected, caller preparation unchanged |
| `0x0058FEE0` | 3 | 1 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `0x005901E0` | 2 | 1 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `0x00590470` | 19 | 6 / 0 | `out-of-system` multi-branch caller content; xrefs inspected, caller preparation unchanged |
| `0x005910B0` | 2 | 1 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `0x00591AD0` | 4 | 2 / 0 | `out-of-system` separate caller content; xrefs inspected, caller preparation unchanged |
| `UiOwner_DispatchControlAction 0x005A5530` | 5 | 2 / 1 | `out-of-system` dynamic owner content; xrefs inspected, caller preparation unchanged |
| `0x0066B990` | 85 | 0 / 0 | `out-of-system` large line-only authored-dialogue owner; xrefs inspected, caller preparation unchanged |
| `0x00670E20` | 2 | 0 / 0 | `out-of-system` line-only owner; xrefs inspected, caller preparation unchanged |

### Native ownership thread and recovered contract

- `MsgBox` construction at `0x004A98E0` owns a zeroed root rectangle at
  `+0x78..+0x84`, a DataLine pointer list/count at `+0xA0/+0x94`, two embedded
  Buttons at `+0xC4/+0x178`, labels at `+0x22C/+0x248`, and reveal/close state
  at `+0xBC/+0xC0`.
- `Dialog_AddLine 0x005BCCB0` chooses the caller wrapper (defaulting to the
  menu wrapper only when null). If unwrapped width exceeds 400 it calls
  `0x0043D030` with an exact 400-pixel boundary. That routine mutates the
  retained string in place: it walks per-glyph advances without render
  kerning, backtracks to a space/hyphen on strict overflow, replaces that byte
  with newline, preserves authored repeated spaces elsewhere, and carries the
  overflowing glyph advance into the new-line scan. That carry is why ordinary
  greedy wrapping is observably wrong even when its final measured line is at
  most 400.
- Native exact rendering still uses wrapper kerning. Menu text is 24 pixels
  high with 25-pixel newline pitch; medium is 16 with 17-pixel pitch. A
  DataLine stores render advance `measuredHeight + authoredGap + 1`; the panel
  accumulates `measuredHeight + authoredGap`. Hub titles pass gap 10; body and
  blank lines pass zero.
- `0x005AB2C0` adds 25 pixels on every panel side and a 100-pixel footer, then
  positions/clamps the panel at the caller anchor. Hagatha/Dowsing anchor at
  `(800,350)`; protected garment warnings use the screen-centered Inventory
  anchor `(800,450)`.
- Settled text starts at `(panel.left + 25,
  panel.top + 20 + firstWrapper.lineHeight)`. Each subsequent DataLine starts
  after the previous stored render advance. This naturally moves the body down
  when the protected title wraps to two lines.
- The primary Button is always centered horizontally at width 196, height 69.
  Its top is `panel.bottom - 60 - 69/2`. The owner’s wider-button hypothesis is
  therefore falsified by both instructions and clean live fields; Website’s
  250-wide `roomy` body is wider than stock, not narrower.
- At settled reveal, the established UI-kit MsgBox chrome maps the computed
  panel into its background/frame/header/arrow rectangle and retains the
  existing deterministic painter order. Button art remains after text/frame
  construction, and the semantic HotRect remains the 196 by 69 body.
- Owner state (gold/capacity/equipment), modal pause, dismissal callback,
  sounds, authority, save/protocol state, and teardown do not move into the
  layout module.

### Fully extracted target rows

| Notice | Native wrapped rows | Root panel | Primary action |
| --- | --- | --- | --- |
| Dowsing insufficient gold | menu title; five medium body rows; trailing blank | `[585.5,208,429,284]` instruction/data result | `[702,397.5,196,69]` |
| ordinary full mind | menu title; three medium rows; blank; four medium rows | `[580.5,191.5,439,317]` | `[702,414,196,69]` |
| Tonic full mind | menu title; four medium body rows | `[577.5,224.5,445,251]` | `[702,381,196,69]` |
| protected Hat | two menu rows; four medium rows; blank; three medium rows; trailing blank | `[579,271,442,358]` | `[702,534.5,196,69]` |
| protected Robe | two menu rows; three medium rows; blank; five medium rows; trailing blank | `[584.5,262.5,431,375]` clean-live confirmed | `[702,543,196,69]` clean-live confirmed |

The complete exact Robe mutation is:

```text
A WIZARD WOULD NEVER
REMOVE HIS ROBE!

A long, intimidating flowing robe looks
debonaire on both a gluttonously fat slob
and a pathetically wasted weakling.

Strip away the robe and people might make
comments about the kind of physique you
get from years in wizarding school.  And
then you'd have a completely avoidable
disintegration on your conscience.
```

### Confidence and open questions

- Confirmed: retail identity; every target caller/string/line branch; all
  direct AddLine/primary/secondary xref owners; exact wrapper mutation;
  font/line metrics; panel formula; anchors; text origins; fixed Button size
  and footer placement; clean-stock Robe line vector/rectangles; systemic beta
  reconciliation; ownership and lifecycle boundary.
- Inferred: human-readable names for several out-of-system owner functions;
  their exact addresses and xref counts are instruction-derived and do not
  depend on those names.
- Unknown: none material to the target or shared wrapper. No approximation is
  required.

### Web implementation consequence

- Add the exact native `0x0043D030` mutation as the MsgBox DataLine-preparation
  seam; preserve repeated spaces, existing line breaks, overflow carry, and the
  hard-break hyphen branch. Keep renderer-level wrapping separate for callers
  such as Boast whose already-prepared stock rows have their own proved owner.
- Add one pure content-sized MsgBox layout owner beside the existing UI plan.
  It accepts authored DataLines/anchor/action count and returns wrapped rows,
  root/frame rectangles, text baselines, and action rectangles from the
  recovered formulas.
- Make standard Hub notice painting and `NativeAction` consume that single
  result. Delete `compact`/`roomy`, `standardLayout`, `titleFont`, and the fixed
  generic-notice geometry. Do not retain aliases or title-string branches.
- Keep Unforge and title two-action caller contracts separate; retain their
  shared Button/frame primitives and validate that the corrected wrapper does
  not change their authored rows unexpectedly.

### Validation contract

- Focused red/green coverage: exact native wrapper mutation (including overflow
  carry, double spaces, existing newline, and no-wrap input); all five notice
  DataLine inventories; every wrapped row; root/frame/text/action geometry;
  fixed 196 by 69 action; painter and semantic bounds from one layout result;
  absence of the refuted `roomy`/font-override path.
- Shared-consumer coverage: message plan and all five target DataLine inventories
  consume the new mutation seam; title prompts, Boast, skill cards, NPC
  selector, hover boxes, and other bounded renderer callers retain their
  previously proved rows unchanged.
- Mac Chrome 1600 by 900: exercise ordinary/Tonic full-mind, protected Hat and
  Robe, and Dowsing; compare Robe against the clean stock frame and require the
  exact menu title rows, body rows, panel/action rectangles, idle/pressed
  chrome, one dismissal, retained equipment, and empty page/console/network/
  WebGL/host error arrays.
- Run focused native-UI/Hub-UI/economy suites and the exact candidate through
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

### Implementation validation receipt

- `native-ui-text.ts` now exposes the recovered MsgBox-only in-place mutation
  loop, including strict overflow, carried overflow advance, preserved repeated
  spaces/newlines, and native hard-break insertion. Renderer-level greedy wrap
  remains separate; the stock-proved Boast rows and every other bounded-text
  sibling retained their prior tests.
- `native-ui-plan.ts` owns one pure single-action layout. It derives wrapped
  DataLines, exact text height/pitch, root/frame rectangles, baselines, the
  fixed 196 by 69 action, and label baseline. `hub-inventory-render-contract.ts`
  supplies explicit title/paragraph/blank membership and anchors for Dowsing,
  ordinary/Tonic Mind, Hat, and Robe. Pixi and `NativeAction` consume the same
  result. The fixed Dowsing frame, `compact`/`roomy`, `standardLayout`, and
  protected-title font override are removed completely.
- The Mac red pass failed at the intended seam with `TS2305` for missing
  `layoutNativeUiSingleActionMessage`. The final focused Mac receipts pass
  native UI `71/71`, Hub UI `93/93`, and Hub economy `50/50`; coverage includes
  every target row/rectangle, the hard-break and whitespace branches, unchanged
  Boast rows, shared Button chrome, Unforge isolation, and the concurrently
  published inventory-stats composition.
- The exact runtime/source/test manifest SHA-256 is
  `ec3c0d178410653e7917e1c939d741c5b5b905ecade9e5e89c5e688ab3036553`
  on Website base `63bd0757d9759ea7663a44a57cb1cfe7ba921184`; every listed file was
  byte-identical in the local and clean detached Mac worktrees. The final Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` stdout hashes to
  `c33259880ce65315abf7b625a42f36be50eecbb03c7d5a842ae6ec5494b9aaaf`.
  It passed backend Release build with zero warnings/errors, 19 backend
  contracts, lint with nine existing warnings and zero errors, prerequisite
  groups through `339/339`, broad Boneyard `1751/1751`, Hub UI `93/93`, desktop
  `4/4`, production frontend/game-host builds, media policy, and the Game bundle
  at `263,678` raw / `80,225` gzip bytes.
- Mac Chrome production-bundle receipt
  `cb32cdddf23e6a47f82e81423c45fa08ccefdd3ea89390ae807f111133a214cd`
  exercised both Mind branches and real protected Hat/Robe drags. Actions were
  Tonic `[702,381,196,69]`, ordinary `[702,414,196,69]`, Hat
  `[702,534.5,196,69]`, and Robe `[702,543,196,69]`; both idle and pressed
  surrounds retained populated ends/connectors, copy was unobscured, and both
  garments remained equipped. Reviewed idle frames hash to
  `2222889b98d2232c569578a584a8d5ba1b2fc8fefbaf1c47144176ab18e47a66`,
  `f9a3e9f84a92d79e09a2765cadb9b4691ab2c09d157bdb9ee4d57cd26fd13937`,
  `c2c7b37ea2997d7673a09aed667990f38e646c1633cdd2d80381b7b8eae7e20f`,
  and `19425382693b2fb2e41bcd2e0255ee8c80af8b1376609c0fa180f611bb8e9474`.
- Focused Dowsing production-bundle receipt
  `9b5f2086112eb2266ee8daed8b23349b9d55ba589ad76e84568bdf146f3d0b04`
  used a zero-gold saved profile and the real Shlorio action. It confirmed root
  `[585.5,208,429,284]`, frame `[536.5,158,527,384]`, action
  `[702,397.5,196,69]`, populated idle/pressed chrome, and reviewed frame
  `e7824dbde218a9c0967513108139df83ffd7e59aa5868c545ca4a5c31c8ddedf`.
  Both successful journeys had empty page, console, failed-request,
  failed-response, WebGL-loss, wire-error, and host-error arrays; Dowsing alone
  recorded one expected aborted favicon request.
- The older shared-sibling lane still samples the DOWSE pre-roll button during
  a dark service reveal and can miss its brightness threshold; its rectangle
  remained exact and it is not MsgBox evidence. The focused rejection lane
  above replaces it for Dowsing MsgBox acceptance without weakening that
  separate diagnostic.
- No browser approximation or material unknown remains. No economy,
  equipment, pause, audio, protocol, save, authority, or teardown behavior
  changed. At this validation-receipt point, commit, push, deployment, and
  production restart had not yet been performed; publication state is reported
  separately at handoff.
