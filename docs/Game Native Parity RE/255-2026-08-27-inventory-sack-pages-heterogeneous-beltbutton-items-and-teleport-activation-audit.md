# 2026-08-27 — Inventory Sack pages, heterogeneous BeltButton items, and Teleport activation audit

## 2026-10-08 — Report 99: equipment shortcut texture modulation and activation audit

### Reported smell and evidence

The three original messages `1557549570215383111`, `1557550152774848553`, and
`1557566134776111187` were reread with nearby discussion on October 8. None is
edited or withdrawn. The report compares the cycled gameplay belt with its
Inventory counterpart: Hat and Robe lose their authored shading, and individual
equipment reportedly fails while Rings work. The follow-up explicitly preserves
the existing Sack quick-set swap. The screenshots show flattened clothing fills
in the gameplay HUD and shaded art in Inventory; lighting-quality settings do
not own these UI pixels. The separate indicator-layering Report 100 is excluded.

At baseline `7020dcd8`, `NativeBeltItemIcon` passes clothing colors as
`NativeUiSprite.maskTint`. That API deliberately retains only atlas alpha, so it
cannot preserve the colored/grayscale texels in Inventory records. The Inventory
GPU owner `addItemIcon` instead multiplies each authored texture by its layer
tint. This is a confirmed source-and-image discrepancy, independent of bank.
The recovered stock textured-modulation contract in entry 287 and the existing
Inventory item catalog remain authoritative; no new native constants or art
are needed. The previous closure missed a DOM-versus-GPU member comparison.

### Boundary and membership

This reopening covers exact-UID equipment and Sack BeltButton presentation and
activation across the three approved web banks. It reuses the native ownership,
catalog, transforms, recursive lookup, admission, and action evidence below.

| Member | Recovered contract | Current disposition / validation requirement |
| --- | --- | --- |
| All Hat and Robe icon records, primary/trim layers, explicit dye colors, recipe colors, and all five element fallbacks | authored RGB multiplied per channel by tint; original alpha and transforms retained | `exact-ported` through the shared RGB mode; channel/alpha regressions and measured Hat/Robe pixels pass; catalog records and tint selection remain shared |
| Ring, Amulet, Staff, Wand, Sack, potion/alias icons and quantities | untinted authored texture/transform; existing ownership and counts | `verified-already-at-parity`; focused regressions and relevant equipment/Sack browser journeys pass; rendering route unchanged |
| White-alpha UI silhouettes and other `maskTint` consumers | alpha-mask recoloring is their explicit contract | `verified-already-at-parity`; focused native-UI regressions pass and the separate mask API is retained |
| All six equipment classes, fixed sinks and Ring 0/1/2, empty/occupied sinks, root/nested owner, all three banks | `0x00552CD0/0x00552850/0x00560060`: exact owner swap, same equipped UID no-op, level/slot admission | `verified-already-at-parity` in the authority and browser coverage below; the reported shortcut-equip failure was not reproduced and no authority behavior was changed |
| Sack direct-child quick-set action, nested/non-equipment preservation, repeat and save continuation | `0x0056D1B0 -> 0x0056B090`: family order, available ring sinks, displaced gear returns to the same Sack | `verified-already-at-parity`; focused Sack regressions and real Boneyard quick-set/repeat/save cases pass; action unchanged |
| Hub/Boneyard HUD and Inventory/Skills/College companions; mouse, keyboard, touch and controller slot addressing | shared actor belt, selected bank translated exactly once, actor-private mutation | focused addressing regressions pass; Hub/Boneyard HUD/Inventory pointer, keyboard and touch activation verified below; existing companion/controller paths unchanged; banks remain the Report 80 web extension |
| Stale/missing gear, equipment level rejection, closed/replaced scene and input release | current authority admission, no identity loss or accidental activation after release | existing focused rejection/lifecycle regressions pass; no authority or release behavior changed |
| Skill behavior, potion use, native exports, bot eight-action view | established shared belt members, not implicated by the equipment report | `out-of-system` for behavior changes; retain existing regression coverage |
| Report 100 dots layering and Report 80 requested cycle-direction preference | separately assigned UI concerns | `out-of-system`; no control/layering change in this fix |

### Implementation and acceptance contract

Add an explicit textured RGB-modulation mode to the shared DOM sprite, distinct
from white-alpha masking. Use the browser's exact sRGB color matrix with unit
alpha, rather than guessed CSS recoloring or replacement art. The clothing icon
consumer uses that mode for every layer and tint source; unaffected sprites keep
their current route. Browser acceptance must measure retained shading and tint,
and exercise actual gear shortcuts in gameplay and Inventory across banks,
including the preserved Sack action. The complete M5 repository gate and the
normal authorized deployment/live verification follow the exact candidate.
If the individual-equip allegation cannot be reproduced, record that limit
instead of changing native same-identity no-op or admission behavior.

