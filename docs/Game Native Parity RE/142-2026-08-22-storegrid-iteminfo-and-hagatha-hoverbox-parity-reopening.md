# 2026-08-22 — StoreGrid, ItemInfo, and Hagatha HoverBox parity reopening

## Reported smell and parity question

- Reported web behavior: Hagatha's Charms and Curses does not expose the
  contextual item/perk information expected when the pointer hovers or the
  user focuses/selects an inspectable cell.
- Stock behavior to recover: the complete contextual-inspection family shared
  by Shop `StoreGrid`, InventoryScreen `ItemInfo`, and Hagatha's owned-perk
  pane, including exact copy, price/suffix branches, geometry, delay, input
  modality, painter order, and teardown.
- Reproduction: Website `origin/main` `cfda6be4980059808d107746b7928e71be70d81a`
  at 1600 by 900. The ordinary two-client trader smoke reached Fomentius and
  produced pre-fix selected capture SHA-256
  `6dbe36a252be2a0258dc9123dd052814518d50ed75838385bab5402a566d47f9`;
  source inspection and the DOM receipt show no Shop hover model, no owned-perk
  semantic targets, and no Shop-owned HoverBox renderer. The long baseline run
  later became replication-bound and timed out waiting for a purchase keyframe;
  that timeout is not tooltip evidence and is not used as the causal claim.
- Falsifiers: a native `StoreGrid` hover that does not allocate `HoverBox`, a
  selected Shop cell that retains the ordinary hover detail, an owned empty
  Hagatha cell that produces copy, or any native delay/audio request on these
  hover branches would falsify the model below.

This is a secondary report against the 2026-08-16/20 presentation closure.
That pass followed `InventoryScreen::PointerPress` far enough to restore
companion selection and delayed `ItemInfo`, but stopped before the
`StoreGrid` hover vslot and before the owned-perk loop later in
`0x0056FC90`. It also labelled `0x00565E00` “detail” without following the
actual detail producer at `0x0055E2C0`. The skipped shared-function and
alternate-branch membership sweep is the process failure reopened here.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, re-hashed 2026-08-22 as `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | byte-identical Beta 0.72.5 target; preferred base `0x00400000` | high |
| Existing retail witnesses | Mod Loader `trader-hagatha-shop.png` `981d7645…514f9`, `trader-hagatha-selected.png` `844136d5…bb89`, and 18-row manifest | fixed 1600 by 900 Shop/InventoryScreen layout and selected-cell special state | high |
| Instructions | StoreGrid ctor/vtable `0x0055C740`/`0x00794B8C`, hover vslot `+0xCC -> 0x0055E2C0`; HoverBox ctor/render/vtable `0x005C38F0`/`0x005C3A60`/`0x0079AE14`; layout `0x005AADE0`/`0x005AB060` | ordinary hovered StoreItems immediately build one contextual HoverBox, destroy the prior box first, clamp to the client, and remain silent | high |
| Instructions | InventoryScreen pointer owner `0x0056FC90`; ItemInfo ctor `0x00553B80`; item content `0x0057C4B0`; perk content `0x00573E90`; PerkShop suffix `0x00554690` | selected inventory items wait 20 ticks; Hagatha's occupied 3 by 3 cells use immediate hover; Shop prices and perk suffixes are separate appended lines | high |
| Static data | Mod Loader `native-hagatha-perk-catalog.json`, `native-item-catalog.json`, `native-hub-trader-catalog.json`; executable strings and all item/perk vtable rows | complete names, descriptions, 47 equipment recipes, seven sets, 86 FX rows, six potion descriptions, misc/sack copy, and every selector branch | high |
| Current web | `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, `hub-inventory-render-contract.ts`, and existing Hub UI tests at `cfda6be4` | only companion/standalone click selection produces ItemInfo; Shop cells have click-only targets; owned perk cells have no input targets; equipment ItemInfo collapses recipe content to name only | high |

