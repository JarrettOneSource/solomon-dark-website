# 2026-08-27 — Goodie Item_Sack materialization and InventoryScreen root navigation

## Reported smell and parity question

- Reported web behavior: Sacks collected from chests appear not to function,
  and activating a Sack is unreliable or a complete no-op. A Sack must open
  consistently in both the Hub and an active Boneyard run.
- This reopens the 2026-08-23 Sack/Dye entry. That pass correctly recovered
  recursive ownership and mutation, but it conflated recursive lookup with
  visible projection and did not follow the type-7008 activation branch in
  `InventoryScreen` handler `0x0056D920`. It therefore shipped every child
  root permanently flattened and left Sack activation without an action.
- The same audit reopens Goodie materialization: the earlier loot pass drained
  all 18 authored rows but preserved the pre-insertion Potion sequence instead
  of the live child root after `0x0055FF20` Potion stacking.
- Reproduction scenes are standalone InventoryScreen in Hub, the same screen
  during an active Boneyard inventory pause, its companion form beside a Hub
  service, nested and empty Sacks, and a naturally materialized Goodie/chest
  Sack collected through the authoritative world actor.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | stock 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, preferred base `0x00400000`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | canonical project/program identity reverified before fresh queries | high |
| Instructions | `0x0056D920`, raw ranges `0x0056D9A9..0x0056DAB3` and `0x0056DBD2..0x0056DC99` | game-back pops one root; Item_Sack activation pushes the current root, selects child `+0x88`, locks input, starts signed page motion, and owns distinct close/open sounds | high |
| Instructions | `InventoryScreen_Update 0x00551A10`; ctor `0x00560380`; opener `0x005C6F10` | both grid pages move 10 stage pixels per 100 Hz tick across the full 1600-wide logical client; the same standalone owner is reachable without a world-kind branch | high |
| Instructions | Goodie tick `0x0061F4C0`, insert `0x0055FF20`, raw `0x0061FAB3..0x0061FABA` plus sibling calls | every child insertion passes both boolean operands as one; equal Potion subtypes merge into the first live node | high |
| Audio data | compiled registry offsets `0xF4`, `0xC8`, `0xB18`; stock WAV catalog | child open is `backpack_open`, parent return is `backpack_close`, outer close is `openpanel` | high |
| Current web trace | `activateSource`, `projectInventoryItems`, Goodie `resolveNativeGoodieContents` | Sack activation has no branch, the grid recursively flattens every root, and repeated Goodie Potions remain separate nodes | high |
| Acquisition trace | `materializeGoodie ->` type-2013 carrier `-> insertPlayerEntityLootItem` | the Item_Sack object, child list, and IDs survive authoritative pickup; acquisition does not erase the container | high |

All addresses are preferred-image addresses from the canonical read-only
`SolomonDark` Ghidra replica workflow. No runtime/ASLR address is used.

## System boundary and membership inventory

Native system: Goodie reward construction through forced child insertion,
ground-Sack pickup, and client-local `InventoryScreen` child-root navigation,
including every authored Goodie row and every root transition branch.

| Member | Native source | Final disposition | Required proof |
| --- | --- | --- | --- |
| Goodie selectors 0..3 | `0x0061FA60..0x0061FABF` | exact-ported | one subtype-0 Potion node, quantity 5, while all five UIDs are consumed |
| Goodie selectors 4..7 | `0x0061FAC7..0x0061FB30` | exact-ported | one subtype-1 Potion node, quantity 6, while all six UIDs are consumed |
| selectors 8..10 equipment | `0x0061FB3E..0x0061FBBA` | verified-already-at-parity | two/three generated items or one definition item remain distinct |
| selectors 11..12 books | `0x0061FBCC..0x0061FC25` | verified-already-at-parity | three independently rolled subtype-2/3 books remain distinct |
| selectors 13..16 Gold | `0x0061FC3B` branch | verified-already-at-parity | 500/800/1100 Gold path creates no Item_Sack |
| selector 17 mixed Potions | `0x0061FC81..0x0061FEA2` | exact-ported | subtype order `5,0,1,4,2`, quantities `1,1,1,1,2`; leaked first three allocations remain absent |
| nonempty/empty carrier decision | `0x0061FEF3..0x0062000F` | verified-already-at-parity | nonempty root creates actor 2013; empty root is destroyed |
| ground pickup and exact tree identity | `0x005E6B50 -> 0x0055FF20` | verified-already-at-parity | collected Goodie Sack retains the same represented child tree with fresh authoritative web IDs |
| outer Hub InventoryScreen | `0x005C6F10`, `0x0056D920` | exact-ported | only the current root's direct children are visible; Sack activation always enters child root |
| active Boneyard InventoryScreen | shared gameplay control and same handler | exact-ported | identical local root transition while the owner-held inventory pause remains active |
| companion InventoryScreen beside services | constructor parameterized root/equipment sinks | exact-ported | player backpack Sack navigation remains available without changing StoreGrid ownership |
| empty and nested Item_Sacks | type 7008 branch has no content gate | exact-ported | empty page opens; nested roots push/pop one level each |
| open transition | screen `+0x168/+0x16C/+0x170`, update `0x00551A10` | exact-ported | right-to-left 160-tick page traversal at 10 logical pixels/tick; input locked during traversal |
| parent return and outer close | game-back branch in `0x0056D920` | exact-ported | parent returns left-to-right with `backpack_close`; outer root closes with `openpanel` |
| root-open audio | registry 5 / offset `0xF4` | exact-ported | exact `backpack_open.wav`, gain 1, default pitch |
| authoritative item tree / local page path | item serializers versus InventoryScreen fields | exact-ported | contents remain authoritative and replicated; active path/transition never enters the protocol |
| Luthacus StoreGrid goods | separate Shop/StoreGrid owner | out-of-system: transfers top-level stored goods; it is not the player InventoryScreen root stack | service regression retains its independent transaction contract |
| `Inventory_EquipAllEligible` Sack use | `0x0056B090`, dispatcher `0x0056D1B0` | out-of-system: separate arbitrary-item belt/compatible drag action, not InventoryScreen child-root opening | native report retains its equipment order, level gate, swaps, and pitch-0.8 sound |

