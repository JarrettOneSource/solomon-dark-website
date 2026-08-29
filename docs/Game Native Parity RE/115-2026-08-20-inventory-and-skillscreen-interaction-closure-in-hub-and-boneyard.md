# 2026-08-20 — Inventory and SkillScreen interaction closure in Hub and Boneyard

## Reported smell and parity question

- Reported web behavior: Inventory can be opened and acted upon only in the
  Hub. The Boneyard backpack is disabled. The tome is decorative in both
  scenes, so learned skills cannot be inspected or assigned to the eight-slot
  secondary belt through the stock interaction surface.
- Stock behavior to recover: one participant-owned InventoryScreen and one
  participant-owned SkillScreen, reachable from keyboard and HUD in both Hub
  and match, with mutual exclusion, input suppression, complete item and
  loadout actions, exact art, and actor-private authoritative mutation.
- Reproduction inputs/scenes: fresh Ether/Mind retail actor, `I`, `T`, HUD
  backpack/tome, Inventory open followed by `T`, a category-2 drag into an
  occupied/empty belt slot, and the same sequence before and after Boneyard
  entry.
- Falsifiers: scene-owned copies of either book, a dim live-world SkillScreen,
  unique-only belt IDs, guessed open/close sound, client-local item/loadout
  state, or gameplay input continuing beneath either screen.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | unmodified retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, directly launched from isolated `sd-stock-skillbook-D64dCC`, no loader | Hub and Boneyard use the same opaque full-screen SkillScreen and InventoryScreen; `T` replaces Inventory; dragging Call Leviathan from the page to slot 1 leaves it simultaneously in slots 0 and 1 | high |
| Clean-stock captures | Mod Loader `tests/fixtures/webgame/menu-reference-captures/skill-screen.png` SHA-256 `5b2423d5daf56e6bb5d154dd2ce0abc80d947286f087c8f81134b01686bb1c87`; `skill-screen-duplicate-belt.png` SHA-256 `e934a18512ef5ed92753be150f5a37e5182751c8ed25644f5030a5d63b87f05d`; settled Inventory witness SHA-256 `0d99c6bb3f1815aa061fd4ee49e7bfccbd0ee058ea69b0e8936155c7e5156d8b` | fixes complete settled composition, starter page/card state, bottom HUD/belt membership, duplicate-slot behavior, and Inventory geometry | high |
| Instructions | `0x00689750`, Inventory opener `0x005C6F10`, Skill opener `0x005CA640`, ctor `0x006576C0`, open `0x0067CAC0`, tick `0x006567E0`, close `0x006568E0`, root render `0x0065B550`, page builder `0x0066B380`, page open/render `0x00673EE0/0x006720F0`, quickbar `0x00657A70/0x0066F330/0x00659AD0`, category selector `0x0066F0B0`, Game HUD action `0x005D8120` | fixes ownership, scene-independent entry, reciprocal overlap, 40-tick envelopes, silent opens and `openpanel` closes, page order/layout, all eight belt slots, duplicate legality, and primary/concentration branches; corrected by the 2026-08-28 reopening below | high |
| Asset/data | Mod Loader `native-asset-object-map.json`, 83-row native skill catalog, Inventory/Skills/UI/Fonts bundles | SkillScreen drains direct UI `3,30,31,32,49` plus shared rails `10,79`; Skills `5,6,12,14,27..122,164..165`; Fonts groups `1..92,93..184,216..307,350..375`; public page rows are exactly `8..79` | high |
| Web baseline | Website `origin/main` `3754115`; `HubInventoryUi`, `GameHud`, Boneyard/Hub scenes, protocol 35, `equipPlayerSecondaryAbility` | authoritative Inventory actions exist but Boneyard cannot send them; tome has no action; secondary belt moves a skill instead of allowing stock duplicates; no SkillScreen/loadout command family exists | high |

All executable addresses are preferred-image virtual addresses. The static
queries used read-only Ghidra replicas; clean-stock captures used no injected
runtime.

## System boundary and membership inventory

