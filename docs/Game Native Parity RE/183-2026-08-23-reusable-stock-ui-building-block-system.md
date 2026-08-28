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
