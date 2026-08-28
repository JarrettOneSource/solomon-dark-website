# 2026-08-25 — Tutorial modal teaching overlay: stage-10/13 callout and pointer geometry (reopens 2026-08-24)

## Reopen statement

The 2026-08-24 entry dispositioned `stage-10 inventory modal targets` and
`stage-13 skill modal targets` as `verified-already-at-parity` on the single
observation that the target and the overlay share the same fixed
`1600 x 900` transformed stage. That skipped the "extract the truth whenever
the truth is extractable" rule: no per-member anchor math was extracted, and
the web positions were guessed literals (`TutorialModalCallouts` pointers such
as `(1320,340) -> (1380,340)` for the equipment arrow, CSS offsets such as
`.tutorial-callout-equipment { top: 260px; right: 65px }`). The stock branch
reads every anchor from live HUD, inventory, and skill-book rectangles; the
native equipment arrow ends on the STAFF/WAND sink at `(1310,259)`, not at
`(1380,340)`. The user report "at the open inventory step the UI messages and
arrows are not placed correctly" is that skipped extraction surfacing. This
pass closes the whole system: every stage-10 and stage-13 member, the HUD
control layout and modal slide they anchor to, the equipment sink chain, the
backpack cell anchor and its gate, the skill-page anchors and their gates, the
callout frame/text primitive, and the pointer blink rule.

Reopened again inside this pass (second RE round, 2026-08-25). The first
round of this entry kept two shared assumptions that instruction evidence now
refutes, and the skill requires a refuted assumption to die for every member
that shares it, so both are replaced here rather than patched for the
reported stage. (1) The blink clock: the entry read `0x0081F658` as a
"process frame counter" and drove the web blink from the authoritative
`stageTicks`. The global is `App+0x28`, the 100 Hz application tick, which
has no pause path at all — while the web single-player modal pause freezes
`stageTicks`, so the modal pointers never blinked (the Mac r2 journey timed
out waiting for a blink window that cannot arrive). Rule skipped: "clocks ...
recovered" in the causal trace — the counter's owner and pause behaviour were
asserted, not traced. (2) Blink membership: every non-modal
`Tutorial::Render` pointer (stages 5, 8, 9, 12, 14, 17, 18) pushes
`blink = 1`, yet the web drew the stage-5/9/12/18 HUD pointers and the
stage-14 pointer steady; the stage-8/17 world pointer used the same frozen
clock. Rule skipped: "a falsified assumption dies everywhere at once" — the
primitive is one shared member. (3) The 2026-08-24 stage-14 row ported the
selected-HUD pointer with the primitive's argument roles reversed (sprite
drawn at the midpoint, rotated toward `c(primary) + (30, 50)`, whereas the
stock sprite sits at `c(primary) + (30, 50)` and points at the midpoint).
Rule skipped: raw-instruction verification of a tiny wrapper's parameter
order. The 2026-08-23 `pointer math/blink` row (30 visible / 20 hidden
ticks) stands as the duty cycle; its clock and its "UI target arrows" proof
contract are superseded by the rows below.

## Reported smell and parity question

- Reported web behavior: at tutorial stage 10 (inventory open) the callout
  boxes and arrows sit at guessed positions that do not point at the resume
  control, the quick-use belt slot, the equipment sink, or the first backpack
  cell; the CSS offsets were authored against one window and drift with the
  window aspect because the frame rect and the stage were mixed.
- Stock behavior to recover: `Tutorial::Render` (`0x005D08C0`, loader
  catalog name `InventoryHint_Render`, Tutorial vtable `0x0079AFC4` slot
  `0x0C`) computes each callout centre and each pointer origin/tip from the
  live rectangles of the HUD backpack/tome/belt controls (slid by the open
  modal), the InventoryScreen equipment sink, the first InventoryGrid cell,
  and the SkillScreen page rectangles, then draws through two primitives:
  `0x005C9C70(String, x, y)` (callout) and `0x005C9BB0(origin, tip, blink)`
  (pointer).
- Reproduction inputs/scenes: tutorial stage 9 with the intro cleared, press
  the inventory binding (stage 10); close, force stage 12, press the skills
  binding (stage 13). Viewports `1600x900`, `2560x1080`, `1200x1000`.
- Falsifiable questions: (1) what are the exact native anchor expressions per
  member; (2) which HUD positions do they read while a modal is open; (3)
  which members are gated, and on what; (4) which pointers blink; (5) how is a
  callout frame sized and where is its text placed relative to `(x, y)`;
  (6) which clock drives the blink, who increments it, and does it keep
  running while a modal is open; (7) for every stage's `0x005C9BB0` call,
  which argument pair is the sprite origin and which is the tip.

## Evidence and provenance