Native system: the optional actor-owned InventoryScreen and SkillScreen,
including their shared input gates, screen lifetime, complete visible asset
membership, Inventory actions, learned-page construction, quickbar/loadout
mutation, and Hub/Boneyard consumers.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| `I` and backpack entry in Hub and Boneyard | preset `0x005A8790`, dispatcher action `0x405`, HUD callback | exact-ported | scene hotkey/button journey and shared screen tests |
| `T` and tome entry in Hub and Boneyard | preset `0x005A8790`, dispatcher action `0x406`, HUD callback | exact-ported | scene hotkey/button journey and shared screen tests |
| reciprocal replacement and close | `0x005CA640`, `0x005C6F10`, screen destructors | exact-ported by the 2026-08-28 reopening below | the old receipt did not prove Skills-to-Inventory; the new contract does |
| local input suppression and multiplayer owner isolation | nesting `0x005CBD40`; actor-owned books | exact-ported | stopped-input and two-owner tests |
| Inventory root, selection/details, paging, held drag and restore | InventoryScreen/Grid/Dragger family in the settled 2026-08-15 entry | verified-already-at-parity | existing render/input contracts; mounted through the same owner in both scenes |
| six potion use branches and accepted/rejected feedback | `0x0056D1B0`, `0x0056D246`, `0x0056D3D2` | verified-already-at-parity | existing per-subtype authority/audio tests plus Boneyard journey |
| seven equipment sinks, equip and unequip | `0x00570CD0`, `0x00575850`, `0x00570D80`, `0x0066F020` | verified-already-at-parity | existing per-sink tests plus Boneyard journey |
| trader companion InventoryScreen and storage/service overlays | `0x00514A20`, Shop family | out-of-system (Hub NPC services; no Boneyard producer) | scene/owner boundary |
| SkillScreen 40-tick open/close lifecycle | `0x006567E0`, `0x006568E0` | exact-ported by the reopening below: open is silent; close owns `openpanel` | fixed-tick transition and positive close-audio tests |
| opaque fixed chrome and complete UI/Skills/Fonts membership | `0x0065B550`, asset-object map | exact-ported | atlas membership and deterministic render tests |
| dependency-root pages and every public row `8..79` | `0x0066B380`, `0x0065E670`, 83-row catalog | exact-ported | table-driven page membership/order tests |
| ordinary, shared-dependency, Welding, selected-primary, category-2, concentration card variants | `0x006720F0`, Skills `5,6,12,14,27..122,164..165` | exact-ported | per-variant render-plan assertions |
| eight quickbar slots, mouse/key bindings, duplicate IDs and replacement | `0x00657A70`, `0x0066F330`, `0x00659AD0` | exact-ported | all-slot, duplicate, drag/drop and strict-protocol tests |
| learned primary selection | `0x0066F0B0`, `0x005D8120` | exact-ported | learned/category rejection and accepted projection tests |
| concentration A/B, Split Mind replacement, duplicate and Mind Chug rejection | `0x0066F0B0`, `0x005D5600`, runtime book | exact-ported | state-transition and runtime refresh tests |
| runtime-only rows 80, 81 and allocated reserve 82 | catalog/selector exclusion | out-of-system (not public learned-page or selector members) | complete row-domain test |

No member is blocked by the browser platform. The web multiplayer host keeps
remote participants advancing while the local owner's optional book is open;
the port mirrors the native local suspension boundary without granting one
client authority to pause other actors.

## Native ownership thread

- Owner and construction path: gameplay owns one Inventory pointer at
  `+0x15A0`, one SkillScreen pointer at `+0x1664`, and references the addressed
  actor/profile book. Hub and Boneyard dispatch to those same owners.
- State transitions: closed -> opening (`+0.025/tick`) -> settled -> closing
  (`-0.025/tick`) -> destroyed. Skill auxiliary pulse decays `*0.9` below
  `0.01`. Opening Skills is silent; close owns one `openpanel` request, as the
  2026-08-28 raw-instruction correction below proves.
- Downstream consumers: render tree, pointer/keyboard hit routing, authoritative
  item/equipment economy, skill book, primary identity, secondary belt, and
  concentration runtime. Presentation focus/hover/drag is transient.
