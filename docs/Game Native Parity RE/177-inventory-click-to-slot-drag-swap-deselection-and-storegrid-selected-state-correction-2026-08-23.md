# Inventory click-to-slot, drag swap, deselection, and StoreGrid selected-state correction (2026-08-23)

## Reopened claim and native causal thread

The earlier inventory row is reopened. It covered same-object double activation
and drag but left blank cells without a semantic hit target, left empty
equipment sinks disabled, and did not pin the complete selected-StoreGrid
sprite branch. A fresh read-only retail trace fixes the boundary:

- `InventoryScreen::PointerPress` (`0x0056F760`) assigns the grid hit result to
  current selection even when it is null. A null hit destroys `ItemInfo`,
  clears current/previous selection, and breaks the former object's 50-tick
  activation chain.
- A same-object activation inside 50 native ticks reaches `0x0056D920`.
  Backpack equipment auto-equips through the stock admission/attach path. Stock
  does not use a previously selected object when a different equipment sink is
  clicked; explicit click-item then click-slot is an owner-requested web
  extension, not a native-parity claim.
- `0x00570CD0` admits Hat to hat, Robe to robe, Staff/Wand to weapon, Ring to a
  ring sink, and Amulet to amulet. `InventoryScreen::PointerRelease`
  (`0x0056FC90`) owns the 10-pixel drag threshold, accepted replacement with
  exact displaced-object insertion, one equipment-to-backpack detach, invalid
  restore, and the Hat/Robe no-empty MsgBoxes. Compatible sinks turn green only
  while an active dragger holds an admissible item.
- `StoreGrid` selected rendering is vtable slot `+0xC8`, `0x00565B40`.
  Purchasable stock uses UI 84 `BUY CLICK AGAIN`; Luthacus storage uses UI 111
  `TAKE CLICK AGAIN`; UI 46 remains the unaffordable state. UI 85/112 are the
  adjacent TOUCH variants, but retail helper `0x00461F60` returns constant zero,
  so this Windows executable always selects the CLICK records. Companion
  InventoryScreen selection is independent and never substitutes either
  StoreGrid picture.

## Required complete membership

| Member | Required Website disposition |
| --- | --- |
| first click / same-object second activation | retain stock 500 ms window, item identity, potion/use/equip branches, and delayed ItemInfo |
| click selected equipment item then compatible explicit sink | implement as the disclosed extension through the existing authoritative `equip` action |
| occupied compatible sink | replace atomically and return the exact displaced object to the same backpack |
| incompatible or locked sink | reject without inventory mutation |
| backpack-to-sink drag | retain 10-pixel threshold, typed admission, active-drag-only green sinks, and accepted swap |
| removable equipment-to-backpack drag | dispatch exactly one `unequip`; Hat/Robe keep stock rejection notices |
| blank inventory/chrome click | clear selection, delayed ItemInfo, pending second activation, and drag presentation |
| StoreGrid selected stock/storage | UI 84 BUY CLICK AGAIN / UI 111 TAKE CLICK AGAIN; never the dormant UI 85/112 Windows branches |
| separate service and companion owners | service selection never aliases backpack/equipment selection |

## Web implementation and acceptance receipt

- `hubEquipmentClickAction` admits only the selected live backpack item and an
  explicitly compatible unlocked sink, then emits the existing authoritative
  `equip` action. The kernel remains the final validator and atomically inserts
  one exact displaced occupant into the same backpack.
- Empty sinks are live semantic targets; the locked third ring remains absent
  like the native off-stage sink. A pointer press/release pair owns click-to-slot
  and cancels at the same 10-pixel threshold as drag. Incompatible sinks retain
  the selection with no inventory mutation. Keyboard activation uses the same
  admission helper.
- One behind-content empty-space action clears selection, pending activation,
  ItemInfo timing, and drag presentation. Empty StoreGrid cells independently
  clear their service owner and Luthacus activation clock. Service and companion
  selections remain separate.
- Equipment-to-backpack release emits one `unequip`; backpack-to-sink release
  retains native active-drag-only green admission and occupied-sink swap.
- `HUB_STOREGRID_SELECTED_RECORDS` pins UI 84/111 as the two live Windows
  selected pictures, UI 46 as rejection, and UI 85/112 as dormant. Dowsing now
  uses the same selected-picture offsets as the common StoreGrid.

The final candidate is Website `origin/main` `1a195086` plus this focused tree,
validated in native Windows at
`C:\Users\User\codex-acceptance\inventory-click-equip-native-parity-20260823-publish-current-lf\website`
and retained locally at
`/home/user/.codex-worktrees/solomon-website-inventory-click-equip-20260823-latest-root`.
The canonical exact-tree gate passed: backend build and 17 contracts; Hagatha
`9/9`; library `4/4`; loot `45/45`; save/economy pretests `255/255`; main game
`1,425/1,425`; HUD-selector `6/6`; ML `61/61`; weather `9/9`; parties `48/48`;
level-up `12/12`; diagnostics `7/7`; Hall `36/36`; Hub UI `26/26`; desktop
`5/5`; every remaining suite zero failures; TypeScript, lint, production build,
and media policy all exit zero. Game chunk `Game-gkG9CsOJ.js` is `441338` raw /
`124315` gzip under the `524288` /
`131072` limits.

The production-bundle Chrome journey passed click item -> compatible empty
ring sink, incompatible Hat rejection without mutation, click into an occupied
ring sink with the exact displaced ring returned once, empty-space deselection,
equipped-ring -> backpack drag, backpack-ring -> second sink drag, selected
storage -> UI 111 `TAKE CLICK AGAIN`, empty StoreGrid deselection, and the
existing Sack/Dye transaction family. Page errors, console errors, and failed
responses are all empty. Reviewed captures and the JSON receipt are retained
under
`C:\Users\User\codex-acceptance\inventory-click-equip-native-parity-20260823-publish-current-lf\evidence\browser\`.
An exact-source supplemental trader witness captured UI 84 `BUY CLICK AGAIN`
at its stock offset; its broader dev-server run is visual evidence only because
that server emitted unrelated missing-media 404s, not part of the green
production completion receipt.

Disposition: `exact-ported` for the stock selection, drag, swap, deselection,
and StoreGrid members; the explicitly requested click-item -> click-slot gesture
is implemented and validated as the disclosed web extension. No member is
blocked by the browser platform. Push is authorized for this task; deployment
remains separate and is not requested.