Stock executable: retail `SolomonDark.exe` 0.72.5, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`, Ghidra 12.0.3 project `SolomonDark`
through `Mod Loader/scripts/Invoke-GhidraHeadless.ps1` (read-only replica
slot 01). No runtime or loader-injected evidence is used for any conclusion
below; every fact is instruction/static-data derived unless marked inferred.

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | `0x005D08C0` `Tutorial::Render`, `case 0xa` `0x005D13xx..0x005D1501`, `case 0xd` `0x005D18xx..0x005D1CFx` (`decompile_targets.py`, `dump_function_instructions.py`; prior task copy `/mnt/d/codex-evidence/tutre-20260801/raw/01_core_tutorial_control_decompile.txt` L1090-1245, L1303-1440) | per-member callout/pointer expressions, gates, and blink flags recovered below | high |
| Instructions | `0x005C9C70` callout primitive, `0x005CA560` wrapper, `0x0043B890` measure, `FUN_00417760` frame draw, `0x004A57C0` font draw | frame `W = w + 28`, `H = h + 20`, rect `(x - W/2, y + 4 - H/2)`, UI record 4, colour `(0.85, 0.73, 0.44, 1)`, font `menu`, centred lines `x_k = trunc(cx - w_k/2)`, `y_k = trunc(cy) + 25k` | high |
| Instructions | `0x005C9BB0(x0, y0, x1, y1, blink)` pointer primitive (`decompile_targets.py`, `dump_function_instructions.py`); `0x00403730` = `Rect::Centre` | the sprite (UI record 28, 58x61) is drawn at the FIRST pair `(x0, y0)` by `0x00414F90(x0, y0, angle)` with `angle = atan2(x1 - x0, y1 - y0)` in degrees (`+360` when negative); the second pair only steers the rotation. Drawn iff `blink == 0 \|\| 0x0081F658 % 50 > 19`. Stack discipline at every call site: the pair allocated LAST (`sub esp,8` nearest the call, lowest address) is the origin | high |
| Instructions | `0x0081F658` identity: static `App` object `0x0081F630` (pointer at `0x00B401A8`; ctor `0x0040B6B0`, vtable `0x007DB97C`); base tick `0x00427800` (vtable slot 8) at `0x0042781E..0x00427824`: `cmp byte [App+0x2C],0; jnz; inc dword [App+0x28]`; 100 Hz scheduler `0x0040D1B0`; `+0x68 > 0` early-returns before the increment | `0x0081F658 == App+0x28`, the application tick counter. `App+0x2C` (`0x0081F65C`) has no writer besides constructor zeroing (`0x00421EF0`, `0x0042742E`); the only byte setter `0x00656560` has one caller `0x0068ABA1` with `ecx = [[edx+0x1654]]`, not the App; only `HallOfFame_Render` rewrites the counter (`0x005A3745`, `0x005A3978`). The counter therefore never pauses and keeps counting while InventoryScreen / SkillScreen are open (their ticks `0x00551A10` / `0x006567E0` run from the same scheduler) | high |
| Instructions | `Tutorial::Render` jump table `0x005D2324` on stage `[this+0x7C]`: 0->`0x005D0CD2`, 2->`0x005D0D49`, 5->`0x005D0DC0`, 8->`0x005D0F04`, 9->`0x005D10C0`, 10->`0x005D1202`, 11->`0x005D16FF`, 12->`0x005D179D`, 13->`0x005D18C5`, 14->`0x005D1D29`, 17->`0x005D1EB4`, 18->`0x005D2074`, 19->`0x005D227B`, others->`0x005D22B4` (exit); every `call 0x005C9BB0` with its pushed blink immediate | stage 5 `0x005D0EFA` blink 1; stage 8 `0x005D10B6` 1; stage 9 `0x005D11F8` 1 (stage 12 computes `origin.x = c(tome).x + 40` at `0x005D1875..0x005D18C0`, pushes 1 at `0x005D188D`, then `jmp 0x005D11E2` into the stage-9 tail that sets `origin.y = c.y - 40` and shares the call); stage 10 `0x005D133E` 1 and `0x005D143C` / `0x005D1529` / `0x005D16E1` 0; stage 13 `0x005D1A00` 1 and `0x005D1AF5` / `0x005D1B9B` / `0x005D1CD9` 0; stage 14 `0x005D1DE9` 1; stage 17 `0x005D206A` 1; stage 18 `0x005D21BE` and `0x005D2274` 1; stages 0/2/11/19 emit no pointer | high |
| Instructions | stage 14 `0x005D1D29..0x005D1DE9` | gate `cmp byte [esi+0xAC],0; jnz exit`; slot A (allocated first = tip) `= 0.5 * (c([Game+0x480]) + c([Game+0x3C0]))` via `0x007DE808 = 0.5` (concentration-A control `+0x46C` and primary control `+0x3AC`, rect at control `+0x14`); slot B (allocated last, `edi` = origin) `= c([Game+0x3C0]) + (30, 50)` (`0x00784D50 = 30`, `0x007847C8 = 50`); blink 1. The stock sprite therefore sits at `c(primary) + (30, 50)` and points up at the midpoint; the 2026-08-24 web port had the two pairs swapped | high |
| Instructions | `0x005D76C0` HUD layout; `0x005C7200` slide writer; `0x00551A10` InventoryScreen tick (`+0x150`, step 0.025); `0x006567E0` SkillScreen tick (`+0x94`) | backpack/tome/belt rectangles as functions of `(W, H, p)`; both modals drive `p -> 1` over 40 ticks; writer forces `p = 1` when both screens exist | high |
| Instructions | `0x00560380` InventoryScreen ctor; `0x00551610` equipment layout writer; `FUN_0040f9e0`, `FUN_00404000` | equipment pane origin, size, and every sink centre incl. STAFF/WAND `container+0x30 = (cx - 80, cy + 10)` | high |
| Instructions | `0x0055D830` InventoryGrid ctor; `0x005D07A0` entry getter -> `FUN_00558e40`; `0x0055A070` grid draw; `0x004282D0` parent-chain resolver | cell entry `{x, y, .., holder@+0x10}`; draw translates by `(x, y)` then draws at `(0, 0)` = cell top-left; first grid at `screen+0x188`, gate flag `[screen+0x294]` | high |
| Instructions | `0x0066B380` SkillPage builder (page origin `+0x14/+0x18`) | page rect origin equals the placement already ported by `nativeSkillBookPagePlacements`; root icon anchors `(100, 80)` and `(100, 70)` resolve through `0x004282D0` | high |
| Asset/data | `native-ui-assets.json` UI records 4 (20x20), 28 (58x61), 47/48 (58x62), 2 (55x55); Inventory record 10 (72x72), all `trimOrigin [0, 0]` | draw origins are logical top-left with no trim shift | high |
| Static data | `0x007DE808` = 0.5 (double), `0x007DE8D8` = 5.0, `0x007DE920` = 20, `0x00784650` = 40, `0x007847C8` = 50, `0x007DE908` = 100, `0x00784D50` = 30, `0x007948F0` = 115, `0x0079B920` = 165, `0x007994B8` = 110, `0x00784798` = 125, `0x007DE840` = 0, `0x007DE910` = 3 (`dump_floats_at.py`, `float=` field) | every literal in the member table, plus the resting belt inset `+3` and the `0` blink flag | high |
| Web | `frontend/src/game/TutorialOverlay.tsx` `TutorialModalCallouts` (pre-change), `tutorial.css` L92-97 | guessed pointer literals and CSS offsets; callout text laid out with the web default line height 24 | high |

## System boundary and membership inventory

Native system: the Tutorial teaching overlay for the two modal stages — every
callout and pointer `Tutorial::Render` emits while stage `0xa` (inventory
open) or stage `0xd` (skill book open) is active, plus the native rectangles
those members read (HUD backpack/tome/belt controls throughout the live modal
slide `p = 0 -> 1`,
the InventoryScreen equipment sink, the first InventoryGrid cell, the
SkillScreen page rectangles) and the two drawing primitives. Because the
pointer primitive is shared, its clock, its per-call blink flag, and its
origin/tip argument roles are members for every `Tutorial::Render` pointer
(stages 5, 8, 9, 10, 12, 13, 14, 17, 18) and are owned here. The placement
expressions of the non-modal pointers (stages 5, 8/17, 9/12, 18) stay owned
by the 2026-08-23 and 2026-08-24 entries (they anchor to the live DOM HUD /
live Sack, which the web projects per presentation frame); the stage-14
pointer's origin/tip is corrected here because that 2026-08-24 row is
refuted.

All numeric examples below are settled stage coordinates at the native
`1600 x 900` backbuffer with `W = 1600`, `H = 900`, modal slide `p = 1`.
The formulas consume live `p` throughout opening. `c(r)` is the centre of
rectangle `r`; `bp`, `tome`, `belt[k]` are the HUD control rectangles from
the layout contract further below.

| Member (class/variant/scene/branch) | Native source (function/table row/record) | Disposition | Proof |
| --- | --- | --- | --- |
| callout primitive | `0x005C9C70(String, x, y)` via `0x005CA560`; measure `0x0043B890`; frame `FUN_00417760` UI 4; text `0x004A57C0` `menu` | exact-ported | `tutorial-modal-callouts.test.ts` frame/line math; overlay renders per-line text at `trunc(cx - w_k/2), trunc(cy) + 25k` |
| pointer primitive | `0x005C9BB0(origin, tip, blink)`: UI 28 sprite drawn AT `origin`, rotated by `atan2(tip - origin)` in degrees (`0x00414F90`); drawn iff `!blink \|\| App+0x28 % 50 > 19` | exact-ported (phase `blocked-by-platform`, see unknowns) | `TutorialPointer` places the sprite at `(x, y)` = origin and rotates toward `(toX, toY)` = tip; `tutorial-modal-callouts.test.ts`; `tutorial-presentation.test.ts` |
| pointer blink clock | `0x0081F658 == App+0x28`; `inc` at `0x00427824` from the 100 Hz scheduler `0x0040D1B0`; `App+0x2C` never set; `+0x68` skip only during scene transitions | exact-ported (phase `blocked-by-platform`) | `native-application-tick.ts`: `tick = floor(now_ms / 10)` on the presentation clock, never frozen by the web gameplay pause; `native-application-tick.test.ts`; `useTutorialPointerBlink` re-renders from the presentation frame loop; journey samples hidden AND visible states while the modal is open |
| stage-5 secondary-slot pointer blink | `0x005D0EFA` pushes 1 | exact-ported | `nativeTutorialHudPointerPlans(5)[0].blink === true` (`tutorial-hud-anchors.test.ts`); placement: 2026-08-23 row |
| stage-8 / stage-17 world Sack pointer blink | `0x005D10B6`, `0x005D206A` push 1 | exact-ported | overlay world pointer `visible={pointerBlink}` (`tutorial-presentation.test.ts`); placement: 2026-08-23 row |
| stage-9 / stage-12 HUD pointer blink | `0x005D11F8` (shared tail; stage 12 pushes 1 at `0x005D188D`) | exact-ported | plans carry `blink: true`; journey samples `[data-tutorial-pointer="inventory"]` at stage 9 and `[data-tutorial-pointer="skills"]` at stage 12 both hidden and visible |
| stage-14 selected-HUD pointer | `0x005D1D36..0x005D1DE9`: origin `c(primary) + (30, 50)`, tip `0.5 * (c(primary) + c(A))`, blink 1 | exact-ported (reopens the 2026-08-24 `pointer` row: origin/tip were swapped and it never blinked) | `nativeTutorialSelectedHudLayout` returns `pointer: { x: 810, y: 75.5, toX: 800, toY: 25.5 }` for the primary-plus-A layout (`native-hud-presentation.test.ts`); overlay passes `visible={pointerBlink}`; journey samples `[data-tutorial-pointer="selected-skills"]` at stage 14 |
| stage-18 potion / HP pointer blink | `0x005D21BE`, `0x005D2274` push 1 | exact-ported | plans carry `blink: true` (`tutorial-hud-anchors.test.ts`); placement: 2026-08-23 row |
| stage-10 resume callout | `case 0xa`: `(c(bp).x - 50, c(bp).y - 120)`, text `Click here or press '%s'\nagain to resume playing` | exact-ported | `(709.5, 751)` at 1600x900 |
| stage-10 resume pointer | origin `(c(bp).x - 50, c(bp).y - 50)` -> tip `c(bp)`; blink `1` | exact-ported | `(709.5, 821) -> (759.5, 871)` |
| stage-10 quick-use callout | `(c(belt[7]).x, c(belt[7]).y - 115)`, text `Put items here\nfor quick use` | exact-ported | `(1104.5, 759.5)` |
| stage-10 quick-use pointer | origin `(c(belt[7]).x - 20, c(belt[7]).y - 50)` -> tip `c(belt[6])`; blink `0` | exact-ported | `(1084.5, 824.5) -> (1044.5, 874.5)` |
| stage-10 equipment callout | sink `[[[Game+0x15A0]+0x15C]+0x30]` (STAFF/WAND) resolved by `FUN_00570f80`; `(pt.x - 250, pt.y + 50)`, text `Put equippable items\nhere to wear them.` | exact-ported | sink `(1310, 259)` = centre of `hubInventoryEquipmentSlotRects('weapon', false)[0]`; callout `(1060, 309)` |
| stage-10 equipment pointer | origin `(pt.x - 60, pt.y + 40)` -> tip `pt`; blink `0` | exact-ported | `(1250, 299) -> (1310, 259)` |
| stage-10 backpack callout | gate `Game+0x15A0 && [screen+0x294]`; entry 0 of grid `screen+0x188` via `0x005D07A0`; require entry, `*entry`, holder `[[entry]+0x10]`, item `[holder]`, `[item+4] != 0`; `pt = 0x004282D0(grid, [obj+0], [obj+4])` = cell-0 top-left; callout `(pt.x + 410, pt.y - 7)`, text `Found items go in your backpack.  Click and\ndrag to move items, double-click to use them.` | exact-ported | web gate = `projectInventoryItems(backpack)[0]` present; cell 0 = `hubInventorySlotPosition(0)` = `(24, 496)`; callout `(434, 489)`; hidden with an empty backpack |
| stage-10 backpack pointer | origin `(pt.x + 60, pt.y - 5)` -> tip `pt`; blink `0` | exact-ported | `(84, 491) -> (24, 496)` |
| stage-13 resume callout | `case 0xd`: `(c(tome).x + 50, c(tome).y - 110)`, same resume text with the skills binding | exact-ported | `(889.5, 761)` |
| stage-13 resume pointer | origin `(c(tome).x + 40, c(tome).y - 40)` -> tip `c(tome)`; blink `1` | exact-ported | `(879.5, 831) -> (839.5, 871)` |
| stage-13 quick-use callout | `(c(belt[1]).x, c(belt[1]).y - 125)`, text `Drag skills here\nfor quick use` | exact-ported | `(554.5, 749.5)` |
| stage-13 quick-use pointer | origin `(c(belt[1]).x - 20, c(belt[1]).y - 50)` -> tip `c(belt[1])`; blink `0` | exact-ported | `(534.5, 824.5) -> (554.5, 874.5)` |
| stage-13 concentration pointer | gate `[ss+0x84] > 2 && [[ss+0x90]+8] != 0` (`ss = [Game+0x1664]`); `pt = 0x004282D0(page[2], 100, 80)`; origin `(pt.x + 100, pt.y - 20)` -> tip `pt`; blink `0` | exact-ported | `pt = (placement[2].x + 100, placement[2].y + 80)` = the third page's root icon centre |
| stage-13 concentration callout A | `(pt.x + 50, pt.y - 165)`, text `You are CONCENTRATING on\nyour new skill automatically` | exact-ported | two independent callouts replace the former single blank-line callout |
| stage-13 concentration callout B | `(pt.x + 50, pt.y - 100)`, text `This confers a bonus, but is\nlimited to one skill at a time.` | exact-ported | |
| stage-13 hover pointer | gate `[ss+0x84] > 0 && [[ss+0x90]] != 0`; `pt = 0x004282D0(page[0], 100, 70)`; origin `(pt.x - 100, pt.y - 30)` -> tip `pt`; blink `0` | exact-ported | `pt = (placement[0].x + 100, placement[0].y + 70)` |
| stage-13 hover callout | `(pt.x - 115, pt.y - 30)`, text `Hover your mouse over a\nskill icon for more information.` (direct `0x005C9C70` call) | exact-ported | |
| HUD backpack control at modal time | `0x005D76C0`: `bp = (W/2 - 69.5, H - 75, 58, 62)`; `0x005C7200`: `y = (H - 75) + 15p` | exact-ported | `native-hud-layout.ts`; `c(bp) = (759.5, 871)` at `p = 1` |
| HUD tome control at modal time | `tome = (W/2 + 10.5, H - 75, 58, 62)`; same slide | exact-ported | `c(tome) = (839.5, 871)` |
| HUD belt controls at modal time | `0x005D76C0` loops: `c.x = c(bp).x - 5 - 260 + 60k` for `k < 4`, `c.x = c(tome).x + 5 + 80 + 60(k - 4)` for `k >= 4`, `53 x 53`; `0x005C7200`: `y = (H - 75) + 8 + 15p` | exact-ported | centres `494.5, 554.5, 614.5, 674.5, 924.5, 984.5, 1044.5, 1104.5` at `y = 874.5` |
| modal slide progress | `0x00551A10` `+0x150 += 0.025` (open) / `-= 0.025` (close), clamp `[0, 1]`; `0x006567E0` `+0x94` same; writer forces `p = 1` when `Game+0x15A0 && Game+0x1664` both exist | exact-ported after review | `native-modal-slide-progress.ts` publishes each screen's live progress; the Tutorial plans and both modal HUD renderers consume the same `p`; pure tests cover `0/.5/1` and the Mac journey measures an intermediate opening frame |
| InventoryScreen equipment pane + sinks | `0x00560380`: `rect = fit(0, 54, 1024, 600)`, anchor `+0x3AC = fitted.bottom - 261` (`H >= 801`), pane `(W - 370, anchor - 400, 320, 320)` standalone / `(W/2 + 377, ..)` companion; `0x00551610` sinks hat `(cx, cy - 70)`, robe `(cx, cy + 28)`, STAFF/WAND `(cx - 80, cy + 10)`, amulet `(cx - 67, cy - 57)`, ring0 `(cx - 67, cy + 77)`, ring1 `(cx + 67, cy + 77)`, ring2 sentinel `-9999` unless perk byte `[[Game+0x1654]]+0x7DF` | verified-already-at-parity | every sink centre equals the centre of the matching `hubInventoryEquipmentSlotRects` rect (weapon `[1274, 223, 72, 72]` -> `(1310, 259)`); the tutorial reads only the STAFF/WAND sink |
| InventoryGrid cell 0 | `0x0055D830`, `0x0055A070`, `0x004282D0`; 88 cells, column-major, pitch 75, origin `(24, 496)` | verified-already-at-parity | `hubInventorySlotPosition(0) = (24, 496)` is the cell top-left, which is what the native pointer targets |
| SkillScreen page rectangles | `0x0066B380` origin `+0x14/+0x18` | verified-already-at-parity | `nativeSkillBookPagePlacements(nativeSkillBookPages(progression))` (2026-08 SkillScreen entry) |
| SkillScreen HUD copy at modal time | live `0x005C7200(p)` from `0x006567E0` | exact-ported after current-main reconciliation | `skill-book-renderer.ts` removes the later `16.5` blanket offset and derives every belt/backpack/tome coordinate from `nativeHudModalSlideLayout(1600, 900, openProgress)`; settled values are belt top `848`, backpack/tome top `840` |
| InventoryScreen HUD copy at modal time | live writer from `0x00551A10` | exact-ported after review | `hub-inventory-renderer.ts` builds the belt/backpack/tome container at `p = 0` and moves it by `nativeHudModalSlideOffset(reveal)`; record 82 remains fixed because it is not a Tutorial anchor |
| stage-9 / stage-12 HUD pointer placement | `case 9`: origin `(c(bp).x - 40, c(bp).y - 40)`; `case 0xc`: `(c(tome).x + 40, c(tome).y - 40)`; both -> tip `c(control)` | verified-already-at-parity | `nativeTutorialHudPointerPlans` offsets `(-40, -40)` / `(40, -40)` from the live DOM HUD anchors (2026-08-24 entry, `p = 0`); blink row above |
| stage 0 / 2 / 11 / 19 text-only members | `0x005D0CD2`, `0x005D0D49`, `0x005D16FF`, `0x005D227B` emit no `0x005C9BB0` call | out-of-system | no pointer; heading/subheading rows owned by the 2026-08-23 entry |
| stage-14 text lines; stage 5/8/17/18 pointer placement | `0x005D1DEE..0x005D1EAA`; `0x005D0DC0..`, `0x005D0F04..`, `0x005D1EB4..`, `0x005D2074..` | verified-already-at-parity (2026-08-23/24 rows) | stage-14 lines `(c(primary).x - 220, c(primary).y + 50 / + 70)` unchanged; the other placements were not re-derived here (their decompiler-derived rows stand); only their blink flags and call sites were read |
| overlay teardown | modal close sends `inventory-closed` / `skills-closed`; stage leaves 10/13; React unmount | exact-ported after review | inventory close already reports at surface removal; SkillBook now sends `skills-closed` at close initiation rather than after its 40-tick visual close; a newly mounted screen resets its progress to zero |

## Native ownership thread

- Owner and construction path: `Game` (`0x0081C264`) owns the `Tutorial`
  object; `Tutorial::Render` runs from vtable slot `0x0C` after the modal
  screens draw, so the callouts paint over the InventoryScreen/SkillScreen.
- Upstream state producers/callers: stage `0xa` is entered from `9` when the
  InventoryScreen exists (`Game+0x15A0`), stage `0xd` from `0xc` when the
  SkillScreen exists (`Game+0x1664`); the web protocol actions
  `inventory-opened` / `skills-opened` already mirror these transitions.
- State representation and transitions: the stage byte plus the owning
  InventoryScreen/SkillScreen slide progress; every geometry input is read
  live each render from the HUD control rectangles, the
  InventoryScreen sink container, the first InventoryGrid entry, and the
  SkillScreen page array.
- Downstream consumers/callees: `0x005CA560` -> `0x005C9C70` ->
  `0x0043B890` / `FUN_00417760` / `0x004A57C0`; `0x005C9BB0`;
  `FUN_00570f80`; `0x005D07A0` -> `FUN_00558e40`; `0x004282D0`.
- Sibling systems sharing ownership or data: the HUD layout `0x005D76C0`
  and slide writer `0x005C7200` (also consumed by the HUD renderer
  `0x005D2520`), the InventoryScreen equipment layout `0x00551610`, the
  InventoryGrid, and the SkillPage builder `0x0066B380`.
- Entry, interruption, reset, and teardown: closing the modal returns the
  stage to the live-HUD branch (`0xb` / `0xe`); no member keeps state.

## Recovered behavioral contract

- Timing/ticks/thresholds: pointer blink uses the application tick
  `App+0x28` (`0x0081F658`), a 100 Hz counter incremented by the base tick
  `0x00427800` with no pause path (`+0x2C` has no writer), so a blinking
  pointer is hidden for 20 ticks (200 ms) and shown for 30 ticks (300 ms) of
  every 500 ms and keeps blinking while the inventory or skill modal is open
  (`draw = !blink || tick % 50 > 19`). Each modal slide ramps by 0.025 for
  40 ticks; `p = 1` is forced only during a screen handoff where both screen
  pointers coexist. Stages `0xa`/`0xd` begin as soon as their screen exists,
  so the callouts must consume live `p`, not jump to the settled layout.
- Geometry/transforms/coordinate spaces: all members are backbuffer
  coordinates; `c(r) = (r.x + r.w * 0.5, r.y + r.h * 0.5)`. Callout `(x, y)`
  is the frame centre shifted 4 px up: `frame = (x - W/2, y + 4 - H/2, W, H)`
  with `W = w + 28`, `H = h + 20`, where `(w, h)` is the `menu` text measure
  (`h = 24 + 25(n - 1)`, `w = max_k w_k`). Text lines are placed by the font
  renderer's centred mode at `x_k = trunc(x - w_k/2)`, `y_k = trunc(y) + 25k`
  (line pitch 25 = glyph height 24 + 1). The pointer sprite (UI 28, 58x61)
  is drawn from origin to tip; the web keeps its existing rotation
  presentation with the origin at the element centre and the tip encoded in
  `data-to-x/data-to-y`.
- Render/hit/collision/traversal order: modal screen, then callouts, then
  pointers per member in source order (resume, quick-use, equipment,
  backpack; resume, quick-use, concentration, hover).
- Assets/audio/randomness: UI records 4 (frame), 28 (pointer); colour
  `(0.85, 0.73, 0.44, 1)` = `#d9ba70` for frame and text; no audio.
