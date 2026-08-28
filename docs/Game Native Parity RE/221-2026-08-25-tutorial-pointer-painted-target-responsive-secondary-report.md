# 2026-08-25 — Tutorial pointer painted-target responsive secondary report

## Reported smell and parity question

- Reported mobile behavior: the pointer beside `Found items go in your
  backpack...` does not appear to point at the intended backpack location, and
  the preceding `ACCESS YOUR INVENTORY` pointer also misses its visible
  Inventory control.
- Reopen statement: the 2026-08-24 responsive closure tracked live target
  centres, and the 2026-08-25 modal closure checked the pointer element centre
  against its native origin/direction metadata. Neither closure checked the
  painted UI-28 arrowhead against the visible target. Calling a target-centre
  equality check painted-arrow proof skipped the shared quad scale/pivot and
  allowed every responsive sibling to retain the same false assumption.
- Stock behavior to preserve: `Tutorial::Render` draws the one centred
  58-by-61 UI-28 quad at each recovered origin and rotates it toward a second
  direction point; fixed modal members share the modal's native-stage
  transform, while HUD members read live widget rectangles on every render.
- Reproduction: current `origin/main` `f267cc6204c612f9156205e454640f1e4f753cf0`,
  Mac Chrome mobile context `896x414`, touch/coarse pointer, UI scale 100,
  natural stage 8->9->10 amulet journey plus the complete modal fixture.
- Falsifiers: a native primitive that places UI 28 by its top-left or tail; a
  direction pair used as a second draw position; a fixed-modal pointer whose
  painted head does not meet its recovered fixed target; or a responsive HUD
  control whose target rectangle remains native-sized after CSS/UI scaling.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same canonical analyzed retail image as the Tutorial closure. | high |
| Static instructions | read-only Ghidra replica wrapper; `0x005C9BB0`, `0x00414F90`, `0x00414540`, `0x004142E0`; `trace_call_arguments.py 0x005C9BB0 6 1` | There are 15 direct pointer calls, all in `Tutorial::Render`; the first pair translates the centre of UI 28's four-vertex quad, the second pair only determines rotation. | high |
| Asset/data | UI record 28, crop `(202,656,58,61)`, logical `58x61`, trim `(0,0)`, no points; alpha bounds `(2,2)..(55,59)` | The painted head is the rotated top of one centred quad; there is no alternate mobile arrow or authored hotspot. | high |
| Web causal trace | `TutorialOverlay.tsx`, `tutorial-hud-anchors.ts`, `GameHud.tsx`, `SkillQuickbar.tsx`, `hub.css` at `f267cc62` | Browser code maps only target centres. Inventory/Tome art becomes `116x124` on coarse input while UI 28 and native `40x40` origin offset remain scale 1; settings UI scale has the same mismatch. Stage 14 still uses fixed 1600-wide geometry instead of its live selected-skill controls. | high |
| Current mobile baseline | Mac acceptance root `/Users/jarrett/codex-acceptance/tutorial-arrow-targets-20260825-root`; `baseline-website-validate.log`, `baseline-modal.log`, `baseline-amulet.log` and screenshots | The full gate and both old mobile journeys pass because they compare metadata. The selected-HUD screenshot visibly places its pointer/text about 80 CSS px left of the actual top-centre skill controls; stage-9 coverage samples blink but never captures or measures the visible arrow. | high |

## System boundary and membership inventory

Native system: the complete Tutorial UI-28 pointer family, including its
centred-quad painter, every call site, live target provider, responsive browser
projection, blink branch, render order, and unmount/teardown.

