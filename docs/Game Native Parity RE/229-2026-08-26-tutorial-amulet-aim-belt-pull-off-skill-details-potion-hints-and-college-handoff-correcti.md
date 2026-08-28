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

## 2026-08-28 — Shared-Tutorial College continuation save attachment

### Reported smell and parity question

- Reported web behavior: a player disconnected while the automatic College
  introduction was presenting the Archchancellor dialogue. `LAST GAME` then
  failed with `Hub game save carries a Boneyard`.
- Stock/browser behavior to preserve: the completed Tutorial hands its wizard
  into the College admission program. A browser continuation taken anywhere in
  that Courtyard/Office/Create sequence must resume the exact Hub phase without
  reattaching the completed Tutorial Arena.
- Reproduction: start the stock Tutorial from the shared Hub, cross its
  automatic Game Over handoff into College, request the deployment-final save
  while the Arch dialogue owns the surface, then load that document on the
  replacement shared host.
- Falsifiers: any Hub continuation still containing a Boneyard descriptor; any
  active Boneyard continuation losing its matching descriptor; an ordinary
  post-run loadout becoming resumable; an arbitrary forged Hub/Boneyard pair
  being accepted; College cursor/dialogue/loadout replay or loss; or a
  deployment-final checkpoint differing from explicit-leave/autosave output.

This reopens the 2026-08-26 College-admission row named `Tutorial Boneyard
descriptor retirement`. That pass proved only the standalone host member. It
did not enumerate the shared-world run container, whose Tutorial simulation
legitimately becomes a Hub-shaped isolated College admission before final
Create confirmation. The missing shared sibling is the process failure.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | `solomon-dark-game.service` structured journal, 2026-08-28 `14:41:16.954Z..14:41:28.709Z` | Protocol-99 deployment requested the final checkpoint and disconnected the player for target `6c8ac194`; protocol 100 then rejected the resume on the shared Hub with the exact reported message. The host stayed up. | high-live |
| Deployed identities | producer `36b140621ed99217f062a422a5731123bf54fe09` (protocol 99); consumer `6c8ac1940d6ff858b3183ec09073e7ed7c46eb72` (protocol 100) | The checkpoint was authored immediately before the planned cross-revision disconnect; this is not an old idle save or an unplanned transport failure. | high |
| Current causal trace | Website `8279c379`; `stepSharedGameWorlds`, `sharedPartySaveStateForPlayer`, `sharedLoadedBoneyardForPlayer`, `publishSaveCheckpointForClient`, `createGameSaveDocument`, `restoreGameSaveDocument` | A completed shared Tutorial remains in its party-run container while College admission is pending. Its save-state projection is Hub, but the independent attachment lookup still returns the container's stock-Tutorial descriptor. The encoder permits that split pair and the strict decoder rejects it. | high |
| Existing positive control | `game-host.test.ts`, `Tutorial Game Over clears its Boneyard before the first College checkpoint` | The standalone host clears its scalar `loadedBoneyard` before the Hub checkpoint. It does not exercise `sharedWorlds.runs`, which explains the false closure. | high |
| Mac browser red after save repair | current-main `a1ae89af`; Chrome 151; exact schema-19 Hub/Arch continuation with the stale stock-Tutorial descriptor | `LAST GAME` reached the Office and rewrote a clean `loadedBoneyard:null` continuation, but the rewritten authoritative College phase was already `null`. `HubScene` opened the restored College dialogue while match loading still made `HubInventoryUi.disabled=true`; its generic disabled-surface teardown called `closeSurface`, which acknowledged the College dialogue without user input. | high-live |
| Durable native evidence | existing Tutorial, College, Game Over, and browser-save entries and reports | Native owns the Tutorial-to-College handoff and exact admission phase. `loadedBoneyard` is a browser content attachment, not native Hub state; discarding a stale completed-Tutorial attachment changes no native simulation fact. | high |

No new executable address, authored table, asset, or runtime-memory fact is
required. The native system is already closed; this pass corrects the browser
continuation projection across one missed shared-host owner.

### System boundary and membership inventory

