# 2026-08-28 — Gold amount, removable perks, overlapping casts, InventoryScreen pages, and completed-run scavenging reopening

> **Partial supersession, 2026-08-31:** the Tonic capacity-affordance reopening
> in entry 175 corrects this entry's unconditional `DRINK TONIC` decoration
> model. Stock moves the plaque after the first Tonic, removes it after the
> second, and paints unlocked empty cells brighter than locked cells.

> **ExactText supersession, 2026-09-01:** the Inventory-specific pen, font-role,
> case, tint, and chrome findings below remain correct, but its conclusion that
> the shared font engine had no defect is falsified. Entry 287's sixth report
> proves that all web glyph output adapters discarded each sprite record's
> logical canvas and trim origin, producing mixed half-pixel ink shifts across
> all ten native bitmap fonts. Inventory must inherit that shared correction;
> no further Inventory-only offset is authorized.

## 2026-09-01 — InventoryScreen ExactText and outer-chrome secondary-report reopening

### Reported smell and parity question

- A player reports that the corrected page-1 copy still sits incorrectly:
  values cross the textured separator in ATTRIBUTES/RESISTANCES, the visible
  font appears unlike stock, the STATS word does not sit cleanly inside its
  shaded rail, and the stock chain border is absent. The player also asks
  whether the font defect is game-wide.
- This is a secondary report in the system closed immediately below. The
  earlier correction stopped at the 13 inner record-10 frames. It did not
  enumerate the later InventoryScreen root-chrome pass, and it transcribed the
  page content base as the frame left `86` instead of the instruction-derived
  inset `96`. It therefore placed label/value pens ten pixels left, submitted
  uppercase replacement literals, rendered only four UI-4 corners instead of
  the complete shaded helper, and left both native chain axes out of the web
  membership. Calling the complete Inventory presentation exact was wrong.
- The falsifier for a global font-engine change is the shared ExactText ABI:
  if its width, kerning, alignment, glyph placement, or point sampler differs,
  every consumer must be corrected. If those shared rules already match, the
  fix must remain in the Inventory call-site contract and must not perturb
  Title/Create/MsgBox/Hall/Skill surfaces.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User stock observation | `SD original - image.png`, 679x694, SHA-256 `e84513ec46b23f893dff87a16eddf14f1b2f619c8346f1b0efae3adf3006c9af`; `SD original 2 - image.png`, 702x728, SHA-256 `4484fe75af8a155f3833d001bfa8c6bbc5488a12ea232be202aa814435cf9c8e` | Page-1 labels finish just before the separator and values begin after a clear inset. The left pane owns horizontal and vertical chain runs, a continuous black STATS backing, and menu glyphs distinct from the web capitals. | high |
| Current-main browser reproduction | Website `46ec87a732b5330dbcab2850da7a4a9298810608`; production Mac Chrome at 1600x900; `baseline-reported-stats-attributes.png` SHA-256 `f4c2d659687d11ae988ff74304411f72dad44ac46a0425d86debdb9161f41a56` | The first value glyph starts at x=206 directly on the gold subframe edge; labels end at x=191. UI-10/UI-79 chains are absent, UI-4 has only corner sprites, and STATS/EQUIP/BACKPACK use replacement uppercase strings and `#AAA2A6`. Page/console/response arrays were empty, proving a presentation defect rather than a failed journey. | high |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same canonical image used by the parent Inventory entries; all addresses below are preferred-image addresses. | high |
| ExactText ABI and alignment | `DarkCloudBrowser_ExactTextRender 0x0043AFC0`; width `0x0043CB00`; right/center/left wrappers `0x0042D610`, `0x004A57C0`, `0x00551410`; renderer entry `0x00421560`; entry 287 complete 78-call/34-owner sampler census | Native mode `-1` subtracts the exact advance width, mode `0` subtracts half, and mode `1` leaves the pen. Glyph advance/kerning and point-filtered wrap-addressed sources already match `native-ui-text.ts`/`native-ui-pixi.ts`. There is no game-wide font-engine defect to patch. | high |
| Page-1 pen instructions | `InventoryScreen::Render 0x00562520`; content-base construction near `0x005628F8`; page-1 calls `0x00563CEE..0x005640A8` and `0x00564535..0x00564804`; constants `0x00795170=114`, `0x007DE810=10`, `0x00793970=105`, `0x0078E470=120` | Pane center is 200. The content base is `(200-114)+10 = 96`, not frame left 86. Body labels right-align at `96+105 = 201`; medium values left-align at `96+120 = 216`. The previous 191/206 contract dropped the shared ten-pixel content inset. Fonts, row baselines, tints, and subframe rectangles remain correct. | high |
| Left root-chrome instructions | `0x005652D0..0x00565AC1` in `0x00562520`; Inventory record 8; UI records 10, 79, 4; strings `stats` at `0x00795040`; UI corner vector consumed at `0x0056592F..0x00565AC1` | After page content, stock overlays the mirrored record-8 helper, UI-10 top/bottom runs, UI-79 left/right runs, one measured UI-4 shaded header, lowercase `stats` in group-3/menu at RGB `.5`, then four authored corner overlays. | high |
| Right root-chrome sibling | equipment renderer `0x00561300`, root range `0x00561DAE..0x005622FB`; string `equip` at `0x00795028` | EQUIP repeats the same record-8/UI-10/UI-79/UI-4/chrome sequence and lowercase menu-literal rule at the mirrored pane. Fixing only STATS would retain the same refuted path in its sibling. | high |
| Backpack header sibling | `InventoryGrid` detail/root renderer `0x00556940`, string `Backpack` at `0x007948F8` | BACKPACK uses the same group-3 font, `.5` tint, measured width plus 40, height 40, and UI-4 mirrored nine-slice. The web already retained its native 175x40 bounds but used uppercase copy and four disconnected corners. | high |
| Asset data | tracked `native-ui-assets.json`; Inventory 8 is 73x73; UI 10 is 106x19; UI 79 is 21x108; UI 4 is 20x20; UI 107..110 are the authored outer corner overlays | All required pixels are already Website-tracked. The omission is renderer membership/order, not an unavailable asset or browser limitation. | high |

Static queries used the canonical read-only replica wrapper from the existing
Mod Loader checkout at `08bfba9ef367f7b863848030d0a289dc31e33192`.
Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
material script SHA-256 values are `search_terms_refs.py`
`83af550e3f8e03bee390b077bd7da128f4ec02e2d44ede3a9e2f87a0409a2f9f`,
`decompile_targets.py`
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`dump_function_instructions.py`
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`,
and `dump_floats_at.py`
`925d7d6f1655937180655da8767b518d904a743d0a3bad4597c9d31b0d50b15a`.

### System boundary and membership inventory

Native system: InventoryScreen fixed-stage text anchoring and root chrome from
the shared ExactText call modes through the left/right pane overlays and the
Backpack section header, across standalone, companion, Hub, and Boneyard
owners.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| shared font atlas, glyph advance, kerning, point sampler | `0x0043AFC0`, `0x00421560`; entry 287 complete census | `verified-already-at-parity` | shared native-ui unit contract remains unchanged |
| right/center/left alignment modes | `0x0042D610`, `0x004A57C0`, `0x00551410` | `verified-already-at-parity` | exact width/anchor assertions; no Inventory-only alignment shim |
| page-1 attribute label pens | content x 96 plus 105 | `exact-ported` by this reopening | every label right edge is 201 |
| page-1 resistance label pens | same shared call path | `exact-ported` by this reopening | every label right edge is 201 |
| page-1 attribute value pens | content x 96 plus 120 | `exact-ported` by this reopening | every value left pen is 216 |
| page-1 resistance value pens | same shared call path | `exact-ported` by this reopening | every value left pen is 216 |
| left pane textured underlay and existing filigree | pre-content root pass | `verified-already-at-parity` | stays behind all page content |
| right pane textured underlay and equipment content | equipment/root pass | `verified-already-at-parity` | stays behind equipment sinks/content |
| left/right Inventory-record-8 outer helpers | `0x0056531C`, mirrored equipment sibling | `exact-ported` by this reopening | stock 0.95-edge mirrored helper overlays content |
| four horizontal chain runs | UI 10; top `paneTop-12`, bottom `paneBottom-5` on both panes | `exact-ported` by this reopening | 106x19 authored tiles, bounded by the pane owner |
| four vertical chain runs | UI 79; left `paneLeft-10`, right `paneRight-7` on both panes | `exact-ported` by this reopening | 21x108 authored tiles, bounded by the pane owner |
| STATS shaded header | UI 4; measured `stats` width 72 plus 40; 112x40 | `exact-ported` by this reopening | lowercase literal, group-3/menu, centered, `#808080` |
| EQUIP shaded header | UI 4; measured `equip` width 72 plus 40; 112x40 | `exact-ported` by this reopening | lowercase literal, mirrored pane, same font/tint |
| Backpack shaded header | UI 4; measured `Backpack` width 135 plus 40; 175x40 | `exact-ported` by this reopening | title-case literal and continuous backing |
| UI 107..110 left/right outer corner overlays | terminal pane-root draws | `verified-already-at-parity`, order corrected | four corners remain above content/chains |
| page-0/page-1/page-2 inner painters | preceding corrective entry | `verified-already-at-parity` except the shared page-1 x pens above | geometry, colors, fonts, gem, filigree retained |
| standalone InventoryScreen | left/right outward projection | `exact-ported` by shared correction | chrome and content use the same owner/order |
| ordinary service companion Inventory | inward 53-pixel projection | `exact-ported` by shared correction | every root-chrome member shifts with its pane |
| Hagatha fixed left pane and common EQUIP pane | service replacement | `exact-ported` by shared correction | fixed content retains common surrounding chrome |
| Hub and Boneyard | common InventoryScreen renderer | `exact-ported` by shared correction | identical pixels and teardown |
| protocol, save, simulation, audio, RNG | no text/chrome ownership | `out-of-system` — no state/cue change | source manifest and lifecycle tests remain unchanged |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- The UI-49/textured underlay and ornamental content are earlier painters.
  Page/equipment content follows. The record-8 overlay, both chain axes,
  measured UI-4 title backing, title text, and authored corner overlays are a
  terminal root-chrome pass. Rendering the entire side panel before page
  content reverses that native ownership even when individual coordinates are
  correct.
