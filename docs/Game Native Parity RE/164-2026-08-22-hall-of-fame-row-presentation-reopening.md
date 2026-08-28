# 2026-08-22 — Hall of Fame row presentation reopening

> Reopens the row-presentation members of
> [2026-08-20 — Hall of Fame, Website-global leaderboards, and reopened Memoratorium](118-2026-08-20-hall-of-fame-website-global-leaderboards-and-reopened-memoratorium.md).
> Request: "Enhance the look of the Hall of Fame rows. Show skill / perk icons
> with a little number on the bottom right corner of them like stock does.
> Just completely refactor it all and make it look hella nice but still using
> stock art assets and looks."

## Why this is a reopening, not a new system

The 2026-08-20 entry closed the Hall rows with `exact-ported` dispositions for
"three Highest Skills", "3-by-3 Perks Used", and the collapsed row while the
Website drew `S${skillId} · ${rank}` text inside bordered DOM cells, raw perk
selector numbers, DOM headings in `--font-heading`, a `▼/▶` glyph, and a
`scale(1.6 * portraitScale)` portrait. None of that came from
`HallOfFameBox::Render` (`0x005A2C80`): the pass extracted the data contract
(struct offsets, writers, ranking) and stopped before the draw contract. The
skipped rule is "extract the truth whenever extractable" — the render routine
is a single static function and a populated stock Hall is reachable in one
run, so the draw contract was extractable the whole time.

## Membership inventory

Unit of work: the native Hall row presentation (`HallOfFameBox::Render`,
`0x005A2C80`, plus its 9-slice helper `FUN_00417760`). Full contract:
`Mod Loader/docs/reverse-engineering/native-hall-of-fame-and-memoratorium.md`
§ "Hall row render contract (`0x005A2C80`)".

