# 2026-08-26 — Tutorial amulet aim, belt pull-off, skill details, potion hints, and College handoff correction

## Reported smells and parity questions

- Stage-10 `FOUND ITEMS GO IN...` now follows the authored amulet's live
  backpack cell, but the pointer direction still terminates at that cell's
  top-left corner. It must aim through the cell center while its painted arrow
  head stops outside the cell and leaves the amulet unobstructed.
- A learned spell can be dragged from SkillScreen into the belt, but an
  assigned icon cannot be pulled back out. The stock destination-button half
  of the edit system must be recovered rather than adding a context-menu
  delete shortcut.
- The stage-13 `HOVER OVER A SKILL ICON` lesson must produce the complete
  HoverBox on desktop, keyboard focus, and a deliberate mobile tap projection.
- Stage 17 shows only the blinking pointer over the dropped Health Potion. Is
  a missing ground-name string another web defect, or is the stock label
  intentionally absent until pickup?
- The potion art currently paints stack quantities such as `2` and `1` where
  users expect the native binding hint. Health/Mana action authority already
  uses belt slots 3/4; visible HUD copy, rebound settings, and Tutorial stage
  18 must agree with those same owners.
- Tutorial death reaches Game Over but the reported browser did not present
  the stock `RAPTISOFT GAMES PRESENTS` / College walk / Office admission. The
  2026-08-25 direct-Office parity entry is reopened, including the question of
  whether `ARCH_INTRO_0` starts automatically.

## Evidence and provenance

| Evidence class | Exact source | Material result | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same canonical image as every current Tutorial/Hub/SkillScreen report; hash reverified before the fresh queries. | high |
| Belt static path | canonical Ghidra replica via `Invoke-GhidraHeadless.ps1`; `BeltButton::vftable +0x68 -> 0x005C7DF0`, common Button ctor/press/release `0x00430430/0x00430890/0x00430A40`, clear `0x005C79C0`, sound registry `+0xCA4` | Any held nonempty belt entry clears immediately on strict pointer displacement `>50`; `+0x7B=1/+0x7C=0` makes ordinary activation release-only, so pull-off cannot cast; sound is `sounds\\poof`; burst is 24 UI-65 plus three/four UI-69 members. | high |
| Tutorial terminal/front-end path | `GameOver::Tick 0x005CF4F0`, MainMenu tick `0x005A51B0`, special bootstrap `0x005BBBB0`, startup `0x005CFA80` | Tutorial completion writes adjacent flags `0x0101`; after a strict ten-tick black handoff, the new story Game starts in special Courtyard, not Office. | high |
| College/Office path | Courtyard ctor/attach/tick/render `0x00506490/0x00503F20/0x0050C970/0x0051EB60`; Office ctor/tick `0x00509C70/0x00509F10`; Office path helper `0x00504670`; shared spline evaluator | Complete ten-point Courtyard and seven-point Office natural splines; the Office raw table is transformed by `roomCenter - 409.5`, exactly `+102.5,+102.5` in the 1024-square room; Title 7/9 alpha program, forced movement, and slowdown are instruction-derived. | high |
| Automatic Chat path | `PlayerWizard::Tick 0x00548B00`, NPC actions `+0x64/+0x68`, common action `0x00501800`, first question `0x004FD6A0` | Forward actor contact increments by two; strict counter `>10` opens Chat on the sixth eligible tick. Story path therefore auto-opens `ARCH_INTRO_0`; the Office exit remains manual. | high |
| Tutorial render/drop path | `Tutorial::Render 0x005D08C0`, stages 8/17; loot notification `0x005CA7C0/0x005D7EF0/0x005CF000` | Both ground Sack lessons render only UI-28 pointer. Item name is inserted only after accepted pickup, at the screen-top notification owner. | high |
| Potion HUD/input | `0x005CFA80`, `0x005CB360`, `0x005D3E10`, `0x005D8120`, binding name `0x004299F0` | Health/Mana are zero-based slots 3/4, defaults `3`/`4`; the plaque below each populated slot is the rebound input hint, not stack quantity. | high |
| Current web causal trace | `tutorial-modal-callouts.ts`, `SkillBook.tsx`, `SkillQuickbar.tsx`, `GameHud.tsx`, `TutorialOverlay.tsx`, `hub-world.ts`, `HubInventoryUi.tsx`, protocol/save schema 14 | Callout targets top-left; no belt-origin movement/unbind message; touch hover relies on browser focus; quantities replace key plaques; post-Tutorial state jumps directly to Office and dialogue remains explicit. | high |