- Exact belt correction: stock assignment replaces only the addressed slot;
  it does not clear matching IDs elsewhere. Protocol validation must therefore
  validate each slot independently and permit duplicates.

## Web implementation consequence and validation contract

- Reuse one Inventory surface component from both scenes and keep trader
  discovery disabled outside Hub; send the same strict authoritative action.
- Add a shared scene-book controller so `I`, `T`, both HUD buttons, close,
  transitions, and mutual exclusion cannot drift between Hub and Boneyard.
- Add strict actor-addressed commands for belt assignment, primary selection,
  and concentration selection. The host validates phase, life/input state,
  learned rank, category, Split Mind, duplicate concentration, and Mind Chug.
- Render SkillScreen through one WebGL owner using exact atlas records and
  bitmap fonts. React supplies only semantic/hit/drag controls.
- Focused tests cover every inventory action branch, every public skill row,
  every card variant, all eight slots including duplicates, both scenes,
  mutual exclusion, transition timing, and two-owner authority.
- Final proof requires Windows `./scripts/validate.sh` and a real Windows
  Chromium `/game` journey through Hub and Boneyard with keyboard and pointer
  actions, state mutation, input suppression, WebGL identity, and empty
  page/console errors.

## Implementation and verification receipt

- `HubInventoryUi` now mounts the same standalone Inventory owner in Hub and
  Boneyard; Boneyard disables only trader discovery. `I`, the backpack, item
  selection, potion use, equipment actions, close, input suppression, and
  host-authoritative economy mutations therefore share one implementation.
- `SkillBook`, `skill-book-model`, and `skill-book-renderer` own the 40-tick
  screen lifecycle, exact full-screen atlas/font composition, all dependency
  pages, selected-primary/concentration card states, and the eight-slot drag
  surface. The HUD tome and `T` open it in both scenes. `I`/`T` replace the
  other book without leaking player input.
- Protocol 36 adds strict belt assignment, primary selection, and concentration
  selection. The player book retains learned-vector order, primary,
  concentration A/B and replacement cursor, and duplicate-capable eight-slot
  belt state. The host validates the authenticated actor, phase, learned row,
  category, Split Mind capacity, duplicate concentration, and Mind Chug lock,
  then publishes a new progression revision and save checkpoint.
- Automated coverage drains every public row `8..79`, all SkillScreen atlas
  members, every slot including the clean-stock duplicate case, primary and
  concentration replacement rules, two-player isolation, both scene mounts,
  Inventory-to-Skills replacement, transition timing, protocol rejection, and
  existing per-potion/per-equipment Inventory branches.
- Windows-native `./scripts/validate.sh` exited zero on tracked tree
  `dc13a0e8009aa05bcdd753c14802b24654fd2e58` using Node 22.17.0, npm 10.9.2,
  Python 3.13.5, and task-local .NET SDK 10.0.302. It passed 25 backend
  contracts, 40 loot tests, 156 prerequisite/save/secondary tests, 1,040 broad
  game/frontend tests, 13 party tests, 5 level-up tests, 7 diagnostics tests,
  14 Hub UI tests, 5 desktop tests, backend build/format, lint/import
  boundaries, production frontend and host builds, bundle budget (`247256`
  raw / `72601` gzip bytes), and media policy. Output contained only the eight
  existing Fast Refresh warnings and Vite's non-fatal chunk advisory.
- Windows Chrome `151.0.7922.170` completed the real 1600-by-900 Hub ->
  Boneyard journey. It opened both books by HUD and keyboard, consumed the Hub
  Health Potion, retained Call Leviathan in slots 0 and 1, opened Boneyard
  Inventory with the Mana Potion present, replaced it with Skills, observed
  local input blocked throughout, and rendered the 1600-by-900 SkillScreen in
  WebGL2. The receipt returned `hubInventory=true`, `hubSkills=true`,
  `matchInventory=true`, `matchSkills=true`, `duplicateBelt=true`, and empty
  console/page-error arrays.