No member is blocked by the browser platform.

## Native ownership thread

- `Item_Sack` type 7008 owns its `SdItemListRoot` at `+0x88`; the ground Sack
  actor owns that exact item until pickup transfers it to the participant.
- Goodie constructs every authored child, then calls forced common insertion.
  Potion stacking keeps the first same-subtype node and adds later stack counts;
  later live objects are destroyed only after consuming their UIDs.
- `InventoryScreen+0x158` owns the current visible root. Its dynamic parent
  stack is `+0x174` with count `+0x184`. Child activation pushes the prior
  root; game-back pops exactly one.
- Transition-active `+0x168` rejects another activation. Countdown `+0x16C`
  and direction `+0x170` drive two alternating `InventoryGrid` pages at a
  fixed 10 pixels per authoritative UI update. Screen destruction discards the
  path and a later open starts at the participant root.
- This is presentation/navigation state only. Hub and Boneyard both mount the
  same participant inventory tree; the Boneyard pause owner continues to own
  mutations, but opening a child root emits no host action.

## Recovered behavioral contract

- A completed activation of any visible Item_Sack, including an empty one,
  opens that Sack. Only its direct children occupy the 88 visible cells.
- Open moves the old grid left and the child grid from the right by 10 logical
  pixels per 10 ms tick. At the fixed 1600-wide web-native stage it settles
  after 160 ticks / 1,600 ms. All inventory activation/drag input is ignored
  while the transition is active.
- Game-back inside a Sack returns one level with the inverse traversal. At the
  participant root it closes the InventoryScreen instead. Closing/reopening
  resets to the outer root.
- Open requests stock `backpack_open.wav`; parent return requests
  `backpack_close.wav`; outer close retains `openpanel.wav`. These are not host
  feedback sounds.
- A Goodie health or mana bundle exposes one stack, not five/six separate
  cells. The mixed selector exposes five cells and the Wizard Chug cell has
  quantity two. Equipment and book rows remain distinct.
- The item tree and IDs remain authoritative, saveable, and replicated. The
  active Sack path, transition age, page offsets, and selection are local UI
  lifetime only and reset without a protocol version change.

## Nearby-system findings

- The prior depth-first flat grid was not a harmless presentation shortcut:
  it let nested children consume outer visible capacity, made every Sack look
  permanently open, and prevented the native back/root lifecycle.
- The current host inventory-pause allowlist cannot explain the no-op because
  a correct root open sends no authoritative action. Adding a protocol action
  would put ownership in the wrong layer.
- The 500 ms cross-input activation detector remains shared with Potion,
  equipment, Dye, and book use. It is not changed unless the repeated browser
  matrix reproduces a sibling failure.
- Durable native details were added to
  `native-items-equipment-and-loot.md` and
  `native-boneyards-and-world.md` in the Mod Loader repository.

## Confidence and open questions

- Confirmed: executable identity, complete Goodie rows, forced insertion
  operands, Potion merge result, child-root state fields, stack transitions,
  input lock, exact page delta/duration, three audio branches, scene ownership,
  acquisition identity, and teardown.
- Inferred: none used as implementation truth.
- Unknowns: none material. The separate equip-all Sack use stays outside this
  InventoryScreen navigation boundary and remains durably documented.

## Web implementation consequence

