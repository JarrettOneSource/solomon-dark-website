# 2026-08-24 — Tutorial authored-equipment identity closure

## Reported smell and parity question

- Production Chrome disconnected `Sirmin` with close code 4008 and
  `frame.players.player-OXa_5cPE0hBXCe2p.economy.backpack[2] generated equipment identity is inconsistent`.
  The player-submitted report is diagnostic 27 / reference
  `a983cc76-9e61-46c6-8ef7-9fdb13746d38`, captured at
  `2026-08-24T13:02:55.376Z` on deployed protocol 70 commit `4021fce5`.
- A reconnect 50 seconds later failed on the same item in the full welcome
  snapshot, proving both live delta and hydration paths reject the retained
  authority state. The game service itself remained active with zero restarts.
- This is a secondary report against the Tutorial and item-identity systems.
  Their earlier closure enumerated embedded item 3010 and claimed retained
  inventory identity, but browser acceptance stopped at stage 0 and no test
  carried the fixed authored amulet through pickup, full/delta protocol, save,
  nested storage, equip, and resume. That skipped membership row caused the
  repeat report.
- Stock behavior to preserve: script 10050 materializes one fixed
  `Sorceror's Amulet` from the Tutorial-authored item row. It is neither starter
  gear, a random-FX item, nor an `items.cfg` named-recipe clone, and it remains
  usable through ordinary inventory ownership without acquiring a false recipe
  or generated-effect identity.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production diagnostic | NFO `DiagnosticLogs.Id=27`, browser reference above, Chrome 151 | The live frame failed after 186,562 ms at backpack index 2; immediate rejoin failed on `snapshot...backpack[2]` before input. | high |
| Production lifecycle | `solomon-dark-game.service` journal `12:59:48Z..13:03:44Z` | Same player ID connected, failed on frame, reconnected, then failed on welcome. No host exception/restart occurred. | high |
| Slot and writer trace | two starter potions occupy backpack indexes 0/1; `nativeTutorialAmuletItem`; Tutorial script 10050 -> ground Sack -> `insertLootInventoryItem` | The fixed Tutorial amulet is the unique natural third backpack row and is inserted unchanged except for its live item ID. | high |
| Strict decoder trace | `game-protocol.ts:inventoryItem` at `4021fce5` | Recipe-null equipment is classified only as selector-less starter gear or level/effect-bearing random gear. The authored amulet has selector 0 and no generated level/effects, so it is forced into the random branch and rejected. | high |
| Projection/save trace | `game-snapshot.ts`, `entity-replication.ts`, `game-save-document.ts` | Item fields are copied verbatim. The frame encoder, reconstructor, and save serializer do not mutate selector, records, colors, or effects. | high |
| Existing native evidence | retail 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Tutorial item 3010/script 10050; `native-items-equipment-and-loot.md` | Fixed live `Item_Amulet` identity is distinct from starter equipment, random factory `0x004645B0`, and named recipe clone `0x004699B0`. No new retail fact is needed. | high |

## System boundary and membership inventory

Native/web system: complete equipment identity classification from construction
through container ownership, mutation, persistence, replication, rendering,
effects, and teardown.