- Captures are
  `C:/sdw/receipts/inventory-skillbook-hub-inventory.png`,
  `inventory-skillbook-hub-skills.png`,
  `inventory-skillbook-hub-duplicate-belt.png`,
  `inventory-skillbook-match-inventory.png`, and
  `inventory-skillbook-match-skills.png`. No member is browser-blocked and no
  native constant remains guessed in this system.

## 2026-08-28 — Player-reported reciprocal switching reopening

### Reported smell and process failure

- A player reports that direct switching between Skills and Inventory has been
  removed. Current source confirms the report: SkillBook recognizes literal
  `I` and requests Inventory only after its complete close, while Inventory has
  no configured-Skills or painted-tome route at all.
- This reopens the `mutual exclusion and close` row above. The earlier pass
  listed both directions, but browser acceptance exercised only Inventory to
  Skills and source-presence assertions stood in for the reciprocal member.
  It also failed to compare the user's current binding with the literal key in
  SkillBook. Calling that inventory exact-ported violated per-member proof.

### Evidence refresh

| Evidence class | Exact source | Recovered fact | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-28 | Canonical image; no runtime/ASLR address is used. | high |
| Complete opener xrefs | read-only canonical Ghidra replica; Inventory `0x005C6F10`, Skills `0x005CA640` | Exactly three producers per screen: configured keyboard `0x005CB360` (`0x005CB3A3/0x005CB3CF`), HUD `0x005D8120` (`0x005D8165/0x005D8184`), authored actions `0x00689750` (`0x0068A222/0x0068A25E`). | high |
| Raw opener instructions | `0x005C6F10`, `0x005CA640` | Each opener marks a live sibling closing and immediately constructs/attaches the requested screen. Old and new coexist; the opener does not wait 40 ticks. | high |
| Raw close instructions | Inventory `0x00550760`, Skills `0x006568E0`, ordinary Inventory close `0x00555810` | Both replacement directions play registry 64 `sounds\\openpanel` exactly once at gain one. Both opens are silent. | high |
| Current web | `origin/main` `0c94685e`; `SkillBook`, `HubInventoryUi`, `MainMenuScene`, Hub/Boneyard scenes | literal-key, missing reciprocal control, delayed handoff, and no Inventory closing envelope reproduce the defect. | high |

### Reopened boundary and complete membership

Native system remains the optional actor-owned InventoryScreen/SkillScreen
sibling controller, now closed over every input producer and both directions.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| configured Inventory key, closed -> Inventory | keyboard xref | exact-ported by this reopening | current binding; Hub/Boneyard |
| configured Skills key, closed -> Skills | keyboard xref | exact-ported by this reopening | current binding; Hub/Boneyard |
| configured Skills key, Inventory -> Skills | `0x005CA640` | exact-ported by this reopening | immediate overlapping replacement |
| configured Inventory key, Skills -> Inventory | `0x005C6F10` | exact-ported by this reopening | immediate overlap; no literal `I` |
| backpack control, closed/Skills -> Inventory | HUD Inventory child | exact-ported by this reopening | live slid rectangle; mouse/touch/focus |
| tome control, closed/Inventory -> Skills | HUD Skills child | exact-ported by this reopening | live slid rectangle; mouse/touch/focus |
| authored action `0x405` | `0x00689750` | exact-ported through the same controller | no duplicate Inventory owner |
| authored action `0x406` | `0x00689750` | exact-ported through the same controller | no duplicate Skills owner |
| reinvoke currently live screen | requested-pointer guard | exact-ported | close once, construct no duplicate |
| reciprocal transition overlap | both openers and screen ticks | exact-ported by this reopening | old fades while new opens; HUD slide forced to one |
| close/replacement audio | `0x00550760`, `0x006568E0`, registry 64 | exact-ported by this reopening | one `openpanel`; opening silent |
| continuous input/pause owner | `0x005CBD40` | verified-already-at-parity across corrected handoff | no world-input frame between screens |
| Hub and Boneyard | shared Game screen pointers | exact-ported by this reopening | both keys, both controls, both directions |
| Boneyard Tutorial open/close events | same shared owner plus Tutorial observer | exact-ported | Skills close and Inventory open each report once |
| developer match observer Boneyard projection | read-only `DeveloperObserverScene` | out-of-system: observer input and optional books are disabled; overlap is explicitly false | production type/member assertion |
| service companion InventoryScreen | Shop/Chat exclusive modal | out-of-system: optional Skills is not exposed through the service modal | existing service coverage unchanged |
| browser gamepad focus | no supported retail controller mapping | out-of-system retail extension; retained through the reciprocal semantic controls | shared focus/confirm router |