- UI-10 settles at each pane's `top-12` and `bottom-5`; UI-79 settles at
  `left-10` and `right-7`. Both axes repeat their natural record sizes and are
  clipped/covered by the same pane/corner owner. They are not filigree and may
  not be substituted by Inventory record 16.
- `FUN_00417760` draws full mirrored corner records, uses the final five
  percent of the source for stretched edges/interior, and optionally fills the
  center. Inventory record 8 and UI record 4 therefore require the existing
  native mirrored-nine-slice helper, not Pixi's equal-third NineSliceSprite or
  four disconnected sprites.
- ExactText strings are case-sensitive record selectors. `stats`, `equip`,
  and `Backpack` intentionally address different group-3 glyphs from the web's
  all-uppercase replacements. All three titles modulate exact grayscale `.5`;
  their continuous UI-4 backing supplies the black shading visible in stock.
- Page-1 x ownership starts at content x=96. Frame x=86 is a separate value.
  Labels use right mode at 201 and values use left mode at 216; the value
  subframe remains at x=206. This produces the visible 10-pixel value inset
  without moving the native separator.

### Nearby-system findings

- The player's broader-font suspicion was a valid falsifier, but the complete
  render-pipeline ledger and fresh instruction trace close it: the shared
  font ABI, sampler, width, and alignment modes are already exact. The visible
  font mismatch comes from case-sensitive replacement literals and wrong
  Inventory pen coordinates. No unrelated app-wide font change is justified.
- The existing `addNativeNineSlice` helper already implements
  `FUN_00417760`. Reusing it closes both record-8 pane overlays and all three
  UI-4 headers without another rendering abstraction.

### Web implementation consequence

- Split side-panel construction into backdrop and terminal chrome so stats,
  equipment, and service content paint between the two native owners.
- Retain UI-49/ornamental backdrop members. Replace the four record-8 corner
  approximation with the complete native mirrored helper; add both UI-10 and
  UI-79 axes; retain UI 107..110 above them.
- Replace disconnected UI-4 corners for STATS/EQUIP/Backpack with the native
  mirrored helper. Submit the exact `stats`, `equip`, and `Backpack` strings in
  menu/group 3 at `#808080`.
- Move both page-1 label and value pens ten pixels right to 201/216. Do not
  move frames, baselines, page clipping, row tints, or the shared ExactText
  renderer.

### Validation contract

- Focused tests must pin the content base 96, label right 201, value left 216,
  the three case-sensitive literals/widths/tint, record-8/UI-4 helper type,
  UI-10/UI-79 records and all relative chain offsets, and backdrop/content/
  chrome painter order for both pane sides and every companion shift.
- A source contract must reject uppercase replacement literals, disconnected
  title corners, missing vertical chains, and page content painted after root
  chrome. Shared `native-ui-text.ts`, point-filter policy, and font manifest
  hashes must remain unchanged.
- Mac Chrome must capture pages 0/1/2 in standalone Hub, page 1 in Boneyard,
  ordinary companion Inventory, and fixed Hagatha. Reviewed crops must show a
  clear divider-to-value gap, continuous shaded STATS/EQUIP/Backpack headers,
  correct menu glyphs, and all four chain sides, with empty page/console/
  response/WebGL/host-error arrays.
