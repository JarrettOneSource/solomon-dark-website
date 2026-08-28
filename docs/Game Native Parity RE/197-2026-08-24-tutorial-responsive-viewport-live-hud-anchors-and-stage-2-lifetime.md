# 2026-08-24 — Tutorial responsive viewport, live HUD anchors, and stage-2 lifetime

## Reported smell and parity question

- Reported web behavior: the Midnight prelude is off-center on large monitors;
  the post-Solomon Magic Missile copy flashes and disappears; and the stage-5
  secondary-spell copy/arrow misses its slot across large desktop, mobile, UI
  scale, and later HUD-position changes.
- This reopens the Tutorial presentation entry above. The earlier pass proved
  the stock 1600 x 900 frame and pointer asset, but then hard-coded those sample
  coordinates and called every live target `exact-ported`. It skipped the
  viewport-size, UI-scale, coarse-pointer, and independently moved-HUD branches
  even though the native renderer resolves widget rectangles every frame.
- Stock questions: which owner supplies screen width/height; which targets are
  live rectangles; what are all sibling pointer offsets; and is stage 2 a web
  lifecycle regression or a retail-authored transient?
- Falsifiers: a fixed native 1600 x 900 child surface; any in-world pointer
  indexing a static coordinate table; stage 2 waiting after ten live enemies;
  or a responsive web layout in which the overlay and target share one
  unchanged coordinate space.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same executable and analyzed program as the complete Tutorial entry. | high |
| Existing static packet | `/mnt/d/codex-evidence/tutre-20260801/raw/01_core_tutorial_control_decompile.txt`, `09_tutorial_key_instructions.txt`, `13_tutorial_trigger_tree.txt`, `15_tutorial_script_command_decompile.txt`, `17_script_runtime_helpers.txt` | `0x005D08C0` consumes live dimensions/widget rectangles; `0x0068B060` drains non-blocking script commands; wave 1 creates ten enemies and stage 2 exits on `>5`. | high |
| Fresh canonical replica | read-only pooled `dump_floats_at.py` through the task Mod Loader wrapper; project/program `SolomonDark/SolomonDark.exe` | Pointer constants are 70/50/40/30/100 at `0x00787C40/0x007847C8/0x00784650/0x00784D50/0x007DE908`. | high |
| Current Website source | `TutorialOverlay.tsx`, `TutorialPrelude.tsx`, `tutorial.css`, `BoneyardScene.tsx`, `GameHud.tsx`, `SkillQuickbar.tsx`, `hub.css` at `4a81a616` | Overlay/prelude are fixed 1600 x 900; bottom baselines and all in-world pointer endpoints are literals; the HUD independently expands, scales 75..125%, and moves slot 0 into a touch bank. | high |
| Prior ledger contradiction | preceding UI target row and behavioral contract | They promise semantic live controls but the implementation receipt had no large/coarse/UI-scale target measurement. | high |

## System boundary and membership inventory

Native system: the Tutorial local presentation owner from viewport-relative
prelude/text layout through every in-world and modal pointer target, render-time
tracking, stage visibility, and teardown. Authority, authored waves, combat,
and narration remain unchanged except for dispositioning stage-2 lifetime.

