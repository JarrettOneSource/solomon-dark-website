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

## 2026-08-30 — Equipment level-admission reopening

### Reported smell and process failure

- A player supplied `scaling 1 - image.png` (2,127,766 bytes, SHA-256
  `1398245626f3755fc26d66b77b342f22dbdc88e9b4863247df9b1be97ea5f87c`):
  a level-1 Warlock has a generated `Curing Ring of Channeling` equipped while
  its ItemInfo says `Requires Player Level 8`. The player reproduced the same
  admission in the College and Graveyard/Boneyard InventoryScreen.
- The stock question is not whether ItemInfo should show a warning. It is
  whether the common equipment admission owner rejects every under-level item
  before attach/swap, which state supplies the two-level reduction, and whether
  click activation, drag release, Sack auto-equip, every equipment class, and
  both gameplay scenes share that rule.
- This is a secondary report in a system previously marked `exact-ported`.
  The 2026-08-23 pass stopped at type/slot admission `0x00570CD0` and did not
  sweep the xrefs of item-level predicate `0x00577900`. Its per-sink tests used
  no player progression context, so they could not falsify the missing rule.
- Falsifiers were: a display-only requirement; a rule limited to generated
  loot or Sack activation; a Hagatha charm/curse selector as the reducer;
  scene-specific College/Boneyard behavior; or an ongoing effect gate instead
  of an admission-time gate. Static instructions and the current web source
  falsify all five.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | image above; supplied 2026-08-30 | Level 1, generated level-8 Ring, red requirement line, item already in an equipment sink; report names College and Graveyard | high |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, reverified 2026-08-30 | Canonical stock image matches the existing inventory evidence | high |
| Static predicate | canonical Ghidra 12.0.3 read-only replica; `0x00577900`; raw range `0x00577900..0x00577941` | `MOVSX` reads item byte `+0x5A`; permanent skill row 63 rank at player skill-table offset `0x1BB2` subtracts exactly two when positive; signed `SETGE` admits iff `playerLevel >= requiredLevel - reduction` | high |
| Predicate membership | all xrefs to `0x00577900` | Eight calls in exactly three owners: six equipment-class scans in `0x0056B090`, same-object activation in `0x0056D1B0`, and equipment-sink drag release in `0x0056DE50` | high |
| Direct activation | `0x0056D1B0`, call at `0x0056D394` | Type IDs `7002..7006` and `7011` call the predicate before attach; failure plays the current bad-action sound and performs no mutation | high |
| Drag release | `0x0056DE50`, call at `0x0056DEE0`; type/slot predicate `0x00570CD0` | Every equipment sink checks the same level predicate before compatibility, detach, swap, or insertion; failure returns without mutation and plays bad-action | high |
| Sack auto-equip | `Inventory_EquipAllEligible 0x0056B090` | Ring, Amulet, Staff, Hat, Robe, and Wand scans each call `0x00577900`; only admitted direct children proceed through the existing ordered attach/swap path | high |
| ItemInfo | `0x0057C4B0`, raw range `0x0057C71B..0x0057C7EB`, string `Requires Player Level` at `0x007971DC` | ItemInfo independently applies the same skill-63 positive-rank subtraction before deciding whether to show the warning, but prints the original item level | high |
| Existing audio evidence | inventory release ledger 293; audio registry offset `0x120` | The shared rejection cue is `bad-action`, gain/pitch one; no new asset or channel is involved | high |
| Current web baseline | Website `origin/main` `7b614e36`; `hub-economy.ts`, `game-simulation.ts`, `hub-inventory-render-contract.ts` | Direct equip receives no player context; Sack auto-equip checks only `generatedLevel <= playerLevel`; ItemInfo tests unreachable `ownedPerkSelectors.includes(8)` even though selector 8 is rejected by economy/protocol validation | high |