- The exact candidate must pass focused native-ui/Hub suites, the production
  build/budget, and `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac
  mini. No publication or deployment is implied by this reopening.

### Implementation validation receipt

- `hub-inventory-render-contract.ts` now owns one complete root-chrome
  contract: record 8 and UI-4 native mirrored helpers, UI-10/UI-79 chain
  records and offsets, UI 107..110 corners, companion/outward projections,
  exact-case title strings, grayscale tint, and header geometry. Page-1 label
  and value pens are corrected from 191/206 to the instruction-derived
  201/216 while the record-10 frames remain unchanged.
- `hub-inventory-renderer.ts` separates pane backdrop from terminal chrome.
  Stats/Hagatha and equipment content paint between those owners; record 8,
  both chain axes, shaded header, and corner overlays paint afterward. The
  existing `addNativeNineSlice` now exposes the native optional-center flag so
  record 8 omits its center while UI 4 retains it. `stats`, `equip`, and
  `Backpack` consume the existing menu font and point sampler without any
  shared font-engine change.
- The Mac red native-UI run compiled and passed 70/72. Its only failures were
  the expected old 191/206 pen values and missing backdrop/chrome source
  owner; stdout SHA-256 is
  `3be8128b3bf141d2e64deff41309e6b8ffe0271c70cd7a33db1538725ba82e98`.
  The implemented tree passed native UI 72/72 and Hub UI 94/94; stdout hashes
  are `c51be1be6c02109d58f0c47ba8ce82e4c00846db6a86c8b2aa1500b0d88bc91a`
  and `0183f6ba37ca8027c1b977756c9df3b45f8ded72c5173a9b9f8a293ceb66e8bd`.
- The production build and bundle budget passed at 263,678 raw / 80,231 gzip
  bytes; stdout SHA-256 is
  `082d58c4a87df4763fc9b9144fc19d951c343e75ce444a185a3f6f38f628b9b4`.
  The production Chrome stats journey repeated Hub pages
  `0 -> 1 -> 2 -> 1 -> 0 -> close -> reopen 0` and Boneyard
  `0 -> 1 -> close`, with empty page/console/failed-response arrays; stdout
  SHA-256 is
  `a974132dc47f2a3c5e12d296627dc9ce84ce31b75b5e038a36362743af9231ca`.
- Manual matched-stage inspection confirms labels terminate at x=201, the
  gold divider stays at x=206, and values begin at x=216 with a clear gap.
  The reviewed Hub page-1, page-0, and page-2 SHA-256 values are
  `0e06fc61ca15938c9f39329880b5556153c7da8fa0dc0454544ddc18fb5322af`,
  `e6144389c37e983337eebb25f111547ea56206fc5e098321ba9c02ae25b2d509`,
  and `ea960b028d72526dbfd6412f9d39d9b03d8005f696f0c321f6b60b5feafde4e0`.
  They visibly retain stock-case menu glyphs, continuous black UI-4 backing,
  record-8 edges, and all four chain sides on STATS and EQUIP. Backpack uses
  the same shaded-title owner.
- Focused Hagatha capacities 3/6/9 and the standalone-plus-four-service
  renderer lifecycle both passed with empty browser/request/response/WebGL
  errors. Their stdout SHA-256 values are
  `fad2ca18fd48568d519bd1e98dd64d6fcd0ce47bdd259567976e9f6f7d99b732`
  and `6a6992416f8df21bf54d68b35570f83bfd44930dd7ac2df3e518c0a3f7dfe3d5`;
  reviewed fixed-Hagatha and companion-lifetime frame hashes are
  `a23a9754b3fe3dda0111c83b9a073b5f5e90ce0310bc99f203ec1a1d5d13a729`
  and `d9229511b6fd41ed886fe9c6b3342f75d0980878f52d3b861468b638d71590fe`.
- No platform approximation or material in-system unknown remains. The
  shared ExactText implementation and every non-Inventory font consumer are
  unchanged. The next validation action is the no-later-edit complete Mac
  gate; publication and deployment were not requested.

## 2026-09-01 — Corrective InventoryScreen STATS composition reopening

### Reported smell and parity question

- A player reports that the scrollable `STATS` region inside InventoryScreen
  still does not look like stock and supplies two stock crops plus the current
  web crop. The web attributes page has thin procedural outlines, no framed
  value column, uniform white copy, the wrong fonts, incorrect panel heights,
  and no page-local filigree. The supplied page-0 stock crop also falsifies the
  web renderer's combined `MELEE DAMAGE` box and missing primary-spell gem.
- This reopens the `InventoryScreen SwipePages` presentation rows below. The
  2026-08-28 pass recovered the three-page state, clipping, inputs, values, and
  page transitions, but it did not follow the panel helper called by the page
  painter or enumerate that helper's xrefs. It substituted `addInset` graphics,
  then accepted a browser journey that proved navigation and values without a
  matched stock-versus-web composition comparison. Calling page presentation
  exact-ported was therefore incorrect.
- Stock behavior to recover is the complete three-page painter beneath the
  already-correct SwipePages owner: every panel rectangle, nested value frame,
  atlas record, font wrapper, row tint, decoration, companion shift, and
  painter order. Paging, input, host state, save state, and teardown are
  falsifiers: none may change as a side effect of this presentation correction.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User stock observation | `SD original - image.png`, 679x694, SHA-256 `e84513ec46b23f893dff87a16eddf14f1b2f619c8346f1b0efae3adf3006c9af`; `SD original 2 - image.png`, 702x728, SHA-256 `4484fe75af8a155f3833d001bfa8c6bbc5488a12ea232be202aa814435cf9c8e` | Page 1 has two wide gold-framed split panels, stock row colors, and page-local filigree. Page 0 has independently framed heading/body pairs and the red primary-spell gem. | high for visible appearance |
| User web observation | `Web Port broken - image.png`, 462x460, SHA-256 `9ecdd71e0b43e1e00e2ceeba1407bc6b0490a0149c1b4457e6268b5356895634` | The current web page reproduces the report: thin hand-drawn borders, narrow/incorrect bodies, no value divider, wrong font roles, white rows, and missing page decoration. | high |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same canonical image as the established InventoryScreen ledger. No runtime/ASLR address is used. | high |
| Complete panel-xref sweep | `InventoryScreen::Render 0x00562520`; all references to shared inset painter `0x00550CC0` | Exactly 13 calls exist, all in `0x00562520`: `0x00562AA6`, `0x00562AF5`, `0x0056301F`, `0x005631C4`, `0x005634D2`, `0x00563652`, `0x005639C7`, `0x00563B80`, `0x00563BD4`, `0x00564235`, `0x005643EE`, `0x00564442`, and `0x00564B2C`. There is no sibling caller outside InventoryScreen. | high |
| Panel helper instructions | `0x00550CC0`; fill `0x0041DD70`; frame `0x004153B0` | Each panel first fills RGB `(0.1,0.1,0.09)`, then nine-slices Inventory record 10 (`Inventory+0x07E0`) as three equal source bands. The web `0x191916` fill plus four procedural strokes is not the native painter. | high |
| Page-0 instructions | `0x00562943..0x00563774` | Local frame rectangles are name `[0,65,228,32]` and `[0,93,228,50]`; primary `[0,161,228,27]` and `[0,184,228,80]`; melee `[0,283,228,27]` and `[0,306,228,32]`. Primary and melee body text use the selected skill root color brightened by 1.25; Inventory record 3 paints the primary gem. | high |
| Page-1 instructions | `0x005637C3..0x00564820`; viewport height field `+0x98 = 320` | With page origin `p`, frames are attributes `[0,p+85,228,32]`, body `[0,p+113,228,80]`, value frame `[120,p+113,108,80]`; resistances `[0,p+233,228,32]`, body `[0,p+261,228,60]`, value frame `[120,p+261,108,60]`. Titles use medium; labels use body right-aligned at body x+105; values use medium at body x+120. | high |
| Page-1 color instructions | saturation helper `0x0040FC60`; text blocks `0x00563BF0..0x005640A3` and `0x0056445E..0x00564804` | Health/Pain derive from `(1,.75,.75)` at saturation `.5`; Mana/Magic from `(.75,.75,1)` at `.5`; Cast/Walk/Poison from `(.75,1,.75)` at `.75`. Quantized web tints are `#E9C9C9`, `#C2C2E2`, and `#C9F9C9`. Attributes baselines relative to its body are `21,35,54,68`; resistances are `21,35,49`. | high |
| Page-2 instructions | `0x00564822..0x00564FA5`; rectangle inset `0x0042D1B0` | The CHARMS/CURSES owner starts from a 240-square rectangle and applies `-5`, yielding one centered 230-square record-10 frame. It is not a 227x238 white-stroked rectangle. Slot/capacity/Tonic logic remains the separately recovered exact member. | high |
| Asset data | tracked `native-ui-assets.json`; Inventory records 3, 10, 13, and 16 | Record 10 is the exact 72x72 gold frame source split into 24-pixel thirds; record 3 is the 18x18 red gem; record 13 is the 16x14 page indicator; record 16 is the 190x109 trimmed page filigree. | high |
| Current web causal trace | Website `419699d1`; `hub-inventory-render-contract.ts`, `hub-inventory-renderer.ts`, tests | `addInset` never samples record 10; page 1 has no right subframes or record-16 draws; labels and values both use medium/white; primary and melee use fixed cyan; page 2 draws a plain white stroke. The incorrect constants are asserted as the contract. | high |

