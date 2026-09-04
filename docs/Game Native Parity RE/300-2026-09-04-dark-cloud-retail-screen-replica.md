# 2026-09-04: Dark Cloud retail screen replica

The Website `/game` Dark Cloud was a Website-only composition that reused a
few stock records on a fluid CSS layout. This pass reverse engineers the retail
Dark Cloud browser screen from the stock captures, the layout dumps and the
decompiled render code, records the painter order and every measured constant,
and rebuilds the Website scene on the native UI kit as a fixed 1600 by 900
stage like every other native stage.

## Evidence

- Stock captures: `.codex-windows-validation/loader-audio-census-20260816/`
  `webgame-contracts/baseline-snapshots/menu-reference-captures/dark-cloud-*.png`
  (1600 by 900) with the matching `menu-layouts/dark-cloud-*.json` text rects.
- Stock atlas `SolomonDarkAbandonware/images/UI.png`; the Website copy is
  `frontend/src/assets/game/skill-picker-ui-atlas.png` with the record table in
  `frontend/src/assets/game/native-ui-assets.json` (`atlases.UI.records`).
- Decompilation: `Decompiled Game/reverse-engineering/pseudo-source/ui/`
  `00594FC0__DarkCloudBrowser_Render.c` and `005C3F40__UiPanel_Render.c`.
- Figure placement and mirror states were confirmed with a shade-compensated
  normalised cross correlation of each atlas record against the capture
  (raw absolute differences were meaningless under the stock vignette).

## Stock text rects (dark-cloud-browser.json)

| Text | Rect (x0, y0, x1, y1) |
| --- | --- |
| THE DARK CLOUD | 747, 22, 1000, 52 |
| beta | 1005, 35, 1066, 52 |
| You are signed in as a GUEST. | 742, 65, 997, 85 |
| To change this, click here. | 737, 86, 979, 105 |
| ONLINE LEVELS (selected tab) | 741, 155, 908, 175 |
| recent / my levels / multiplayer tabs | 498, 166, 593, 183 / 991, 166, 1119, 183 / 1140, 128, 1342, 197 |
| boneyard name / author / rating | 105, 223, 308, 240 / 1306, 223, 1371, 239 / 1431, 223, 1495, 239 |
| first row | 105, 285, 1495, 310 |
| PLAY / options | 764, 835, 836, 854 / 1058, 837, 1161, 853 |

## Painter order and constants

All coordinates are design pixels on the 1600 by 900 stage. `UI.n` is record
`n` of the UI atlas. Sprites use the kit convention that `mirrorX` places the
record by its right edge.

1. Clear to black.
2. Wall `UI.30` tiled across the full width on rows y 65 and y 800, 108 high.
3. Scroll columns `UI.33` at x -74 and x 1540, tiles at y 0, 267, 534, 801.
4. Figures: flourish `UI.29` at (63.5, 53.5) and mirrored with its right edge
   at 1536.5; tall wizard `UI.31` at (1488, 18) and at (-57, 765); short wizard
   `UI.32` mirrored with right edges at 104 (y 26.5) and 1644 (y 773.5).
   Correlations: bottom-left tall 0.952, bottom-right short mirrored 0.748,
   top-right tall 0.462, top-left short mirrored 0.234 (plain 0.027).
5. Shade: solid black band y 0 to 50, black to transparent gradient y 50 to
   150, and a 60 px glow around the list panel (55, 173, 1490, 627).
6. Chains: `UI.10` across y 158 from x 24 (pitch 106) and y 804 from x 39;
   `UI.79` down the right at x 1543 and mirrored on the left (right edge 57)
   from y 172, pitch 108, six links; all clipped to (0, 150, 1600, 650).
7. Stones `UI.107` to `UI.110` at (34.5, 153.5), (1480.5, 153.5),
   (34.5, 730.5), (1480.5, 730.5).
8. Frame: black fill (57, 175, 1487, 624); 1 px rules at offsets 0, 1, 2, 3,
   10, 11, 12, 13 from each edge (top and bottom `e5d2a4 e0c88f a38d55 6f603a
   0e0d0a ddcb9d d1b56e 6c5e38`, left and right `ddc589 ddc180 b99f60 96814e
   b09d6d d8bb75 a48d55 201c11`); gold corners `UI.17` at (55, 173),
   (1545, 173) mirrored X, (55, 800) mirrored Y and (1545, 800) mirrored both.
9. Leather `UI.49` tiled from (55, 173) with period 264, clipped to
   (75, 193, 1450, 587); then a black half-alpha header band (75, 193, 1450, 65).