No member is browser-blocked.

### Corrected behavioral contract and implementation consequence

- Game owns Inventory at `+0x15A0` and Skills at `+0x1664`. A replacement marks
  the old object closing, plays its cue, and mounts the new top input owner in
  the same call. Both independent 0.025-per-tick envelopes remain alive; the
  bottom HUD is forced to its settled slide while both pointers exist.
- Current configured physical codes, not `event.key` literals, route close and
  replacement. The rendered backpack and tome remain reciprocal semantic hit
  targets on their live slid rectangles.
- Web ownership stays split between parent session/modal state and scene-local
  Inventory presentation, but one pure input rule and one overlap predicate
  must govern both components. The old screen remains mounted and inert until
  its 40th close tick; the new screen owns input immediately.
- `open-panel` plays once at close start for ordinary close and either
  replacement. A newly mounted sibling adds no open cue.

### Validation contract and receipt

- Focused tests must cover rebound codes, both painted controls, same-screen
  close, both replacement directions, open/close overlap from partial and
  settled progress, exactly one cue, no duplicate owner, both scenes, Tutorial
  event counts, and continuous input suspension.
- Mac Chrome must perform rebound-key and pointer replacement in both Hub and
  Boneyard while checking overlap data, modal progress, authoritative position,
  WebGL identity, and empty page/console/failed-response arrays.
- Implementation and exact-tree Mac receipts are recorded below. The older
  Windows receipt above remains historical evidence for the one direction it
  actually exercised; it is not proof of this reopening.

### 2026-08-28 implementation receipt

- `native-optional-book.ts` now owns configured reciprocal key routing, forced
  overlap HUD progress, and the owner-local Inventory pause predicate while the
  host changes its replicated source label. `SkillBook` and `HubInventoryUi`
  consume that shared contract and expose reciprocal semantic backpack/tome
  controls on the live slid rectangles.
- SkillScreen starts its 40-tick close, plays one `openpanel`, and requests
  Inventory immediately. Inventory now has the missing symmetric close envelope,
  starts Skills immediately, remains inert/under the new screen, and releases
  only at progress zero. Both renderers force the shared HUD to progress one
  during coexistence. The old Inventory input listener yields immediately to
  the new top owner.
- The Boneyard-specific source-label race is closed: a locally owned modal pause
  plus live Inventory remains admitted while the host changes `skill-book` to
  `inventory`; the screen is no longer destroyed during that acknowledgement
  gap. The read-only developer observer explicitly disposes its overlap member
  as false.
- Mac focused red failed only on the missing shared module/card exports. The
  final byte-identical candidate passed production/test TypeScript plus the
  focused Inventory, SkillScreen, and picker behavior suites; the complete
  Boneyard group passed.
- Chrome `151.0.7922.174` on Apple M2 completed four real overlap transitions:
  pointer Skills -> Inventory -> Skills in Hub and rebound `B`/`V` Skills ->
  Inventory -> Skills in Boneyard. Each receipt observed both DOM owners and the
  correct retiring target before the old 40-tick owner disappeared. Per-edge
  audio counters advanced by exactly one for all four replacements, proving one
  close cue and no new-screen open cue. Existing WebGL2 SkillScreen, quickbar,
  hover, drag, selection, and Boneyard authority checks also passed. Page,
  console, and failed-response arrays were empty.