| # | Member | Native source | Disposition | Website port |
| --- | --- | --- | --- | --- |
| 1 | Box tile background (UI `49`, 264 px period, scrolls with content) | `0x005A2C80` prologue | exact-ported | `.hall-of-fame-tiles` layer inside the scroll content |
| 2 | Row highlight rect `(50, y-25, W-100, rowH-10 [+expH])` | row loop | exact-ported | `hallRowHighlightRect` kernel + `.hall-row-highlight` |
| 3 | Current-wizard gold fill `0.1 + 0.05 sin(tick*3°)` | row loop | exact-ported | CSS keyframe sampled from the kernel pulse (1.2 s) |
| 4 | Row frame 9-slice UI `17` (current `0.5 + 0.2 sin`, others `0.2`) | `FUN_00417760` | exact-ported | `HallNineSlice` (mirrored corners, 5 % edge strips) |
| 5 | Rank numeral, font 4, centered `(W/2-60, y+75)` | row loop | exact-ported | `HallBitmapText font="heading"` |
| 6 | Rank ornament UI `25`, center-anchored left of the numeral | row loop | exact-ported | `HallAtlasSprite` at `hallRankOrnamentCenter` |
| 7 | Wizard composite `1.25 * portraitScale` at `(W/2, y+88)` with element orb VFX | serialized wizard draw | exact-ported | `HallWizard` layers + `HallElementOrb` (DOM element VFX, 100 Hz) |
| 8 | Name, font 3, centered baseline `y+140` | row loop | exact-ported | `HallBitmapText font="menu"` |
| 9 | `LEVEL %d %s`, font 0, centered `y+155` | row loop | exact-ported (was wrong font) | `HallBitmapText font="body"` |
| 10 | `AWESOMENESS: %d`, font 0, centered `y+170` | row loop | exact-ported (was wrong font) | `HallBitmapText font="body"` |
| 11 | Expand chevron UI `9` at `(W/2 - eA/2 - 25, y+155)`, 90°/180°, click toggles | row loop | exact-ported | `hallChevronCenter` + `<button>` hotspot |
| 12 | `SURVIVAL`, `Time:`, `Wave:` labels and values, font 1 | expanded block | exact-ported | left-aligned `HallBitmapText font="medium"` |
| 13 | `HIGHEST SKILLS` label, font 1 | expanded block | exact-ported | same |
| 14 | Skill cell: tinted Skills `164` backplate → Skills `27+id` @0.9 → black α0.5 badge → white font-0 rank right-aligned at `(cellX+53, Y+22)` → Inventory `10` @0.8 frame; empty = frame only | expanded block | exact-ported (was text) | `HallSkillCell` |
| 15 | `PERKS USED` label, font 1, right-aligned at `W-100+px` | expanded block | exact-ported | right-aligned `HallBitmapText` |
| 16 | Perk cell 3×3: Inventory `10` @0.57 + Skills `127+selector` @0.7, no numeral | expanded block | exact-ported (was text) | `HallPerkCell` |
| 17 | Kills box: font-1 lines at `y_k`, `y_k+20`, font-3 name at `y_k+40`, 9-slice UI `50` α0.5 `(W/2-150+px, y_k-30, 300, 90)` | expanded block | exact-ported | `hallKillsBox` + `HallNineSlice` |
| 18 | `px` cascade `-10 → +10 → +25` on wide clients | expanded block | exact-ported | `HALL_PEN_X` constants |
| 19 | Separators: 2 px, `y = yCursor-50`, transparent outer → gold `(217,186,112)` center | row loop tail | exact-ported | `.hall-row-separator` linear gradients |
| 20 | Scroll: wheel, current row auto-scroll, expanded row kept in view | box tick | exact-ported | native DOM scroll + `scrollIntoView` on the current row |
| 21 | Current wizard (`DAT_00819ed8`) → pulse + default expanded | box load | exact-ported with a disclosed mapping: the Website's current wizard is the run this session just recorded (`currentRunId`), since the web has no persistent active-wizard slot | `currentRunId` prop from `MainMenuScene` |
| 22 | Narrow-client (`< 1280`) layout branch | `0x005A2C80` | out-of-system | unreachable: the Website stage is fixed at 1600 wide |
| 23 | Boast / story branch in the kills box | `0x005A2C80` | out-of-system | campaign data does not exist on the Website |
| 24 | Toggle sound | `0x005A2C80` | verified-already-at-parity | no sound call in the toggle path; the Website stays silent |
| 25 | Hall background (`hall-of-fame-background.png`) and Main Menu hotspot `(617.5, 809.5, 365, 85)` | 2026-08-20 closure | verified-already-at-parity | unchanged |
| 26 | Local / Global scope and four board tabs, loading / error / empty states | Website-only (2026-08-20) | out-of-system (kept) | restyled as stock bitmap-font tabs in the box header band |

## Evidence