| Member | Native source / target owner | Disposition | Proof |
| --- | --- | --- | --- |
| shared UI-28 centred quad and rotation | `0x005C9BB0 -> 0x00414F90 -> 0x00414540`; UI 28 | `exact-ported` in this closure | common pointer scale/rotation contract and painted-head browser measurements |
| stage-5 secondary-slot pointer | `0x005D0EFA`, live `53x53` belt control | `exact-ported` in this closure | stock, UI-scale, moved-HUD, and coarse-bank target/scale receipts |
| stage-8 first-Sack pointer | `0x005D10B6`, live world projection | `verified-already-at-parity` | world and pointer share Boneyard logical/display transform; blink receipt retained |
| stage-9 Inventory pointer | `0x005D11F8`, live backpack control | `exact-ported` in this closure | visible-art anchor, target scale, painted mobile landing, both blink phases |
| stage-10 resume pointer | `0x005D133E`, live slid backpack control | `verified-already-at-parity` plus new painted-landing proof | fixed modal stage, progress `0..1`, blink phases |
| stage-10 quick-use pointer | `0x005D143C`, belt 7 origin / belt 6 direction | `verified-already-at-parity` plus new painted-landing proof | fixed modal stage, progress `0..1`, steady visibility |
| stage-10 equipment pointer | `0x005D1529`, STAFF/WAND sink | `verified-already-at-parity` plus new painted-landing proof | fixed modal stage, exact sink rect, steady visibility |
| stage-10 first-backpack-cell pointer | `0x005D16E1`, InventoryGrid cell-0 top-left | `verified-already-at-parity` plus new painted-landing proof | natural third-row amulet and fixture cell-0 cases; head meets cell-0 top edge |
| stage-12 Skills pointer | shared `0x005D11F8` tail, live tome control | `exact-ported` in this closure | visible-art anchor, target scale, painted mobile landing, both blink phases |
| stage-13 resume pointer | `0x005D1A00`, live slid tome control | `verified-already-at-parity` plus new painted-landing proof | fixed modal progress and blink receipts |
| stage-13 quick-use pointer | `0x005D1AF5`, belt 1 | `verified-already-at-parity` plus new painted-landing proof | fixed modal progress, steady visibility |
| stage-13 concentration pointer | `0x005D1B9B`, page 2 root | `verified-already-at-parity` plus new painted-landing proof | third-page gated fixed-stage receipt |
| stage-13 hover pointer | `0x005D1CD9`, page 0 root | `verified-already-at-parity` plus new painted-landing proof | first-page gated fixed-stage receipt |
| stage-14 selected-HUD pointer and two lines | `0x005D1DE9`; primary / concentration-A live controls | `exact-ported` in this closure | actual DOM control centres, current viewport/UI scale, copied text offsets, blink phases |
| stage-17 first-Sack pointer | `0x005D206A`, live world projection | `verified-already-at-parity` | same world-pointer owner as stage 8 |
| stage-18 health-potion pointer | `0x005D21BE`, live red-potion control | `exact-ported` in this closure | visible-art rather than enlarged touch-hitbox anchor and scale receipt |
| stage-18 health-meter pointer | `0x005D2274`, live health control | `exact-ported` in this closure | dynamic width centre plus uniform HUD-scale receipt |
| application-clock blink branches | `App+0x28`, `%50 > 19` | `verified-already-at-parity` | every blinking family samples hidden and visible; steady modal siblings never hide |
| stage/modal/world teardown | Tutorial stage exit, modal close, world replacement, React unmount | `verified-already-at-parity` | no pointer/measurement subscriber survives its owner |

No second pointer asset, pointer factory, per-stage hotspot table, audio call,
random branch, collision/hit target, or replicated pointer state exists.

## Native ownership thread

- `Game` owns the Tutorial object; `Tutorial::Render 0x005D08C0` is the only
  caller owner. Fifteen direct calls cover sixteen logical stage members
  because stages 9 and 12 share the `0x005D11F8` tail.
- HUD layout writers own control rectangles; InventoryScreen/SkillScreen own
  modal progress and fixed-stage anchors; world registration/camera projection
  owns Sack positions. The pointer never caches a target.
- `0x005C9BB0` owns blink and angle. `0x00414F90` translates/rotates the
  centred record; `0x00414540` transforms all four vertices. The direction
  pair is not the painted head and does not affect translation or scale.
- The browser's deliberate HUD UI-scale and coarse-pointer transforms are
  presentation inputs. Their analogous native composition is a similarity
  transform of target centre, origin offset, and UI-28 quad together.
- Leaving a stage, closing a modal, replacing the world, or unmounting the
  overlay removes its pointer and presentation-frame measurement owner.

## Recovered behavioral contract

- Native logical pointer size is `58x61`; visible alpha occupies
  `(2,2)..(55,59)`. Rotation is
  `atan2(direction.x-origin.x, direction.y-origin.y)` under the native axis
  convention, equivalent to the web's CSS `atan2(dy,dx)+90` for the up-facing
  atlas record.
