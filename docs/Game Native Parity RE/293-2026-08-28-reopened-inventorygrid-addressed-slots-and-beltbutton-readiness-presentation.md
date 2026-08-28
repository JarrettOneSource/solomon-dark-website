# 2026-08-28 — Reopened InventoryGrid addressed slots and BeltButton readiness presentation

## Reported smell and parity question

- Reported web behavior: items can be dragged inside InventoryScreen but cannot
  be placed into chosen boxes; the compact arrays immediately auto-organize
  them. Hotbar skill icons remain grey when usable, with only the red cooldown
  sector distinguishing an unusable state.
- Stock behavior to recover: persistent addressed InventoryGrid cells with
  empty internal slots, exact blank/occupied-cell drop semantics, and the full
  BeltButton ready/cooldown/unavailable colour-state graph.
- Reproduction inputs/scenes: standalone College and active-Boneyard
  InventoryScreen; every nested Sack page and all companion screens; blank,
  occupied, same-Potion, Sack, equipment, parent-return, storage, unforge,
  belt, and invalid drop targets; ready, private/common cooldown,
  insufficient-mana, noncombat, item, and empty BeltButtons.
- Falsifiers: native roots compact every item after release; blank cells are
  paint-only; occupied cells shift rather than swap; later pickups ignore
  holes; the `0.375` captured icon is the ready branch rather than a separate
  availability gate; or any category/item family has an independent presenter.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player reports | direct 2026-08-28 stock-versus-web comparison | Stock permits addressed box placement and visibly brightens a ready hotbar skill; current web auto-organizes and keeps skills grey | authoritative symptom |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed image as the existing InventoryScreen, BeltButton, and HUD corpus; freshly re-hashed before this pass | high |