| Member | Native/web source | Disposition | Proof |
| --- | --- | --- | --- |
| Prelude record 43 center | `0x005D08C0`; live Tutorial width/height | exact-ported | center of current logical viewport at stock, large, tall, and mobile aspect ratios |
| Prelude skull record 68 | same owner; center X and `350-100*blend` Y in 900-high instance | exact-ported | responsive center X while preserving recovered Y/blend lane |
| stages 0/2/11/19 top copy | `0x005C9710/0x005C9960` | exact-ported | live horizontal center, fixed native top baselines |
| stages 5/9/12/18 bottom copy | `0x005D0DC6`, `0x005D10C6`, `0x005D17A3`, `0x005D207A` | exact-ported | baselines `viewportHeight-170/-140`, not 730/760 literals |
| stage-5 secondary slot pointer | Game widget `+0x600`; origin `(-70,-50)` | exact-ported | follows live slot-0 center under desktop width, UI scale, touch-bank layout, and runtime movement |
| stage-9 inventory pointer | Game widget `+0x240`; origin `(-40,-40)` | exact-ported | follows live backpack control |
| stage-12 skills pointer | Game widget `+0x300`; origin `(+40,-40)` | exact-ported | follows live tome control |
| stage-14 selected-HUD lesson | preceding selected-skill HUD closure; widgets `+0x480/+0x3C0` | verified-already-at-parity after `06c99f3e` | shared selected-HUD layout owns the exact pointer, two text rows, and acknowledgement lifecycle; this generic resolver does not duplicate it |
| stage-18 potion pointer | Game widget `+0x8C4`; origin `(-50,-30)` | exact-ported | follows live red-potion control |
| stage-18 HP pointer | Game widget `+0x3C0`; origin `(-100,+70)` | exact-ported | follows live health display |
| stage-8/17 Sack pointers | live camera projection plus current viewport clamp | exact-ported | no 1600 x 900 clamp on expanded viewport; authoritative blink retained |
| stage-10 inventory modal targets | common pointer; modal-owned resume/quick/equipment/first-backpack anchors | verified-already-at-parity | target and overlay share the same fixed 1600 x 900 transformed stage |
| stage-13 skill modal targets | common pointer; modal-owned resume/quick/concentration/hover anchors | verified-already-at-parity | same fixed-stage ownership |
| UI scale 75/100/125 percent | transformed `.hub-hud` | exact-ported browser projection | physical target center maps back to overlay logical coordinates |
| coarse-pointer quickbar banks | `mobile-quickbar-layout.ts` and coarse CSS | exact-ported browser projection | slot-0 semantic anchor, never desktop offset reuse |
| arbitrary later HUD translation | native per-render rectangle lookup; browser DOM geometry | exact-ported browser projection | next presentation frame tracks the moved target without remount |
| stage-2 Magic Missile copy | `0x005D6330`; script 10002; `0x0068B060`, `0x0046C710`, `0x00473390` | verified-already-at-parity | ten immediate enemies make `enemyCount > 5` true on the next 100-Hz Tutorial tick |
| overlay exit / subscription teardown | Tutorial removal, world replacement, React unmount | exact-ported | no presentation-frame listener or stale target survives teardown |

> Reopened 2026-08-25: the `stage-10 inventory modal targets` and `stage-13 skill modal targets` rows above were dispositioned without extracting the per-member anchor math; see the 2026-08-25 entry, which supersedes them.

## Native ownership thread

- `Tutorial::Render 0x005D08C0` owns the copy and pointers. It reads its active
  UI context dimensions and centers copy at `width/2`; bottom instructions use
  `height-170` and `height-140`.
- Each in-world arrow resolves a Game-owned widget rectangle through
  `0x00403730` during that render, derives a case-specific origin, and calls the
  one pointer primitive `0x005C9BB0`. No arrow owns a cached DOM-equivalent
  coordinate or independent timer.
- Stage 14 delegates that rule to the preceding selected-HUD closure, which
  consumes the live primary/concentration layout and its acknowledgement gate.
  The generic responsive resolver owns only stages 5, 9, 12, and 18.
- Modal branches reparent the Tutorial owner into the inventory/skills surface;
  their targets remain in the same transformed fixed stage. World arrows take
  a fresh type-`0x7DD` actor projection each presentation frame.
- Separately, Solomon combat release enters stage 2 and starts script 10002.
  `ScriptThread::Tick 0x0068B060` drains its non-blocking loop in one tick,
  `0x0046C710` constructs both five-member groups, and each `0x00473390`
  constructor increments `0x0081984C`. The next Tutorial tick takes the exact
  `>5` branch into blank stage 3.

## Recovered behavioral contract

- The web overlay uses the current logical Boneyard viewport. Physical browser
  scaling is applied once by the native frame; target DOM rectangles must be
  mapped back into that logical coordinate space.
- Copy keeps stock fonts, gold/shadow layers, and vertical baselines. Only the
  values native derives from current width/height remain dynamic.
- In-world arrows target the semantic live controls above and update every
  presentation frame. UI scale, media-query bank placement, and later CSS
  translations are inputs, not special cases.
- Stage-2 copy remains a one-tick native transition. Adding a minimum display
  timer, holding until narration completes, or delaying the second five-enemy
  group would change retail behavior.

## Nearby-system findings

- `GameHud` and `SkillQuickbar` already expose stable semantic controls for the
  stage-5/9/12/18 targets; adding anchor identity to those owners is deeper than
  duplicating their CSS formulas in the Tutorial.
- The shared presentation scheduler already owns browser-frame work. A
  Tutorial subscriber can measure only while mounted and publish React state
  only when a target actually moves.
- `Mod Loader/docs/re/tutorial-mechanics.md` now records the viewport contract,
  complete movable-HUD target table, exact offsets, and the stage-2/script
  chronology.

## Confidence and open questions

- Confirmed: native dimension owner, all stage-5/9/12/18 target families and
  offsets, delegation to the separately closed stage-14 selected-HUD owner,
  stage-2 predicate, wave-1 membership, script drain bound, and immediate
  enemy-count writer.