- At native target scale 1, every recovered origin/direction coordinate remains
  unchanged. A browser-only uniform HUD transform `s` maps a live HUD target
  centre normally and maps the member's origin offset and UI-28 quad by the
  same `s`. Translation-only movement changes no scale.
- Target scale comes from the painted target owner's live rectangle relative
  to that member's native control height: secondary 53, backpack/tome 62,
  red potion 50, health meter 20, selected-skill control 65. Visible artwork,
  not an oversized transparent touch hitbox, owns art-target members.
- Fixed modal pointers remain scale 1 inside the 1600-by-900 modal stage;
  their owner stage applies the one outer display transform to canvas,
  callouts, pointer, and target. World pointers likewise remain scale 1 inside
  the already responsive Boneyard logical viewport.
- Stages 9 and 12 share a centred bottom control and the same native copy
  relation: target centre `y=855`, subheading baseline `760`, heading baseline
  `730`. For target scale `s`, the browser keeps the subheading at
  `target.y - 95s` and the heading 30 logical pixels above it. This is exactly
  `760/730` at `s=1` and preserves the pointer-to-copy clearance when the
  mobile Inventory/Tome art and UI-28 quad are doubled.
- Draw order, callout text/frames, 30-visible/20-hidden tick blink, modal gates,
  stage transitions, input, audio, authority, replication, and teardown do not
  change.

## Nearby-system findings

- The stage-14 screenshot falsifies the preceding entry's
  `verified-already-at-parity` disposition: its fixed x=800 layout ignores the
  expanded mobile logical viewport, even though the primary/concentration
  action controls already expose stable DOM owners.
- The first corrected stage-9 mobile screenshot then falsified a second
  metadata-only assumption: the pointer landed on the doubled Inventory art
  but covered `ACCESS YOUR INVENTORY` because the copy remained at the
  unscaled bottom baselines. The shared stage-9/12 target-relative baseline
  rule above removes that overlap without changing the stock scale-1 frame.
- The natural Tutorial correctly starts with Health and Mana potions at
  backpack indexes 0/1 and inserts the authored amulet at index 2. Native stage
  10 deliberately points to InventoryGrid cell 0, not specifically to the
  newly acquired amulet; changing that target would be non-stock.
- The Mod Loader `native-hud.md` pointer primitive now owns the corrected
  centre-versus-direction terminology, full 15-call membership, pivot proof,
  and responsive-composition consequence.

## Confidence and open questions

- Confirmed: executable identity, all calls, quad pivot, record dimensions and
  alpha bounds, every target owner/offset, current mobile/UI-scale target size,
  stage-14 drift, modal fixed-stage alignment, blink, and teardown.
- Unknowns: none material. A stock mobile branch does not exist; applying the
  browser's own uniform HUD transform to the complete native pointer
  composition is the exact representable projection, not a guessed offset.
- `blocked-by-platform`: none.

## Web implementation consequence

- Extend semantic HUD anchors from centres to centre-plus-uniform-scale, using
  the visible backpack/tome/potion artwork where the touch hitbox is larger
  than what is painted.
- Scale every responsive HUD pointer's recovered origin offset and centred
  UI-28 quad together. Keep modal/world pointer scale exactly 1.
- Move stage 14 onto the same live primary/concentration anchor owner and scale
  its pointer plus two text offsets as one composition; remove the fixed
  1600-wide Boneyard-side selected-HUD plan.
- Project the shared stage-9/12 instruction baselines from the same live
  Inventory/Tome scale so the corrected arrow cannot cover its own copy.
- Replace metadata-only acceptance with visible-pointer screenshots and
  painted-head/target geometry receipts across the entire membership.

## Validation contract

- Focused tests: stock scale 1 preserves every native coordinate; 75/125 UI
  scale and 2x coarse Inventory/Tome/selected-control transforms scale origin
  offsets and pointer quads; translation changes only centres; missing siblings
  omit only their pointer; stage-9/12 scale-1 and 2x copy clearances; modal
  plans retain scale 1 and exact rows/order.
- Mac Chrome journeys: natural touch stage 8->9->10 and the full stock/wide/
  tall/touch modal matrix. Capture stage 9 while its pointer is visibly painted;
  prove its target against the visible Inventory art, and prove the stage-10
  backpack arrowhead meets cell 0. Repeat painted-target receipts for all
  stage-10/13 arrows, stages 5/12/14/18, and both world arrows.
