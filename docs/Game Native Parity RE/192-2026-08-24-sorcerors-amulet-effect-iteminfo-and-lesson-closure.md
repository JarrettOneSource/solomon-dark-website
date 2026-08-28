# 2026-08-24 — Sorceror's Amulet effect, ItemInfo, and lesson closure

## Reported smell and parity question

- The reported question asks whether the fixed Tutorial `Sorceror's Amulet`
  has the correct effects and description and whether the Tutorial carries the
  stock UI explaining how to interact with it.
- The immediately preceding transport closure admitted the fixed item through
  protocol and save paths, but it repeated the older Tutorial report's
  `opaque serialized child` assumption as a no-FX conclusion. Its browser
  receipt proved pickup/equip/retention, not the equipped stat delta or complete
  contextual copy. That was a process failure: an extractable authored child
  was left undispositioned and one browser screenshot was treated as the full
  item contract.
- Falsifiable questions are: whether the ten-byte child is an FX row; which
  kind, target, operator, and magnitude it contains; what stat consumes it;
  what exact description/effect text stock displays; whether the lesson has a
  special amulet-use instruction or only the shared inventory teaching flow;
  and whether the same omitted-description assumption affects named equipment.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Asset/data | retail `data/levels/tutorial.boneyard`, SHA-256 `97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed`, embedded ItemRecipe UID 3010 | Exact name, description, type 7003, selector 0, white colors, and child payload `02 00 00 00 00 02 00 00 20 41`. | high |
| Instructions | retail 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; `FX::Sync 0x00570A90` | Child order is kind byte, target dword, operator byte, magnitude float: kind 2, target 0, operator 2, magnitude 10.0. | high |
| Instructions | `FX_Apply 0x00576AA0`, kind-2/operator-2 branch | Target 0 selects Ether and multiplies progression class-damage lane `+0x100` by `1 + 10/100`, yielding `1.1`. | high |
| Instructions | `FX_Format 0x00575C20`; common item-content builder `0x0057C4B0` | Stock formats `Ether Damage +10.0%`; ItemInfo emits the optional authored description before level/effect rows. | high |
| Instructions/data | `Tutorial::Tick 0x005D6330`, `Tutorial::Render 0x005D08C0`, stages 8, 9, and 10 | Stage 8 is only the blinking world-item arrow; stage 9 says `ACCESS YOUR INVENTORY`; stage 10 teaches quick use, the equipment area, and backpack drag/double-click. No special `equip the amulet` literal or equip-required completion predicate exists. | high |
| Existing web trace | `nativeTutorialAmuletItem`, `hubItemTooltipLines`, `resolveEquippedNativeEffects`, protocol 70 | The item supplied no `nativeEffects`; recipe-null equipment ItemInfo stopped after the name, so neither description nor effect nor 1.1 Ether multiplier existed. | high |
| Membership sweep | `native-item-catalog.json`, all 47 `items.cfg` recipes | Eighteen named recipes have nonempty authored descriptions and 29 have exact empty descriptions. The same shared ItemInfo path currently omitted all 18 nonempty sibling rows. | high |
| Built-browser falsification | manifest-identical Mac production bundle after the first implementation; stage-8 save fixture through real supervisor/host | Stages 8, 9, and host-authored 10 were reached, but `.tutorial-modal-callouts[data-stage="10"]` never mounted. `MainMenuScene.sameRuntimeScene` intentionally retains one snapshot for a stable Boneyard run, so its parent-owned stage predicate never sees stage changes while `BoneyardScene` does. | high |

## System boundary and membership inventory