| Evidence | Source |
| --- | --- |
| Stock captures (clean retail, PID 1856, 2026-08-22 19:43:56 → 20:01:58) | `C:\Users\User\AppData\Local\Temp\solomon-hall-20260822\02-menu.png`, `03-hall.png`, `04-hall-expanded.png`, `05-hall-expanded-b.png` (client crops in the session scratchpad `stock/`) |
| 9-slice UV constant `_DAT_007de96c = 0.95` | Ghidra headless dump, scratchpad `ghidra/dump_007de96c.log` |
| Draw order, constants, pen cascade | Ghidra decompile of `0x005A2C80` and `FUN_00417760` |
| Row 1 pixel probes (screen space) | highlight top 135; rank `1` ink 733–743 × 208–234; ornament 704–724 × 214–234; composite 774–869 × 174–253 with 1,723 ether-purple orb pixels at 831–869 × 179–239; name 731–866 × 284–300; LEVEL line 741–858 × 304–315; AWESOMENESS 722–873 × 319–330; chevron 688–707 × 306–323; separator 359–360 |
| Expanded probes | SURVIVAL 291–379 × 339–350; HIGHEST SKILLS 290–435 × 409–419; skill frames 292–347 / 352–407 / 412–467 × 430–484; PERKS USED right edge 1308; perk grid center (1248, 425); kills frame 675–974 × 378–467; Monsters Killed 736–911 × 396–408; awesomest name 752–895 × 427–448 |
| Tile period | mean abs diff 6.2 at dy = 264 vs 13.8 at dy = 263/265 |
| Font identification (corrected in pass 2) | `Level 3 SEER` is medium (group 1, font object `+0x4d530`): width 118, centered pen 740, ink 741–858 (glyph column 0 is the atlas gutter); `Awesomeness: 91` medium width 155, pen 722, ink 722–873. The pass-1 "body" attribution measured the all-capitals string against 113.5 body / 138.5 medium and is withdrawn. Exe strings `Level %d %s` (0x0079965c), `Awesomeness: %d` (0x0079964c), `Awesomest Kill:` (0x007996bc) |
| Text placement rule | per-glyph fits on 73 glyphs across 7 strings (`Level 3 SEER`, `Awesomeness: 91`, name, rank, `SURVIVAL`, `Monsters Killed`, `Awesomest Kill:`): pen = trunc(x − width/2) centered / x − width right / x left; quad left = round-half-up(pen + offX − w/2), top = round-half-up(y + offY − h/2); every quad on a whole pixel, constant +0.125 fit phase, no blur |
| Mirrored 9-slice texels | row-frame right-edge column profile [61, 61, 52, 48] = left edge [58, 61, 53, 45] mirrored and shifted +1 px; mirrored pieces show texel `w − j` at pixel `j` (`FUN_00417760`) |
| Sprite placement (box space, alpha-aware fit vs atlas art) | Stock sprite quads are not pixel-snapped: ornament 0° at 503.75/134.05 (nominal 503.5/134); chevron 90° at 488.25/224.05 (nominal 487.5/224), 180° at 487.30/225.85 (nominal 486.5/225), bilinear-soft edges. Submit path `FUN_00414540` → `TextQuad_Draw` → `FUN_00412d70` appends float corners verbatim (no rounding, no half-pixel correction). Web whole-pixel quads: 488–507 × 224–245 collapsed, 487–508 × 226–245 expanded (≤0.3 px from the fit) |
| Skill icon rule | `native-skill-catalog.json`: all 82 `skills_atlas_icon_record` values equal `27 + id` |
| One-shot scroll program (`box+0xDC/+0xE0`, 250/150 row constants, `sin(pi*t/180)` ease over 90 ticks, `_CIsin` + pi at `0x007de8a8` → `0x00b4027c`) | Ghidra headless: scratchpad `ghidra/decompile_00589DD0.log`, `disasm_00589DD0.log`, `dump_scroll_constants.log`, `dump_ease_constants.log`, `disasm_00747128.log`, `insns_004100d6.log`, `dump_pi.log` |

## Findings

1. The 2026-08-20 "exact-ported" dispositions for the skill and perk grids and
   the collapsed row were process failures: no draw contract had been
   extracted. Closed by this reopening.
2. The portrait scale `1.6 * portraitScale` had no native basis; the native
   composite draws at `1.25 * portraitScale` with the element orb VFX at the
   staff tip.
3. Withdrawn in pass 2: the row lines are `Level %d %s` (class in capitals)
   and `Awesomeness: %d` in font 1 (medium, mixed case). The pass-1 "font 0"
   claim came from measuring an all-capitals string; the medium widths
   (118 / 155) match the ink exactly once the blank gutter column is counted.
4. The kills-box line constant is `f60 = 50`, placing `y_k` at screen 408 and
   the frame at 378–467; the instruction-stream reading of 60 was wrong.
5. The separator gradients are bright at the center and fade outward.
6. The chevron is keyed to the measured width of the `AWESOMENESS` line, and
   the rank ornament is keyed to the measured width of the rank numeral.