| Inventory instructions | canonical Ghidra 12.0.3 read-only replica; `0x00560D30`, `0x00560BB0`, `0x00560140`, `0x00560320`, `0x0055FF20`, `0x0056DD80`, `0x0056DE50`, `0x005624B0`, `0x00575850`, `0x00550990`, `0x00572F20` | Grid holders commit in addressed order; blank internal cells are type-7000 `Item_None`; blank drops place, occupied drops swap, matching Potions merge, and shared insertion fills the first placeholder before append | high |
| Belt instructions/data | `BeltButton::Present 0x005D3E10`; renderer setters `0x0041FE50/0x0041C510`; raw ranges `0x005D41A5..0x005D41CB`, `0x005D4257..0x005D43E0`, `0x005D43EB..0x005D4458`; floats `0x007DE934=.75`, `0x007DE978=.25`, `0x007DE870=.5`, `0x007845E8=.1` | Ready is white alpha `.75`; cooldown is red `(.5,.1,.1,.75)` square fan under white alpha `.25`; only insufficient mana/explicit disable uses half-alpha, normally `.375` | high |
| Current web causal trace | `hub-economy.ts`, `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, protocol/save projections, `SkillQuickbar.tsx`, `skill-quickbar.ts` at Website `a24bb5d0` | Inventory roots contain only compact item arrays; grid painters/hit tests use array index; move actions address only a Sack, not a cell. `NativeSkillIcon` hard-codes `.375` for every non-cooldown skill | high |
| Existing native visual record | `Mod Loader/tests/fixtures/webgame/hud-goldens.json` and its full-health/cooldown crops | The `.375` observation existed but the earlier report did not trace the later mana/disable branch and mislabelled it as ready | high corrective interpretation |

No injected runtime address or stale process is used. Preferred-image
addresses above come from the canonical replica wrapper. The durable native
facts are also corrected in `native-items-equipment-and-loot.md` and
`native-hud.md`.

## System A boundary and membership inventory — addressed InventoryGrid roots

Native system: every InventoryScreen current-root grid, from root construction
and authored cell projection through drag/drop mutation, shared insertion,
replication/save, page transition, and teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| participant top-level root and 88 visible cells | root `+0x14/+0x20`; `0x00560D30` | `exact-ported` | sparse-slot kernel and every-cell projection tests |
| every recursively nested Item_Sack root | Sack child root plus same page builder/commit | `exact-ported` | per-depth blank/place/swap/merge tests and browser Sack journey |
| standalone College and active-Boneyard InventoryScreen | shared screen owner | `exact-ported` | identical host mutation and two-scene browser receipt |
| Fomentius, Hagatha, Luthacus, and Shlorio companion InventoryScreens | independent companion screen owner | `exact-ported` | shared renderer/action projection in each service |
| internal empty cell / trailing unused capacity | `Item_None 7000`, `0x00572F20`, trim `0x00560320` | `exact-ported` | internal hole survives; trailing holes normalize away |
| blank-cell release | kind-0 holder, `0x00575850`, `0x0056DE50` | `exact-ported` | source becomes empty and exact addressed destination owns item |
| occupied ordinary-cell release | same router plus dual `InventoryFlyby` | `exact-ported` | exact two-item swap; no shift/duplication/loss |
| matching native/mod stack release | Potion type/subtype or mod content identity | `exact-ported` | resident identity survives with bounded summed quantity |
| Item_Sack destination | item vtable/accessor and shared insertion | `verified-already-at-parity`, strengthened for sparse destination | direct child receives item in first free slot; cycles/self reject |
| child-to-parent return holder | kind-7 holder and parent stack | `verified-already-at-parity`, sparse source retained | exact item moves once and former child slot stays empty |
| equipment swap/unequip and Hat/Robe invariant | `0x00570CD0`, `0x0056FC90` | `verified-already-at-parity`, sparse source/displaced slot strengthened | displaced item fills first hole, normally the incoming source slot |
| Luthacus backpack/storage crossing | shared InventoryDragger transfer | `exact-ported` destination-hole rule; same-owner StoreGrid remains invalid restore | first free destination slot, exact source hole, no auto-sort |
| unforge, consume, dye, books, discard, accepted item destruction | existing item actions plus root removal | `exact-ported` sparse removal | removed cell remains available to first subsequent insertion |
| purchase, dowsing result, loot pickup, Last Word, Tutorial, random/mod item insertion | all `0x0055FF20` shared callers and Website producers | `exact-ported` | table-driven first-hole-before-append assertions |
| inventory-to-belt shortcut | `0x0056EC30 -> 0x005C7090` | `verified-already-at-parity` | binding does not consume or move the inventory cell |
| host/guest, late join, reconnect, save/restore, world transfer, Game Over | participant economy wire/save owners | `exact-ported` | protocol/save schema carries every recursive addressed slot |
| selection, ItemInfo, dragger/flyby presentation, page switch, close/teardown | screen-local owners | `verified-already-at-parity`, slot anchoring strengthened | selection follows item identity at its addressed cell; no state survives teardown |

## System B boundary and membership inventory — BeltButton availability rendering

Native system: all eight Game-owned BeltButton presenters, from authoritative
entry/cooldown/mana state through colour composition, icon/sector order, input
hint, scene modulation, and teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| eight empty buttons | entry type 7000 | `verified-already-at-parity` | no art/action; addressed box remains |
| all skill entries: category 1, all 23 category 2, duplicate IDs | type `0x1B67`, `0x005D3E10` | `exact-ported` shared availability projection | per-family table plus representative browser pixels |
| Website category-3 assignment extension | disclosed belt extension using same icon rows | `exact-ported` extension through shared presenter | no separate opacity path |
| ready skill | `0x005D41A5..0x005D41CB`, white alpha `.75` | `exact-ported` | computed style/pixel witness with no red sector |
| private cooldown longer than common | skill `+0x64/+0x68` | `verified-already-at-parity` sector geometry; `exact-ported` alpha | row-capacity fan and `.25` icon assertion |
| common cooldown equal/longer | player common timer | `verified-already-at-parity` sector geometry; `exact-ported` alpha | common-capacity fan and `.25` icon assertion |
| insufficient available mana | current mana versus refreshed entry cost | `exact-ported` | exact effective-cost projection and half-alpha transition |
| explicitly disabled/noncombat category-2 | Game gate plus separate College RGB modulation | `exact-ported` | Hub remains quarter-RGB and does not masquerade as ready run state |
| Health/Mana aliases and exact-UID item/Sack/equipment entries | non-skill BeltButton painter branches | `verified-already-at-parity` | item art/count unaffected by skill opacity rules |
| toggle-active Planewalker/Firewalker/Mindstar/Regenerate | no presenter highlight branch | `verified-already-at-parity` no-highlight state | activity label may remain semantic; pixels do not pulse/tint |
| cooldown completion | no flash/audio/scale branch | `exact-ported` | direct `.25 -> .75` transition only |
| keyboard/rebound mouse/touch/controller, modal slide, save/restore, late join | same eight button objects and participant belt | `verified-already-at-parity` | input source never changes presentation ownership |
| clear/pull-off, death/Game Over, scene/session teardown | BeltButton/Game lifetime | `verified-already-at-parity` | icon/sector/input hint leave together |

No member in either system is `blocked-by-platform`.

## Native ownership thread and recovered behavioral contract

- Inventory ownership: item identity stays with the participant root while
  root index/`Item_None` owns placement. InventoryScreen owns current/alternate
  page holders, pointer capture, selection, dragger, flyby, parent stack, and
  transitions. The host must author slot mutations; a client-only CSS position
  would be lost on the next snapshot.
- Inventory transitions: drag threshold remains strict 10 pixels. Blank place,
  occupied swap, matching-stack merge, Sack insertion, parent return,
  equipment/storage/unforge/belt targets, and invalid restore are mutually
  exclusive release branches. New objects choose the first internal hole and
  append only when none exists. Geometry remains 22 columns by 4 rows,
  column-major, 75-pixel pitch, 72-pixel cells.
- Belt ownership: Game owns eight entry records; simulation/progression owns
  skill cooldowns and refreshed costs; `BeltButton::Present` samples them each
  frame. Ready establishes white `.75`. Cooldown draws its red square fan
  first and then white `.25` icon. Affordability/disable may replace alpha with
  half of current renderer alpha. College RGB modulation is a separate
  component-wise multiplier.
- Authority/replication: inventory slot indices, item identities, nested-root
  membership, belt entries, cooldowns, effective costs, and current mana come
  from authoritative snapshots. Pointer selection, drag/flyby interpolation,
  and browser focus remain local. Protocol and save versions advance together;
  older compact saves migrate deterministically by array index.
- Lifecycle: root/page replacement clears stale selection and drag state;
  close, service teardown, world transfer, death/Game Over, disconnect, and
  save replacement cannot retain a visual-only placement or availability
  state. Neither system adds audio, randomness, or a browser approximation.

## Nearby-system findings

- The earlier inventory closure used “drag swap” to mean backpack/equipment
  replacement but never enumerated ordinary grid-cell targets. Its compact
  array made the omission structural across every item family and Sack page.
- The earlier HUD report conflated a captured final pixel alpha with the
  caller's draw state and stopped before the mana/disable branch. Static colour
  setter arguments prove `.375` is unavailable, not ready.
- Root insertion already has the exact first-hole rule for every future item
  producer. Implementing placement only in React would leave loot, purchases,
  displaced gear, replication, and save restoration auto-sorted.

## Confidence and open questions

- Confirmed: executable identity, every cited owner/callee, placeholder type,
  grid commit algorithm, empty/occupied/stack/Sack branches, insertion order,
  all ready/cooldown/unavailable RGBA constants, draw order, scene multiplier,
  and complete reachable membership.
- Inferred: none used for implementation constants or branch membership.
- Unknown: none material. Native flyby raster timing remains the already
  recovered 20-tick presentation member and does not block authoritative slot
  parity.

## Web implementation consequence

- `hub-economy.ts` owns a sparse recursive slot projection, first-hole
  insertion, addressed move/swap/merge, validation, and legacy sequential
  normalization. `HubInventoryUi` and `hub-inventory-renderer` consume the same
  slot projection rather than array position.
- The `move-inventory-item` action addresses destination root and cell. Current
  protocol/save documents preserve slot metadata recursively; schema-19 compact
  arrays migrate by their existing order.
- `skill-quickbar.ts` owns the availability alpha projection. `GameHud` carries
  authoritative current mana/effective cost into `SkillQuickbar`; the component
  removes the hard-coded always-grey ready default.
- Obsolete paths to remove: compact `activeRoot.slice(...).map(index)` cell
  ownership, blank-grid no-op release, same-root rejection, and universal
  non-cooldown `.375` opacity.

## Validation contract

- Focused kernels: place into first/middle/last blank; swap both directions;
  same-stack merge; self/invalid rejection; nested Sack and parent return;
  first-hole insertion from every producer family; slot uniqueness/range;
  protocol-103 and save-schema-20 round trips plus schema-19 migration.
- Presentation: every InventoryScreen renderer/action/selection/dye target uses
  the same addressed slot; ready/cooldown/unavailable returns `.75/.25/.375`;
  red fan remains square and below the icon; Hub modulation remains separate.
- Mac browser: in College and active Boneyard, drag items to noncontiguous blank
  cells, swap occupied cells, close/reopen, enter/leave a nested Sack, trigger a
  pickup into the first hole, and observe a skill transition ready -> cooldown
  -> ready plus an insufficient-mana control. Require snapshot/save persistence
  and empty page, console, failed-response, and host-error arrays.
- Exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh` and
  the complete Mod Loader static RE suite on the Mac mini.