## System boundary and membership inventory

Native/web boundary: the complete Tutorial teaching/edit/terminal handoff
family implicated by the reports: semantic pointer geometry, SkillScreen
HoverBox and belt editing, ground-item lesson feedback, potion belt hints, and
the first-story College/Office admission through automatic Chat. Ordinary
combat, loot selection, later story phases, and Create internals retain their
separate established owners.

| Member | Native/web source | Disposition required by this closure | Proof |
| --- | --- | --- | --- |
| stage-10 authored first-cell backpack pointer | `0x005D1540..0x005D16E6` | out-of-system as a literal target; prior requested semantic amulet-cell improvement remains | amulet moves among top-level/nested projections and pointer follows its live cell |
| amulet-cell direction target | responsive fixed-stage inventory grid | exact requested web projection | `toX/toY` are cell center; painted UI-28 tip stops outside its top edge |
| amulet equipment-sink pointer | stage-10 equipment member | verified-already-at-parity | continues to target amulet body slot center, independent of backpack index |
| all stage-10 sibling callouts/arrows | resume, quick-use, equipment, backpack | verified-already-at-parity except backpack aim | stock/75/125/mobile geometry matrix |
| learned category-1/2 card drag | `HoverButton`, `SkillDragger`, eight destination rectangles | verified-already-at-parity after prior corrective pass | strict `>3`, centered 40-square, greatest overlap, `pickskill` |
| populated BeltButton pull-off | `0x005C7DF0/0x005C79C0` | exact-ported for web skill bindings | strict `>50`, immediate one-slot null, no belt-to-belt move |
| pull-off `poof` and UI-65/UI-69 burst | registry 73 and local effect owner | exact-ported presentation | gain one; 24 plus three/four authored members; teardown after effect |
| Potion/ordinary-item BeltButton pull-off | same native handler | out-of-system for this skill-binding projection because the current product exposes those two Potion entries as fixed semantic actions and exposes no ordinary item belt assignment; no false skill unbind is inferred | native fact remains documented; fixed Potion actions retain slots 3/4 |
| quickbar replication/save | progression `skillQuickbar[8]`, host, protocol, save | exact-ported | nullable addressed update, revision, broadcast, checkpoint, reconnect |
| desktop HoverBox | SkillScreen card hit owner and `drawNativeHoverBox` | exact-ported | enter/focus shows full native lines; leave/blur clears |
| coarse-pointer HoverBox | browser lacks hover | requested input projection | tap pins the same row; tapping another changes it; background/close clears |
| level-up SkillPicker descriptions | LevelupScreen cards already contain quick descriptions | verified-already-at-parity; distinct from stage-13 SkillScreen wording | no second invented popup |
| stage-8/17 ground Sack pointer | `0x005D08C0`, first type `0x7DD` | verified-already-at-parity | live blinking pointer follows first Sack |
| visible ground item name | exhaustive Tutorial/loot render path | out-of-system because stock has none | negative render/source test; no `Health Potion` label before pickup |
| accepted pickup notification | loot notification manager | verified-already-at-parity | `Health Potion` appears at screen top only after collection |
| Health/Mana art | Inventory 46/47 | verified-already-at-parity | exact sprites remain |
| Health/Mana visible input hint | UI 22 plus Fonts group 8 | exact-ported | labels read live belt4/belt5 bindings; defaults `3`/`4` |
| stack count | recursive inventory authority and accessible button copy | exact-ported state but out-of-system as a persistent painted native badge | quantity remains available to assistive/UI tooltip copy, not substituted for binding plaque |
| Tutorial stage-18 copy | dynamic potion binding | verified-already-at-parity, strengthened coverage | same belt4 label as Health HUD, including rebound settings |
| Tutorial Game Over terminal writer | `0x005CF8AB..0x005CF913` | exact-ported | durable tutorial clear/checkpoint then College flags |
| ten-tick black front-end bridge | `0x005A51B0 -> 0x005BBBB0` | exact-ported | no ordinary title buttons or loader replay |
| Courtyard natural spline | ten complete authored points | exact-ported | cursor/strict-ten target advancement and native movement kernel |
| Title 7 `RAPTISOFT GAMES PRESENTS` | title-alpha spline through cursor 4 | exact-ported | exact atlas record, Y 250, alpha curve |
| Title 9 `SOLOMON DARK` | title-alpha spline after cursor 4 | exact-ported | exact atlas record, Y 450, uncovered-alpha product |
| special Courtyard cover | `-0.0005f` | exact-ported | fixed-tick recurrence and transition continuity |
| Courtyard Office portal | ordinary inclusive portal owner | verified-already-at-parity | scripted doorway/fade/swap remains shared |
| Office natural spline | seven complete authored raw points plus room-center transform | exact-ported | raw `(400,773)..(420,415)` becomes world `(502.5,875.5)..(522.5,517.5)` via `+102.5,+102.5`; cursor, speed-one then `*0.99000001` to `<=0.5` |
| Archchancellor collision admission | shared named-NPC contact owner | exact-ported for story auto-handoff | sixth eligible tick opens exact `_0` dialogue |
| ordinary named-NPC collision admission | same shared caller | exact-ported alongside existing click/touch/key extension | auto interaction and contextual affordance resolve the same declaration; no duplicate Chat |
| story Arch/Polisher graph/audio/markers | existing phase-zero Office closure | verified-already-at-parity | `ARCH_INTRO_0`, Polisher wipe, exact markers |
| first question acknowledgement | `0x004FD6A0` clears admission flag | exact browser lifecycle projection | stops forced walk, saves acknowledged phase, does not exit Office |
| manual Office exit -> Create | `Office::AfterSwitch 0x00504AD0` | verified-already-at-parity | Create still cannot precede Office/dialogue |
| disconnect/reload during any intro phase | browser continuation save | exact-ported portable projection | resumes phase/cursors/contact/dialogue delivery without replay/skip |
| Tutorial Boneyard descriptor retirement | host Game Over boundary before first Hub checkpoint | exact-ported portable projection | every Courtyard/Office save carries `loadedBoneyard: null`; restore never sees a Hub simulation paired with the retired Tutorial |

