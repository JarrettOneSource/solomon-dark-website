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