## Implementation validation receipt

- Website implementation now preserves recursive addressed cells through the
  host action, protocol `103`, save schema `20`, and deterministic schema-19
  compact-array migration. Blank drops place, occupied drops swap, matching
  stacks merge, nested Sack pages reserve visible cell zero for parent return,
  and every insertion producer fills the first hole before append. The shared
  BeltButton projection now consumes authoritative effective mana costs and
  presents ready/cooldown/unavailable icon alpha as `.75/.25/.375`.
- The byte-identical Mac candidate at commit
  `3e9635d274a108d0a3624569f1c486bdf59baad0`, tree
  `95e060187e849b3ffbcfab71b3998cad1b0f4be1`, passed the canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate: 29 backend contracts,
  2,593 frontend/desktop tests, lint/import boundaries, backend and production
  frontend/game-host builds, bundle budget, and media policy. Log SHA-256 is
  `97576c86d6cce3bb2909936445b3c15fd6a8c8da25cc2225cbb80d2d739552fe`.
- The production Chrome inventory journey moved the root key into blank slot
  12, swapped it with the ring in slot 6, closed and reopened InventoryScreen,
  and retained key/ring slots `6/12`. A nested Sack key retained root slot 9
  at visible slot 10. The journey continued through equipment, item belt,
  storage, all four companion screens, dye, nested Sack, parent-return, and
  active-Boneyard paths with empty page, console, and failed-response arrays.
  Log SHA-256 is
  `e89e12f3fc2bd1fa57d862ff02b05e9ccece6780abbe5ea2cf17801cf3a433ef`;
  addressed-root and nested-Sack captures hash respectively to
  `b260ab79648faffcb471cad6a91c8e2d2b55668d7915b192d39ddf47626b6ed8`
  and `55c16d41f9ecb7df8b423550a204256c12781e1b54d540c2c6a2787aa1dda074`.