System boundary: **browser continuation world/content attachment consistency**,
from an authoritative per-player world projection through every checkpoint
trigger, persistence inspector, strict restore, shared-world materialization,
and the completed Tutorial container lifetime.

| Member / branch | Source | Disposition | Required proof |
| --- | --- | --- | --- |
| Standalone/private Tutorial -> College | scalar `state` plus `loadedBoneyard`; completed-Game-Over ordering | `verified-already-at-parity` | first Courtyard checkpoint and Arch checkpoint carry Hub plus `null` attachment |
| Shared-Hub solo Tutorial -> isolated College | `SharedPartyRun` whose simulation becomes Hub/`run.phase=hub` before Create | `exact-ported` projection correction | all College phases remain in the intended isolated run container, but every continuation attachment is `null` |
| Restored Arch dialogue while Hub renderer/loading barrier settles | `HubScene` College surface opener plus `HubInventoryUi` disabled teardown | `exact-ported` lifecycle correction | no surface and no acknowledgement until renderer ready and parent loading clears; then the saved dialogue opens once |
| Explicit Arch dialogue skip/done/choice/Escape | College dialogue surface and host action | `verified-already-at-parity` | the first actual player dismissal/choice acknowledges once; ordinary world/service surfaces retain generic disabled teardown |
| College dialogue acknowledgement, Office exit, `college-loadout`, and confirmed incoming | Hub participant/economy/transition owners | `exact-ported` through shared rule | exact cursor/dialogue/transition/save restore; final confirmation still merges into public Hub once |
| Periodic progress checkpoint | `publishSaveCheckpointForClient(..., 'periodic')` | `exact-ported` shared correction | uses world-qualified attachment |
| Tutorial-boundary and College-complete checkpoint | shared tick lifecycle publishers | `exact-ported` shared correction | same document invariant at transition edges |
| Explicit leave | `client-save-before-leave` | `exact-ported` shared correction | forced final document restores |
| Deployment-final checkpoint | `restartForDeployment` | `exact-ported` reported branch | target-revision checkpoint restores on replacement protocol/host |
| Active stock/default/custom/mod Boneyard | Boneyard simulation and matching `LoadedBoneyard` | `verified-already-at-parity`, hardened producer contract | descriptor remains required and run IDs agree |
| Party-rejoin staging/recovery | detached active Boneyard projection and signed lineage | `verified-already-at-parity` | matching active descriptor/token remain unchanged |
| Ordinary shared Game Over/loadout | terminal profile-only checkpoint until all loadouts confirm | `verified-already-at-parity` | no resumable continuation or accidental early Hub merge |
| Existing malformed Hub + completed stock-Tutorial descriptor | protocol-99 and earlier affected browser documents | `exact-ported` one-way recovery | fully validate the descriptor and Hub state, discard only this known stale attachment, resume College exactly |
| Hub + arbitrary ordinary/custom/mod Boneyard descriptor | strict restore and backend inspector | `verified-already-at-parity` failure branch | still rejected as inconsistent |
| Boneyard + null/mismatched descriptor | strict restore and encoder contract | `verified-already-at-parity` failure branch | still rejected before admission |
| Browser IndexedDB and account slot 0 | `GameSaveCoordinator`, API inspector/store | `exact-ported` common document rule | frontend read may repair the historical document; every new local/cloud write is strict and clean |
| Native save import | portability owner resumes in Hub with no web Boneyard attachment | `verified-already-at-parity` | remains `loadedBoneyard:null` |

There is no browser-blocked member and no approximation. The complete
stock-Tutorial descriptor is parseable, but no longer owns anything after its
simulation has entered the Hub.

### Native ownership thread

- Owner and construction: the shared party run owns loaded Boneyard content
  while its simulation is a Boneyard. The Tutorial terminal tick changes that
  simulation into the participant-local College admission Hub; the run
  container remains temporarily useful to isolate the pre-Create wizard.
- Upstream producers: Tutorial automatic Game Over, shared-world stepping,
  College dialogue/loadout transitions, periodic/lifecycle checkpoint writers,
  explicit leave, and deployment drain all converge on one checkpoint builder.