All native addresses are preferred-image addresses for the verified retail
file. No PID, runtime ASLR address, injected observation, or stale deployment
claim is used by this entry.

## System boundary and membership inventory

Native system: contextual inspection from an inspectable grid/cell becoming
current through HoverBox/ItemInfo construction, exact content building,
layout/render, and destruction. Purchase mutation, item use, equipment-effect
application, and perk combat behavior are consumers outside this presentation
boundary.

| Member | Native source | Target disposition | Proof contract |
| --- | --- | --- | --- |
| Fomentius ordinary StoreGrid hover | `0x00794B8C + 0xCC -> 0x0055E2C0` | exact-ported | hover/focus shows item name, help, and price; selection suppresses the ordinary tooltip |
| Hagatha offer StoreGrid hover | same shared slot; `Item_Perk +0x2C -> 0x00573E90`; `0x00554690` | exact-ported | every offer, first-mix, remixed, and bundle branch |
| Luthacus storage StoreGrid hover | same shared slot; `InventoryShop` ctor `0x004F59A0` clears price byte `+0x289` | exact-ported | arbitrary stored item detail with no price line |
| Shlorio result StoreGrid hover | same shared slot; DowsingShop result grid | exact-ported | all 47 recipe offers with price; pre-roll has no StoreItem target |
| Selected Shop special cell | `0x0055E2C0` StoreItem kind `1`; executable diagnostic `Hover over special item!` | exact-ported | selected BUY/transfer cell does not retain ordinary hover detail |
| Standalone and companion InventoryGrid ItemInfo | `0x0056FC90`, `0x00553B80`, `0x0057C4B0` | exact-ported | 20-tick delay, second activation, drag suppression, class content, clamp, teardown |
| Hagatha occupied 3 by 3 owned-perk hover | `0x0056FC90` loop, InventoryScreen `+0x5CC`, `0x00573E90` | exact-ported | immediate occupied-cell hover/focus; empty cells and bundle art are silent |
| Pointer leave, focus move, purchase rebuild, drag, notice, close, range/region/fade exit | `0x0055E2C0`, `0x0056FC90`, HoverBox destructor `0x005C39B0`, service teardown | exact-ported | no stale tooltip or gameplay input leak |
| Mouse hover | native pointer hit state | exact-ported | immediate and silent |
| Keyboard/controller focus | native SwipeList/current-cell path | exact-ported | focus inspection shares the same content owner |
| Touch selection inspection | browser semantic adapter over the same fixed-stage cell | exact-ported | focus/select makes the same tooltip available without inventing different copy |
| Base Item/placeholder 7000 and StoreItem special kind 1 | factory/vtable sweep | out-of-system (no ordinary descriptive HoverBox branch) | no fabricated copy |
| Item_Map 7010 | registered constructor, no retail art/help producer | out-of-system (no inventory/shop producer) | no fabricated copy |
| Item_Misc book subtypes 2/3 | `0x00570ED0`, absent current web inventory producer | out-of-system (separate reward/progression producer) | exact strings retained in native report/catalog, no synthetic web item |
| Mod potion tooltip | browser-only extension | out-of-system (not a retail member) | continues using manifest-owned name/description through shared box geometry |

Fomentius's complete authored class membership is six Potion rows (subtypes
0, 1, 2, 3, 4, and 5), Item_Misc subtypes 0 and 1, and Item_Sack. All nine are
`exact-ported`; per-row assertions pin their exact title/help and Shop price.

### Hagatha authored rows

Each row covers both the Shop-offer content path and the occupied owned-perk
path unless its disposition says otherwise.