- The production Chrome/WebGL2 Phasing journey observed the same icon at ready
  alpha `.75`, insufficient-mana alpha `.375`, and cooldown alpha `.25` over
  `rgba(128,26,26,.75)` with a native square-sector path. Page, console, and
  response error arrays were empty. Log SHA-256 is
  `acd02ae732907050d513703df5760c831ea9c357c59328e3b601b6e48e1df95b`;
  the ready, insufficient-mana, and cooldown captures hash to
  `2198d22af3b424a9f01540e0a55fff5a3effc167a99af076efc3c831bc9a25c6`,
  `0c40d1f9a60008ee7f5298950dadb1c28ef461aa33e922d0e7ffd3e804a1a914`,
  and `2fbfea957fc0132cae57235a39f0379ead9e52c08a916aa74e6ac2aed7ada6bd`.
- The rebased Mod Loader evidence tree at commit
  `a369115d524516336770ddb7439f4c202ed45f4c`, tree
  `a6536bde126e6becf99d8ff98c2f3bd6e80d0e86`, passed all `531/531`
  registered Mac `--ci` static RE checks. Log SHA-256 is
  `91f9b0af5df5e48d2144ffc01a7937869cd703caee5b2f56e295b8dfc2c819d9`.
- This receipt is the sole tracked edit after the final canonical gate and
  browser journeys; source, test, protocol, save, renderer, and harness bytes
  are unchanged from the cited candidate. Publication is authorized;
  deployment was not requested.