Static queries used the canonical read-only replica workflow through the
existing Mod Loader checkout at `08bfba9ef367f7b863848030d0a289dc31e33192`.
Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
material scripts were `decompile_targets.py`
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`search_terms_refs.py`
`83af550e3f8e03bee390b077bd7da128f4ec02e2d44ede3a9e2f87a0409a2f9f`,
`dump_insns_around.py`
`79249e8ea5eb04115bb284f1bef9b90d81cd74f2c5301a747d08908a36032b40`,
`dump_function_instructions.py`
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`,
and `dump_floats_at.py`
`925d7d6f1655937180655da8767b518d904a743d0a3bad4597c9d31b0d50b15a`.

### System boundary and membership inventory

Native system: InventoryScreen's nested three-page STATS presentation from
the 320x320 clip through its 13 shared inset-painter calls, exact text/art
membership, standalone/service projection, and owner-local teardown.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| page-0 name heading frame | `0x00562AA6` | exact-ported by this corrective pass | record 10, `[0,65,228,32]` |
| page-0 identity body frame | `0x00562AF5` | exact-ported by this corrective pass | record 10, `[0,93,228,50]` |
| page-0 primary heading frame | `0x0056301F` | exact-ported by this corrective pass | record 10, `[0,161,228,27]` |
| page-0 primary body frame | `0x005631C4` | exact-ported by this corrective pass | record 10, `[0,184,228,80]` |
| page-0 melee heading frame | `0x005634D2` | exact-ported by this corrective pass | record 10, `[0,283,228,27]` |
| page-0 melee body frame | `0x00563652` | exact-ported by this corrective pass | record 10, `[0,306,228,32]` |
| page-1 attributes heading frame | `0x005639C7` | exact-ported by this corrective pass | record 10, `p+85`, 228x32 |
| page-1 attributes body frame | `0x00563B80` | exact-ported by this corrective pass | record 10, `p+113`, 228x80 |
| page-1 attributes value subframe | `0x00563BD4` | exact-ported by this corrective pass | x+120, 108x80 |
| page-1 resistances heading frame | `0x00564235` | exact-ported by this corrective pass | record 10, `p+233`, 228x32 |
| page-1 resistances body frame | `0x005643EE` | exact-ported by this corrective pass | record 10, `p+261`, 228x60 |
| page-1 resistances value subframe | `0x00564442` | exact-ported by this corrective pass | x+120, 108x60 |
| page-2 CHARMS/CURSES frame | `0x00564B2C` | exact-ported by this corrective pass | centered record-10 230-square frame |
| record-10 fill/frame painter | `0x00550CC0 -> 0x0041DD70/0x004153B0` | exact-ported by this corrective pass | RGB fill plus three-band 72x72 nine-slice; all 13 callers |
| page-0 display/identity copy | `0x00562B1C..0x00562DD8` | verified content already; frame/gold projection corrected | menu name, medium `LEVEL/title` |
| page-0 primary and melee copy | `0x005630A1..0x00563774` | exact-ported by this corrective pass | body headings, medium values, root tint, record-3 gem |
| page-1 attributes rows | `0x00563BF0..0x005640A3` | exact-ported by this corrective pass | medium title, body labels, medium values, four exact baselines/tints |
| page-1 resistance rows | `0x0056445E..0x00564804` | exact-ported by this corrective pass | medium title, body labels, medium values, three exact baselines/tints |
| page-local record-16 filigree | `0x00563858..0x0056420C` | exact-ported by this corrective pass | page-1 attribute/resistance draws added; page-0 draws retained |
| page-2 slots, capacity alpha, Tonic plaque | `0x00564C39..0x00564FA5`; entry 175 correction | verified-already-at-parity apart from corrected enclosing frame | all nine cells, capacities 3/6/9, two plaque positions |
| page indicators and three-page clip | `SwipePages`; record 13 | verified-already-at-parity | 320x320 over 960, pages 0/1/2, hard clipping |
| wheel, drag, requested click/keyboard/touch page actions | existing SwipePages controller | verified-already-at-parity | unchanged bounded page owner and input tests |
| standalone InventoryScreen | Game Inventory pointer | exact-ported by shared correction | x projection without service shift |
| ordinary Fomentius/Luthacus/Shlorio companion Inventory | same painter, +53 x shift | exact-ported by shared correction | every page and nested value frame shifts together |
| Hagatha fixed companion pane | PerkShop replacement | exact-ported by shared page-2 frame correction; no SwipePages input | same slots/frame presentation, fixed owner |
| Hub and Boneyard consumers | shared InventoryScreen owner | exact-ported by shared correction | identical fixed-stage painter and teardown |
| host simulation, protocol, save, replication, audio, RNG | no presentation ownership | out-of-system: no state or cue is changed | existing state/input/lifecycle coverage remains unchanged |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- InventoryScreen constructs one SwipePages child and owns its page offset,
  clipping, input capture, and teardown. `0x00562520` is the sole STATS painter;
  the 13-call xref sweep closes the entire inset-frame membership.
- Painter order is page-local record-16 filigree, inset fill and record-10
  frame(s), gold heading copy, row-specific copy, then page indicator. The
  primary gem is record 3. Page 1 nests its right value frame after the body
  frame, so the divider is textured rather than a line primitive.
- The inset helper fills `(0.1,0.1,0.09,1)`, restores white, and renders
  Inventory record 10 with source thirds. The 72x72 source therefore has exact
  24-pixel corner/edge/center bands; procedural strokes are not equivalent.
- Primary and melee value color is not fixed cyan. The selected primary skill
  supplies its native root color and `0x0040FD00` applies the stock 1.25
  brightening/clamp. Page-1 row colors instead use the three saturation recipes
  recorded above.
- Standalone and ordinary companion Inventory share every page and differ only
  by the established 53-pixel horizontal projection. Hagatha replaces the
  scroller with its fixed page-2 pane; Hub and Boneyard share the same owner.
  No frame, text, decoration, or page state survives close/replacement.

### Nearby-system findings

- Inventory record 10 already renders the equipment cells, but the STATS
  painter uses the same record as a three-band nine-slice. Treating the cell
  sprite and scalable inset frame as unrelated allowed the procedural fallback
  to survive despite the complete atlas being present.
- The exact root-color tint table already serves SkillPicker. Inventory's
  primary/melee copy is another native consumer of that shared presentation
  truth; it must not retain a second fixed tint.

### Confidence and open questions

- Confirmed: retail identity; all 13 panel xrefs; every frame rectangle and
  subframe; fill, atlas record, thirds; font roles; page-1 baselines and colors;
  primary/melee root-color ownership; all page/scene/companion variants.
- Inferred: none used as a shipped native fact.
- Unknown: no material in-system unknown. Browser rasterization must still be
  compared against the supplied stock crops because D3D9 and Pixi implement
  undersized nine-slice corners differently internally; the stock pixel result,
  not either API's incidental tessellation, is the acceptance oracle.

### Web implementation consequence

- Replace `addInset` and the page-2 white-stroke rectangle with one exact
  Inventory record-10 inset renderer using the recovered RGB fill and 24-pixel
  source thirds. Use it for all 13 members; remove the procedural STATS path.
- Correct page-0 paired frame geometry, split melee heading/body, add the
  primary record-3 gem, and derive primary/melee tint from the shared native
  skill-root palette.
- Correct page-1 header/body geometry, add both 108-pixel value subframes, add
  missing page-local record-16 filigree, use medium headings/body labels/medium
  values, and apply the exact baselines and three row tints.
- Correct the common page-2/Hagatha enclosing frame to 230 square while
  preserving all recovered slot, capacity, Tonic, inspection, and action logic.
- Do not change SwipePages state, page actions, clipping, pause/input ownership,
  host/protocol/save data, or screen lifecycle.

### Validation contract

- Focused contract coverage must pin all 13 xrefs as web frame members, record
  10, 24-pixel thirds, fill color, all page rectangles/subframes, page-1 font
  roles/baselines/tints, root-colored page-0 values, record-3 gem, page-1
  filigree, standalone/companion shifts, and page-2 230-square ownership.
- On the Mac mini, run the focused Inventory renderer/behavior suites and the
  canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` against the exact
  candidate tree.
- Real Mac Chrome must traverse pages `0 -> 1 -> 2` in standalone Hub and an
  ordinary companion, inspect fixed Hagatha, repeat Inventory in Boneyard, and
  return empty page/console/failed-response/WebGL/host-error arrays.
- Stock-versus-web crops at the same 1600x900 fixed stage must visibly match
  the supplied page-0 and page-1 references for gold frame weight, separate
  bodies, value dividers, filigree/gem membership, font roles, row positions,
  and per-row/root colors.

### Implementation validation receipt

- `hub-inventory-renderer.ts` now routes all 13 InventoryScreen panel members
  through one `NineSliceSprite` owner using tracked Inventory record 10 with
  exact 24-pixel source thirds and the recovered `(0.1,0.1,0.09)` fill. The
  procedural `addInset` path and page-2 white-stroke rectangle are gone.
- Page 0 owns the exact paired name/identity, primary, and melee rectangles;
  the primary record-3 gem; gold body headings; and root-colored primary/melee
  copy. Page 1 owns both textured 108-pixel value subframes, the missing five
  record-16 filigree draws, medium headings, body labels, medium values, exact
  baselines, and red/blue/green row tints. The common page-2/Hagatha frame is
  the recovered 230 square while slot, capacity, Tonic, removal, and inspection
  behavior remains unchanged.
- The render contract and focused test now pin every recovered dimension,
  record, source third, font role, tint, baseline, gem, filigree member, and
  source-path removal. `smoke-sacks-dyes.mjs` retains page-0/1/2 visual
  receipts and now repeats page 1 in Boneyard; `smoke-hub-traders.mjs` can
  self-host its production build so the four-service renderer lifecycle is
  independently reproducible.
- The Mac red run passed TypeScript and 67/68 focused tests; its sole failure
  was the expected surviving `addInset` source assertion. After implementation,
  the exact candidate passed TypeScript and all 68 native-UI tests; focused log
  SHA-256 is
  `1308b18a046f0b112e7e5246479eb9437ff9e6e3991e9c1e0c0497f76d1d3020`.
- The production-bundle Hub/Boneyard journey traversed Hub
  `0 -> 1 -> 2 -> 1 -> 0 -> close -> reopen 0`, then Boneyard
  `0 -> 1 -> close`, preserved owner-local input blocking, and returned empty
  page, console, and failed-response arrays. Log SHA-256 is
  `2019bcfabbbd27f0ad7dcfe37e5276848db0e1aeb45f2aec3d42c0a99e830089`.
  Reviewed page-0, Hub page-1, Hub page-2, and Boneyard page-1 frame hashes are
  `3d4edd6bff1985c195a021d3dc9e1cd1d28ac694ad47a23b9f188000218e0cbd`,
  `9943ea26391361b0fd01a9e84e4dc00616470111276ba7f3bb896422b90559f4`,
  `5703146ab00f52ec6e1d8ad3cbe4d3b0ae4b868d69f0a12a5aea737fedf3c88b`,
  and `13e8cec8b409d70a57c97e8520386e492d65384f8b91251e92c57e3f6869ab92`.
- Mac Chrome also exercised capacities 3/6/9 in fixed Hagatha and ordinary
  Inventory page 2 with empty browser/response/WebGL-error arrays; representative
  hashes are `845ebb2d1963cdeb42bf7efd3e31306265d3f9b1a1c2eceeaf4ef115b5a41125`
  and `a894004b30fee2b196b776abc68b9654b310b231fd7b8fe1158aac0085729631`.
  The production companion lifecycle then proved standalone Inventory plus
  Hagatha, Fomentius, Luthacus, and Shlorio each retained one scene-owned
  painted renderer with empty browser/request/response/WebGL-error arrays;
  receipt SHA-256 is
  `046a760a50da7a3e62365d67eb6cfc385afef8e2259cf117b21ae494bd3c3569`.