| Selector | Name | Disposition | Required branch |
| ---: | --- | --- | --- |
| -1 | BARGAIN BUNDLE | exact-ported | offer only; intro, every bundle member name, price, 50-percent suffix |
| 0 | LIFE CHARM | exact-ported | exact native description |
| 1 | MANA CHARM | exact-ported | exact native description |
| 2 | SPEED CHARM | exact-ported | exact native description |
| 3 | ITEM CHARM | exact-ported | exact native description |
| 4 | GOLD CHARM | exact-ported | two native description lines |
| 5 | SEEKER'S CHARM | exact-ported | exact native description |
| 6 | REVELATION CHARM | exact-ported | exact native description |
| 7 | CHEAT DEATH CHARM | exact-ported | base line plus disabled, remaining-count, and used-up presentation inputs |
| 8 | PERKY CHARM | owned tooltip exact-ported; Shop offer out-of-system because retail builder excludes selector 8 | exact dormant description retained |
| 9 | SCATTER CURSE | exact-ported | exact native description |
| 10 | WAR CHARM | exact-ported | exact native description |
| 11 | CURING CHARM | exact-ported | exact native description |
| 12 | THE LAST WORD CHARM | exact-ported | exact long native description/wrap |
| 13 | SPELLWELDER'S CHARM | exact-ported | exact native misspelling `compenent` retained |
| 14 | WEIRD CASTER CHARM | exact-ported | exact native description |
| 15 | DRINKER'S CHARM | exact-ported | exact native description |
| 16 | GLASS CANNON CURSE | exact-ported | exact two-sentence description |
| 17 | SORCEROR'S CHARM | exact-ported | exact native description |
| 18 | FOCUS CHARM | exact-ported | exact native description |
| 19 | DISFIGURING CURSE | exact-ported | exact native description |
| 20 | BARE HANDS CHARM | exact-ported | exact native description |
| 21 | SPLIT MIND CHARM | exact-ported | exact native description |
| 22 | CURSE BOSSES | exact-ported | exact native description |
| 23 | ARCANE ATTRACTOR CHARM | exact-ported | exact native description |
| 24 | SERENDIPITY CHARM | exact-ported | exact native description |
| 25 | REVERIE CHARM | exact-ported | exact native description |
| 26 | BRUTE'S CHARM | exact-ported | two native description lines |
| 27 | TONIC | exact-ported | exact native description |

### Equipment recipe rows

The common item builder consumes every recipe/set/FX row, so Shlorio and
Luthacus inspection must not stop at one sample item.