- Input/network authority/replication: none; presentation only. The
  backpack gate reads the local player's first projected backpack cell.
- Boundary and failure behavior: with an empty backpack the stage-10
  backpack callout and pointer are absent; with fewer than three skill pages
  the concentration pair is absent; with no page the hover pair is absent.

## Nearby-system findings

- Review correction: Claude's branch predated the current-main SkillScreen
  rewrite. After rebase, applying its settled `p = 1` coordinates on top of
  current main's `liveHudArtOffsetY = 16.5` would have double-shifted the HUD.
  The reconciled renderer removes that blanket offset and derives the controls
  directly from live `nativeHudModalSlideLayout(..., openProgress)`, preserving
  the newer root/page/HoverBox renderer while fixing its HUD owner.
- Durable finding: the live DOM HUD backpack/tome centres are
  `(763, 855)` / `(843, 855)` at 1600x900 (`tutorial-hud-anchors.test.ts`),
  i.e. `+3.5 px` x and `-1 px` y from the native closed rects
  `(759.5, 856)` / `(839.5, 856)`. Out of this system (live-HUD presentation,
  G9); recorded for the HUD owner.
- Durable finding: the inventory-modal belt art was centred at `y = 874`
  while the native belt rect centre at settled `p = 1` is `874.5`; the belt art
  record (UI 2) is `55 x 55` logical over a `53 x 53` rect, so the art is
  centred on the rect centre, not drawn from the rect origin. Changed in
  this pass: `addBelt` derives every base centre from
  `nativeHudModalSlideLayout(..., 0)` and the screen moves that owner by the
  live slide offset (falsified-assumption rule; the settled stage-10/13 belt
  pointers end on `874.5`).