- The first full exact-source Mac gate passed: Release backend build with zero
  warnings/errors, 19 backend contracts, lint with nine pre-existing warnings
  and zero errors, frontend groups including native UI and Hub UI `92/92`, the
  338-test prerequisite set and 1,749-test broad Boneyard set, desktop `4/4`,
  production frontend/game-host builds, bundle budget (`263,673` raw / `80,226`
  gzip), and media policy. Pre-receipt gate log SHA-256 is
  `d34eed140e8afd72201db59aa13c530a4fda147def29a4ac8c1a0489d7e09a22`.
- Initial Mac `tsc` did not run through an inherited empty dependency symlink;
  a clean task-local `npm ci` corrected the environment. Two early Boneyard
  attempts proved the seeded scene was still input-blocked; scoping the journey
  to the ready/unblocked Boneyard owner closed the harness race. A later full
  trader run passed the relevant all-service renderer checkpoint before its
  unrelated funding phase requested an optional Lua runtime; the maintained
  lifecycle-only run above ended cleanly at the in-system boundary. None of
  these harness corrections changed product behavior.
- This tracked receipt is the only edit after the passing full gate. A
  no-later-edit exact-tree Mac gate is the final handoff gate. Publication and
  deployment were not requested and were not performed. No member is
  browser-blocked and no material in-system unknown remains.

## 2026-08-28 — Assigned wizard class-title secondary-report reopening

### Reported smell and parity question

- A player reports that InventoryScreen's top-left wizard identity prints raw
  pairs such as `AIR ARCANE` or `ETHER BODY`, while stock assigns one title to
  each element/discipline combination.
- This reopens the page-0 identity row below, which was called
  `verified-already-at-parity`. The skipped rule was to follow the renderer's
  direct native callee: the 2026-08-28 implementation reconstructed a label
  from the two web enum names even though `InventoryScreen` calls the shared
  class-title lookup and the complete lookup had already been extracted for
  Hall of Fame.
- The report recalls examples including Gypsy, Astronomer, and Clairvoyant.
  Those recollections are falsifiers, not source data: the byte-verified retail
  title table and executable string census must decide the shipped names.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same executable and canonical analyzed program as the existing Hall and Inventory ledgers. | high |
| Instructions and complete static table | `WizardClassTitle 0x00658B40` | Element ids `0..4` are Ether, Fire, Air, Water, Earth; discipline ids `5..7` are Body, Mind, Arcane. The function returns all 15 titles enumerated below and `WIZARD` only for an invalid pair. | high |
| Complete xref sweep | all references to `0x00658B40` in canonical Ghidra program `SolomonDark.exe` | Exactly two native consumers exist: `InventoryScreen::Render 0x00562520` at `0x00562C51` and Hall loading `0x005A13A0` at `0x005A1B46`. | high |
| Inventory instructions | `0x00562C2A..0x00562DB3`; format string `Level %d\n%s` at `0x00795144` | Inventory reads the live wizard's element at `+0x82C`, discipline at `+0x830`, and level at `+0x30`; calls the lookup; formats the level and assigned title as one two-line string; and draws it with medium Fonts group 1 at `Fonts + 0x4D530`. | high |
| Executable string census | retail file offsets `0x39EA00..0x39EAA8` | The contiguous authored bank is `WIZARD`, then the exact 15 strings below. `GYPSY` and `CLAIRVOYANT` are absent. `ASTRONOMER` occurs only as RTTI for the separate Courtyard ambient class; the wizard title is `ASTROLOGER`. | high |
| Current web causal trace | Website base `213d34d6`; `hub-inventory-renderer.ts`, `hall-of-fame.ts`, `HallOfFameScene.tsx`, `PlayerCardDialog.tsx`, and `hub-npc-dialogue.ts` | Hall, the Website player-card extension, and memorial inspection consume the extracted table, but Inventory page 0 bypasses it and paints ``${element.toUpperCase()} ${discipline.toUpperCase()}``. The table is incorrectly owned by the Hall module rather than shared wizard identity. | high |

The instruction queries used the canonical read-only replica workflow and the
existing Mod Loader checkout only as tooling: tool revision
`08bfba9ef367f7b863848030d0a289dc31e33192`, wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`,
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
and `refs_to_addr_decompile.py` SHA-256
`c6844b842ccd87aa70d290ae34553d874a8f90866eb234425f7c51fd8a438c4b`.

### System boundary and membership inventory

Native system: the pure wizard class-title lookup from a valid creation
element and discipline, plus every native and Website presentation surface
that claims to show that assigned title.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether + Body = `SAGE` | `0x00658B40`, ids `0/5` | `exact-ported` | complete shared-table assertion |
| Ether + Mind = `SEER` | `0x00658B40`, ids `0/6` | `exact-ported` | complete shared-table assertion |
| Ether + Arcane = `OCCULTIST` | `0x00658B40`, ids `0/7` | `exact-ported` | complete shared-table assertion |
| Fire + Body = `WARLOCK` | `0x00658B40`, ids `1/5` | `exact-ported` | complete shared-table assertion |
| Fire + Mind = `PYROMANCER` | `0x00658B40`, ids `1/6` | `exact-ported` | complete shared-table assertion |
| Fire + Arcane = `FIRE MAGE` | `0x00658B40`, ids `1/7` | `exact-ported` | complete shared-table assertion |
| Air + Body = `STORMCALLER` | `0x00658B40`, ids `2/5` | `exact-ported` | complete shared-table assertion |
| Air + Mind = `ASTROLOGER` | `0x00658B40`, ids `2/6` | `exact-ported` | complete shared-table assertion |
| Air + Arcane = `STORM MAGE` | `0x00658B40`, ids `2/7` | `exact-ported` | complete shared-table assertion |
| Water + Body = `ICEBINDER` | `0x00658B40`, ids `3/5` | `exact-ported` | complete shared-table assertion |
| Water + Mind = `THAUMATURGE` | `0x00658B40`, ids `3/6` | `exact-ported` | complete shared-table assertion |
| Water + Arcane = `FROST MAGE` | `0x00658B40`, ids `3/7` | `exact-ported` | complete shared-table assertion |
| Earth + Body = `RITUALIST` | `0x00658B40`, ids `4/5` | `exact-ported` | complete shared-table assertion |
| Earth + Mind = `CHANNELER` | `0x00658B40`, ids `4/6` | `exact-ported` | complete shared-table assertion |
| Earth + Arcane = `EARTH MAGE` | `0x00658B40`, ids `4/7` | `exact-ported` | complete shared-table assertion |
| Invalid-pair `WIZARD` fallback | final branch of `0x00658B40` | `out-of-system` — Website character configuration is strictly decoded to the five elements and three disciplines before presentation | type/codec coverage retains the closed domain; no invented fallback title |
| InventoryScreen page-0 identity | `0x00562520`, xref `0x00562C51`, `Level %d\n%s` | `exact-ported` by this corrective pass | Air/Arcane and Ether/Body identity assertions plus real Inventory browser capture |
| Hall of Fame row title | `0x005A13A0`, xref `0x005A1B46`; row renderer `0x005A2C80` | `verified-already-at-parity` | existing populated-row and complete-table coverage, now using the shared owner |
| Website player-card class | Website social extension | `exact-ported` extension | same shared lookup; no second title table |
| Website memorial-inspection class | Website social/memorial extension | `exact-ported` extension | same shared lookup; no Hall-owned wrapper |
| Create element/discipline selectors | no lookup xref in Create | `out-of-system` — this is the input surface for the two components, before an assigned-title consumer | Create continues to expose the actual choices |
| Native save-transfer preview | Website import/export extension | `out-of-system` — intentionally reports serialized component values, not a stock class-title surface | no change to portability diagnostics |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- Creation and save state own the element/discipline pair. The lookup is pure,
  immutable, and has no clock, random, audio, input, destruction, or teardown
  state. All consumers derive the title when rendering; no title is serialized
  or replicated separately.
- InventoryScreen and Hall are the only native xrefs. Inventory uses one
  newline-separated `Level %d\n%s` medium-font value; Hall uses the same title
  in its row-specific `Level %d %s` string. Raw component names are never a
  class-title fallback for a valid retail wizard.
- Website authority already replicates the same typed character configuration
  to Inventory, Hall records, and player cards. The correction is therefore a
  shared presentation lookup, not a protocol, save, or host-state change.
- The top-left Inventory page geometry, clipping, tint, medium font, and
  16-pixel native line height were already correct. Only the content owner was
  wrong; replacing it must not disturb the three-page SwipePages lifecycle.

### Nearby-system findings

- The player's examples correctly identify the kind of missing feature but do
  not match retail 0.72.5 data. In particular, `ASTRONOMER` names a Courtyard
  ambient class; `ASTROLOGER` is the shipped Air/Mind wizard title. Adding
  Gypsy, Astronomer, or Clairvoyant would create a new table rather than restore
  stock behavior.
- Housing the table under Hall of Fame allowed the later Inventory port to miss
  it. Assigned wizard identity belongs in a shared core kernel consumed by Hall,
  Inventory, and explicit Website extensions.

### Web implementation consequence

- Move the complete exact-uppercase table and lookup into a shared
  `native-wizard-class.ts` owner. Delete the Hall-owned duplicate and wrapper;
  all class-title consumers import the shared function directly.
- Make Inventory page 0 build the exact two-line `LEVEL <n>\n<TITLE>` value
  through a tested render-contract function and submit it as one medium-font
  text node. Remove the raw element/discipline label path completely.
- Preserve Create and save-transfer component labels because they do not claim
  to be assigned-title consumers.

### Validation contract

- Exhaustively assert every one of the 15 table rows and the two reported
  combinations: Air/Arcane must be `STORM MAGE`; Ether/Body must be `SAGE`.
- Assert Inventory's exact multiline value, medium-font line geometry, and no
  raw component fallback; retain Hall populated-row coverage and player-card
  type coverage through the same shared import.
- On the Mac mini, run focused native-UI and Hall suites, the canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, and a real production-bundle
  Chrome journey from Create into Hub Inventory. The capture must visibly show
  the assigned title and return empty page, console, failed-response, WebGL,
  and host-error arrays.

### Implementation validation receipt

- `native-wizard-class.ts` now owns the exact uppercase 15-row table and the
  single typed lookup. Hall, Inventory, player cards, and memorial inspection
  consume that owner directly; the Hall-owned table/wrapper and Inventory's raw
  element/discipline concatenation were removed. Inventory submits one
  `LEVEL <n>\n<TITLE>` medium-font node at the existing native baseline, so the
  default 16-pixel group-1 line height preserves the recovered geometry.
- The Mac red pass failed exactly at the two new seams: Hall could not resolve
  `native-wizard-class.ts`, and native UI could not import
  `hubInventoryWizardIdentityText`. After implementation, focused Mac suites
  passed Hall `36/36`, native UI `55/55`, and Hub UI `80/80`. The complete
  table assertion covers every authored row; focused Inventory assertions pin
  Air/Arcane to `LEVEL 7\nSTORM MAGE` and Ether/Body to `LEVEL 3\nSAGE`.
- The first canonical run encountered one transient failure in the broad
  1,684-test Boneyard process after 1,683 siblings passed. The unchanged exact
  suite immediately reran `1,684/1,684`; no product edit was made. A clean
  second canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` then passed:
  28 backend contracts, lint with 17 existing warnings and zero errors, every
  frontend suite including Hall `36/36` and Hub UI `80/80`, desktop `5/5`,
  Release backend and production frontend/game-host builds, bundle budget, and
  media policy. The production Game entry was 262,618 raw / 79,651 gzip bytes
  under 524,288 / 134,144. Pre-receipt full-gate log SHA-256 was
  `37e131c19d24b81958b1b1f03de0342cc8947c47b382fb329575207c71e80c8a`.
  The final post-receipt run uses this exact documented tree as its candidate.