| Recipe | Name | Disposition | Proof |
| ---: | --- | --- | --- |
| 0 | Pentaclostic Ring | exact-ported | recipe tooltip assertion |
| 1 | Arcanoric Robe | exact-ported | recipe tooltip assertion |
| 2 | Cosmofluxic Wand | exact-ported | recipe tooltip assertion |
| 3 | Theptoplasmar Amulet | exact-ported | recipe tooltip assertion |
| 4 | Synertauxic Ring | exact-ported | recipe tooltip assertion |
| 5 | Sublunarous Hat | exact-ported | recipe tooltip assertion |
| 6 | Combinator's Cap | exact-ported | recipe tooltip assertion |
| 7 | Combinator's Cape | exact-ported | recipe tooltip assertion |
| 8 | Combinator's Club | exact-ported | recipe tooltip assertion |
| 9 | Combinator's Choker | exact-ported | recipe tooltip assertion |
| 10 | Combinator's Circle | exact-ported | recipe tooltip assertion |
| 11 | Bug-Master's Cap | exact-ported | recipe tooltip assertion |
| 12 | Bug-Master's Robe | exact-ported | recipe tooltip assertion |
| 13 | Bug-Master's Wand | exact-ported | recipe tooltip assertion |
| 14 | Bug-Master's Loop | exact-ported | recipe tooltip assertion |
| 15 | Pan-Dimensional Strangler | exact-ported | recipe tooltip assertion |
| 16 | Cloudcover Hood | exact-ported | recipe tooltip assertion |
| 17 | Ozone Cape | exact-ported | recipe tooltip assertion |
| 18 | Lightning Rod | exact-ported | recipe tooltip assertion |
| 19 | Storm Choker | exact-ported | recipe tooltip assertion |
| 20 | Burning Hat | exact-ported | recipe tooltip assertion |
| 21 | Burning Robe | exact-ported | recipe tooltip assertion |
| 22 | Biting Ring | exact-ported | recipe tooltip assertion |
| 23 | Bitter Ring | exact-ported | recipe tooltip assertion |
| 24 | Glittering Amulet | exact-ported | recipe tooltip assertion |
| 25 | Potter's Apron | exact-ported | recipe tooltip assertion |
| 26 | Clayshaper's Ring | exact-ported | recipe tooltip assertion |
| 27 | Claybaker's Ring | exact-ported | recipe tooltip assertion |
| 28 | Kiln | exact-ported | recipe tooltip assertion |
| 29 | Obfuscate's Meddler | exact-ported | recipe tooltip assertion |
| 30 | Karen You Scandalous Wench | exact-ported | recipe tooltip assertion |
| 31 | Poxproof | exact-ported | recipe tooltip assertion |
| 32 | Ethereal Choker | exact-ported | recipe tooltip assertion |
| 33 | Absolox's Boomstick | exact-ported | recipe tooltip assertion |
| 34 | Staff of Dawn | exact-ported | recipe tooltip assertion |
| 35 | Ringwall | exact-ported | recipe tooltip assertion |
| 36 | Fleetfinger | exact-ported | recipe tooltip assertion |
| 37 | Gritchenscorn | exact-ported | recipe tooltip assertion |
| 38 | Mindblowing Ring | exact-ported | recipe tooltip assertion |
| 39 | Smartest Ring | exact-ported | recipe tooltip assertion |
| 40 | Yzmar's Handicap | exact-ported | recipe tooltip assertion |
| 41 | Qubar's Ether | exact-ported | recipe tooltip assertion |
| 42 | Qubar's Fire | exact-ported | recipe tooltip assertion |
| 43 | Qubar's Air | exact-ported | recipe tooltip assertion |
| 44 | Qubar's Water | exact-ported | recipe tooltip assertion |
| 45 | Qubar's Earth | exact-ported | recipe tooltip assertion |
| 46 | Robe of Thaumic Unperturbability | exact-ported | recipe tooltip assertion |

All seven set records and all 86 item/set FX rows inherit `exact-ported` through
the shared recipe content builder and receive catalog-wide assertions rather
than a single visual sample.

## Native ownership thread and recovered behavioral contract

- `Shop` embeds `StoreGrid` at `+0x9C`; `0x0055E800` installs vtable
  `0x00794B8C`. Its `+0xCC` slot is `0x0055E2C0`, the actual Shop hover owner.
  It destroys `StoreGrid+0x110` first, inspects the current ordinary StoreItem,
  allocates a 0xBC-byte HoverBox, asks the live item vtable `+0x2C` to append
  content, optionally appends Shop price, dispatches Shop vtable `+0xC0` for a
  subclass suffix, lays out the box, and attaches it above the service.
- InventoryShop constructor `0x004F59A0` clears owner byte `+0x289`, so
  Luthacus omits price. Ordinary Shop, PerkShop, and DowsingShop keep it set.
  PerkShop `+0xC0` is `0x00554690`: selector `-1` adds
  `    Bulk discount: 50%`; an unmixed ordinary selector adds
  `    High price due to first mixing.`
- StoreItem kind zero is descriptive. Kind one is the selected/special cell;
  `0x0055E2C0` emits only the diagnostic literal `Hover over special item!`
  and builds no HoverBox. Selection and hover are therefore separate states.
- InventoryScreen's selected-object ItemInfo waits 20 native ticks. StoreGrid
  and owned-perk HoverBoxes have no delay and request no sound. Starting a drag
  suppresses ItemInfo; changing current cell, leaving the target, rebuilding a
  shop, or closing the surface destroys the contextual object.
- The Hagatha owned pane loop in `0x0056FC90` scans only the progression-owned
  count in row-major three-by-three order, using occupied 60-square cells. It
  stores the current index at InventoryScreen `+0x5CC`; empty capacity cells
  and the decorative bundle below the grid do not create HoverBox content.
