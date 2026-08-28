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
| Instructions | `0x00689750`, Inventory opener `0x005C6F10`, Skill opener `0x005CA640`, ctor `0x006576C0`, open `0x0067CAC0`, tick `0x006567E0`, close `0x006568E0`, root render `0x0065B550`, page builder `0x0066B380`, page open/render `0x00673EE0/0x006720F0`, quickbar `0x00657A70/0x0066F330/0x00659AD0`, category selector `0x0066F0B0`, Game HUD action `0x005D8120` | fixes ownership, scene-independent entry, mutual exclusion, 40-tick envelopes, silence, page order/layout, all eight belt slots, duplicate legality, and primary/concentration branches | high |
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
| mutual exclusion and close | `0x005CA640`, `0x005C6F10`, screen destructors | exact-ported | Inventory-to-Skills and Skills-to-Inventory tests |
| local input suppression and multiplayer owner isolation | nesting `0x005CBD40`; actor-owned books | exact-ported | stopped-input and two-owner tests |
| Inventory root, selection/details, paging, held drag and restore | InventoryScreen/Grid/Dragger family in the settled 2026-08-15 entry | verified-already-at-parity | existing render/input contracts; mounted through the same owner in both scenes |
| six potion use branches and accepted/rejected feedback | `0x0056D1B0`, `0x0056D246`, `0x0056D3D2` | verified-already-at-parity | existing per-subtype authority/audio tests plus Boneyard journey |
| seven equipment sinks, equip and unequip | `0x00570CD0`, `0x00575850`, `0x00570D80`, `0x0066F020` | verified-already-at-parity | existing per-sink tests plus Boneyard journey |
| trader companion InventoryScreen and storage/service overlays | `0x00514A20`, Shop family | out-of-system (Hub NPC services; no Boneyard producer) | scene/owner boundary |
| SkillScreen 40-tick open/close and silent lifecycle | `0x006567E0`, `0x006568E0` | exact-ported | fixed-tick transition and audio-negative tests |
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
  `0.01`. Opening/closing Skills is silent.
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