- A real Mac Chrome journey used the built production bundle and built
  authoritative host, selected Air then Arcane through Create, entered the
  Hub, and opened settled Inventory. Visual inspection shows `STORM MAGE`
  directly below `LEVEL 1`; no raw `AIR ARCANE` label remains. Page errors,
  console errors, failed responses, request failures, WebGL context losses, and
  structured host errors were all empty. Full-stage and identity-crop SHA-256
  values were `086fedae458cde24bc485667260bafad293b898f3d123b85bf2baff4d354bc8c`
  and `21d5e4be8c6745ab02c39e1ac14498c71a4006d67f7b92c2c65b9b414821bac3`.
- No protocol, save-schema, authority, timing, input, or platform adaptation was
  required. No material in-system unknown or `blocked-by-platform` member
  remains.

## Reported smell and parity question

- Reported web behavior: Gold piles appear capped at 8 while Gold Charm is
  owned; owned charms cannot be removed; a secondary cannot begin while the
  primary button is held; the arrows beneath STATS do not change the page; and
  Luthacus does not retain carried potion bottles after Game Over.
- This reopens three ledger entries previously called exact: native loot,
  category-2 input/action ownership, and the common InventoryScreen. The earlier
  inventory pass stopped at the initially visible STATS slice and Hagatha's
  service-only owned-perk pane instead of enumerating the enclosing SwipePages
  owner. The earlier secondary pass mapped native `PlayerWizard+0x1EC` to the
  broader web primary-action predicate without proving the field equivalence.
  The completed-run entry intentionally retained a Website-only no-carried-item
  policy which this report now supersedes.
- Two reports are explicit product requests rather than stock behavior. Retail
  gives the gold tier-3 actor one art family for every amount at least 8, and
  retail provides no owned-perk removal writer or action. The Website must keep
  the native amount formula and disclose the visual-tier fact, while adding the
  requested no-refund perk removal as a named web extension.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | same executable and canonical analyzed project as the established loot, Hub, input, and Game Over reports | high |
| Gold instructions | `Arena_CreateGold 0x0046AA90`; arena level writers `0x00465149`, `0x00465C6C`, `0x0046E0C7`, `0x005091BA`; `Skills_FinalizePass 0x0067C421/0x0067C65A` | sentinel amount uses live Arena wave ordinal; Gold Charm multiplies final amount by float32 1.25 and candidate bound by 0.75; tier 3 begins at amount 8 but does not cap the amount | high |
| Hagatha writer census | `ActorProgression_ApplyHagathaPerk 0x0066EF70`; writes to `+0x7C4/+0x7CC`; `InventoryScreen::PointerRelease 0x0056FC90`; renderer `0x00562520` | the sole active flag writer sets `+0x7CC+selector` to one; the only zeroing owner is fresh progression construction. Owned cells build HoverBox state only. Click, double-click, and drag leave the Gold Charm row and flag intact. Retail has no removal action | high |
| Secondary input instructions | `Game_BeltActivate 0x005D5600`; PlayerWizard secondary dispatcher `0x0054CC50`; browser-input native report `0x00429820/0x00548B00` | category-2 activation checks Game input seal `+0x1ABE`, PlayerWizard no-interrupt byte `+0x1EC`, common cooldown `Skills+0x64`, and row cooldown `Skill+0x64`. It does not read the primary action at PlayerWizard `+0x270` or the primary held level. Left and right levels remain independent | high |
| Inventory static instructions | `InventoryScreen` ctor `0x00560380`, common rebuild `0x00555810`, STATS renderer `0x00562520`, `SwipePages` vtable `0x0079457C`, pointer down/move/up `0x00431C80/0x0043A1E0/0x00431DA0`, wheel/page step `0x00431E60`, owned-perk hover tail `0x005707A8..0x00570A6D` | STATS is one clipped 320 by 320 viewport over 960 pixels of content, exactly three 320-pixel pages. Wheel and a pointer drag over ten pixels change pages; the gold triangles are painter-owned indicators with no native click callback | high |
| Injected supporting observation | task-owned temporary-profile retail process PID 7000, staged retail hash above, loader Lua exec plus real Win32 input; no production/profile data | live InventoryScreen at `DAT_00819E58` measured viewport `[50,89,320,320]`, content height 960, page step 320, and settled offsets 0/320/640. Clicking the down indicator left offset zero; dragging upward changed 0 to 320 and then 640. Page 1 showed ATTRIBUTES and RESISTANCES; page 2 showed CHARMS/CURSES. Adding selector 4 through the known native apply helper painted its exact icon; click, double activation, and drag did not remove it | high for state/geometry, supporting rather than clean-stock evidence because the loader was injected |
| Existing clean capture | `tests/fixtures/webgame/menu-reference-captures/inventory-screen.png`, SHA-256 `0d99c6bb3f1815aa061fd4ee49e7bfccbd0ee058ea69b0e8936155c7e5156d8b` | page 0 at settled offset zero shows identity, primary spell, melee damage, and the down indicator | high |
| Temporary page captures | task-owned screen captures `/tmp/solomon-stats.StB1cx/page1.png` SHA-256 `296cef38e74c0bd227b01077e3b4df31df9309617097e6f5b47028d4cb11fa01`, `page2.png` `70a05b33d790556266b8e3ec0141c528023860912b8a1af038939a086c367fc1`, and `page2-charm.png` `fc040e2501db7326aa5b6d2f4f8fd6b1faf60661669d5eabe65f258a9b8dfe63` | page 1 exact labels are HEALTH, MANA, CAST SPEED, WALK SPEED, PAIN, MAGIC, POISON; page 2 is the nine-cell owned-perk pane plus DRINK TONIC | medium for durable appearance until replaced by task-owned Mac/clean-stock acceptance evidence |
| Completed-run instructions | `GameOver::Tick 0x005CF4F0 -> 0x005C9670 -> 0x005BE320`; `Player+0x1C0`, inventory `Gameplay+0x13B8`, seven equipment sinks `+0x1410`, Last Word `Skills+0x7D8` | an unconsumed corpse transfers every eligible equipped object and backpack root, including both potion subtypes, into one named Sack in Luthacus profile storage. Last Word independently adds ground Sacks/Gold. Fresh starter loadout construction is downstream and separate | high |
| Web baseline | Website `origin/main` `a24bb5d0` | Gold formula and amount credit are already exact, but no wave-boundary integration receipt exists; owned-perk actions only inspect; `castAbility` rejects `playerPrimaryCastOwnsFacing`; STATS hardcodes page 0; durable Game Over calls `transferCarriedItems: false` while explicit New Game retirement uses true | high |