- HoverBox `0x005C3A60` draws after its owner: opaque black contextual fill,
  native edge pass, then each case-preserving ExactText line. Content wraps at
  300 pixels. Layout helpers use a 25-pixel content/client margin; StoreGrid
  uses a 35-pixel source gap and a 70-square source exclusion, while owned
  perks use 25 and 60. The box flips across its source and clamps to the fixed
  1600 by 900 client when the preferred side would overflow.
- Common item content `0x0057C4B0` is not “name only” for recipe gear. It emits
  display name with native rarity/set tint, optional description, effective
  level requirement, every live FX line through `0x00575C20`, and for recipe
  set members the set name, all member names, and complete-set FX. Recipe-less
  starter equipment genuinely has only its name.
- Perk content `0x00573E90` emits exact selector copy. Selector 7 additionally
  has disabled, `Cheats remaining: %d`, and `Used up!` inputs. Bundle `-1`
  enumerates the global last-wizard selector list. These are authored branches,
  not prose to paraphrase.

There is no browser-platform approximation inside the recovered visible
system. Keyboard focus and touch focus/select are browser input adapters to the
same native content owner; they do not change copy, timing, geometry, purchase
authority, or audio.

## Nearby-system findings

- The old ledger name “detail `0x00565E00`” conflated Shop chrome/selected
  presentation with content production. `0x0055E2C0` plus item vtable `+0x2C`
  owns hover content; this correction is also recorded in Mod Loader.
- `0x0057C4B0` proves the existing web equipment ItemInfo is incomplete even
  outside traders: all 47 recipes, seven sets, and 86 FX declarations share the
  same builder. The false “equipment means name only” assumption is removed for
  every recipe-backed and generated item in this pass.
- Runtime perk effects remain outside this presentation boundary. The tooltip
  reads their state but does not own damage, drops, movement, progression, or
  death transitions.

## Web implementation consequence

- Add one typed inspection model owned by `NativeHubSurface`, with distinct
  hover and focus lifetimes and no authority/mutation fields.
- Expose semantic hit targets for every Shop/InventoryShop/Dowsing result item
  and every occupied Hagatha perk cell. Preserve Shop selection separately and
  suppress the ordinary tooltip for its selected special cell.
- Replace paraphrased perk help with all exact `0x00573E90` lines. Reuse the
  existing complete equipment-effects catalog to build every recipe/generated
  item line and set block; do not duplicate or truncate the table.
- Generalize the Pixi ItemInfo compositor into the shared native HoverBox
  geometry, retain delayed InventoryGrid selection, and add immediate
  StoreGrid/owned-perk construction above the service overlay.
- Add one semantic `role=tooltip` mirror for accessibility while keeping all
  visible pixels inside WebGL.

## Validation contract

- Pure tests pin all 29 perk outcomes, selector-7 dynamic branches, nine
  Fomentius rows, 47 recipe rows, seven sets, 86 FX rows/operator formats,
  price/no-price/suffix branches, and the complete tooltip geometry constants.
- Static/component contracts require StoreGrid hover/focus/leave wiring,
  occupied Hagatha targets, selected-cell suppression, one visible WebGL
  HoverBox owner, semantic tooltip text, and teardown on purchase/close.
- Browser acceptance at 1600 by 900 must hover an unselected Fomentius item,
  every Hagatha offer class including first-mix and bundle, an owned charm,
  a Luthacus storage item, and a Shlorio result; focus must reproduce the same
  content; selection must retain BUY/transfer behavior; purchase/rebuild and
  pointer exit must remove stale copy; page/console errors must stay empty.
- Run `./scripts/validate.sh`, then repeat the trader journey on the exact Mac
  mini tree before any completion claim.

## Implementation validation receipt

- `HubInventoryUi` now owns distinct service hover/focus inspection state,
  transparent StoreGrid and occupied-perk hit targets, a semantic tooltip
  mirror, and touch-specific press-edge double activation that preserves the
  mouse release-edge and 10-pixel drag paths. Selected Shop special cells still
  suppress ordinary hover content.