No requested member is browser-blocked. The one explicit browser adaptation is
tap-for-hover; Pointer Events and the native bitmap/atlas stack represent every
other mechanism directly.

## Recovered behavioral contract

- The amulet pointer direction uses the live 72-by-72 cell center, but arrow
  placement is solved separately: UI-28's painted tip remains just above the
  cell top. A target at the center does not authorize covering the icon.
- Card-to-belt assignment and belt pull-off are different native gestures.
  Pull-off is strict Euclidean displacement over 50, clears immediately, and
  never moves the binding to another slot. Ordinary BeltButton action is a
  release callback, so an accepted pull-off does not fire the removed skill.
- SkillScreen owns the detailed HoverBox. Desktop hover/focus and mobile tap
  select the same `hoveredSkillId`; level-up SkillPicker quick descriptions are
  not a substitute for this lesson.
- Stock gives the player no floating ground-name label. Stage 17 deliberately
  supplies only the pointer. `Health Potion` text begins at accepted pickup.
- Health and Mana action/default labels are respectively `belt4 -> 3` and
  `belt5 -> 4`. Rebinding either slot changes input, plaque, tooltip/ARIA, and
  Tutorial copy from the same settings object.
- Post-Tutorial startup is not the process loader and not the ordinary static
  title menu. It is a black ten-tick handoff into the first story Game, whose
  Courtyard painter owns Title records 7/9 while authority forces the wizard
  along the authored College spline.