7. The box scrolls exactly once, to the current wizard's row: the first
   render frame that draws it sets `box+0xDC = rowTop - H/4` (clamped to the
   extent), and the 100 Hz box tick eases `scroll = sin(t deg) * target` for
   `t = 0..89` (0.9 s). The expand toggle never writes the scroll; the
   earlier "eases so the expanded row stays in view" reading is withdrawn.
   The kernel carries this as `hallCurrentRowScrollTarget` / `hallScrollEase`
   and the scene runs it once per `currentRunId` on mount.
8. Native text placement is integer and crisp: `pen = trunc(x − width/2)`
   for centered strings, glyph quads at round-half-up of
   `pen + offX − w/2` / `y + offY − h/2`. The earlier web layout centred on
   half pixels and blurred every odd-width string; refuted by the 73-glyph
   fit (every stock quad on a whole pixel).
9. The 9-slice mirrored pieces sample texel `w − j` at pixel `j`, so the
   right and bottom pieces sit one pixel further out and never draw the
   glyph's blank gutter column / row (`HALL_MIRROR_SHIFT = 1`, container
   clipped to the rect). The "brighter row" under each separator is this
   frame inner line; the separator ramp itself already matched.
10. The native sprite pass does not snap: `FUN_00414ea0`/`FUN_00414f90`
    (scale / rotation matrix, 90° and 180° from `_DAT_00785d98`/`_DAT_00784738`)
    transform the stored corners as floats and `FUN_00412d70` appends them
    verbatim, and the captures confirm fractional, bilinear-soft quads
    (+0.25 px unrotated, ≈+0.75 px x for the rotated chevron, ≈+0.85 px y in
    the 180° state — consistent with a half-pixel corner bias rotating with
    the quad against D3D9's pixel-center convention; corner values not
    dumped). The web draws crisp whole-pixel sprites at the nearest quad:
    `hallChevronPlacement` rounds half up and adds
    `HALL_CHEVRON_EXPANDED_Y_SHIFT = 1` in the 180° state, within 0.3 px of
    the fitted stock positions; the sub-pixel softness is a deliberate
    divergence. (Supersedes the earlier "round-half-up snap" claim.)
11. The chevron is keyed to the medium width of the `Awesomeness:` line
    (155 → center 497.5 → quad 488–507), not a body width.
12. The awesomest-kill name is drawn exactly as stored (font 3), and the
    boast / story branch is campaign-only with no Website counterpart.
13. Not traced: what the native renderer does with a character the font
    lacks (the font has no `…`). The kernel skips such characters with zero
    advance and `hallMissingGlyphs` gates every static scene string in
    `test:hall`; wizard names are user data and are never allowed to crash
    the scene.
14. The global board no longer flashes the previous board's rows: the fetch
    result is keyed by `board:refresh`, so the scene is busy until the result
    for the current key lands (`aria-busy`), which the smoke waits on.

## Website consequence

`HallOfFameScene.tsx` and `hall-of-fame.css` are rewritten around a pure
kernel `hall-of-fame-presentation.ts` (box, cadence, every anchor above,
native text placement, sprite placement, pulse alphas, mirrored 9-slice
layout, tile grid) with unit tests in `test:hall`; `HallOfFamePrimitives.tsx`
holds the atlas sprite / bitmap text / nine-slice DOM primitives. The
scene renders stock bitmap fonts (body / medium / menu / heading), stock UI,
Skills, and Inventory atlas records, mirrored-corner 9-slice frames, and a DOM
element-VFX orb from the existing `nativeElementVfxPlan` kernel. The
`currentRunId` prop (the run this session recorded) selects the pulsing,
default-expanded current row. Local / Global and board controls stay, drawn as
bitmap-font tabs in the box's header band.

## Validation contract

- Mac mini only: `/opt/homebrew/bin/bash ./scripts/validate.sh` green on the
  exact tree.