The temporary native process and its exact staged executable were stopped after
the bounded probe. No user save, shared runtime, or production process was used.

## System boundary and membership inventory

Native/web systems: Gold selection/materialization through pickup credit;
participant-owned Hagatha outcome list and its requested web removal edge;
independent primary/right-belt levels through secondary action takeover;
InventoryScreen's complete three-page STATS viewport; and completed-run carried
item archival through Luthacus storage and fresh-run replacement.

### Gold amount and presentation

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| sentinel level formula at waves 0..3 | `0x0046AA90`, Arena `+0x8FF0` | `verified-already-at-parity`; visual report explained | exact distributions; Gold Charm maximum is 7 at levels 0/1 and 8 at levels 2/3 |
| wave 4 and later sentinel totals | same | `verified-already-at-parity`, browser proof required | deterministic charmed total greater than 8 at wave 4 and later |
| Gold Charm quantity/chance | `0x0067C421/0x0067C65A` | `verified-already-at-parity` | owner modifier is float32 1.25/0.75 and survives Hub-to-run transition |
| equipment `FX_GOLDBONUS` composition | Gold `+0xC0` consumer | `verified-already-at-parity` | equipment factor composes before truncation without replacing Charm |
| explicit Goodie/script Gold | same spawner, explicit amount | `verified-already-at-parity` | multiplier, chunk total, and randomization stay exact |
| actor amounts 1..25 | Gold type 2012 `+0x140` | `verified-already-at-parity` | amount and pickup text/credit retain the full integer |
| art tiers 0/1/2/3 | `0x0060FFE0`, thresholds `<3/<5/<8/else` | `verified-already-at-parity` | amounts 8..25 intentionally share tier-3 art; no invented larger pile sprite |
| multiplayer roll/pickup authority | host roll plus first valid retirement | `verified-already-at-parity` | selected amount is authoritative; collector alone receives exact credit |

There is no native or web integer cap at 8. The predicted visible difference
the reporter noticed is stock behavior: the pile sprite stops increasing after
tier 3 even while amount/text/credit continue above 8.

### Hagatha ownership and requested removal

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| selectors 0..26 ordinary ownership | `+0x7C0/+0x7C4`, flags `+0x7CC+selector` | `verified-already-at-parity` for purchase; `out-of-system` for stock removal | unique ordered row, capacity, save, replication |
| selector 27 Tonic, at most two | same list plus capacity `+0x800` | corrected by the 2026-08-30 Hagatha reopening; not removable by the extension | both Tonic rows remain visible and count within total capacity 3/6/9, leaving seven ordinary cells after two Tonics |
| owned pane, nine row-major cells | `0x00562520`, `0x0056FC90` | `exact-ported` in Hagatha service; missing from standalone page 2 | icon `Skills[127+selector]`, hover detail, empty cells |
| first-mix history | profile first-mix bytes | requested extension preserves it | removed selector returns as a base-price offer, never a new triple-price first mix |
| derived/status charms and curses | complete 0..26 effect matrix | requested extension deactivates ongoing ownership and refreshes shared derived state | one regression per selector family |
| Cheat Death / Serendipity / Reverie runtime | selectors 7/24/25 | requested extension clears retained one-shot/until-hurt runtime on removal | no orphaned charge or active multiplier |
| Revelation and Weird Caster acquisition | selectors 6/14 | first-purchase side effects remain historical | remove/rebuy cannot repeatedly raise ranks or grant multiple secondaries |
| Split Mind | selector 21 | shared refresh drops concentration slot B on removal | no inaccessible second concentration survives |
| Last Word | selector 12 | ownership removed only in Hub/Inventory state | later deaths do not burst/archive through a removed charm |
| refund | no retail producer | owner-directed policy: none | gold unchanged by removal |
| participant/network ownership | existing host action seam | requested extension is host-authoritative and participant-private | another participant remains byte-for-byte unchanged |

### Overlapping primary and secondary casting

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| browser left/right simultaneous levels | native input report, `mousedown/up` | `verified-already-at-parity` | second button edge survives while first remains held |
| Game input seal | `Game+0x1ABE` | `verified-already-at-parity` | pause/modal/transition still blocks both lanes |
| native no-interrupt byte | `PlayerWizard+0x1EC` | `verified-already-at-parity` through general eligibility, not the primary action | no reintroduction of an active-primary guard |
| common and row cooldowns | `Skills+0x64`, row `+0x64` | `verified-already-at-parity` | unchanged silent/common and fizzle/private rejection branches |
| all 23 category-2 IDs `11,12,15,21,23,27,30,35,41,45,46,48,49,50,51,54,72,73,74,76,77,78,79` | dispatcher `0x0054CC50` | `exact-ported` after removing the disproven web-only primary guard | every row accepts from the same active-primary starting state when its own prerequisites pass |
| ordinary StaffCast2 rows | action callback | `verified-already-at-parity` after activation | secondary takeover suppresses primary output during occupancy, then held primary may resume |
| Dampen CastSpin | skill 21 | `verified-already-at-parity` | specialized spin takeover remains |
| Firewalker/Mindstar/Regenerate and other actionless state branches | dispatcher switches | `verified-already-at-parity` | toggle transition may coexist with the held primary without invented StaffCast |
| Planewalker/Plane Orb | dispatcher/modifier primary override | `verified-already-at-parity` | native override still owns the primary after accepted activation |

### InventoryScreen SwipePages

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone left viewport `[50,89,320,320]` | InventoryScreen/SwipePages | `exact-ported` after this pass | hard clipping and page-local painter order |
| companion viewport `[103,89,320,320]` | same owner shifted 53 right | `exact-ported` for ordinary companions | same pages/inputs beneath Fomentius, Luthacus, and Shlorio |
| Hagatha companion replacement | PerkShop | `verified-already-at-parity` | fixed CHARMS/CURSES pane remains, no nested scroller |
| page 0 identity/level/discipline | `LEVEL/NEXTLEVEL` rows | `verified-already-at-parity` | exact visible page retained |
| page 0 primary spell | `DAMAGETYPE/DAMAGE/MANACOST/MANARECOVERY` | `verified-already-at-parity` | current selected primary output retained |
| page 0 melee | `MELEEDAMAGE` | `verified-already-at-parity` | native range/unit retained |
| page 1 attributes | `HP/MANA`, derived cast/walk speed | missing | current/max values and derived percentages |
| page 1 resistances | `RESISTDAMAGE/RESISTMAGIC/RESISTPOISON` | missing | pain/magic/poison percentages from authoritative derived state |
| page 2 ordinary owned selectors and empty cells | progression list/count | missing from standalone/ordinary companion | nine row-major cells, icon/hover membership |
| page 2 DRINK TONIC decoration | renderer data/atlas | missing | exact text/art remains non-transactional |
| drag threshold and capture | `0x00431C80/0x0043A1E0/0x00431DA0` | missing | more than 10 pixels, pointer capture, bounded page snap |
| wheel step | `0x00431E60` | missing | one 320-pixel page per signed wheel action |
| up/down indicators | Inventory record 13 inside content | painter missing beyond first pair | exact visibility at page boundaries |
| indicator click | no retail control/hit callback; live click no-op | owner-directed Website extension | click changes exactly one page and remains keyboard/touch accessible |
| close, Sack navigation, service replacement, teardown | InventoryScreen owner | `verified-already-at-parity`, regression expanded | page input/state does not leak across unrelated surface owners |