### Acceptance checkpoint — 2026-10-08

Implementation `802299ae` passed the previously retained M5 baseline, focused,
application/test TypeScript and lint stages in
`job_20261008T040928Z_71fe34ac12`; those stages were reused, not rerun here.
The tint regression is red on the former alpha-mask consumer and green on the
textured consumer. The added equipment authority matrix has 144 combinations:
six classes, six bank-edge slots (`0/7/8/15/16/23`), top-level/nested ownership,
and Hub/Boneyard scenes, with occupied-sink return and repeated-UID no-op checks.
Existing focused economy/input tests cover the unchanged sibling paths.

The combined built runtime `11e0c6dc24bfd200d74fcf79435cfa32ca9e027b`
passed desktop and mobile-context Chrome `153.0.8010.12` in
`job_20261008T060958Z_9ab69a64e6`. Each mode performed 24 equipment activations
plus repeats across cycled banks 2 and 3, HUD and Inventory, Hub and Boneyard.
All six classes equipped. The Boneyard Sack shortcut swapped seven direct
children, preserved all 25 owned item identities through repetition, and kept
the Sack. The actual browser checkpoint restored all 24 belt entries and the
same 25 identities through the maintained save-document reader; this is a
save-content round trip, not a browser reload/resume claim.

Measured Hat and Robe screenshots retain authored shading: mean RGB channel
error against texture-times-tint is respectively `0.0321` and `0.0201` on the
0–255 scale, with 177 and 109 red-channel shades. This comparison uses actual
rendered icon clones normalized onto integer pixel origins, so CSS raster
snapping is not incorrectly compared with Canvas half-pixel interpolation.
The original half-pixel comparison failed at `19.24`; its image was retained,
then matched source texels confirmed the comparator alignment error. Normal
gameplay screenshots were reviewed without modifying their icon geometry.
Both source layers and expected-reference PNGs are retained with the receipts.

Mobile-context acceptance used `844 x 390`, `hasTouch: true`, `isMobile: true`
and DPR 1. It recorded `maxTouchPoints = 1`, `(pointer: coarse) = true`,
`(hover: none) = true`, and 50 actual hotbar `pointerdown` events, all with
`pointerType = touch`. Assignment drags remained ordinary mouse fixtures;
activation used real locator taps. This is Chrome touch emulation, not a
physical-phone assertion. Both modes have empty page, console, request,
failed-response, host and unexpected-transport error arrays.

**Retained qualification:** the original individual shortcut-equip complaint
was not reproduced by the authority or scoped browser cases. A separate
selection-dependent interaction did occur while constructing a fixture: after
binding a backpack Amulet, its retained selection causes a subsequent press
on an equipped Ring to enter the previously requested click-item-to-sink web
extension; dragging cancels that click rather than starting a Ring-source drag.
Entry 177 explicitly distinguishes that extension from stock's hit-object
selection. The existing native notes do not independently establish selection
retention immediately after a belt drop, so this result is not labeled native
parity or silently erased. The failed receipt and screenshot are retained.
Independent assignment cases use the normal empty-space deselection control;
actual bound shortcuts also succeeded in Inventory with a backpack item still
selected. No equipment authority or selection behavior was changed by this fix.

M5 receipts are under
`/Volumes/Drive/codex-acceptance/report99-ioar46jj-runs/` in
`report99-built-20261008T060959Z-desktop/receipt.json` and the matching `-touch`
directory. The selected-item attempt is retained in
`report99-built-20261008T053509Z-desktop/receipt.json`.
The shared compute lease and this journey's browser/host processes were released.
At this checkpoint the coordinator still owns the final combined canonical
gate, publication and live-result boundary; built acceptance is not a deployment
claim.