- Representation: the resumable simulation's `world.kind` is authoritative.
  `loadedBoneyard` is a dependent attachment and may be non-null only for a
  Boneyard simulation with the same run ID.
- Downstream consumers: local/cloud persistence, backend inspection, strict
  restore, shared-Hub import, renderer loading, Lua content activation, party
  recovery, and title `LAST GAME` consume the pair. After admission, `HubScene`
  owns the restored College surface and must wait for its renderer plus parent
  loading barrier before constructing that surface; only player dismissal owns
  the acknowledgement action.
- Entry/reset/teardown: active Boneyard entry attaches content; Tutorial-to-
  College detaches it from the continuation; confirmed Create merges the
  isolated wizard into the shared Hub; disconnect and deployment do not change
  the serialization rule.

### Recovered behavioral contract

- A Hub continuation always serializes `loadedBoneyard:null`, including a Hub
  simulation temporarily stored in a shared party-run container.
- An active Boneyard continuation always serializes one fully validated,
  run-ID-matching descriptor. Terminal Game Over/loadout remains profile-only.
- The encoder rejects an inconsistent pair so another caller cannot recreate
  this class silently.
- Restore may repair only the historical signature produced here: a valid Hub
  continuation with a fully valid stock-Tutorial descriptor and a completed
  Tutorial profile. It discards that dependent attachment; it does not rewrite
  player, economy, College, RNG, tick, transition, mod, or integrity state.
- Arbitrary default/custom/mod descriptors and Boneyard-side mismatches remain
  fail-closed. Protocol version is not a sufficient trust signal by itself.
- Every checkpoint trigger uses the same projection, so deployment does not
  acquire a second save model.
- Restoring `arch-dialogue` must retain that phase while the Hub renderer and
  loader settle. Loading is not a dialogue dismissal: it must neither construct
  a surface that generic disabled teardown immediately closes nor emit
  `acknowledge-college-intro-dialogue`. Once ready, the dialogue opens exactly
  once from its saved sequence and ordinary explicit close semantics resume.

### Nearby-system findings

- Durable finding: a shared run container is not itself proof that its current
  simulation is a Boneyard. During the stock Tutorial handoff it intentionally
  contains a Hub-shaped, pre-admission College continuation.
- Why it matters: content/Lua/render/save callers must qualify run-owned data by
  the active simulation world instead of treating container membership as the
  world discriminator.
- Native report/catalog update: none; this is browser runtime topology already
  represented in the Website architecture and does not revise native truth.

### Confidence and open questions

- Confirmed: live producer/consumer timestamps and revisions; exact shared
  state/attachment split; standalone coverage gap; every checkpoint call path;
  active/terminal Boneyard siblings; strict restore failure.
- Inferred: the persisted browser document is the deployment-final checkpoint;
  the journal ordering and exact immediate error make this causal inference
  strong without reading private browser storage.
- Unknown: whether the affected slot is IndexedDB or account-owned. The fix and
  validation cover both persistence inspectors, so that distinction is not
  material and no private account data is required.

### Web implementation consequence

- Derive the continuation attachment from the already-selected save state:
  Hub -> `null`; Boneyard -> the matching active attachment.
- Add a symmetric encoder invariant rather than relying on a future restore to
  catch producer corruption.
- Add one narrow stock-Tutorial stale-attachment migration in the TypeScript
  restore. Keep the C# write inspector strict so a newly uploaded inconsistent
  document is still rejected; existing slot reads are repaired by the same
  frontend restore path as IndexedDB.
- Gate the `HubScene` College dialogue opener on both local renderer readiness
  and the parent modal/loading barrier. Do not weaken `HubInventoryUi` generic
  teardown or suppress a real user acknowledgement.
- Do not merge the pending College admission into the public shared Hub early,
  remove the run container, weaken general save validation, add a protocol
  compatibility shim, or special-case the deployment UI.

### Validation contract

- Red/green host test: shared-Hub Tutorial automatic completion -> Arch College
  state -> forced deployment-final checkpoint -> strict restore -> replacement
  shared-host admission, with `loadedBoneyard:null` and exact College phase.