- The inspected Hub Inventory-switch frame SHA-256 is
  `858bf4825630ba89fea63346b260b67ccb51f69d557a8ec1f91c4d1b2bc4fa14`;
  `skill-book-boneyard-inventory-switch.png` is
  `b3eb393c199320d44e5af440b3a1c3a359c6f24b18b07fbe73f2c7e1e3b7a305`.
  These hashes record the result; task-owned copies are disposable after the
  exact-tree acceptance rerun.
- Publication and deployment were not requested and were not performed.

## 2026-08-28 — Responsive opaque SkillScreen root reopening

### Reported smell and parity question

- Reported web behavior: opening Skills in the Hub does not produce a proper
  full-screen surface. On a browser whose aspect ratio differs from `16:9`,
  the fixed `1600 x 900` SkillScreen occupies only the contained native stage
  while the Hub remains exposed around it.
- Stock behavior to preserve: SkillScreen is one opaque full-screen optional
  actor-owned screen. Its authored `1600 x 900` composition remains fixed,
  but no world pixel is visible outside that composition while the screen owns
  input.
- Reproduction: open Skills from the Hub HUD at `1600 x 900`, `844 x 390`, and
  a tall viewport; sample the complete browser surface during opening,
  settlement, replacement, and closing. Repeat the same shared owner in the
  Boneyard.
- Falsifiers: stretching the native stage, a black rectangle limited to the
  native stage, exposed world pixels in the aspect-ratio gutters, an immediate
  black cut that ignores the 40-tick envelope, or an input-active gutter.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; size/hash reverified 2026-08-28 | Canonical native image remains identical to the earlier complete SkillScreen investigation. | high |
| Clean stock and instructions | existing clean capture `skill-screen.png`; root `0x0065B550`, tick `0x006567E0`, close `0x006568E0` | The root curtain is opaque at settlement and follows the same `+/-0.025` screen progress as the fixed composition. Hub and Boneyard share the owner. | high |
| Current web causal trace | Website `origin/main` `6220c5a7`; `MainMenuScene`, `SkillBook`, `skill-book.css`, `fixedGameViewportLayout` | `SkillBook` mounts only `.main-menu-native-stage.skill-book-stage`. At `844 x 390`, contain scaling yields a roughly `693 x 390` stage, leaving approximately 75 px on both sides with no SkillScreen-owned curtain or input surface. Inventory already owns the correct viewport-sized `.hub-native-ui-overlay`. | high |
| Mac baseline attempt | detached exact-base worktree; Chrome 151; existing mobile Inventory/Skills smoke | The current harness was intercepted by the separately owned Tutorial startup prompt before Hub entry. It is a harness drift receipt only and is not counted as visual evidence for or against this report. | high |

### System boundary and membership inventory

Native system: the optional actor-owned SkillScreen root projection from its
screen-progress curtain through the fixed authored stage, input surface, both
gameplay-scene consumers, reciprocal Inventory overlap, and teardown.

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| full-browser opaque backing surface | SkillScreen root curtain; responsive Website projection | exact-ported | viewport bounds equal the complete stage at every tested aspect ratio |
| curtain alpha during opening/closing | `0x006567E0/0x006568E0` | exact-ported | backing opacity equals `openProgress` across the 40-tick envelope |
| fixed `1600 x 900` authored composition | `0x0065B550` and complete UI/Skills/Fonts inventory above | verified-already-at-parity | remains centered and uniformly contained; never stretched or cropped |
| transparent semantic/hit stage | native SkillScreen pointer owner | verified-already-at-parity, enclosed by corrected viewport owner | icon, drag, HUD, close, and reciprocal controls retain native coordinates |
| aspect-ratio gutters | browser-only projection around fixed stock stage | exact-ported as opaque continuation of the root curtain | no Hub/Boneyard pixels and no world input leak |
| Hub consumer | gameplay `+0x1664`, opener `0x005CA640` | exact-ported by this reopening | HUD/key open and complete viewport coverage |
| Boneyard consumer | same actor-owned screen pointer | exact-ported by the shared correction | matching coverage and local suspension |
| Skills -> Inventory overlap | sibling controller recovered above | verified-already-at-parity beneath corrected root owner | retiring Skills curtain and incoming Inventory overlay leave no visible/input gap |
| ordinary close and teardown | 40-tick close/destroy | exact-ported by this reopening | viewport surface retires only with the SkillScreen owner |
| service/dialogue Inventory overlays | separate Shop/Chat owners | out-of-system (not SkillScreen root consumers) | existing viewport owners remain unchanged |
| mandatory level-up SkillPicker | separate `LevelupScreen` modal | out-of-system (its responsive curtain is owned in ledger 245) | unchanged by this root correction |