### Completed-run Luthacus archival

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Health and Mana Potion roots | backpack `+0x13B8` | missing at terminal Game Over | both bottles enter the retained Sack exactly once |
| other Potion subtypes and stack quantity | common item tree | missing at terminal Game Over | identity/quantity preserved |
| seven equipment sinks | Gameplay `+0x1410`, marker `item+0x58` | missing at terminal Game Over | every eligible occupied sink transfers |
| arbitrary backpack items, nested/empty Sacks | common inventory tree | missing at terminal Game Over | exact recursive object identity, no flattening except existing replication-depth packing policy |
| consumed-corpse branch | Player `+0x1C0` through `SETZ` | existing web model has no corpse-consumption producer | `out-of-system` until Ether Drain corpse consumption exists; ordinary web death uses unconsumed branch |
| Last Word ground Sacks/Gold | selector 12 | `verified-already-at-parity` | composes with carried archive into one retirement outcome |
| one of five retained Sack suffixes | `Integer(5)` | `verified-already-at-parity` | exact RNG and name |
| empty archive | `0x005BE320` | `verified-already-at-parity` | no empty Sack |
| 28-root storage boundary | profile `+0x8C` | existing bounded consolidation policy retained | no loss or invalid tree |
| fresh starter equipment/potions | `0x005CFA80` | `verified-already-at-parity` | active loadout is fresh and archived objects remain storage-only |
| pre-existing storage and persistent profile state | durable profile | `verified-already-at-parity` | storage appends/consolidates without resetting gold/perks/unforge/NPC flags |
| explicit Kill/New Game retirement | existing true branch | `verified-already-at-parity` | continues to scavenge carried bottles/equipment |
| terminal Game Over profile checkpoint | existing false branch | missing; prior Website-only policy superseded by this report | now uses the same native carried-item archive owner |
| multiplayer participants | one economy/profile per player | missing terminal matrix | each completed participant receives only that participant's carried tree |

No native member is blocked by the browser platform. The two deliberate web
extensions are removable ordinary perks and clickable page indicators; both are
explicitly user-directed and do not replace the recovered native drag/wheel or
purchase/archive contracts.

## Native ownership thread

- Gold: Arena wave ordinal `+0x8FF0` and finalized progression Gold scalar
  `+0xC0` produce the integer total. The actor retains the amount independently
  from its four-row art tier, so appearance cannot be used as an amount meter.
- Perks: progression owns the ordered selector list, capacity, flags, and
  first-mix state. Retail creates only an apply edge and an owned-cell HoverBox.
  The requested removal therefore belongs beside `buyHagathaPerk` and must
  refresh the same authoritative player state, not delete a renderer icon.
- Casting: device levels are independent. Belt activation reaches the category
  switch before primary dispatch for the tick; accepted secondary action state
  then owns any primary suppression/override. An active primary is not an
  activation prerequisite or rejection state.
- STATS: InventoryScreen owns one nested SwipePages object. It clips and offsets
  three authored 320-pixel pages; input changes that owner state, while the gold
  triangles only report whether another page exists.
- Scavenging: completed-run processor owns both ordinary carried transfer and
  Last Word ground recovery before fresh starter construction. Luthacus stores
  the resulting named Sack as participant-private durable profile data.

## Web implementation consequence

- Keep `native-loot.ts` amount/tier behavior. Add wave-boundary regression and
  browser receipts which distinguish tier-3 appearance from amount/text/credit.
- Add `remove-hagatha` as a strict host action for ordinary selectors only.
  Preserve first-mix history and gold, clear ongoing runtime state, suppress
  repeat irreversible acquisition grants, and refresh all derived consumers.
- Delete only the `playerPrimaryCastOwnsFacing` activation guard. Preserve
  secondary-owned StaffCast2/CastSpin/Planewalker primary takeover after an
  accepted cast.
- Add the three-page stats state to the shared InventoryScreen model, replicate
  the four missing derived percentages, render pages 1/2 under a hard clip, and
  expose native drag/wheel plus requested arrow actions across standalone and
  ordinary companion screens.
- Change the durable completed-run profile path to transfer carried items. Do
  not inject archived contents into the fresh active backpack.

## Validation contract

- Gold: deterministic level 2/3 maximum 8 and level 4 maximum 10 with Charm;
  amount 10 must retain tier 3, pickup text `10 GOLD`, and exact credit.
- Perks: remove every ordinary effect family, reject Tonic/unknown/unowned
  removal, preserve first-mix price/history and gold, prevent repeat Revelation/
  Weird Caster grants, clear runtime one-shots, drop Split Mind slot B, and
  prove participant isolation plus save round trip.
- Casting: left/right input overlap plus all 23 category-2 rows from both a
  sustained and one-shot primary state; ordinary/special takeover and resume;
  unchanged cooldown, fizzle, mana, audio, facing, and teardown.
- STATS: page values 0/1/2, exact 320/960 geometry, clipped visibility, every
  label/value row, wheel/drag/click/keyboard/touch bounds, standalone plus all
  companion families, Hagatha replacement, close/reopen/reset, and no stale
  pointer capture.
- Scavenging: both starter bottles, every equipment sink, mixed backpack,
  nested/empty Sacks, existing storage, Last Word composition, empty archive,
  28-root boundary, fresh active starters, save hydration, and two participants.
- The exact Website candidate must pass
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini, followed by a
  real Mac Chrome production-bundle journey with empty page, console,
  failed-response, WebGL-context, wire, and host-error arrays. Mod Loader is a
  read-only RE instrument and is not a parity validation or publication target.

## Implementation validation receipt

- Gold generation required no formula patch: the existing selector already
  retained the full integer independently of its four art tiers. The focused
  regression now pins charmed maxima `8/8/10` at waves `2/3/4`; the production
  browser materialized the wave-4 amount `10`, retained tier-3 art, displayed
  `10 GOLD`, and credited ten.
- Requested perk removal is an authoritative `remove-hagatha` action for
  selectors `0..26`; Tonic `27`, unknown, and unowned rows reject. Removal
  preserves gold and first-mix history, refreshes all derived consumers, clears
  Cheat Death/Serendipity/Reverie runtime, drops Split Mind slot B, and prevents
  Revelation or Weird Caster acquisition grants from repeating on repurchase.
- Secondary admission no longer widens native `PlayerWizard+0x1EC` with the
  primary-facing predicate. All 23 category-2 rows pass from both one-shot and
  sustained primary states. Mac Chrome admitted Ring of Ice while the Fire
  primary remained held, then retained ordinary cooldown, mana, Cast2, audio,
  VFX, and primary-handoff behavior.
- InventoryScreen now owns one clipped `320 x 320` viewport over three
  `320`-pixel pages. Page 1 renders authoritative Health, Mana, Cast Speed,
  Walk Speed, Pain, Magic, and Poison values; page 2 renders the nine-cell
  charms/curses pane. Native drag/wheel and the requested clickable arrow
  actions share the same bounded page owner. Browser proof traversed
  `0 -> 1 -> 2 -> 1 -> 0`, removed Life Charm without a refund, and reopened
  on page 0. The full-stage deselection hit target was moved below the stats
  interaction layer after the first browser run proved it intercepted arrows.
- Completed Boneyard Game Over now enables carried transfer only at the
  completed-run boundary. Each of two participants received one durable named
  Luthacus Sack containing Hat, Robe, Staff, Health Potion, and Mana Potion,
  while the new active wizard separately received fresh starter equipment and
  bottles. The real Luthacus screen transferred and opened that archived Sack
  without flattening or cross-participant leakage.
- Runtime candidate `b13e52da` passed the complete Mac mini Website gate after
  rebasing onto `772f91bc`; log SHA-256
  `e697540fc71d160710302e11634139da69a007a60e6f4002466170c9df770a0c`.
  The later `d6fb96e2` integration changed Website RE documentation only.
  Documentation-rebased candidate `94d3e8bb` passed the single four-stage
  production-bundle Chrome `151.0.7922.174` journey; log SHA-256
  `0b97413c3531fc3f60a32633333d5490d9ee91e1147f62e740a0c14bb1bb115e`.
  Page, console, failed-response, WebGL, wire, and host error arrays were empty.
- Representative inspected Mac frames are stats attributes
  `7d9dd324734f5c806d07b93119a139c3a4031a79ecb150269c99e3f17372fd37`,
  stats perks `47b91b6dcde8fe7857134388db12ac07ed78935b2cfecd1d72ef8537aaf80c38`,
  removed charm `127e34ddb064d07ee37d62fff13c572360e4fb5f17c74af0b100cc6832582e22`,
  overlapping Ring of Ice
  `291bd7fade8335aab08645b19896845f105e575c099ff9293ef90478bf746c62`,
  visible loot `59c3f8482057ae933b7c6eb453f118ae96357be444045c1601787021cc73a8d6`,
  and opened Luthacus archive
  `c1a69717c593ff32b8d868fd938ab613af08b00e8e9c50a25cf88d9a6499b7a9`.
- No platform-blocked member or unresolved native unknown remains. The only
  intentional extensions are no-refund ordinary-perk removal and clickable
  stats arrows; retail itself provides neither action. Publication and
  deployment remain separate and were not requested.