- Playwright journey (`tools/smoke-hall-of-fame-rows.mjs`, playwright-core +
  system Chrome, 1600×900): root → Hall of Fame → seeded local rows →
  expanded row → scrolled row → Global error state → Main Menu, zero page and
  console errors, screenshots compared against the stock crops at the probe
  coordinates above.
- Every launched process disposed by exact PID.

## Validation receipt

Validated on the Mac mini (2026-08-22) in worktree
`/Users/jarrett/codex-acceptance/hall-rows-20260822` = detached `63a213f5` +
`hall-rows.patch` (the `frontend/src` diff hashes `8bed8d3a` on both the
Windows worktree and the Mac); all commands run from `frontend/`.

- `npm run -s test:hall` — 33/33 (kernel + existing hall suites; run three
  times: before validate, after the at-rest smoke change, and on the final
  tree after the doc/comment edits, together with `tsc` exit 0 and lint 0
  errors).
- `npx tsc -p tsconfig.app.json --noEmit` — exit 0.
- `npm run -s lint` (oxlint) — 0 errors, 8 pre-existing warnings in
  `src/main.tsx`.
- `scripts/validate.sh` — exit 0 (`/tmp/hall-validate.log`; `test:boneyard`
  1374/1374 inside it; one earlier standalone boneyard run failed 1/1374 and
  passed on rerun, test name not captured — flaky, unrelated to this change).
- `node tools/smoke-hall-of-fame-rows.mjs` against `node tools/dev-game.mjs
  --port 5187` with system Chrome — exit 0: consoleErrors 0, pageErrors 0,
  failedResponses 0; expectedDevErrors 3 / expectedDevResponses = 404
  `deployment.json`, 500 `leaderboards?board=awesomeness|wave` (dev:game has
  no backend; allow-listed by URL only). Steps: hall open rows 4; row 1
  expanded skillCells 3 / perkCells 9; scrollTop 620 rendered 5; hide row 1;
  global board alert 1 / rows 0 / status 1 (backend absent); wave board;
  back to menu. 10 screenshots, every capture taken with the pointer parked
  at the origin and the toggle hover filter settled.
- Pixel comparison against the stock captures
  (`%TEMP%\solomon-hall-20260822\{01..05}.png`, box space = screen − (200, 80)):
  rank heading, ornament, name, `Level 41 WARLOCK`, `Awesomeness:` glyph
  runs at identical positions (73 glyphs / 7 strings, integer quads);
  frame 9-slice edge profiles within ±1, bottom inner lines within ±2,
  separator ramp max diff 3; expanded statics (`SURVIVAL`, `Time:`,
  `Wave:`, `HIGHEST SKILLS`, `PERKS USED`, `Monsters Killed:`,
  `Awesomest Kill:`) identical bboxes, IoU 0.91–0.95; kills frame, skill
  frames, rank badges and the 3×3 perk grid bboxes identical; chevron at
  rest: peak luminance 187 = stock, whole-pixel quads 471/224 (90°) and
  470/226 (180°) in the web row vs fitted stock 488.25/224.05 and
  487.30/225.85 for its own center (≤0.3 px after the 17 px center offset).
- Residuals: stock sprites are bilinear-soft at fractional positions (not
  reproduced, see Finding 10); on partial-coverage glyph rows the web
  anti-aliasing is up to 26 luminance brighter (e.g. `E` top row 133 vs 107)
  with identical glyph positions; the staff orb VFX animates on the 100 Hz
  tick, so captures are not bit-stable in the portrait region by design;
  the toggle hover/focus brightening (`brightness(1.35)`) is a web-only
  affordance with no stock counterpart.
- Process disposal: dev server 58862 (+58866/58867), validate 56883/56885,
  rerun dev 67930 (+67934/67939) all exited/killed by exact PID; no headless
  Chrome left behind. Mac tmux session PID 9203 belongs to another codex
  validate run and was left untouched.
- Not exercised: current-row pulse and scroll kinematics (kernel-tested
  only); populated global leaderboard rows (no backend in dev:game); the
  campaign boast / story branch (out of scope).