- No extractable native member remains unknown. Browser DOM measurement is an
  ownership projection, not a behavioral approximation; it recovers the same
  participant-local rectangle truth after CSS transforms.
- No `blocked-by-platform` member exists in this boundary.

## Web implementation consequence

- Expand the in-world Tutorial layer to the logical viewport and make the
  prelude fill its owning layer. Parameterize bottom baselines by live height.
- Add semantic anchor attributes at the owning stage-5/9/12/18 HUD controls.
  One Tutorial geometry resolver maps their current client rectangles into
  overlay-local coordinates and builds those pointers from the recovered
  native offsets; retain the selected-HUD stage-14 owner unchanged.
- Preserve the modal fixed-stage branch and authoritative stage-2 kernel. Remove
  the five hard-coded in-world pointer endpoint pairs and the fixed world clamp.

## Validation contract

- Focused tests: 900/1080-height baselines; client-to-logical rectangle mapping;
  all stage-5/9/12/18 pointer plans and offsets; the preceding stage-14 layout
  contract; missing-target behavior; stage-2 one-tick transition; and listener
  teardown.
- Browser journey on Mac Chrome: stock 1600 x 900, large 2560 x 1080, mobile
  landscape coarse pointer, UI scale 75/125, and a runtime HUD translation.
  For each, compare pointer endpoint against the target center and require it
  to update on the next presentation frame. Capture the large prelude center.
- Run the canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  manifest-identical Mac tree with empty page, console, failed-response, wire,
  and host-error arrays.

## Implementation validation receipt

- The in-world Tutorial and prelude now consume the live logical Boneyard
  viewport. Stages 5, 9, 12, and 18 resolve semantic HUD rectangles on each
  shared presentation frame; the separately closed selected-HUD owner retains
  stage 14. Modal stages 10/13 remain on their fixed native surface.
- The exact final merge passed the focused Windows Tutorial group `22/22`,
  including the one-tick stage-2 transition, responsive baselines, every
  stage-5/9/12/18 offset, missing targets, and the upstream selected-HUD
  acknowledgement/layout contract. The rebased Mod Loader candidate passed
  all `499/499` CI-safe static RE contracts on macOS Python 3.12/Pillow 12.2.
- Before the final upstream selected-HUD/Flydirt/rain rebase, the responsive
  candidate passed the complete canonical Mac `./scripts/validate.sh`,
  including the fixed-tick Lua performance sentinel, every frontend/desktop
  group, production builds, media policy, and bundle budget; log SHA-256 is
  `d086ae828febf54543dbe7dd5f393897bd31ad54c5aef0279538d88c6d4be880`.
  The exact final merge was then rebuilt on both Windows and Mac; the Mac game
  entry is `129640/131072` gzip bytes.
- Built production Chrome `151.0.7922.170` passed on Windows and macOS 26.6.2
  across stock `1600x900` at 100%, desktop `1920x1080` at 75%, large
  `2560x1080` at 125%, and coarse-pointer mobile `896x414`. Every scenario
  reported empty page, console, and failed-response arrays.
- Prelude record 43 matched the overlay center exactly in every journey:
  stock `(800,450)`, 75% desktop `(960,540)`, large `(1280,540)`, and mobile
  physical `(447.99688720703125,207)`. The final large and mobile screenshots
  were visually inspected and show the Midnight card centered.
- The stage-5 pointer endpoint equaled the measured slot-0 center in every
  initial and moved frame. A live `translate(80px,-25px)` moved the logical
  endpoint by `(80,-25)` at 100%, `(60,-18.75)` at 75%, and `(100,-31.25)` at
  125%, without remounting; coarse mobile followed the left quickbar bank.
- Final Mac evidence hashes: responsive journey log
  `cce93a2e5873125167d5b0a488ece029807906c90148f8c9b75b66fcfc674aa7`,
  large prelude
  `10e19be531a449fdbd48e7f9ddbb7acb799e32d12cf0ccd9949d749837d69b18`,
  large stage 5
  `098242bbc24a1a6fb90149dd6c2cf80db87abb929f495dfc785e030d02a01c31`,
  mobile prelude
  `9de55cee54c62f7d1a74fc5563aa3b96de865efb78bc188b8c0fabca1a34035f`,
  and mobile stage 5
  `754ba60127b37914dcf55203ac7f31b068a87d94c35f9bb0c98ff10f70e01da7`.
- The post-Solomon Magic Missile heading remains deliberately unmodified: two
  five-skeleton groups become live in the same script tick, so the next 100-Hz
  Tutorial tick takes `enemyCount > 5` into blank stage 3. A display hold would
  diverge from retail.
- No push or deployment was performed; those remain separate operations.