10. Tabs from the shared `planNativeUiTabs` on the strip (460, 128, 882, 69):
    label baseline 181, scale 0.88, gold `d7b96f`, resting labels lowercase
    (small caps face), selected label uppercase.
11. Heading `THE DARK CLOUD` in the heading face, scale 1, baseline 50, centred
    on x 800; `beta` in the menu face at scale 0.9, x 1006, baseline 50.
12. Account lines in the menu face: line 1 scale 1.15 baseline 88, line 2
    scale 0.89 baseline 100, 2 px underline under `click here.` at
    (836, 103, 140, 2).
13. Column captions in the menu face at scale 0.87, baseline 238; the name
    column is left aligned at x 105, the others right aligned.
14. Rows in the menu face at scale 1 from y 260 with a 25 px pitch and the
    baseline 28 px below the row top (ink rows 11 to 29 of each pitch). Rows
    are gold; the selected row and status rows are green `96c596`.
15. Footer: Search (390, 818, 90, 52), Sort (495, 818, 90, 52), primary
    (623.5, 809.5, 353, 69) and Options (1017.5, 818, 185, 52), unchanged.

## Website composition

- `native-dark-cloud-contract.ts` gains `NATIVE_DARK_CLOUD_TEXT`,
  `NATIVE_DARK_CLOUD_COLUMNS`, `NATIVE_DARK_CLOUD_SCENE`, and the planners
  `planNativeDarkCloudBackdrop()` (steps 2 to 4 plus the side plates) and
  `planNativeDarkCloudFrame()` (steps 6 to 9). Both return plain
  `nativeUiPlan` fragments that `NativeUiPlanView` renders.
- `planNativeUiTabs` accepts `labelScale`, `labelTint`, `selectedLabel` and
  `selectedLabelTint` so the Dark Cloud tabs can use the stock lowercase
  resting labels without a second tab planner.
- `NativeDarkCloudPresentation.tsx` exposes `NativeDarkCloudSceneArt`
  (backdrop plan, CSS shade, frame plan), `NativeDarkCloudHeading`,
  `NativeDarkCloudTabs`, `NativeDarkCloudColumns`, `NativeDarkCloudRowCells`,
  `NativeDarkCloudStatusRow`, the tool and primary buttons and the panel art.
  `NativeDarkCloudListFrameArt` and the element-size scaling are gone.
- `DarkCloudScene.tsx` renders mods, subscribed mods and parties as bitmap
  text rows on the stock column anchors (name left 105; author or wizards
  right 1100; version or status right 1255; status or location right 1493).
  The Website columns differ from the retail boneyard browser because the
  Website lists mods and parties, not boneyards.
- `MainMenuScene.tsx` passes `nativeStageStyle` to the Dark Cloud stage, so
  the scene scales uniformly like the Hub and Boneyard stages.
- `dark-cloud.css` drops the fluid override and the phone media queries; the
  stage is always 1600 by 900 and scaled. The unused
  `assets/game/dark-cloud/stone-wall.png` is removed.
- The workbench (`/native-ui.html`, DOM components, DARK CLOUD tab) shows the
  full composition with sample rows for visual checks.

## Assumptions and open items

- Row pitch 25 and baseline offset 28 come from the first row rect and the
  green CREATE row ink (271 to 288) in the stock capture; the retail row
  stride was not read from code.
- The glow around the panel is approximated with CSS gradients and radial
  corners; the retail shade is a vertex-coloured quad.
- The frame rules are drawn as measured 1 px solids rather than a record; the
  retail frame may be a stretched record whose identity was not confirmed.
- Side plates `UI.20`, flourishes `UI.29` and the chain phases keep the
  earlier pixel decode; their correlations were inconclusive under shading.
- Phones now receive the uniformly scaled 1600 by 900 screen; it has not been
  checked on a physical phone and may be small.
- `frontend/tools/smoke-dark-cloud.mjs` (not in the gate) still targets
  `.dark-cloud-media-placeholder`, `.dark-cloud-row-actions button`,
  `.dark-cloud-party-status` and `.dark-cloud-party-location[title]`, which no
  longer exist on the list; `.dark-cloud-mod-row[data-mod-slug]`,
  `.dark-cloud-row-copy strong` and the `.dark-cloud-row-main` double click
  still work. The SUBSCRIBE action moved to the mod detail dialog.
- The live `/game` route was not captured here because the Dark Cloud needs a
  backend; the check was done on the workbench composition.