Native system: fixed Tutorial equipment construction through loot, contextual
inspection, inventory teaching, equip/stat refresh, replication, persistence,
unequip, and Tutorial teardown, plus the shared authored-equipment-description
members disproved by the same ItemInfo omission.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| item UID 3010 identity/art/colors | Tutorial Boneyard row; Amulet renderer `0x00578910` | verified-already-at-parity | exact type/name/selector/records/tints and recent container/protocol matrix |
| item UID 3010 description | embedded recipe string; `0x0057C4B0` | exact-ported | exact ItemInfo line assertion |
| item UID 3010 FX tuple | payload plus `0x00570A90` | exact-ported | exact `{kind:2,target:0,operator:2,magnitude:10}` assertion |
| Ether damage application | `0x00576AA0`, progression `+0x100[0]` | exact-ported | equipped modifier is float32 1.1; all seven other classes remain 1 |
| stock FX text | `0x00575C20` | exact-ported | `Ether Damage +10.0%` tooltip assertion |
| no set/generated identity | clone `0x004699B0`; recipe UID 3010 is outside `items.cfg` set registry | exact-ported | null web recipe index and generated level; authored effect remains live |
| script-10050 one-shot drop and first eligible Item Skeleton link | Boneyard triggers 10049/10050/10051 | verified-already-at-parity | retained host Tutorial tests |
| stage-8 ground pointer | `0x005D08C0`; UI record 28; first `0x7DD` lookup | verified-already-at-parity | retained blinking world-target overlay and browser journey |
| stage-9 inventory-open instruction and pointer | `0x005D08C0` | verified-already-at-parity | exact heading/subheading and dynamic binding tests |
| stage-10 resume, quick-use, equipment, and backpack callouts/arrows | `0x005D08C0` and modal anchors | exact-ported in this closure | local Tutorial owner mounts from the live stage; exact literal membership and browser journey |
| stage-10 completion | `0x005D6330` inventory-close byte | verified-already-at-parity | closing after viewing advances; equipping is not required |
| `SAY_CARELESSFOOL` / `SAY_UNREDEEMABLE` narration around the lesson | Tutorial narration queue | verified-already-at-parity | exact source WAV/cue queue tests |
| backpack, storage, equipped amulet, recursive Sack, welcome/delta/save | shared item ownership | exact-ported with corrected FX identity | protocol/save round-trip and strict near-match matrix |
| equip, refresh, unequip, replacement, death/run teardown | inventory/effect/session owners | exact-ported | sink/effect/lifecycle nonregression coverage |
| 18 nonempty named-recipe descriptions | `items.cfg` rows 29..46 | exact-ported | complete catalog and per-row tooltip assertions |
| 29 exact-empty named-recipe descriptions | `items.cfg` rows 0..28 | exact-ported | catalog asserts empty and tooltips invent no prose |
| all 73 item FX and 13 set FX rows | `items.cfg` and existing native effect catalog | verified-already-at-parity | retained complete effect/catalog/tooltip tests |
| random generated equipment | `0x004645B0/0x0057A000` | out-of-system for descriptions; verified effect nonregression | native has generated name/effects but no authored description source |
| starter Hat/Robe/Staff | first-player construction | out-of-system for descriptions | recipe-less and description-less; correctly stop after name |

There are no browser-platform-blocked members. Strings, the finite FX tuple,
the fixed-tick lesson state, and the multiplier are exactly representable.

## Native ownership thread and recovered behavioral contract

- Script 10050 owns construction from the embedded ItemRecipe; its live FX
  list is cloned with the item. The ground Sack owns world lifetime, pickup
  transfers the unchanged item, and the amulet sink plus progression refresh
  own effect application.
- The exact effect is Ether-class spell damage `+10%`, not global damage, flat
  damage, a generated effect, a set bonus, or an inert serialized field.
  Operator 2 multiplies the Ether lane by float32 `1.1`; downstream Ether spell
  damage consumes the ordinary class multiplier.
- Inventory ItemInfo owns the presentation. It emits the exact case-preserving
  name, then optional authored description, then the formatted live effect.
  For this item the three visible text rows are `Sorceror's Amulet`,
  `A dull trinket, carved with a few beneficial runes`, and
  `Ether Damage +10.0%`.
- The Tutorial does not explain the stat numerically outside ItemInfo and does
  not require equipping before progression. Stage 8 points at the drop; stage 9
  points at inventory; stage 10 says `Put equippable items\nhere to wear them.`
  and explains backpack drag/double-click. Closing the viewed inventory starts
  the next wave. Adding a special amulet modal or equip gate would diverge.
- Protocol 70 and save schema 7 already carry `nativeEffects`; the correction
  changes the admitted exact authored tuple without adding a wire field or
  compatibility branch. Description is immutable source content resolved by
  fixed authored identity or named recipe, as in the native recipe registry.
- `BoneyardScene` owns the live Tutorial state and modal inventory surface.
  Stage-10/13 callouts must be mounted from that owner. `MainMenuScene` retains
  only scene-identity snapshots by design, so it cannot own a changing Tutorial
  stage predicate without either dropping callouts or forcing parent rerenders
  on every gameplay snapshot.

## Nearby-system findings

- The prior ItemInfo closure claimed all 47 recipe rows exact but tested only
  names, effects, sets, and prices. Eighteen source recipes have nonempty
  descriptions that the web catalog generator discarded. The same shared
  content fix must restore all 18 now; correcting only the Tutorial row would
  preserve the falsified omission on siblings.
- The ten-byte child layout is a reusable decoder fact and is now recorded in
  `Mod Loader/docs/re/tutorial-mechanics.md` and
  `docs/reverse-engineering/native-items-equipment-and-loot.md`.
- The first built-browser pass disproved the earlier `verified-already-at-parity`
  stage-10 row. The literals and component existed, but their parent owner held
  a deliberately stable scene snapshot. Presence/source tests alone did not
  prove reachability.

## Web implementation consequence

- Put the exact authored FX tuple beside `nativeTutorialAmuletItem` and require
  it in strict protocol classification. Do not classify it as random gear.