- Save tests: valid affected stock-Tutorial document repairs; ordinary/custom/
  mod descriptors remain rejected; active Boneyard descriptor remains exact;
  encoder rejects both Hub/non-null and Boneyard/null/mismatched pairs.
- Backend tests: new Hub/non-null uploads remain rejected; clean repaired Hub
  documents remain accepted. Existing slot reads continue to return exact
  stored bytes for frontend migration.
- Mac canonical gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the
  byte-identical candidate.
- Mac Chrome: fresh shared-Hub Tutorial/College checkpoint or an exact fixture,
  planned disconnect, `LAST GAME`, clean rewritten continuation, and restored
  Arch dialogue after the loading cover with no premature acknowledgement and
  empty page, console, failed-response, protocol, and host-error arrays.

### Implementation validation receipt

- Root correction: `sharedLoadedBoneyardForPlayer` now returns content only
  while that player's current run simulation is actually a Boneyard. The
  pre-Create College run container remains intact, but save, same-tab welcome,
  renderer loading, and Lua/content consumers can no longer infer a Boneyard
  from the container alone. `createGameSaveDocument` now rejects Hub/non-null,
  Boneyard/null, inactive, and run-ID-mismatched pairs before encoding.
- Historical recovery: `restoreGameSaveDocument` discards only a structurally
  valid default `stock-tutorial`/`Tutorial` attachment from a Hub/`run.phase`
  `hub` continuation whose owner has completed the Tutorial. Arbitrary default,
  custom, or mod Boneyards remain rejected. Backend upload inspection remains
  strict; a repaired client immediately checkpoints clean bytes.
- Restored presentation: `HubScene` now waits for local renderer readiness and
  the parent modal/loading barrier before constructing a saved Arch dialogue.
  `HubInventoryUi` keeps its generic disabled teardown, and only the later
  explicit dialogue close/choice owns acknowledgement.
- Mac red receipts: the shared deployment test exposed the complete non-null
  stock-Tutorial descriptor at the expected `null` assertion; the parser threw
  the reported error; the encoder raised no exception; and the UI contract
  lacked a loading/readiness gate. Log SHA-256 values are respectively
  `756b0e3f6e74560ca0fc2bac4394c5d5775e157f4d5849081483232be448ea0c`
  and `d8139545b5544dc1f775b315a697c4ead3f59082f808f38232ef914fcbcf1d47`
  for the host and UI lanes; the save red failures share the retained focused
  red log in the task evidence directory.
- Focused/broad green receipts: the exact three new save/deployment tests pass
  `3/3`; complete `game-host`, `shared-game-worlds`, and `game-save-document`
  files pass `118/118`; Tutorial plus Hub Inventory render contracts pass
  `41/41`. Log SHA-256 values are
  `ed7df103af0d35f9fc4b2b4eb4005289653cb776cea6aa779b1cac50a7b4e563`,
  `a53ce235fafc0ba59cd5c57aaeeed09c035f530ab7a1a80a7f65a6ce66e04a53`,
  and `541cbd4891337e40b9059b8c7f116f2717c3a5e776f513151099838dbcf06a13`.
- Mac Chrome 151 on current-main base `a1ae89af` loaded an exact affected
  schema-19 IndexedDB fixture through `LAST GAME`, rewrote it with
  `loadedBoneyard:null`, and retained authoritative plus presented
  `arch-dialogue`. Page, console, failed-response, protocol, and host-error
  arrays were empty. The settled 1600-by-900 capture visibly shows the
  Archchancellor frame and `SKIP` action; SHA-256 is
  `b565924195264b4e1d7cffdf4d702594ea5eeaec9615b73590d867e07e78c2b6`.
  Browser log SHA-256 is
  `1c76d1ed3d29bf808cf2ddbf59c8dc4cebb5ca758275a3c2b1685c946fbdd662`.
- The browser harness now accepts both root-form legacy and current nested
  continuation fixtures, requires a clean rewritten Hub attachment, waits for
  the exact saved College phase, and supplies its required task-owned Memorial
  path. It does not weaken legacy position assertions.