- Run Mod Loader `python3 tests/re/run_static_re_tests.py --ci` and Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on byte-identical Mac trees;
  require empty page/console/failed-response/wire/host error arrays.

## Implementation validation receipt

- Implementation: responsive semantic targets now publish centre plus uniform
  target scale from the painted owner. Inventory/Tome/health-potion anchors
  moved from oversized touch hitboxes to their visible stock art; secondary,
  health-meter, primary-skill, and concentration-A controls retain their own
  live rectangles. Every responsive origin offset and the centred UI-28 quad
  consume that scale. Stage 14 now derives its pointer and both text offsets
  from live primary/concentration centres instead of the fixed x=800 plan.
  Stages 9/12 derive copy clearance from the same target scale; modal/world
  pointers remain scale 1 inside their existing outer transforms.
- Red/green regression: the tests-only Mac gate failed on the missing
  `nativeTutorialSelectedHudLayoutFromCenters` export. The first implemented
  gate then reached the new `47/47` Tutorial group and exposed only a strict
  `834.9999999999999` versus `835` test comparison; the renderer-tolerance
  assertion replaced that exact-equality mistake and the complete gate passed.
- Exact-tree identity: all 12 Website changed blobs and all three Mod Loader
  changed blobs match byte-for-byte between the local isolated worktrees and
  `/Users/jarrett/codex-acceptance/tutorial-arrow-targets-20260825-root`.
- Mac automated gates: Website `/opt/homebrew/bin/bash ./scripts/validate.sh`
  exits zero with the complete backend/frontend/desktop/build/media contract;
  Tutorial family `47/47`; production game entry `474599` raw / `133074` gzip
  against `524288` / `133120`. Mod Loader
  `python3 tests/re/run_static_re_tests.py --ci` passes `505/505`, including
  the newly registered centred-quad/15-call contract. Logs:
  `evidence/final-website-validate.log` and
  `evidence/green2-loader-static-re.log`.
- Four-viewport Mac Chrome modal matrix: stock `1600x900`, wide `2560x1080`,
  tall `1200x1000`, and touch `896x414` all report empty page, console,
  failed-response, and host-error arrays. Stock target scale remains 1 with
  heading/subheading `730/760`. Touch Inventory scale is
  `1.9999992295702578`, target `(908.9125719393078,835.0000132685122)`,
  origin `(828.9126027564974,755.0000440857019)`, and clear copy baselines
  `615.0000864593378/645.0000864593378`. The fixed stage-10 backpack
  arrowhead is `(105.7853889465332,226.70042419433594)`, horizontally inside
  cell 0 `[91.04000091552734,124.16000366210938]` and 1.46 CSS px above its
  `228.16000366210938` top edge. Maximum fixed-modal DOM error remains below
  `0.0001` CSS px. Log: `evidence/final-modal.log`.
- Sibling receipts: touch stage 14 reads live primary
  `(953.9129111476258,25.499999523162842)` and concentration-A
  `(993.9131758088961,25.499999523162842)`, then paints direction midpoint
  `(973.913043478261,25.499999523162842)` and origin
  `(983.9129107648803,75.4999988852536)`. Responsive stock/75/125/mobile
  scenarios prove pointer scale equals target scale for stage 5 and both
  stage-18 pointers; every scenario has empty browser error arrays. Log:
  `evidence/final-responsive.log`.
- Natural mobile journey: the real authored Sack/pickup path at `896x414`
  captures stage 9 only after UI 28 is visibly painted, opens Inventory through
  the touch backpack, retains both stage-10 callout families, equips the
  authored amulet, and reports empty page/console/failed-response/wire arrays.
  Screenshots: `evidence/final-amulet-stage-9-inventory-prompt.png` and
  `evidence/final-amulet-stage-10-item-info.png`; log:
  `evidence/final-amulet.log`.
- Visual inspection: the final stage-9 copy is above and clear of the scaled
  arrow, whose head lands on the painted backpack; the `Found items...` arrow
  lands at cell 0; stage-14 copy/pointer sits beside the actual top-centre
  skills; and stage-18 potion/health arrows point to their visible controls.
- Unknowns / platform differences: none. Commit is local only; push and
  deployment were not requested or performed. Task worktrees and named Mac
  evidence remain retained pending publication authorization.