- Durable finding: `layoutNativeUiText` defaults multi-line pitch to
  `font.metrics[0]` (24) while the native `menu` centred mode advances 25 per
  line; callers that port native multi-line text must pass `lineHeight: 25`
  or lay out per line. The callouts now lay out per line.
- Durable finding: the global `0x0081F658` that HUD, menu, footstep, and
  hit-feedback code read as a "frame counter" is `App+0x28` of the static
  `App` object at `0x0081F630`, incremented once per 100 Hz base tick
  (`0x00427800`, `0x0042781E..0x00427824`) and skipped only while the
  scene-transition field `+0x68 > 0`. The `+0x2C` "paused" byte guarding the
  increment has no writer outside the constructor in 0.72.5, so nothing in
  the stock game ever freezes that counter. Evidence: `refs_in_range.py`,
  raw byte-store census over `0x0081F65C`, `decompile_targets.py` on
  `0x00427800` / `0x00656560` / `0x00689750`. Why it matters: every web
  presentation that blinks on `0x0081F658` must use a free-running
  application tick, not `stageTicks`, the sim tick, or any paused clock.
- Durable finding: the web single-player gameplay pause
  (`requestGameplayPause('inventory' | 'skills')`) freezes the sim and with it
  `tutorial.stageTicks`, so any presentation driven from `stageTicks` stops
  while a modal is open. Evidence: Mac r2 journey — the blink-window wait on
  `stageTicks % 50` never advanced under stage 10. Recorded so no later
  presentation member repeats the mistake.