- Let the existing shared equipped-effect resolver apply the tuple; add no
  Tutorial-only damage branch.
- Preserve descriptions in the generated native equipment catalog and let the
  shared ItemInfo builder resolve the fixed Tutorial description or the named
  recipe description before effects.
- Retain the stock lesson sequence and exact generic callouts. Do not invent a
  special amulet tutorial screen or require an equip action to advance.
- Move modal Tutorial callout mounting into `BoneyardScene`, beside the live
  Tutorial overlay and inventory surface, and remove the stale parent predicate
  from `MainMenuScene`.

## Validation contract

- Assert the exact fixed identity/effect tuple, protocol/save/container round
  trips, and independent rejection of missing or mutated kind, target,
  operator, magnitude, and extra rows.
- Equip the fixed amulet through the ordinary sink and assert Ether multiplier
  float32 `1.1`, every other class multiplier `1`, and restoration after
  unequip/no-item resolution.
- Assert the exact three-line fixed ItemInfo; assert all 47 named descriptions
  against the source catalog, including all 18 nonempty and 29 empty rows.
- Retain every stage-8/9/10 literal, pointer, transition, and narration test.
- Assert callout ownership in `BoneyardScene`, absence from `MainMenuScene`, and
  browser reachability after host-authored 9 -> 10.
- On the manifest-identical Mac candidate, run
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, then use built-production Mac
  Chrome to traverse the natural Tutorial drop, world arrow, inventory prompt,
  ItemInfo reveal, ordinary amulet equip, modal callouts, close/next-wave, save,
  and resume. Capture stage/item/modifier state plus empty page, console,
  failed-response, wire, and host-error arrays.

## Implementation validation receipt

- The first manifest-identical Mac production journey reached live Tutorial
  stages 8, 9, and 10, then failed waiting for the stage-10 modal callouts. That
  receipt falsified the parent-owned implementation before final acceptance;
  the ownership correction and final rerun follow below.
- `nativeTutorialAmuletItem` now carries the immutable authored
  `{kind:2,target:0,operator:2,magnitude:10}` row. Protocol classification
  admits only that exact fixed identity and rejects missing, empty, mutated, or
  extra effects. The ordinary equipped-effect resolver produces float32 Ether
  class multiplier `1.100000023841858` and leaves the other seven class lanes at
  one; no Tutorial damage special case exists.
- The native equipment catalog generator now retains all 47 description rows.
  Shared ItemInfo asserts the exact 18 nonempty and 29 empty named-recipe
  members. The fixed Tutorial ItemInfo visibly renders, in order,
  `Sorceror's Amulet`, `A dull trinket, carved with a few beneficial runes`,
  and `Ether Damage +10.0%`.
- `BoneyardScene` now mounts stage-10/13 modal callouts from its live Tutorial
  state. The stale `MainMenuScene` predicate was removed; a source ownership
  regression prevents moving the callouts back onto the frozen scene snapshot.
- The manifest-identical Mod Loader tree passed all `499/499` CI-safe static RE
  contracts on the Mac. The corrected Website tree passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build and 22
  contracts, formatting/lint/import boundaries, every frontend group including
  Boneyard, Tutorial, protocol/save, native equipment, and Hub UI, five desktop
  tests, production frontend and game-host builds, media policy, and bundle
  budget (`458736` raw / `128874` gzip bytes against `524288` / `131072`).
- Built-production Chrome `151.0.7922.170` resumed a generated schema-7 stage-8
  Tutorial through IndexedDB and the real compiled supervisor/host. It showed
  the live ground pointer; picked up the authored amulet; showed the exact
  stage-9 `ACCESS YOUR INVENTORY` instruction; mounted stage-10 resume,
  quick-use, equipment, and backpack callouts; revealed the three-line
  ItemInfo; double-click equipped the ordinary amulet sink; checkpointed save
  revision 6 with the exact FX row and class multipliers
  `[1.100000023841858,1,1,1,1,1,1,1]`; closed inventory; and reached stage 11.
  Page, console, failed-response, and WebSocket-error arrays were all empty.
  Fixture SHA-256 was
  `7181a68d8b1582863fd4d5af7de28f0899d1f1a33dac4241ae2df6337d322698`.
- Retained Mac screenshot SHA-256 values are stage-8 pointer
  `3e7b37a1c4952e5b236157d6602c46580733d6a2b26d694f53d399feb2e4b559`,
  stage-9 prompt
  `2840a4e01937fda8bcd62cd92d195e3a39bba9290e5b1e7642e97a1dc244fc57`,
  stage-10 ItemInfo
  `59e580a40b0f64a99f782e67d51a3dae82297aeb3a5c9bbcf28157af83ddb7e2`,
  and stage-10 equipped
  `295b3067d2d08b05544ba233fcdee1eb20ac11e212fd8cb5324d8aca34790057`.
  No push, deployment, or production-state change was authorized or performed.