> **2026-09-24 report 22:** [entry 252's native page-motion reopening](252-2026-08-27-goodie-item-sack-materialization-and-inventoryscreen-root-navigation.md#2026-09-24--report-22-native-vertical-sack-page-transition)
> supersedes this entry's 160-tick horizontal/full-stage-width claims. Native
> Sack pages move vertically across the grid's height: 365 pixels and 37
> updates on the fixed 900-high stage. The belt, root contents, item activation
> and Teleport contracts are unchanged.

> **2026-09-28 report 51:** [entry 293's InventoryScreen BeltButton reopening](293-2026-08-28-reopened-inventorygrid-addressed-slots-and-beltbutton-readiness-presentation.md#2026-09-28--report-51-live-beltbuttons-inside-inventoryscreen)
> corrects this entry's scope: the eight-slot owner and gameplay HUD activation
> were recovered here, but the Website Inventory surface still omitted live
> short-press/key activation and cooldown presentation. The shared owner now
> covers those modal consumers without changing the item/skill catalog.

## Reported smell and parity question

- Player reports: Teleport appears not to trigger; toolbar entries cannot be
  moved; Sacks cannot be opened in the College; in a run, inventory objects can
  be rearranged but cannot be moved to the toolbar.
- The immediately preceding InventoryScreen closure corrects the old flattened
  projection and recovers the type-`0x1B60` child-root state machine. This
  neighboring-system audit accepts that newer closure as the canonical Sack
  page contract and extends it through current-root movement, equipment return,
  item-to-belt drag, and the active-run pause authority boundary. It does not
  introduce a second page model.
- The earlier quickbar closure is also reopened. It correctly recovered skill
  assignment and BeltButton pull-off, but treated the Website player skill book
  as the complete eight-slot owner. Retail `0x005C7090`, `0x005D50E0`,
  `0x005D3E10`, and `0x005D8120` instead own one heterogeneous belt containing
  skills, two recursive potion aliases, and exact-UID item entries. The visible
  Website potion buttons were hard-wired overlays and no item-drop mutation
  existed behind the painted modal belt.
- Teleport is audited as the category-2 sibling most likely to expose an input
  or BeltButton routing regression. Acceptance must distinguish the correct
  College/noncombat rejection from an active-Boneyard failure.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Re-hashed in the outer workspace before this pass. | high |
| Instructions — Sack navigation | canonical `SolomonDark` Ghidra project through replica wrapper; `InventoryScreen::PointerPress 0x0056F760`, activation `0x0056D920`, page builder `0x00560D30`, update `0x00551A10`, close/destructor `0x00555810/0x005684C0`, Sack accessor `0x00570C10` | Same-object activation on type `0x1B60` pushes the current root, installs `Item_Sack+0x88`, and swaps the two page owners. Game-back pops one root; both page lanes traverse the full 1,600-pixel stage width. | high |
| Instructions — Sack ownership | `Item_Sack` ctor/dtor `0x005A7520/0x00573E00`, root allocator `0x00570B90`, vtable `0x00796368`, icon `0x00577950`, help row `0x00571BF0` | Each Sack owns and destroys one separate `0x58`-byte item-list root; root `+0x04` stores the Sack UID and navigation writes the live owner pointer at root `+0x08`. | high |
| Instructions — heterogeneous belt | shared drop router `0x005C7090`, InventoryDragger release `0x0056EC30`, BeltButton ctor/refresh/present/pull-off `0x005CA3A0/0x005D50E0/0x005D3E10/0x005C7DF0`, action `0x005D8120`, item action `0x0056D1B0` | All eight buttons share one entry discriminator and destination router; eligible item drops are shortcuts and do not transfer ownership out of inventory. | high |
| Instructions — Sack belt action | complete decompile and raw instructions for `0x0056D1B0` and `0x0056B090`; call at `0x0056D3DB..0x0056D3FC` | The exact Sack pointer is passed on the stack. The action keeps the Sack, scans only its direct child root, equips the first eligible Hat, Robe, Staff, Wand, and Amulet in that order, then equips up to the available two/three Ring slots. Every displaced item is inserted back into the same Sack root; non-equipment and nested contents remain. One `backpack_open` cue follows the action. | high, instruction-derived |
| Instructions — ordinary equipment action | complete `0x00552CD0`, recursive owner lookup `0x00552850`, root-relative transfer `0x00560060`, eligibility `0x00577900`; raw `0x00552CDC..0x00552F5C` | The class chooses its fixed sink or an available Ring sink, swaps the live slot, then searches the inventory/Sack tree for the exact UID. Only that owning root removes the incoming item and receives displaced gear. An already-equipped UID has no inventory owner, so the same-slot case is a no-op. Accepted equipment swaps play `backpack_open`. | high, instruction-derived |
| Instructions — Teleport | category router `0x005D5600`; secondary dispatcher `0x0054CC50`, case `0x30` at `0x0054D625..0x0054D728`; burst `0x00644A00`; ranked refresh `0x00661530` | Category 2 validates actor/combat eligibility, then Teleport pays its shared cost/cooldown, emits source and destination effects, and unconditionally accepts the world callback's destination. | high |
| Asset/audio data | Inventory records `70/71`; UI/Inventory page records; audio registry rows 1 `pickskill`, 4 `backpack_close`, 5 `backpack_open`, 73 `poof`, Teleport `sounds\\teleport` | Sack entry/exit and belt accepted/pull-off paths have distinct fixed cues; Teleport requests its point cue twice. | high |
| Current web causal trace | Website `8826abcf`; `HubInventoryUi.tsx`, `hub-economy.ts`, `hub-inventory-renderer.ts`, `GameHud.tsx`, `SkillQuickbar.tsx`, `player-progression.ts`, `game-simulation.ts` | Inventory recursively flattens every Sack; Sack activation has no branch; modal belt hard-codes the first two potion families; authoritative state stores only skill IDs; item drop cannot address a belt slot. Teleport's kernel and relocation consumer are present. | high |
| Active-run pause-policy trace | Website `game-host.ts` at `8826abcf`; `client-hub-action`, `client-skill-quickbar-bind`, `pauseAllowsInventoryAction` | While Inventory owns the solo/shared run pause, the host admits ordinary inventory mutation but silently drops `bind-belt-item`; null belt clears are admitted only from a SkillBook pause. This is the authority cause of “in-game items move but cannot move to toolbar,” independent of drag geometry. | high |

Instruction evidence is static preferred-address evidence. No injected runtime
address or stale process is used. Raw task logs are transient and the reusable
facts are also recorded in the Mod Loader native reports.

## System A boundary and membership inventory — InventoryScreen nested-root pages

Native system: the participant-local InventoryScreen page owner from direct
root construction through Sack entry/back navigation, direct-child selection,
drag/drop, page transition, rebuild, close, and teardown. Inventory ownership
and mutation remain authoritative participant state; the current browse path is
screen-local presentation state.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone College InventoryScreen | opener `0x005C6F10`, ctor `0x00560380` | `exact-ported` | opens at the participant root and supports the full page stack |
| standalone active-Boneyard InventoryScreen | same Game opener and root | `exact-ported` | identical Sack/selection/drag lifecycle in the run |
| Fomentius, Hagatha, Luthacus, and Shlorio companion InventoryScreens | dispatcher `0x00514A20`; independent companion owner | `exact-ported` | each companion backpack retains the same Sack page stack beneath the service overlay |
| top-level inventory root | ctor argument stored at `InventoryScreen+0x158` | `exact-ported` | only direct root children occupy cells; descendants do not leak through closed Sacks |
| empty and nonempty Item_Sack | `0x0056D920`, `0x00570C10`, root `+0x14/+0x20` | `exact-ported` | second activation enters either child root; game-back remains available from an empty child |
| recursively nested Item_Sack at every accepted web inventory depth | same activation/root stack | `exact-ported` | each level pushes exactly one parent and can be unwound independently |
| game-back child return | game-back branch `0x0056D9A9..0x0056DAD1` | `exact-ported` | pops exactly one parent while a child root is active; only game-back at the participant root closes the screen |
| forward page transition | `0x0056DBD9..0x0056DCA7`, `0x00551A10` | `exact-ported` | old/new grids move in opposite directions by 10 stage pixels per 100 Hz tick across the 1,600-pixel stage width; input is suspended for all 160 ticks until swap |
| reverse page transition | `0x0056D9A9..0x0056DAD1`, same update | `exact-ported` | same fixed step in the opposite direction, then parent becomes current |
| Sack entry/back audio | registry offsets `+0xF4/+0xC8` | `exact-ported` | one `backpack_open` on accepted entry, one `backpack_close` on accepted back |
| selection, 20-tick ItemInfo, 50-tick second activation | `0x0056F760/0x0056FC90` | `exact-ported` | navigation destroys stale selection/info/activation state; new page begins neutral |
| direct-child drag into another Sack and child-to-parent return | `0x0056DE50`, current root plus stack | `exact-ported` | exact live object moves once, cycles/self-targets reject, and page rebuild retains current path |
| equipment sinks, storage transfer, unforge, dye, potion, books | existing shared action members | `verified-already-at-parity` after root-relative correction | the action targets a visible direct child; an equipment swap returns displaced gear to that child's exact root rather than leaking it to the top-level backpack |
| InventoryScreen close, service close, world transition, death/Game Over | `0x00555810/0x005684C0` and web modal teardown | `exact-ported` | current/inactive pages, parent stack, dragger, ItemInfo, and sounds cannot survive teardown |
| inventory descendants beyond the 88 visible cells | dynamic native list plus `0x00560D30` visible grid | `verified-already-at-parity` storage; hidden until reachable by a supported page | no flattened overflow is invented |

The browser can represent every member; none is `blocked-by-platform`.

## System B boundary and membership inventory — Game BeltButton state and activation

Native system: the eight Game-owned BeltButton objects, every entry producer,
refresh/persistence rule, painter, input source, action consumer, and pull-off
lifecycle. The Website's explicitly requested category-3 assignment remains a
documented extension inside the same one-entry-per-slot owner.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| eight empty/occupied slots, destination-only replacement, duplicate skill IDs | `Game+0x5EC`, stride `0xEC`, `0x005C7090` | `exact-ported` | one authoritative tuple; no parallel potion/skill overlays |
| entry `7000` empty | ctor `0x005CA3A0`, clear `0x005C79C0` | `exact-ported` | no action/icon; strict pull-off restores the complete empty record |
| entry `0x1B67` skill | `0x005C7090`, `0x005D5600` | `exact-ported` for stock categories 1/2; retained explicit web extension for category 3 | category 1 selects, category 2 invokes, category 3 selects concentration only |
| five pure primaries plus Welding row 52/builds | category 1 catalog | `verified-already-at-parity` through the unified belt | selection, active icon, duplicates, acquisition and persistence remain |
| all 23 category-2 rows including Teleport 48 | category 2 catalog | `verified-already-at-parity` plus fresh end-to-end Teleport receipt required | active-run press edge reaches the existing shared secondary kernel |
| all fourteen category-3 rows `57..63,65..71` | Website extension over native category router | `verified-already-at-parity` extension | manual assignment only; Mind Chug/Split Mind semantics unchanged |
| entry `0x1B65` recursive Health alias | `0x005C7090`, `0x005529A0`, `0x005D50E0/0x005D8120` | `exact-ported` | subtype-0 drop normalizes to an alias, resolves first recursive stack, displays total, and remains bound at zero |
| entry `0x1B66` recursive Mana alias | `0x005C7090`, `0x00552B70`, same consumers | `exact-ported` | subtype-1 sibling follows the same contract |
| exact potion subtypes 2..5 | ordinary type `0x1B59` plus UID | `exact-ported` | Wizard Chug, Antidote, Mind Chug, and Rejuvenation bind/use the exact stack and clear after disappearance |
| Ring/Amulet/Staff/Hat/Robe/Wand exact-UID entries | runtime types `0x1B5A..0x1B5E/0x1B63`, item vtable `+0x34`; `0x00552CD0/0x00552850/0x00560060` | `exact-ported` | activation swaps through the chosen sink, returns displaced gear to the incoming item's direct inventory/Sack root, plays `backpack_open`, and treats the already-equipped same-slot identity as a no-op |
| Item_Sack exact-UID entry | type `0x1B60`, item vtable `+0x34`, action `0x0056D1B0 -> 0x0056B090` | `exact-ported` | binding follows UID through nested inventory; activation keeps the Sack, equips eligible direct children in native family/slot order, returns displaced gear to that Sack, and plays `backpack_open` |
| Item_Perk and Item_Map exact-UID entries | `0x1B61/0x1B62`, item vtable `+0x34` | `out-of-system` until those stock classes are materialized as Website backpack objects | decoder reserves no invented activation for currently unreachable item kinds |
| Item_Misc dye/key/books | vtable `+0x34 -> 0x00461F60` constant false | `exact-ported` rejection | these classes never become belt bindings |
| browser-only mod item/mod potion classes | no retail class/vtable row | `out-of-system` (explicit web content extension, no inferred native belt contract) | no silent coercion into a stock item discriminator |
| SkillDragger release | `0x006564A0 -> 0x005C7090` | `verified-already-at-parity` through unified state | strict >3-pixel start, centered 40-square greatest-overlap drop, `pickskill`, teardown |
| InventoryDragger release | `0x0056EC30 -> 0x005C7090` | `exact-ported` | same live slot rectangles/overlap; active-run Inventory pause explicitly admits the host bind; accepted binding leaves item in its current owner and plays `pickskill` |
| BeltButton pull-off for every populated entry | `0x005C7DF0` | `exact-ported` | strict >50 units clears immediately; active-run Inventory pause admits the null clear but not skill assignment; `poof` and complete burst occur without release activation |
| new-character and Tutorial population | `0x005CFA80`, `0x005C85E0`, Tutorial activation `0x005D5FE0` | `exact-ported` | starting secondary in slot 0; Health/Mana aliases in slots 3/4 persist at zero when Tutorial removes starter stacks, then resolve the authored pickup; new category-1/2 rows fill first empty only |
| inventory/equipment/skill refresh | `0x005D50E0`, recursive UID search `0x005521C0` | `exact-ported` | missing exact items/unlearned skills clear; nested/equipped/active-drag items remain; aliases persist |
| keyboard, rebound mouse, touch, controller | shared addressed slot input | `exact-ported` | all input producers invoke the current heterogeneous entry, never a stale visual overlay |
| Hub/noncombat and active-Boneyard gates | `0x005D5600`, Game/player state | `exact-ported` | primary/concentration/item actions follow their own gates; category-2 combat is rejected outside active combat |
| host/guest, late join/reconnect, save/restore, world transfer, Game Over | Game raw-state ownership and web authority boundary | `exact-ported` | one participant-owned belt replicates/persists and resets with the character lifecycle |

No member is `blocked-by-platform`.

## Teleport causal model and nearby findings

- BeltButton does not special-case Teleport. A populated skill entry routes row
  48 through the same category-2 branch as the other 22 rows. The secondary
  kernel consumes only a new slot edge, actor eligibility, mana, the 150-tick
  common gate, and Teleport's ranked private cooldown.
- Dispatcher case `0x30` calls the source `0x00644A00` burst, asks the active
  world for a destination with parameter `100`, writes the returned position,
  then calls the destination burst. Both calls request `sounds\\teleport`; the
  world callback has no rejection result.
- Arena uses the already recovered farthest shuffled 100-unit lattice plus the
  collision-safe radius-40 spiral. Indoor Region worlds return `(0,0)`, but the
  normal Game/College combat gate prevents ordinary category-2 activation.
  Therefore a College button that is visibly disabled and produces no cast is
  parity; the same binding in an active Boneyard must relocate, pay mana, start
  cooldown, emit two bursts/two sounds, and replicate the new position.
- The current web Teleport kernel, destination resolver, relocation write, VFX,
  audio, cooldown, and replication are retained unless the baseline journey
  falsifies one. The belt cutover must prove every category-2 row still reaches
  that existing owner.

## Native ownership thread and recovered behavioral contract

- `InventoryScreen` owns two reusable `0x110` page lanes, current root
  `+0x158`, a parent-root stack at `+0x174` with count `+0x184`, current lane
  `+0x3A8`, transition active/start/direction at `+0x168/+0x16C/+0x170`, and
  selection/ItemInfo/InventoryDragger state. `Item_Sack` owns only its child
  root; confusing those owners caused the stale no-browse conclusion.
- `0x00560D30` builds only current-root direct children. On entry, the screen
  pushes the old root and writes the selected live Sack pointer to child root
  `+0x08`; the game-back branch pops exactly one root. The two lanes slide at a
  fixed 10 pixels per tick until the 1,600-pixel stage width has been traversed,
  for 160 fixed ticks / 1,600 ms.
- `Game`, not `Skills_Wizard` or `InventoryScreen`, owns the eight BeltButton
  records. Skill and inventory draggers are lateral producers into the same
  `0x005C7090` rectangle router. Health/Mana aliases resolve recursively on
  refresh/action; ordinary items retain type plus UID and remain inventory-
  owned shortcuts.
- Tutorial does not clear the potion aliases. `0x005D5FE0` removes the two
  starter potion objects and calls `0x005D50E0`; the alias refresh rule retains
  `0x1B65/0x1B66` at zero. The authored wave-5 Health pickup therefore becomes
  actionable through the same slot-3 alias at stage 18 without a parallel HUD
  button.
- The authoritative web owner must consequently be a separate participant belt
  component. Inventory tree and skill book remain sibling sources. A bind
  replaces one addressed belt entry; economy/skill changes refresh it; input
  resolves it; snapshot/save carry it. No client-only item overlay may shadow
  a skill binding.
- The Sack BeltButton action is not an unpack operation. `0x0056D3DB` passes
  the resolved live Sack to `0x0056B090`. That function repeatedly reads only
  the Sack-owned root, removes and equips the first eligible Hat, Robe, Staff,
  Wand, and Amulet, then assigns eligible Rings across the available slot list,
  preferring an empty remaining slot. Displaced equipment is reinserted into
  the same child root. The Sack object and every untouched child survive.
- Ordinary equipment action has the same root discipline. `0x00552CD0`
  selects/swaps the live equipment slot and returns the displaced pointer;
  `0x00552850` recursively resolves the incoming UID's exact inventory owner;
  `0x00560060` removes the incoming object there and inserts the displaced one
  back into that owner. A nested-Sack equip therefore cannot surface old gear
  at the top level. An already-equipped UID has no inventory-root owner and the
  same-slot branch performs no transfer.
- Browse path and page animation are client-local UI state. Inventory movement,
  equipment, item activation, belt binding, consumption, skills, Teleport, and
  relocation remain host-authoritative. Closing the modal discards the path;
  it never mutates Sack ownership merely by looking inside.
- The Boneyard Inventory pause is an authority boundary, not just a local input
  mask. Its allowlist must admit `bind-belt-item`, and the skill-bind handler
  must admit only `skillId=null` from an Inventory-owned pause. Non-null skills
  remain SkillBook-only. Omitting either branch makes correct browser geometry
  look nonfunctional because the host silently drops the message.

## Confidence and open questions

- Confirmed: all owners, vtables, root/stack/transition fields, direct-child
  builder, entry/back transitions, audio rows, belt entry discriminators,
  accepted/rejected item-class membership, producers, refresh, painters,
  actions, pull-off, and Teleport dispatcher sequence are instruction- or
  asset-derived.
- Inferred only at the web-product boundary: currently unreachable native
  Item_Map/Item_Perk backpack materializations remain reserved rather than
  synthesized. This does not omit a reachable Website member.
- Unknown: none requiring a browser approximation. Baseline and candidate
  browser journeys remain required to classify the player-observed Teleport
  report and fill the implementation receipt.

## Web implementation consequence

- Replace the progression-owned nullable skill-only quickbar with one separate
  eight-entry player belt component. Each entry is null, a skill row, a
  Health/Mana alias, or an exact native item type/UID. Preserve the documented
  category-3 Website extension without weakening the stock item/type rules.
- Seed the starting secondary and potion aliases, preserve category-1/2
  first-empty acquisition, make skill/item binds destination-only, normalize
  every economy/skill mutation, and carry the belt through protocol, late join,
  save schema, world transfer, Game Over, and Tutorial reset.
- Make the HUD and modal painter consume that same belt. Remove the independent
  potion overlays and client-side slot interception. Slot input resolves the
  authoritative entry; non-skill activation is an addressed belt action.
- Retain the preceding closure's `HubInventoryUi` local Sack path, game-back
  routing, and 160-tick horizontal transition. Render only current-root direct
  children rather than `projectInventoryItems` descendants; make selection,
  hit testing, item movement, dye/unforge/equip/storage, and drag-to-belt
  relative to that current root. Remove stale state on transition and teardown.
- Retain Teleport's recovered kernel. Add a regression from a real belt slot
  through active-Boneyard relocation and a College negative control instead of
  a Teleport-only fallback or scene exception.
- Bump strict game protocol to 89 and save schema to 18 for the new
  authoritative belt shape; migrate schema-17 skill bindings and seed aliases
  only into empty historical slots.

## Validation contract

- Focused model tests: exact eight-entry belt; every stock entry class and
  Misc/mod negative; Health/Mana alias normalization; exact-UID nested/equipped
  retention and missing-item clear; skill duplicates/replacement; fresh,
  Tutorial, acquisition, Game Over, import and migration states.
- Focused inventory tests: top-level direct children only; empty/nonempty/nested
  Sack entry; game-back at each depth; 10-pixel fixed-tick transition; selection /
  ItemInfo / drag teardown; current-root-to-Sack and child-to-parent movement;
  standalone plus every companion service.
- Focused action tests: all six potion subtypes, every equipment sink family,
  Sack item action, invalid Map/Perk/Misc/mod rows, accepted/rejected item drop,
  all-slot pull-off, and item retention across nested/equipped ownership.
- Protocol/save tests: protocol-89 strict belt decoding, authority ownership,
  host/guest snapshots, late join/reconnect, schema-18 round trip, schema-17
  migration, malformed/cross-owner UID rejection, and revision/checkpoint flow.
- Teleport and category siblings: all 23 category-2 rows remain addressable;
  row 48 from a belt press in an active Boneyard changes position and produces
  two bursts/two audio events, mana debit, common/private cooldown, replication,
  release/re-press behavior, and no page/console/host error. College preserves
  movement/item/primary/concentration handling while rejecting the cast.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the byte-identical clean
  Mac candidate, then Mac Chrome production journeys in College, each trader
  companion, and Boneyard. Capture before/inside/back Sack frames, every belt
  entry family, item drop/pull-off, Teleport active/negative controls, save
  restore, page/console/request/response/host errors, and task-owned shutdown.

## Implementation validation receipt

- Exact pre-receipt Website candidate
  `97c61453a2ca658f1d82da6ae35bf60b62ca3e0c` and its clean detached Mac
  worktree passed `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build
  and integration contracts, strict formatting/lint, every registered frontend
  and desktop group, production build, media/CSP policy, and bundle budget.
  `Game-CbUO5vZy.js` is 477,914 raw / 133,665 gzip bytes against limits
  524,288 / 134,144. Validation stdout SHA-256 is
  `032de9249e0d79628093b540f2e42d0259c00fc49f567d1c3891c70800a0a510`.
- Exact Mod Loader candidate `b03a26d648fbec08adbb7b12430b413016112a42`
  passed all 513/513 portable static RE contracts on Homebrew Python after the
  new `binary-layout.ini` provenance hash was reconciled. Stdout SHA-256 is
  `23ac2b28e7d6502bc4fd3fa6121d132a6ac105fc56c699618907e30777e4b0d1`.
- Mac Chrome 151 / WebGL2 completed the production Sack/Dye/belt journey in
  standalone College Inventory, Hagatha, Luthacus, Fomentius, Shlorio, and an
  active Boneyard. Filled/nested roots, game-back, root-relative movement,
  recursive Luthacus storage, exact-UID item bind/activation/pull-off, and the
  Inventory-pause authority path passed. Page, console, and failed-response
  arrays are empty; the exact audio census is 12 `backpack_close` and 18 shared
  `backpack_open` requests. Receipt SHA-256 is
  `5d5cb893e8e48df2b666e16b57eadb73376462f93a99508c2af68a365237d6c5`.
  Reviewed College item-belt, child-Sack, and Boneyard item-belt frame hashes
  are `bd83f30a...999932`, `04967dc4...db248`, and
  `c7786f84...cc19e`.
- The production Teleport positive control moved the authoritative actor from
  `(938.5399780273438,1761.4599609375)` to
  `(674.4675903320312,1475.3670654296875)`, emitted two bursts and two ordered
  `teleport` events, debited mana from 100 to 90.4 after observed regeneration,
  and committed the 6,000-tick private / 150-tick common cooldowns. Its receipt
  and reviewed flash-frame SHA-256 values are `ee5b2da2...dc24a` and
  `6474a9a2...00c34`; page, console, and response error arrays are empty.
- The matching College control retained position `(950.64,164.04)`, mana 100,
  actor/event counters, and audio while exposing the disabled Teleport label.
  Receipt and reviewed frame SHA-256 values are `fb4cfc3c...08b09` and
  `2f8c683a...438d`. The same production pass caught and closed the missing
  service-child game-back action and updated both long journeys to wait for the
  protocol-88 mutual-start readiness owner before attempting Boneyard input.
- Evidence is retained under Mac
  `/Users/jarrett/codex-evidence/inventory-belt-teleport-20260827-rebased/`.
  The receipt update changes documentation only. No production deployment was
  performed.


## October 8 — Report 80 rightward bank-cycle follow-up

The mixed `1557546406695149620` message additionally requests cycling right;
its editor-account observation is tracked separately as 98. Current control
source already maps the unmodified cycle key to +1 and Shift to -1, with
right/Next arrow +1 and left/Previous arrow -1. Bank 0/1/2 dots are rendered
left-to-right in both DOM gameplay and the shared modal canvas. This is
unchanged from the approved three-bank feature commit `af513e7f`, not a newly
recovered stock behavior: stock has only its existing eight-slot belt.

The existing three-bank foreground browser loop now explicitly waits for
0→1→2→0 progression after every normal cycle-key press, rather than merely
pressing three times. This strengthens the already-intended bank coverage and
will verify the rightward request on the final built/live client. No product
direction inversion is made without a reproduced contrary result. The mixed
message remains unchecked until both scopes pass their required acceptance.


## October 8 composed canonical acceptance

Runtime/test candidate `cde84b13acd8bd95dfccd153be65bc0a59d0511f` passed the
unchanged complete M5 `scripts/validate.sh` at 07:46:07 UTC: 45 Python tests
and 4,414 Node executions across 22 batches, with no failures, skips or
cancellations. Configured renderer coverage is 100%; mutation acceptance
records 603 killed, 198 compile errors, two nonterminating timeouts, no
survivors, and the existing documented equivalents. Quality failures are empty.

The initial acceptance runner put HOME on an external volume without Unix
ownership, causing two native launchd fixture bootstrap errors. Matching the
maintained worker's real HOME corrected that test setup; source/build/cache/tmp
remained external and temporary test registrations were removed. No volume
security setting, test omission, product change or lowered gate was used.
Later acceptance/investigation edits are documentation only. Normal publication,
managed deployment and scoped live checks remain separate pending steps.

Scope: Report 99 clothing shading and preserved equipment behavior; the original shortcut-equip allegation remains unreproduced.