No member is blocked by the browser platform.

### Recovered behavioral contract and implementation consequence

- One viewport-sized SkillScreen owner blocks pointer input and paints black at
  the same live `openProgress` as the fixed native root. The WebGL canvas,
  semantic buttons, drag coordinates, and renderer backing store remain exactly
  `1600 x 900` inside the existing contained transform.
- The viewport owner belongs inside `SkillBook`, not to the Hub scene, so Hub,
  Boneyard, Tutorial, keyboard/HUD entry, reciprocal replacement, and teardown
  cannot drift. Inventory's already-correct viewport overlay is the sibling
  model, not a CSS exception.
- Background pointer input clears presentation-local skill details but never
  reaches the world. No simulation, protocol, save, audio, or authority change
  is required.

### Validation contract

- Focused source/render coverage must pin one viewport owner, progress-driven
  opacity, fixed-stage containment, pointer blocking, and unchanged native
  canvas dimensions.
- Mac Chrome must open Skills in Hub and Boneyard at desktop and `844 x 390`
  touch viewports, assert overlay bounds equal the viewport, stage bounds remain
  contained, gutter pixels are opaque black, world input stays blocked, and
  reciprocal replacement/close remain gap-free.
- Require WebGL2, empty page/console/failed-response arrays, the focused
  SkillScreen/optional-book suites, and the complete supported Website gate.
- Implementation, browser, gate, publication, and deployment receipts remain
  pending below this investigation entry.

### Implementation validation receipt

- `SkillBook` now owns one viewport-sized `.skill-book-overlay` and black
  curtain whose opacity is the existing `openProgress`. The unchanged
  `1600 x 900` WebGL stage remains centered and uniformly contained inside it.
  The overlay owns gutter input and retires with the same opening, reciprocal
  replacement, close, and teardown lifecycle in Hub and Boneyard.
- The maintained Inventory/SkillScreen smoke now covers the startup prompt,
  deployment-revision fixture, full overlay geometry, curtain style, contained
  native stage, both replacement directions, Potion use, and empty
  page/console/failed-response arrays on desktop and touch viewports.
- On the exact current-main base `5257a20e`, Mac Chrome `151.0.7922.174`
  measured Hub and Boneyard overlays at exactly `844 x 390`, with the native
  stage at `693.3333 x 390` and `75.3333`-pixel side gutters. The settled
  curtain was opaque black at alpha one and the mobile visual receipt SHA-256
  was `29b2023b90590e065d5f49bfebdfb94b52d16343510885dddad742892406153b`.
- The matching desktop journey measured both overlays and stages at exactly
  `1600 x 900`. All four Skills/Inventory replacement edges retained their
  overlapping progress owners, and both desktop and mobile receipts had empty
  browser-error arrays. Browser log SHA-256 values were
  `0aef14fec032dbd7e9701253e906ecbaeee6d527ad513ff31e8d4ac74b2cf468`
  and `2226fdbadb4b1e7c7116e2c765031b38c01220d8c14c07d12f616552844164a1`.
- The exact source candidate passed the complete supported Mac gate with Node
  `22.17.0` / npm `10.9.2`, all broad runtime suites including `1,688` Boneyard
  tests, desktop tests, production builds, bundle budget (`262,749` raw /
  `79,696` gzip), and media policy. This receipt is the sole tracked edit after
  that pass; a no-later-edit exact-tree repeat is the final handoff gate.
- No member is browser-blocked and no protocol, simulation, save, audio, or
  multiplayer-authority path changed. Publication and deployment were not
  requested and were not performed.