- Preserve `projectInventoryItems` for recursive lookup, HUD/bot queries, save,
  protocol, and the explicitly authorized Tutorial amulet target. Stop using
  it as the visible InventoryScreen grid.
- Add a current Sack path plus transition model owned by `HubInventoryUi`.
  Resolve only direct children for the active page; reconcile stale paths to
  the nearest live ancestor; reset the path on screen teardown.
- Route Sack activation and game-back through that local owner in standalone,
  Boneyard, and companion inventory modes. Do not add a protocol action or
  host allowlist entry.
- Render both outgoing and incoming grid layers during the exact discrete page
  traversal and expose settled/path state for deterministic browser proof.
- Add the exact `backpack_open.wav` asset/manifest row and play the recovered
  open/back/outer-close cues at their owning transitions.
- Apply common Potion insertion semantics while resolving Goodie contents so
  the final bundle tree retains native stacks and UID consumption.

## Validation contract

- Red/green kernel tests: all 18 Goodie rows after insertion, stack quantities
  and UID gaps; direct-root resolution; empty, nested, stale-path, open/back,
  and 160-tick discrete offset plans.
- UI/renderer tests: only direct active-root children consume cells; recursive
  global consumers remain intact; outgoing/incoming direction and endpoints;
  input lock; open/back/close audio ownership; companion membership.
- Real-host Mac Chrome: naturally materialize and collect a Goodie Sack in an
  active Boneyard, open it after pickup, verify the correct stacked contents,
  return to root, and repeat settled open/back cycles. Repeat the same filled,
  empty, and nested path in Hub. Require zero page/console/response/host errors
  and exact `backpack_open` / `backpack_close` event counts.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` and the Mod Loader portable
  static RE suite on byte-identical Mac candidate trees before publication.

## Implementation validation receipt

- Goodie resolution now runs every authored child through the recovered common
  insertion rule. Equal Potion subtypes merge into the first live node while
  every attempted allocation still consumes its UID. Selectors 0..3 therefore
  retain one quantity-5 health stack, selectors 4..7 one quantity-6 mana
  stack, and selector 17 the exact five-node order and quantities above.
- `HubInventoryUi` owns a local Sack path and reconciles it to the nearest live
  ancestor. The grid resolves only the active root's direct children. Sack
  activation, game-back, teardown reset, and input lock share that owner in
  Hub, active Boneyard, and companion inventory. The authoritative item tree,
  save/protocol representation, and host action surface are unchanged.
- The Pixi inventory renderer retains outgoing and incoming pages and advances
  them in discrete ten-pixel steps through the exact 160-tick traversal. Empty
  and nested Sacks use the same branch. Luthacus StoreGrid remains a separate
  top-level storage projection, while a Sack transferred back to the player
  can be opened normally.
- The exact stock `backpack_open.wav` is registered at gain 1/default pitch.
  Parent return uses the existing `backpack_close` cue and outer close keeps
  `openpanel`; no host feedback or protocol action was added.
- The Mac red gate first failed the three newly asserted Goodie insertion
  contracts (`43/46` passing) against five/six separate Potion nodes. The
  independent root-navigation red fixture failed at `250/251` because
  `inventoryItemsAtSackPath` did not exist. Both failures disappeared only
  after the production insertion and root-navigation owners were added.
- A byte-identical Mac candidate based on Website main
  `a8a0b7d7ad78e40be5d6120f54694ecb9e295961` passed the canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate. Its production game
  entry was `Game-CPmO3mD5.js`, 476,425 raw bytes and 133,249 gzip bytes,
  within the 524,288/134,144-byte limits. The byte-identical Mod Loader tree
  based on `fdd38df28eebb2fbfa0f456b5666c043b6afa503` passed `510/510`
  portable static RE contracts.
- Mac Chrome 151/WebGL2 Hub acceptance opened filled, empty, and nested Sacks,
  returned through every parent, moved items, exercised all dye swatches, and
  opened a Sack after companion storage transfer. It reported status `ok`,
  exactly eight `backpack_open` and eight `backpack_close` events, and empty
  page/console/failed-response arrays. The reviewed Sack movement frame SHA-256
  is `ec9630c92ac9614e01dbcc548385d0c271c6d8fae0df39d49af4b1882c38c34f`.
- A separate real-host Boneyard journey naturally materialized reward-0
  Goodie, collected its ground Sack, observed one quantity-5 Potion child,
  and completed five settled open/back cycles during the run. Chrome reported
  WebGL2 and empty page/console/failed-response arrays; the smoke process also
  exited zero after browser and host teardown. The reviewed open-Sack frame
  SHA-256 is `d7df7877be8b053c1ab14756498d8ed1cad4f86c1320db825b257ec06d46a29b`.