| Member | Native/web owner | Disposition | Proof |
| --- | --- | --- | --- |
| starter Hat | fresh character construction | verified-already-at-parity | exact name/type/records, no selector/recipe/generated fields |
| starter Robe | fresh character construction | verified-already-at-parity | exact name/type/records, no selector/recipe/generated fields |
| starter Staff | fresh character construction | verified-already-at-parity | exact name/type/records, no selector/recipe/generated fields |
| fixed Tutorial `Sorceror's Amulet` | item 3010, script 10050, `nativeTutorialAmuletItem` | exact-ported in this closure | exact authored name/type 7003/selector 0/records 30+18/white colors and absence of recipe/random fields |
| random Hat selectors 0..3 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact dual records and non-null colors |
| random Robe selectors 0..2 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact dual records and non-null colors |
| random Staff selectors 0..5 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact single record, no colors |
| random Wand selectors 0..5 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact single record, no colors |
| random Ring selectors 0..11 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact single record, no colors |
| random Amulet selectors 0..11 | factory `0x004645B0` | verified-already-at-parity | generated level/effects, exact two-record selector projection, no colors |
| 47 named recipe rows across all six classes | `items.cfg`, clone `0x004699B0` | verified-already-at-parity | exact source index, name/type/rarity/records and optional legal dye colors |
| named and random Hat/Robe dye state | native item colors and `dyeInventoryClothing` | verified-already-at-parity | color mutation preserves every non-color identity field |
| backpack root | player economy | exact-ported for authored amulet | welcome and delta both round-trip the exact row after pickup |
| storage root | Luthacus transfer owner | exact-ported for authored amulet | transfer/storage projection retains identity |
| amulet equipment sink | equipment slot 6 | exact-ported for authored amulet | equip/unequip and effect refresh retain the exact fixed row |
| recursive Sack contents | `Item_Sack` ownership | exact-ported for authored amulet | bounded nested decode/save retains exact identity |
| ground Sack carrier and pickup | Boneyard loot actor/store | verified-already-at-parity; protocol handoff corrected | item gets only a fresh live ID before backpack insertion |
| full welcome/resume snapshot | game snapshot/protocol | exact-ported in this closure | production rejoin shape decodes |
| keyframe/delta player economy | entity replication/protocol | exact-ported in this closure | production live-frame shape decodes |
| schema-7 Tutorial continuation | save owner | exact-ported in this closure | picked amulet survives save/resume only in Tutorial economy |
| durable pre-Tutorial profile | tutorial profile baseline | verified-already-at-parity | fixed amulet never leaks into later player profile |
| inventory renderer and tooltip | shared item presentation | verified-already-at-parity | selector 0 renders exact amulet records without a recipe lookup |
| player attachment/equipment effects | amulet sink and FX resolver | reopened by the following correction | the row has one authored Ether-class damage effect; the earlier no-FX conclusion was false |
| ML inventory observation | semantic inventory projection | verified-already-at-parity | recipe-null/no-effect identity remains bounded and non-set |
| malformed near-matches | strict protocol boundary | exact-ported rejection | name/type/subtype/quantity/rarity/selector/records/colors/recipe/generated mutations all fail closed |
| run replacement, death/profile retirement, disconnect | existing save/session owners | verified-already-at-parity | no hidden compatibility copy or orphan identity remains |
| potions, Misc, Sack, Perk, Map, mod potions | non-equipment item families | out-of-system | separate kind/type identity branches remain unchanged |

There are no browser-platform-blocked members. This is a finite authored data
identity and is exactly representable in JSON, saves, and browser rendering.

## Native ownership thread and recovered behavioral contract

- Tutorial script 10050 owns the single item-3010 materialization edge. The
  Boneyard loot carrier owns ground lifetime, pickup owns the live ID rewrite,
  and player economy owns every later container/mutation. None of those owners
  convert the item into random gear or a named recipe.
- The fixed row is exactly: equipment kind, Amulet/type 7003, selector 0,
  records `[30,18]`, white two-value authored color state, quantity one, null
  subtype/rarity/recipe, no generated level, and one authored FX row. Its
  display name is exactly `Sorceror's Amulet`. The following correction owns
  the effect tuple that this transport-focused pass had left opaque.
- Equipment identity has four disjoint classes: starter, fixed authored
  Tutorial, random generated, and named recipe. Classification is based on
  owned fields, then each class validates its entire exact tuple. A nearly
  matching item never falls through as another class.
- Full and delta protocol remain transparent projections. The client must not
  loosen generated-equipment validation or silently drop the row; the shared
  decoder must recognize the missing authoritative class.
- Save, Sack, storage, equip, and reconnect use the same identity function at
  every depth. No schema/protocol bump is required because every field already
  exists in protocol 70; only the closed-union validation omitted one shipped
  member.

## Nearby-system findings

- The latest slot revision was replaced by a newly created wizard after the
  crash, so the invalid third row no longer exists in SQLite. The submitted
  report, exact backpack index, Tutorial source row, and repeat welcome failure
  still make the reproduction deterministic without guessing the lost bytes.