- Durable finding: `0x00403730` is `Rect::Centre` (`out = (r.x + r.w * 0.5,
  r.y + r.h * 0.5)`), the helper every `Tutorial::Render` pointer feeds.
- Durable finding: the 2026-08-24 stage-14 pass rendered the selected-HUD
  pointer with origin/tip reversed and steady; the 2026-08-23/24 HUD pointer
  plans (stages 5/9/12/18) were rendered steady although the stock calls push
  `blink = 1`. Both corrected in this pass (member rows above).
- Native report/catalog also updated:
  `Mod Loader/docs/reverse-engineering/native-hud.md` gains the HUD control
  layout + modal slide contract and the Tutorial teaching-overlay contract
  (addresses, constants, per-stage pointer table with blink flags and the
  corrected primitive description);
  `Mod Loader/docs/reverse-engineering/native-movement-and-tick.md` records
  the `0x0081F658 == App+0x28` identity and the absent `+0x2C` writer;
  `Mod Loader/docs/main-menu-solomon-visual-re.md` renames its "global frame
  counter" wording to the application tick.

## Confidence and open questions

- Confirmed: every expression in the member table (instruction-derived,
  constants read with `dump_floats_at.py`); the STAFF/WAND sink identity
  (raw instruction `mov eax,[eax+0x30]` on the sink container, refuting the
  2026-08-24 "hat" reading); grid cell origin = glyph translation = top-left;
  page origin = placement; the pointer primitive's argument roles (raw
  `0x005C9BB0` body: draw at the first pair, `atan2` of the second minus the
  first); the blink clock identity `0x0081F658 == App+0x28` and its
  increment/skip sites; the absence of any `App+0x2C` writer; the per-call
  blink immediates for all fifteen `0x005C9BB0` sites; the stage-14
  origin/tip slots and constants.