- Office spline rows are room-local, not world-local. `0x00504670` adds
  `roomCenter - 409.5` to both axes, so the retail room applies
  `+102.5,+102.5` before movement/contact ownership consumes the target.
- The second authored spline carries the wizard inside the Office. Named-NPC
  interaction is collision-driven; the Archchancellor dialogue auto-starts on
  the sixth continuous eligible contact tick. The player then controls the
  dialogue and later physically exits the Office to open Create.

## Implementation consequence

- Keep Tutorial callout planning pure and expose an aim/painted-tip helper so
  cell-center direction and non-obstruction are tested independently.
- Extend the authoritative nullable quickbar update through client, protocol,
  host, progression, broadcast, and save checkpoint. Feed both SkillScreen and
  live HUD belt gestures from the same strict pull-off predicate and effect
  owner.
- Make SkillScreen touch selection explicit instead of relying on iOS button
  focus side effects.
- Reuse the existing extracted native keyboard-plaque primitive for Potion
  slots; remove the misleading painted quantity digit.
- Replace `college-intro`'s direct-Office fade with a participant-local,
  serialized College admission owner containing phase, Courtyard/Office path
  cursors, title cursor/cover, speed decay, contact count, and dialogue
  acknowledgement. Reuse `native-natural-spline.ts`, shared player movement,
  ordinary portal transitions, story NPC declarations, and existing dialogue
  renderer/audio.
- Admit the full `acknowledge-college-intro-dialogue` protocol discriminator;
  its 35-character stock-lifecycle projection exceeds the former generic
  32-character Hub-action bound and must not disconnect the client before the
  acknowledgement checkpoint.
- Bump wire/save schemas because nullable unbind and resumable College state
  change accepted authoritative shapes. Publish checkpoints at pull-off,
  Tutorial terminal handoff, Courtyard-to-Office, automatic dialogue, first
  dialogue acknowledgement, and existing Create/settlement boundaries.
- Do not add a ground label, generic splash video, direct Office teleport,
  timer-only fake walk, or automatic Office exit.

## Validation contract

- Pure/unit: amulet at several backpack/nested positions aims at exact cell
  center with painted tip outside; strict pull-off 50/greater-than-50; addressed
  null mutation and duplicates; desktop hover/leave/focus and coarse tap; live
  Potion labels under default and rebound controls; stage-17 negative ground
  text plus post-pickup notification.
- College kernel: every authored path/title point, natural-spline samples,
  target cursor strictness, title 7/9 switch, cover recurrence, Courtyard
  portal, Office slowdown, sixth-contact automatic target, acknowledgement,
  manual-exit/Create, and no replay after settlement.
- Protocol/save/host: reject malformed phases/cursors/nulls; full/delta and
  schema migration; mid-Courtyard, mid-Office, pre-dialogue, and acknowledged
  reconnect; ordered checkpoint reasons and profile/continuation separation.
- Browser on the Mac mini: desktop and mobile stage-10 pointer pixels;
  SkillScreen assign then pull-off with poof/burst/save receipt; hover and tap
  HoverBox; default/rebound Potion plaques/Tutorial text; stage-17 pointer-only
  before pickup and notification after; real Tutorial Game Over through Title
  7, Title 9, Courtyard walk, Office walk, automatic `ARCH_INTRO_0`, manual
  Office exit, and Create. Require empty page/console/network/host errors.
- Run the exact Website canonical gate and Mod Loader registered static RE
  suite on byte-identical clean Mac candidates. No validation command runs on
  Windows/WSL.