- `game-snapshot.ts` and entity replication copy economy items rather than
  synthesizing them. Their strict failure locations identify one shared decode
  omission, not two serialization bugs.
- No Mod Loader document changes in this closure because item 3010, Amulet
  layout/art, the random factory, and the named-recipe factory were already
  recovered and recorded.

## Web implementation consequence

- Keep the exact authored identity beside `nativeTutorialAmuletItem`, its
  construction owner. Let the shared protocol inventory validator recognize
  that one fourth equipment class before starter/random classification.
- Do not add a generated level, generated/random FX identity, fake rarity, or a
  guessed recipe index to the Tutorial item. Preserve its authored FX row
  separately from generated-equipment classification.
- Do not weaken generated or named-equipment validation, add a legacy decoder,
  or special-case one backpack index/session/player.

## Validation contract

- On untouched `4021fce5`, decode the exact `nativeTutorialAmuletItem` in a
  full welcome and player-economy delta frame and reproduce the submitted
  `generated equipment identity is inconsistent` failure.
- After the fix, round-trip the exact item through backpack, storage, equipped
  amulet slot, recursive Sack, welcome, delta/keyframe, and schema-7 Tutorial
  save/resume while the durable profile remains unchanged.
- Mutate every authored identity member independently and require strict
  rejection. Re-run starter, all six random selector families, all named
  recipes, dyes, nested Sacks, inventory actions, rendering, equipment effects,
  and save migration coverage.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the manifest-identical
  Mac tree and a real Mac Chrome/WebGL Tutorial pickup/resume journey with
  empty page, console, failed-response, wire, and host-error arrays.

## Implementation validation receipt

- The Tutorial owner now exports one immutable authored-identity row and builds
  `nativeTutorialAmuletItem` from that same source. The shared inventory
  decoder recognizes the selector-bearing/no-generated-level class, then
  admits only the exact Amulet tuple. Starter, random generated, and named
  recipe branches are byte-for-byte unchanged; protocol 70 and save schema 7
  remain unchanged.
- On the untouched deployed base `4021fce5`, the new full-welcome regression
  failed with the submitted
  `snapshot.players.player-1.economy.backpack[2] generated equipment identity is inconsistent`
  error while the other `1483/1484` Boneyard tests passed. This reproduced the
  production rejoin failure before any implementation code changed.
- The fixed Mac tree passed the complete canonical gate: backend build and 22
  contracts; formatting/lint/import boundaries; frontend groups
  `9/4/45/264/1484/6/77/9/63/12/14/7/36/33`; five desktop tests; production
  frontend/GameHost builds; bundle budget; and media policy. The new matrix
  covers backpack, storage, equipped amulet, nested Sack, welcome, frame, 13
  independent malformed identities, and schema-7 Tutorial save/profile lanes.
- Built-production Mac Chrome resumed a task-generated schema-7 Tutorial at
  stage 9 through IndexedDB, the real supervisor/host, full welcome, player
  frames, renderer, and save coordinator. It rendered item ID 15 as
  `Amulet, Sorceror's Amulet`, equipped it into the amulet sink, retained an
  active Boneyard continuation, and checkpointed without page, console,
  failed-response, wire, or host errors. The inspected 1600x900 inventory
  receipt is SHA-256
  `48c01807ed39e04144186c1243cfc1a8dcf22946d482f3fa42ca2f49331ec8ff`;
  the source save fixture was
  `d54756ce89f8c3f39a2f379caec052a6aa968c1f03d6dc9b8249664abc40df69`.
- The schema-7 fixture generator and legacy-smoke compatibility additions were
  task-only acceptance scaffolding and were removed after the receipt. The
  final diff contains only this ledger, the authored identity source, shared
  decoder, and focused protocol/save regressions. No Mod Loader report changed
  because the retail item facts were already complete.
- Final manifest-identical validation, publication, deployment observation,
  post-deployment log verification, and task-scaffolding cleanup remain
  pending and are reported separately.