- Inferred: none load-bearing.
- Unknown (`blocked-by-platform`): the blink phase only. Native counts
  application ticks since process start; the web derives the same 100 Hz tick
  from the presentation clock (`performance.now() / 10`) with the same
  `% 50 > 19` rule, so period, duty cycle, and never-pausing behaviour match
  but the phase relative to process start does not (no browser can observe
  the stock process's tick count).
- Next falsifying probe if the unknown becomes material: none needed; phase is
  not observable across two processes.

## Web implementation consequence

- Correct owner/module: `frontend/src/game/native-hud-layout.ts` (HUD
  control rectangles as a pure function of `(W, H, p)`, ported from
  `0x005D76C0` / `0x005C7200`);
  `frontend/src/game/native-modal-slide-progress.ts` (the live presentation
  value shared by each modal screen and the Tutorial overlay);
  `frontend/src/game/tutorial-modal-callouts.ts` (callout frame/line math and
  the stage-10/13 member plans, ported from `0x005D08C0` / `0x005C9C70`);
  `frontend/src/game/native-application-tick.ts` (the 100 Hz application
  tick `App+0x28`, ported from `0x00427800`); `TutorialOverlay.tsx`
  `useTutorialPointerBlink` (one presentation-frame subscription that
  re-renders every blinking pointer from that tick).
- Shared model change: `TutorialModalCallouts` renders the plan; it receives
  the backpack, progression, stage, and live modal progress, computes the equipment sink from
  `hubInventoryEquipmentSlotRects`, the first cell from
  `hubInventorySlotPosition`, and the page anchors from
  `nativeSkillBookPagePlacements`, and takes its blink state from the
  overlay hook — no `stageTicks` prop. `TutorialPointerPlan` carries the
  stock `blink` flag (true for every HUD pointer); `TutorialPointer`
  receives `visible` from the same hook. `nativeTutorialSelectedHudLayout`
  returns the stage-14 pointer with origin `c(primary) + (30, 50)` and tip at
  the midpoint.
- Stock behavior preserved: per-member positions, gates, texts, blink duty
  cycle and its free-running clock, frame sizing, per-line text placement,
  colour, records, sprite-at-origin rotation, 40-tick modal-anchor motion, and
  close-edge teardown.
- Browser-specific approximation, if unavoidable: blink phase (above).
- Symptom patch or obsolete path to remove: the six guessed CSS offset rules in
  `tutorial.css`, the literal pointer coordinates, the single blank-line
  concentration callout, the `left: 10, top: 11.75` text placement, and the
  `stageTicks % 50 > 19` blink expressions in the overlay and the modal
  callouts (frozen under the modal pause).

## Validation contract

- Focused automated test: `tutorial-modal-callouts.test.ts` asserts every
  member's centre/origin/tip/blink/text at 1600x900 against the constants
  above, the live slide at `p = 0/.5/1`, and the gates (empty backpack,
  0/1/3 pages); `native-modal-slide-progress.test.ts` asserts independent
  screen ownership and subscriber updates;
  `native-hud-layout.test.ts` asserts the control rectangles at `p = 0` and
  `p = 1` for 1600x900 and a non-default `(W, H)`;
  `native-application-tick.test.ts` asserts the 10 ms tick, the 20-hidden /
  30-visible duty per 50 ticks, and the 500 ms period;
  `tutorial-hud-anchors.test.ts` asserts `blink: true` on every HUD pointer
  plan; `native-hud-presentation.test.ts` asserts the corrected stage-14
  origin/tip; `tutorial-presentation.test.ts` pins the rewritten overlay
  (hook-driven blink, no `stageTicks` blink expression, no `stageTicks`
  prop on the modal callouts).
- Playwright or runtime journey: `frontend/tools/smoke-tutorial-modal-callouts.mjs`
  against the built bundle on Mac Chrome at 1600x900, 2560x1080, 1200x1000
  (stage 10 with an item in cell 0, stage 13 with three learned pages), plus
  an empty-backpack pass; page/console/failed-response arrays must be empty;
  every member's DOM geometry must equal the model within 0.5 px after the
  stage transform at an intermediate opening frame and at settle, at every
  viewport; the overlay's progress and its screen owner's progress must remain
  within five native ticks; the stage-9 `inventory`, stage-12
  `skills`, stage-14 `selected-skills`, and modal `resume` pointers must each
  be sampled both hidden and visible (while the modal pause is active for the
  modal stages) and the non-blinking modal pointers must never hide.
- Stock-versus-web comparison: numeric — the journey compares DOM geometry to
  the native expressions; the native expressions are instruction-derived.
- Measurable acceptance criteria: per-member positions within 0.5 px during
  opening and at settle at all three viewports; gates hide/show the correct
  members; validate.sh green.

## Claude implementation receipt (superseded by review)

The receipt below records Claude's clean pre-rebase candidate and remains
useful evidence for the recovered formulas, settled geometry, gates, and blink.
It is not the final merge receipt: review found that it validated only
`p = 1`, and its older SkillScreen patch would double-shift the newer
current-main renderer. The reconciled exact-tree Mac receipt follows after the
review changes are gated.

- Files/modules changed (Website, branch
  `claude/tutorial-modal-callouts-20260825` on 69397270): new
  `frontend/src/game/tutorial-modal-callouts.ts` (+ test) — the stage-10/13
  member plans; new `frontend/src/game/native-hud-layout.ts` (+ test) — the `(W,
  H)`-parameterised control rectangles; new
  `frontend/src/game/native-application-tick.ts` (+ test) — the 10 ms
  application tick and the `% 50 > 19` duty; `tutorial-hud-anchors.ts` (+ test)
  — `blink: true` on every HUD pointer plan; `native-hud-presentation.ts` (+
  test) — the stage-14 origin/tip reversal; `TutorialOverlay.tsx` — hook-driven
  blink, model-driven modal callouts, no `stageTicks` blink expressions;
  `BoneyardScene.tsx` — passes the replicated backpack and progression to the
  modal callouts; `renderer/hub-inventory-renderer.ts`,
  `renderer/skill-book-renderer.ts` — the pre-review HUD copies used settled
  `nativeHudModalSlideLayout(W, H, 1)` coordinates instead of literals;
  `tutorial.css` — the six guessed callout offset rules removed;
  `tutorial-presentation.test.ts`; `frontend/package.json`
  (`smoke:game:tutorial-modal-callouts`); new
  `frontend/tools/smoke-tutorial-modal-callouts.mjs` (the journey). Mod Loader
  docs only (branch `claude/tutorial-modal-callouts-re-20260825` on 249ea3c5):
  `docs/reverse-engineering/native-hud.md`,
  `docs/reverse-engineering/native-movement-and-tick.md`,
  `docs/main-menu-solomon-visual-re.md`.
- Tests and canonical gate (Mac mini only, acceptance root
  `/Users/jarrett/codex-acceptance/tutorial-modal-callouts-20260825/`, local and
  Mac changed-file manifests byte-identical for every run): final tree —
  `/opt/homebrew/bin/bash ./scripts/validate.sh` exit 0 — 16 node:test runs /
  2245 tests / 0 fail, 22 Python contract tests OK, `oxlint` 0 errors (9
  pre-existing warnings, all in untouched files), game bundle 471,662 raw /
  132,323 gzip bytes (budget 524,288 / 133,120) ok, production media policy ok
  (`evidence-final/validate.log`); Mod Loader `python3
  tests/re/run_static_re_tests.py --ci` 501/501 tests passed
  (`evidence-final/loader-re.log`). Earlier receipt on the same code tree minus
  the journey script: `evidence-r3/` — validate.sh 16 runs / 2245 tests / 0
  fail, bundle 471,662 raw / 132,323 gzip (budget 524,288 / 133,120), media
  policy ok; loader suite 501/501.
- Browser/native evidence: `npm run smoke:game:tutorial-modal-callouts` against
  the built bundle on Mac Chrome (`evidence-final/journey.out`,
  `evidence-final/candidate-<scenario>-*.png`; identical pass in
  `evidence-r10/`): status `ok`, no failures, page/console/failed-response
  arrays empty at 1600x900 (scale 1), 2560x1080 (scale 1.2, stage inset 320 px)
  and 1200x1000 (scale 0.75, stage inset 162.5 px). Per member, DOM geometry
  equals the model within 1e-4 px after the stage transform: stage 10 = 8
  members (resume, quick-use, equipment, backpack) with an item in cell 0, 6
  with an empty backpack (backpack callout and pointer absent); stage 13 = 6
  members with the two-page book (resume, quick-use, hover), 9 with a third root
  page granted (concentration pointer, concentration and concentration-limit
  callouts join, hover pointer moves to the third placement). Blink samples
  (50-tick duty on the free-running application tick, sampled while the modal
  pause held the tutorial `stageTicks` frozen): stage-9 `inventory`
  hidden/visible 25/50 (stock), 23/52 (wide), 24/51 (tall); stage-12 `skills`
  26/49, 28/48, 25/50; modal `resume` 22/50, 25/48, 21/51 at stage 10 and 22/50,
  20/52, 22/50 at stage 13; stage-14 `selected-skills` 26/49, 24/51, 23/52 —
  every `blink` pointer (stage-9 `inventory`, stage-12 `skills`, modal `resume`,
  stage-14 `selected-skills`) sampled both hidden and visible; the non-blinking
  modal pointers were never hidden (`steadyHidden: 0` in every scenario).
  Stage-14 pointer DOM geometry `{ x: 810, y: 75.5, toX: 800, toY: 25.5 }` at
  1600 wide = origin `c(primary) + (30, 50)`, tip at the primary/A midpoint.
  Pre-edit symptom receipt on 69397270 with the tracked changes stashed
  (`evidence-r3/pre-journey.out`,
  `evidence-r3/pre-{stock,wide,tall}-failure.png`): the same journey fails at
  its first assertion in all three scenarios — the stage-9 inventory pointer
  sampled `blinkHidden 0 / blinkVisible 75` (76 in tall), i.e. the `stageTicks %
  removed CSS rules, not by that receipt. Journey-only iterations r4–r9 fixed
  the journey, not the port: expectations must be built from the replicated
  `ProtocolPlayerProgression` (`createGameSnapshot`), not the sim-side component
  (no `learnedSkills`); and a host-side mutation made while the client holds a
  `client-gameplay-pause` (source `skill-book`) is invisible to the client until
  the world resumes, because `broadcastSnapshot` runs only on tick advance — the
  three-page book is therefore granted while the world runs and re-opened from a
  forced stage 12; the first stage-13 close is accepted at stage 15 or 14
  because earlier forced stages leave their wave enemies alive and `enemyCount >
  2` moves 15 → 14 on the next tick.
- Remaining implementation explicitly out of scope: the blink phase
  (`blocked-by-platform`, above) — the web clock starts at page presentation,
  the native clock at `App` construction, so the hidden/visible windows are
  offset by an unrecoverable constant while the 500 ms period and 20/30 duty
  match. Commit, push, and deployment: none (not authorized); both task
  worktrees retained.

## Codex review correction and final exact-tree receipt

- Independent instruction review rechecked retail SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  `0x005C9BB0`, `0x00427800`, every Tutorial pointer call site, the stage-14
  stack argument order, `0x005C7200`, `0x005D76C0`, `0x00551A10`,
  `0x006567E0`, `0x005D6330`, and the recovered constants through the
  canonical read-only Ghidra replica wrapper. Claude's anchor formulas,
  pointer origin/tip correction, per-call blink flags, and application-clock
  conclusion are supported.
- Review found two merge-blocking gaps. The pre-review journey asserted only
  settled `p = 1`, although stages 10/13 begin when the screen pointer first
  exists and `Tutorial::Render` reads live HUD rectangles during the 40-tick
  ramp. Also, Claude's branch predated current main's corrective SkillScreen
  renderer; applying its old settled coordinates after rebase would have
  double-shifted that HUD by the newer `16.5` container offset. Both gaps are
  corrected rather than retained as caveats.
- Final Website implementation adds `native-modal-slide-progress.ts` beside
  the recovered pure layout. InventoryScreen and SkillScreen publish their
  live progress; the Tutorial plans and both HUD renderers consume the same
  value. SkillScreen's blanket offset is removed in favor of direct live
  layout coordinates. `skills-closed` now leaves stage 13 when close begins,
  matching the native close-byte edge. The original settled geometry, gates,
  texts, pointer clock, stage-14 correction, and guessed-CSS removal remain.
- Exact-tree identity: local and Mac candidate Git trees and every changed
  blob matched before validation. Mac acceptance root is
  `/Users/jarrett/codex-acceptance/tutorial-modal-callouts-review-20260825/`.
- Final Mac Website gate:
  `/opt/homebrew/bin/bash ./scripts/validate.sh` exited 0 with 16 node:test
  runs / 2,277 tests / 0 failures, 23 Python contracts, backend build and
  format clean, oxlint 0 errors (9 pre-existing warnings), production media
  policy clean, and bundle `474,053` raw / `132,873` gzip bytes within
  `524,288` / `133,120`. Evidence:
  `evidence/website-validate-final.log`.
- Final Mod Loader gate:
  `python3 tests/re/run_static_re_tests.py --ci` passed 502/502. Evidence:
  `evidence/loader-static-re.log`.
- Final Mac Chrome journey passed at `1600x900`, `2560x1080`, and
  `1200x1000` with empty page/console/failed-response arrays and 15
  screenshots. It checked every stage-10/13 member at intermediate opening
  progress (`inventory p = .075`; skills `p = .10/.125/.15`) and settled
  `p = 1`; maximum transformed DOM error was below `0.0001 px`. Every
  blinking stage-9/12/14/modal pointer sampled hidden and visible, and every
  steady modal pointer stayed visible. Evidence:
  `evidence/tutorial-modal-journey-final.log`; stock inventory/skills/selected
  screenshot SHA-256 values are `fdcd1f70...52c2`, `25649736...cb5`, and
  `7aeba557...9e75`.
- The first reviewed journey failed only because its newly added settled
  SkillScreen assertion sampled live opening positions at `p = .675/.75`
  while expecting `p = 1`; those positions agreed with the recovered live
  model. The journey was corrected to wait for the explicit settled edge,
  reran green, and the complete Website gate was repeated on that exact tree.
- Remaining visible difference: blink phase only (`blocked-by-platform` as
  above). Publication is authorized by the review request and pending the
  final fetch/fast-forward proof. Deployment remains separate and was not
  requested.