- `hub-inventory-render-contract.ts` drains all 28 exact perk description rows,
  bundle/member copy, Cheat Death inputs, price/first-mix/bulk branches, all 39
  FX formatter kinds, every operator format, 47 recipes, seven sets, and 86
  item/set FX rows. `native-equipment-effects.ts` exposes the already
  authoritative catalog rather than duplicating effects.
- `hub-inventory-renderer.ts` uses one fixed-stage contextual box compositor
  for immediate StoreGrid/owned-perk HoverBox and delayed InventoryGrid
  ItemInfo. Inventory ItemInfo now retains recipe requirements, FX, set member,
  and complete-set content instead of collapsing every equipment item to its
  name. Canvas state exposes the actual post-20-tick visibility boundary.
- Automated membership coverage is `21/21` Hub UI tests. It individually
  checks all perk rows, all recipe rows, the complete set/FX counts, geometry,
  price suppression/suffixes, touch press ownership, and visible WebGL-only
  ownership. The final canonical `./scripts/validate.sh` passed the unchanged
  `15/15` backend/contracts, `4/4` library, `43/43` loot, `227/227`
  prerequisites, `1288/1288` game, `8/8` world weather, `29/29` party,
  `11/11` level-up, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI, and
  `5/5` desktop suites plus
  production TypeScript/build, media policy, and bundle budget. The final Game
  entry is 393,784 raw / 110,558 gzip bytes.
- Desktop Chrome at 1600 by 900 opened standalone Inventory inside a live
  Boneyard, selected Mana Potion, observed visible ItemInfo after 200 ms, then
  consumed the potion on the next two-stage activation. It returned
  `matchInventoryPotionConsumed:true` with empty page/console errors. The
  visible capture is
  `/tmp/solomon-dark-iteminfo-desktop-match-inventory-item-info.png`, SHA-256
  `12b123e30ab84731a200adb7dfd4fe1dca6b7508df289e50096c22ffe758d774`.
- Touch Chrome at 844 by 390 repeated the live-Boneyard sequence with one real
  first touch and a controlled same-task two-touch activation pair inside the
  native 500-ms window. It returned `mobile:true`,
  `matchInventoryPotionConsumed:true`, and empty page/console errors. The
  visible capture is
  `/tmp/solomon-dark-iteminfo-mobile-match-inventory-item-info.png`, SHA-256
  `52262f01d98f9a1ae708098fa75e4d46b912d7b99c46d14a2a4875b28f22838e`.
  Headless Playwright's separate real taps were measured 660 ms apart, so the
  test does not weaken the 500-ms game contract to accommodate harness lag.
- The full single-client trader journey completed every interaction/transaction
  tail with `status:"ok"` and `browserErrors:[]`: Fomentius help/price,
  Luthacus help with no price, Hagatha first-mix offer and newly owned charm,
  and Shlorio recipe/set/FX/price. Captures and SHA-256 values are Fomentius
  `07303738799ae5f61dc41820bb14f4e9b20f401b8b78dc6b8a01dc1caffcd224`,
  Luthacus `49225008c09a8f560d76a9ceb2a40e84b80160db238c1660990c2c2372a6a970`,
  Hagatha offer `b817418039481f911445ae6cbe3ddb84d2f3b99222f48f2ed0630d3f5afdabc0`,
  Hagatha owned `8e2107fedf244b2a8b1357815f9938b9bb9a352bbce5b45302ee9ed6d36c7518`,
  and Shlorio `28a8758075e8b3d3255e611fb9fa7c2ca6b3ec104be2c5360da3e7c9b9ecbcad`.
- There are no `blocked-by-platform` members or remaining presentation
  unknowns in this boundary. Runtime perk-effect state machines remain the
  separately dispositioned downstream systems; this pass neither guesses nor
  changes them.
- Publication is authorized after validation but remains pending at this
  receipt point. No deployment or production restart is implied.