- Pre-split integration base was Website `a68c043b0b4253a1bed45a98ed458dfc7fb0e2fd`.
  SHA-256 comparison found zero mismatches across all eight changed files in
  the detached Mac worktree. The exact final-base Chrome repeat again restored
  and rewrote the affected fixture with both authoritative and presented
  `arch-dialogue`; its error arrays stayed empty. Browser/backend-build log
  SHA-256 values are
  `347507309a8668b0d610c5a3aace651e8fcb1a0cf7963328ab78d71ae627e067`
  and `1d71861b6fa6d84cec8c797a93fb75d09fcd2c9e36bbe0fd01a8dd6f97001095`;
  the visually inspected final screenshot SHA-256 is
  `94e8f35d0e499ff7d851e3cd519b8237f00a186e1929bc38ea48ae647cb6c96d`.
  The complete Mac canonical gate then passed through backend build with zero
  warnings/errors, all 29 Website/backend contracts, formatting, lint and
  generated/boundary checks, every registered frontend group including
  `1,751/1,751` Boneyard tests, production frontend/game-host builds, bundle
  budget (`261,906` raw / `79,454` gzip), and CSP/media policy. Pre-receipt log
  SHA-256 is
  `bfa6cae0c2e6aa5e2fcc4b050911b6bf9553fb6bbcefa089b8a680da77cddd7f`.
  Its post-receipt exact-tree repeat also passed with `VALIDATE_EXIT=0`.
- Concurrent main then split this ledger into numbered system files and added
  unrelated authenticated screenshot routing. The focused section now extends
  this existing College-handoff owner as required by the new index. Current
  integration base is Website `d2c4b9a6`; SHA-256 comparison again found zero
  mismatches across all eight changed files. The exact browser journey passed
  with `EXIT_CODE=0`, clean attachment rewrite, retained authoritative/presented
  `arch-dialogue`, and empty error arrays. Browser log and visually inspected
  settled-frame SHA-256 values are
  `1a053ca4b8f15dc7aa06fb312ade526d8f88effbff5909c9f588df38b647f1d3`
  and `48de60ce70807a443160c14c1c5fe855e92f2fd74cd2922ff8edd2e42c15b0b7`.
  The complete canonical gate passed with `VALIDATE_EXIT=0`; log SHA-256 is
  `f42079967c5e51ff1604bc7658899a34987a8b0595c09c9d3df9701c308f66e9`.
  This paragraph is the sole post-gate edit; one final exact-tree gate follows.
  No Mod Loader or native report changed because no native fact changed.
  Publication and deployment were not requested.
- The final concurrent resume-grace publication rebased cleanly without
  changing this production path. Final current-main base is Website
  `2d57b148f09d3b0480b869c777ce31e762974ff9`, save schema 20, and protocol
  104. All eight files are byte-identical on the detached Mac worktree. Current
  focused suites pass `121/121` save/host/shared-world tests and `42/42`
  College/UI tests; log SHA-256 is
  `538da57d83abb5c1f829866e0b6ef4b855d8582311dde7054104a8141381f623`.
- The exact schema-19 incident fixture still resumes and migrates under schema
  20/protocol 104 with `EXIT_CODE=0`, a clean attachment, retained
  authoritative/presented `arch-dialogue`, and empty error arrays. Browser log,
  backend-build log, and settled screenshot SHA-256 values are
  `9bee6b9984e1eb5db866c61740fdf91c37e91cc31fe79e68950f55b15187a977`,
  `e3c763347e8b2f90f7e6ba14f31b3cb6f265906ddcf9ea9ca7a1488434e082ff`,
  and `e93e474f11f27d7148af8f1a1851c80752914609fbf67a228783da7f41269d04`.
- The complete current-main canonical gate passed with `VALIDATE_EXIT=0`;
  production entry `Game-CM1jx4T2.js` measured `262,008` raw / `79,505` gzip,
  and log SHA-256 is
  `1f65975b551cceafccfb5b8efd49db1833016b11acdc698858f6bec1242714ae`.
  This final receipt is the sole post-gate edit; the frozen exact tree receives
  one last canonical repeat with no later tracked change.