Ghidra was invoked through the existing Mod Loader checkout read-only at
`08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py`, `dump_function_instructions.py`, and
`refs_to_addr_decompile.py` are respectively
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`,
and `c6844b842ccd87aa70d290ae34553d874a8f90866eb234425f7c51fd8a438c4b`.

### System boundary and complete membership

Native system: player-owned equipment level admission, from the item `+0x5A`
required-level field and permanent Creativity rank through all InventoryScreen
producers, attach/swap rejection, ItemInfo presentation, sound, authoritative
web replication, and the College/Boneyard consumers.

#### Authored equipment table membership

Every authored recipe row feeds the same required-level field. The already
extracted 47-row table remains the exact data source; this reopening changes
its admission consumer, not any row.

| Row | Authored item | Class | Required level | Disposition |
| ---: | --- | --- | ---: | --- |
| 0 | Pentaclostic Ring | Ring | 0 | verified-already-at-parity |
| 1 | Arcanoric Robe | Robe | 0 | verified-already-at-parity |
| 2 | Cosmofluxic Wand | Wand | 0 | verified-already-at-parity |
| 3 | Theptoplasmar Amulet | Amulet | 0 | verified-already-at-parity |
| 4 | Synertauxic Ring | Ring | 0 | verified-already-at-parity |
| 5 | Sublunarous Hat | Hat | 0 | verified-already-at-parity |
| 6 | Combinator's Cap | Hat | 0 | verified-already-at-parity |
| 7 | Combinator's Cape | Robe | 0 | verified-already-at-parity |
| 8 | Combinator's Club | Staff | 0 | verified-already-at-parity |
| 9 | Combinator's Choker | Amulet | 0 | verified-already-at-parity |
| 10 | Combinator's Circle | Ring | 0 | verified-already-at-parity |
| 11 | Bug-Master's Cap | Hat | 0 | verified-already-at-parity |
| 12 | Bug-Master's Robe | Robe | 0 | verified-already-at-parity |
| 13 | Bug-Master's Wand | Wand | 0 | verified-already-at-parity |
| 14 | Bug-Master's Loop | Ring | 0 | verified-already-at-parity |
| 15 | Pan-Dimensional Strangler | Amulet | 0 | verified-already-at-parity |
| 16 | Cloudcover Hood | Hat | 0 | verified-already-at-parity |
| 17 | Ozone Cape | Robe | 0 | verified-already-at-parity |
| 18 | Lightning Rod | Staff | 0 | verified-already-at-parity |
| 19 | Storm Choker | Amulet | 0 | verified-already-at-parity |
| 20 | Burning Hat | Hat | 0 | verified-already-at-parity |
| 21 | Burning Robe | Robe | 0 | verified-already-at-parity |
| 22 | Biting Ring | Ring | 0 | verified-already-at-parity |
| 23 | Bitter Ring | Ring | 0 | verified-already-at-parity |
| 24 | Glittering Amulet | Amulet | 0 | verified-already-at-parity |
| 25 | Potter's Apron | Robe | 0 | verified-already-at-parity |
| 26 | Clayshaper's Ring | Ring | 0 | verified-already-at-parity |
| 27 | Claybaker's Ring | Ring | 0 | verified-already-at-parity |
| 28 | Kiln | Wand | 0 | verified-already-at-parity |
| 29 | Obfuscate's Meddler | Amulet | 8 | exact-ported by this reopening |
| 30 | Karen You Scandalous Wench | Amulet | 15 | exact-ported by this reopening |
| 31 | Poxproof | Amulet | 30 | exact-ported by this reopening |
| 32 | Ethereal Choker | Amulet | 10 | exact-ported by this reopening |
| 33 | Absolox's Boomstick | Staff | 5 | exact-ported by this reopening |
| 34 | Staff of Dawn | Staff | 15 | exact-ported by this reopening |
| 35 | Ringwall | Ring | 3 | exact-ported by this reopening |
| 36 | Fleetfinger | Ring | 10 | exact-ported by this reopening |
| 37 | Gritchenscorn | Ring | 10 | exact-ported by this reopening |
| 38 | Mindblowing Ring | Ring | 1 | exact-ported by this reopening |
| 39 | Smartest Ring | Ring | 20 | exact-ported by this reopening |
| 40 | Yzmar's Handicap | Hat | 3 | exact-ported by this reopening |
| 41 | Qubar's Ether | Wand | 10 | exact-ported by this reopening |
| 42 | Qubar's Fire | Wand | 10 | exact-ported by this reopening |
| 43 | Qubar's Air | Wand | 10 | exact-ported by this reopening |
| 44 | Qubar's Water | Wand | 10 | exact-ported by this reopening |
| 45 | Qubar's Earth | Wand | 10 | exact-ported by this reopening |
| 46 | Robe of Thaumic Unperturbability | Robe | 15 | exact-ported by this reopening |

#### Producers, consumers, branches, and lifecycle

| Member | Native/web source | Disposition | Required proof |
| --- | --- | --- | --- |
| generated Ring `7002` | item `+0x5A`; random equipment level | exact-ported by this reopening | under/exact/reduced threshold and reported ring regression |
| generated Amulet `7003` | same predicate and item field | exact-ported by this reopening | per-class direct admission |
| generated Staff `7004` | same predicate and item field | exact-ported by this reopening | per-class direct admission |
| generated Hat `7005` | same predicate and item field | exact-ported by this reopening | per-class direct admission while required-clothing detach remains separate |
| generated Robe `7006` | same predicate and item field | exact-ported by this reopening | per-class direct admission while required-clothing detach remains separate |
| generated Wand `7011` | same predicate and item field | exact-ported by this reopening | per-class direct admission into weapon sink |
| recipe-less starter/Tutorial/mod wearables | initialized level byte zero; common predicate | verified-already-at-parity | zero requirement remains admitted; Tutorial amulet identity unchanged |
| permanent Creativity skill 63 | player skill row 63 rank `> 0` | exact-ported by this reopening | rank zero versus positive; exactly two levels; rank magnitude does not stack |
| first click / same-object activation | `0x0056D1B0` | exact-ported by this reopening | rejection before attach and one bad-action cue |
| backpack-to-sink drag | `0x0056DE50` | exact-ported by this reopening | reject before detach/swap/insertion; dragged item restores |
| explicit click-item -> sink | Website extension from the earlier entry | exact-ported through the shared authoritative admission owner | same rejection/state/audio as stock producers |
| keyboard/gamepad semantic activation | same Website `equip` command | exact-ported through the shared authoritative admission owner | no input-producer bypass |
| occupied sink swap | attach path after predicate | verified-already-at-parity, strengthened by rejection proof | under-level source leaves exact occupant and backpack untouched |
| third-ring charm gate | separate sink-availability branch | verified-already-at-parity | level admission does not unlock or bypass ring III |
| `Inventory_EquipAllEligible` Sack activation | `0x0056B090` | exact-ported by this reopening | all six classes use recipe/generated requirement plus Creativity reduction |
| Sack activation from item belt | dispatcher `0x0056D1B0`; Website belt authority | exact-ported by this reopening | authoritative player level and skill book reach the shared predicate |
| ordinary equipment activation from item belt | same dispatcher and Website `equip` command | exact-ported by this reopening | cannot bypass direct Inventory admission |
| College/Hub InventoryScreen | actor-owned shared screen | exact-ported by this reopening | level-1/high-level rejection in browser |
| Boneyard/Graveyard InventoryScreen | same actor-owned shared screen | exact-ported by this reopening | same saved item rejected against occupied sink in browser |
| Hub service companion InventoryScreen | same player equipment sinks and command | exact-ported through the shared owner | no trader-side bypass |
| ItemInfo in backpack, equipment, StoreGrid, and services | common `0x0057C4B0` content builder | exact-ported by this reopening | warning presence uses permanent Creativity rank; text retains original level |
| rejection feedback/audio | predicate failure and sound registry `+0x120` | verified-already-at-parity once authority rejects | exactly one `bad-action`; no success equip cue |
| multiplayer/save replication | Website host-authoritative economy, progression, and skill book | exact-ported by this reopening | authenticated actor context; rejection changes no item/effect ownership |
| already-equipped state and later level changes | stock has admission-time predicate only; player level and permanent Creativity do not decrease | out-of-system: no native ongoing eligibility/effect gate or forced unequip | existing equip/effect/save behavior remains unchanged |
| random equipment generation and 47-recipe acquisition | upstream producers of the level field | out-of-system: admission consumes their already recovered output | existing loot/Dowsing receipts remain unchanged |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- Equipment owns one signed required-level byte at `+0x5A`. Recipe gear and
  generated gear converge on that field before InventoryScreen sees them.
- `0x00577900` is the sole admission predicate. It ensures player skill row 63
  exists, reads the permanent rank at row offset `+0x22`, subtracts two when
  that rank is positive, then performs the inclusive signed comparison
  `playerLevel >= requiredLevel - 2`. Rank 2 does not subtract four.
- `0x0056D1B0`, `0x0056DE50`, and `0x0056B090` are the complete xref set.
  Admission is immediate and has no tick, animation, RNG, geometry, collision,
  or teardown state. Successful mutation continues through the existing exact
  attach/swap owner; failure performs no detach, insertion, effect refresh, or
  save mutation.
- ItemInfo performs the same positive-Creativity test but prints the original
  required level. Thus level 6 with Creativity may equip a level-8 item and no
  warning appears; level 5 still sees `Requires Player Level 8` and is rejected.
- Hub and Boneyard mount the same participant InventoryScreen. The web port's
  multiplayer adaptation keeps the predicate in the authenticated host action,
  using that participant's progression and permanent skill book; presentation
  controls are not trusted to admit the item.
- Rejection uses the existing bad-action cue once. Equipment effects are
  downstream of successful attachment only; there is no separate disabled-item
  state and no ongoing level check.

### Nearby-system finding

The current web ItemInfo's `ownedPerkSelectors.includes(8)` is unreachable:
selector 8 is explicitly rejected by Hagatha economy and protocol validators.
That code confused Hagatha tooltip row 8 with native skill row 63. The same
false ownership assumption also kept Creativity out of Sack auto-equip. Both
must be replaced by the participant's permanent skill-63 rank wherever the
shared level rule is consumed.

### Confidence and open questions

- Confirmed: formula, signed/inclusive branch, item field, Creativity ownership,
  all xrefs, all six item classes, three input owners, ItemInfo behavior, and
  scene sharing.
- Inferred: none required for implementation.
- Unknown: none material. There is no browser approximation.

### Web implementation consequence and validation contract

- Put required-level resolution and the exact Creativity reduction in the
  authoritative equipment economy module. Generated level overrides recipe
  level; recipe-less equipment resolves to zero, matching the native field.
- Require direct equip and Sack auto-equip callers to supply player level and
  permanent Creativity rank. The simulation host, not the browser control,
  supplies both from the authenticated participant.
- Make ItemInfo consume that same recovered rule and remove the false Hagatha
  selector-8 path. Preserve its original-level warning text.
- Focused Mac tests must drain all 47 recipe rows, all six generated classes,
  exact/ineligible thresholds, positive non-stacking Creativity, recipe-less
  gear, occupied swaps, direct nested-Sack gear, Sack auto-equip, belt
  dispatch, and authoritative rejection without mutation.
- Mac Chrome must use the real production bundle and host: at level 1, show
  Ringwall's level-3 warning and reject same-object activation in College, then
  reject a drag/click admission in Boneyard while preserving the backpack item
  and occupied equipment. Both failures must produce one bad-action cue and no
  page, console, or failed-response errors.
- The complete supported Mac gate remains mandatory.

### Implementation validation receipt

- `hub-economy.ts` now owns one required-level resolver and one native admission
  predicate. Generated level overrides a recipe row, recipe-less gear resolves
  to zero, and any positive permanent Creativity rank subtracts exactly two.
  Direct equip and `Inventory_EquipAllEligible` require the same explicit player
  context and reject before removal, swap, or effect ownership changes.
- `game-simulation.ts` supplies level and skill-63 permanent rank from the
  authenticated participant for ordinary Inventory, item-belt, and Sack-belt
  actions in both worlds. `hub-inventory-render-contract.ts`, the retained
  renderer, and semantic service HoverBoxes consume the same rule; the
  unreachable Hagatha-selector-8 ownership is removed.
- The initial Mac red gate reached the inventory kernel with 328 passing tests
  and the one new six-class under-level regression failing because the old
  kernel admitted the item. After implementation, the focused rows pass for all
  47 recipes, all six generated classes, inclusive thresholds, non-stacking
  Creativity, recipe-less gear, occupied and nested-Sack rejection, ordered Sack
  auto-equip, item-belt dispatch, authoritative College/Boneyard ownership, and
  ItemInfo warning visibility.
- On the byte-identical Website candidate based on `7b614e36`, the complete
  supported Mac gate `/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero.
  Backend build and all 28 Website contracts passed; lint reported only the 19
  existing warnings and zero errors; the broad Boneyard/runtime group passed
  1,775/1,775; Hub UI passed 86/86; desktop passed 5/5; every other configured
  suite, test TypeScript, production TypeScript, backend/frontend build, game
  host build, generated-content checks, and media policy passed. Production
  `Game-BGyXk_h5.js` is 266,211 raw / 80,892 gzip bytes under the 524,288 /
  134,144 limits.
- Mac Chrome `151.0.7922.174` ran the production-bundle Sack/Dye Inventory
  journey with a level-1 wizard and level-3 Ringwall. In College, ItemInfo
  visibly retained `Requires Player Level 3`, same-object activation left the
  Ringwall in the backpack and all ring sinks unchanged, and exactly one
  bad-action cue played. In Boneyard, dragging that Ringwall into occupied ring
  I was rejected, preserved backpack item `40019` and equipped ring IDs
  `40018,40017`, and played exactly one bad-action cue. Page errors, console
  errors, and failed responses were all empty.
- Reviewed College and Boneyard frames hash respectively to
  `fea1f9ec19977c0f3c601711fbd51aba9c5e87ecd4ee81e176772efce230788f`
  and `7eee5e0d87a863406bc32600f16e9e5700b490cdb72e0cf1c6831e1dab1ac0b3`.
  These hashes record the result; task-owned screenshots and other transient
  receipts are disposable after publication.
- No member is browser-blocked and no material unknown remains. Push to `main`
  is authorized by the user; deployment was not requested and remains separate.
