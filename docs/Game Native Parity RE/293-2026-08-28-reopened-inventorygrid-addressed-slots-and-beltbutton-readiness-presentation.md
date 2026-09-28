# 2026-08-28 — Reopened InventoryGrid addressed slots and BeltButton readiness presentation

## 2026-09-27 — Report 50: equipment drops into an addressed Sack cell

### Report and causal evidence before implementation

The archived six-second `ring_bug.mp4` (SHA-256
`cd75884140ce40932b3249fd73ce19c374633fb6f6fb8859187179d1127ca56b`)
shows a ring dragged from each equipment sink toward an ordinary backpack
cell. The faded Sack icon in visible cell zero identifies a nested Sack page,
not the top-level backpack. Both equipment cells become empty; the intended
cells remain empty. The clip does not expose the authoritative destination
IDs, so the precise resulting top-level slots come from the Website source,
not a visual guess about the recording.

The current Website `HubInventoryActions.tsx` computes an addressed cell and
active `sackPath` for backpack sources, but its equipment-source branch accepts
any point in the broad backpack rectangle and emits only `{type:'unequip',slot}`.
`game-simulation.ts` calls `unequipInventorySlot`, which inserts into
`source.backpack` at its first free top-level slot. The selected child root and
cell never cross the authority boundary. The previous inventory drag journey
checked only that the equipped Ring returned to *some* backpack cell; it even
dropped at visible cell 25 without asserting that cell or the active root.

Fresh read-only retail 0.72.5 Ghidra replica evidence (preferred base
`0x00400000`, executable SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`)
closes the missing native handoff. InventoryScreen `0x0056FC90`, raw
`0x0057032C..0x0057037A`, reads the equipped holder, calls
`0x0056DD80` to create `InventoryDragger` and detach the source, then clears
that source holder with `0x00575850(..., null)`. On release, `0x0056DE50`
receives the pointed holder; raw `0x0056E643..0x0056E669` passes the held item
to that **specific** holder's `0x00575850` and inserts it through the screen's
current root at `+0x158`. Ordinary holders write item and tick directly;
kind-7 cell zero instead returns to the parent root. The page builder
`0x00560BB0` produces those addressed ordinary and parent holders, while the
shared insertion owner `0x0055FF20` fills the first hole for automatic
placement and displaced occupants; the pointed cell still receives the held
item. Thus the Website's root-only auto-insert is
not the native drag-release contract. Existing entry 177's "one unequip"
assertion covered the source transition but omitted the destination member;
entry 293's addressed-grid audit did not cross from an equipment source.

The retail executable was re-hashed this pass. The canonical Ghidra 12.0.3
source project was read only through the Mod Loader replica wrapper at tool
revision `08bfba9ef367f7b863848030d0a289dc31e33192` (wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`).
The task-local decompile and instruction logs are respectively SHA-256
`59d14db8e9ae902382beb34d05cfc909f1dfbc015cc4c01a10bf941bf631010a`
and `fb07b0be9eda84b91e13d24dfa9a6a01d9d27bfc73feb2541172c9755b45a8cb`.
The latter establishes the exact `ECX` target-holder receiver and held-item
argument at `0x0056E643..0x0056E650`, followed by current-root insertion at
`0x0056E65A..0x0056E669`.

### System boundary and final membership inventory

Native system: an equipment item's InventoryDragger transfer into the current
InventoryScreen root, from source-holder detachment through pointed-holder
commit, inventory refresh, action feedback, replication/save, and teardown.
The target is the complete reachable equipment-source and grid-target family,
not only the two Rings shown in the video.

| Member or branch | Native source | Final disposition and proof |
| --- | --- | --- |
| Ring 0/1/2, Amulet, Staff/Wand equipment sources | `0x0056FC90 -> 0x0056DD80` | `exact-ported`: one addressed action path; all removable classes and the third Ring have kernel assertions, and real Ring sources pass Hub/Boneyard pointer journeys. |
| Hat and Robe source refusal | `0x0056FC90`, authored MsgBoxes | `verified-already-at-parity`: required clothing still rejects without mutation; kernel and the broad Hub browser prelude cover both notices. |
| Blank addressed cell in top-level and nested Sack roots | `0x0056DE50 -> 0x00575850`; current root `+0x158` | `exact-ported`: the host receives the chosen owned root and slot; two-level Sack target at root slot 12 survives save/restore and appears in both Hub and Boneyard. |
| Kind-7 parent holder on a nested page | `0x00575850` kind 7 | `exact-ported`: visible cell zero inserts into the immediate parent root; built Hub journey confirms depth one and its first free slot. |
| Occupied ordinary cell and Sack destination | `0x0056DE50` occupied branch; `0x0055FF20` first-hole insertion; `0x00550A70` Flyby | `exact-ported`: occupied cell receives the dragged Ring, its prior resident takes the first visible hole, and the existing two-lane Flyby waits for host feedback. A Sack cell inserts into that Sack's first free child slot. |
| Matching stack | `0x0056DE50` Potion/content branch | `out-of-system` for equipped sources: every removable equipment class is one non-stackable object; existing backpack stack handling is unchanged. |
| Click/double activation without a pointed grid cell | `0x0056D920 -> 0x0056D1B0` | `verified-already-at-parity` as a distinct auto-placement path; the existing first-hole action and direct activation remain unchanged and have a regression assertion. |
| Invalid/off-grid target, full root, stale Sack path, locked ring sink | InventoryScreen release and shared admission | `exact-ported`: invalid targets and full visible pages leave the equipped object unchanged, and addressed nested slots cannot hide a displaced item beyond the visible 87 cells. Off-grid restoration and the third-ring gate retain their existing tests. |
| College and Boneyard InventoryScreens | shared screen/economy owner | `exact-ported`: the same real pointer-to-host action passed built journeys in both scenes. |
| Fomentius, Hagatha, Luthacus and Shlorio companion InventoryScreens | shared InventoryActions stage | `verified-already-at-parity` for mounting and drag ownership: the new action is the common path; a focused Fomentius journey passed and previous all-four receipts remain in this ledger. The broader fresh all-service journey has a separate limit below. |
| Remote clients and save/resume | protocol 139 and participant economy save owner | `exact-ported`: strict paired-action codec, host reducer, simulation integration and save/restore tests retain one Ring at its nested identity/slot. |
| Report 03 release ghost, Report 22 navigation pacing, Report 32 live belt | separate presentation/interaction owners | `out-of-system`; shared menu proximity is not a causal link. |

Implementation must reuse the existing cell hit test, active Sack path and
slot-addressed inventory insertion. The authoritative action, strict protocol
codec, reducer and tests will carry the chosen root/slot together; local drag
art remains presentation-only. The red check is equipment Ring -> blank cell
inside a two-level Sack, with exact item ID and slot, source vacancy, no
top-level duplicate, and the same result after save/restore. Built WSL browser
acceptance will exercise the real pointer gesture and host feedback, plus the
other removable sinks, protected clothing, parent/occupied/invalid targets,
and empty page/console/response errors.

The WSL red test now exercises Ring 0 -> visible cell 13 (root slot 12) in a
two-level Sack. On the published base, 59 economy tests passed and that new
test failed: the returned Ring occupied top-level slot zero at depth zero
instead of inner Sack slot 12 at depth two. That red test preceded product edits.

### Website correction and focused acceptance

The shared `unequip` action now optionally carries a paired destination Sack
ID and root slot. Legacy activation without a pointed cell keeps the existing
first-hole path. The strict protocol-139 decoder rejects partial, invalid and
out-of-range destination pairs; the host passes a valid pair to the same
economy reducer in every scene. The reducer resolves the owned root, places
into an addressed blank cell, or uses the existing first-hole plus root-swap
mechanism for an occupied ordinary cell. Dropping on a Sack targets its child
root; kind-7 cell zero targets the immediate parent. Invalid/full targets
reject atomically. Hat/Robe and the third-ring gate retain their existing
admission rules. The pointer owner reuses the established cell geometry and
Sack path, while the existing Flyby owner handles an occupied two-item move.
No new item catalog, persistent field or renderer asset was introduced.

The WSL red test changed from 59/60 to 60/60; the focused economy, simulation
and strict-protocol matrix passes 212/212, including two-level Sack placement
after save/restore, all removable gear classes, and full-grid rejection. Test
TypeScript, frontend lint and production build pass.
The final built WSL browser journey produced twelve receipts across Hub and Boneyard:
blank selected child cell, occupied child cell and displaced first-hole item,
Sack target, parent holder, and later scene continuity all have the correct
authoritative item ID/root/slot. Every sampled old-source pixel difference
through host feedback was zero; page, console and failed-response arrays were
empty. The complete browser log has SHA-256
`d175cb1b6b9d410941a2ad60fe37c03d938c50603fdfd3cefc62a71ebf43bafe`;
reviewed Hub/Boneyard screenshots have SHA-256
`3df78f9cacb5a06cf9aa67dd8b256af711a8c60e0126bbe1fed5ce89556d443f`
and `19165c685e7e58fc8b1e21e7e37a888e3b6a6af5cc0224f23607a6127dfc59c1`.
The remote test wrapper blocked while printing that long receipt, then was
stopped after the finished browser process and log were independently checked;
the log parser exited zero and verified all twelve receipts.

The broader inventory smoke passed 28 Hub receipts but timed out in an older
Fomentius delayed-snapshot blank-drop completion wait after a second shop
action. Its page/console/response arrays were empty; a focused fresh Fomentius
journey passed all three service receipts. The isolated timeout is not proof
that this addressed equipment drop caused a shared feedback defect, and the
broader full-service journey is not claimed as passing. It is retained in the
archive's final supplemental review for a separate bounded diagnosis. The
canonical WSL gate completed all configured stages: 3,949 Node tests and 24
Python tests ran with zero reported test failures, and the final renderer
quality report recorded `"failures": []`. The SSH wrapper lost the remote
shell's numeric exit code after the run completed, so a separate exit-zero
log audit checked every stage marker, all test summaries and the final quality
report. The complete validation log has SHA-256
`5a403101c236a088432216d31d191a69796089f3d3c734187f7aab8d0961f6f6`.
Task screenshots and raw logs are disposable scratch; their outcomes and
hashes are recorded here.

## 2026-09-22 — Report 03: released-item ownership across host feedback

### Report, evidence, and reopened boundary

The six-second `menu_bug_items.mp4` attached to Discord message
`1551640808787284108` shows dragged items briefly returning to their previous
inventory cells on release, including equipment drops. The original archive
is preserved at `2026-09-21/03-dropped-items-flash-in-old-menu`; attachment
SHA-256 is `3ab9a1f8643524dae4c24716a61abafcd9a9d560c7cfc424ff2196f09c663a4a`.
This reopens the earlier claim that release presentation was complete: the
prior pass covered the native Flyby clock but omitted the asynchronous handoff
between immediate release actions and authoritative snapshots.

Fresh static recovery used the canonical `SolomonDark` Ghidra project through
the read-only replica wrapper, without occupying a native GUI session. Retail
0.72.5 was re-hashed: 4,723,200 bytes,
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, image base
`0x00400000`. Read-only Mod Loader tool revision was
`08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`,
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.

| Evidence | Recovered contract | Confidence |
| --- | --- | --- |
| `0x00575850` holder commit | Ordinary holders write the item at `+4` and current tick at `+8` synchronously; kind 7 inserts into the parent root instead. | high, decompiled instructions |
| `0x0056DE50`, calls at `0x0056E650/0x0056E66A`, then `0x0056E8FD` | Blank placement commits the destination and root before the common inventory refresh. Potion merge, Sack/parent insertion, equipment attach and StoreGrid callbacks are synchronous branches of this same release owner. | high, static control flow |
| `0x0056FC90`, `0x00570371..0x00570444` | Equipment removal detaches/inserts and clears the source holder before retiring presentation; Hat/Robe retain their existing refusal dialogs. | high, static control flow |
| `0x0056F5A0`, `0x0056F6B3..0x0056F71E` | Occupied-grid Flyby calls the release router before clearing screen `+0x3C4` and destroying itself; its existing 20-tick motion and independent fades remain native. | high, static control flow |
| Website `ed0a2d598`, InventoryActions and HubStorageActions | Immediate releases clear `dragging` while dispatching an asynchronous action. Every old root/sink painter then sees the old economy with no held item until feedback arrives. | high, source trace and failing Mac pixel regression |

System boundary: InventoryScreen/StoreGrid drag presentation ownership from
pointer capture through immediate or Flyby release, authoritative completion
or rejection, page/surface interruption, and teardown. Every item uses the same
identity-based handoff; no item table, authored slot, transform, sound, or
quantity rule changes. The complete existing item/slot catalogs and extraction
above remain authoritative.

| Member | Final disposition and proof |
| --- | --- |
| Blank addressed cell, matching stack, Sack insertion, parent return | `exact-ported`: Mac pixel checks cover blank placement, merge, Sack insertion, two nested roots and both parent-return paths; native immediate action/audio retained. |
| Hat, Robe, Staff/Wand, Ring 0/1/2, Amulet equipment sinks and removable equipment sources | `exact-ported`: all six equipment types, all three rings, occupied replacement, level rejection and protected clothing passed Mac browser checks; focused contracts retain aliases and locked-ring admission. |
| Luthacus StoreGrid to backpack and backpack to storage | `exact-ported`: deposit/withdraw old-source pixels remain suppressed through feedback; authoritative items cross roots once. |
| Empty-Sack unforge | `exact-ported`: immediate mutation has the same held-item handoff; browser verifies removal and the native result notice. |
| Belt binding and unforge confirmation | `out-of-system`: neither moves the item on initial release; their existing source restoration remains correct. |
| Ordinary occupied swap and invalid return Flybys | `verified-already-at-parity`: existing 20-tick owner suppresses lanes through feedback; preserve its independent tails. |
| Rejected action, pointer cancellation, page/screen replacement, close, death/session teardown | `exact-ported`: rejected level admission restores source pixels, pointer cancellation emits no action, nested root changes discard page-local presentation, and close during withheld feedback followed by reopen leaves no drag. Death/session teardown uses that same unmounted owner. |
| College, Boneyard, Fomentius, Hagatha, Luthacus, Shlorio | `exact-ported`: blank/equip/unequip pixel checks pass in all six scenes; shared HubInventorySurface owns completion. |

Implementation consequence: keep one local released drag at its release point
until an authoritative action result is available, resolving it in the same
render as the new economy. Lock further inventory gestures during that handoff.
Reuse the existing drag renderer/source suppression and feedback sequence;
do not predict inventory mutations, add arbitrary timers, or invent Flybys for
native immediate branches. Network latency is a browser multiplayer constraint:
the held icon can remain at the release point while awaiting authority, but
must never flash at the old slot. Rejection restores it only with host feedback.

Validation contract: Mac Chrome with the production build, real pointer input,
controlled server-to-browser snapshot suspension, old-slot pixel comparison
before/after release, authoritative destination/rejection checks, sibling/page
and scene coverage, zero page/console/failed-response errors, and the exact
candidate's full `/opt/homebrew/bin/bash ./scripts/validate.sh` under the campaign publication lock.

### Implementation and focused Mac receipt

`InventoryActionHandler` carries the released drag only for immediate actions.
`HubInventorySurface` retains it until newer matching action feedback, derives
its disappearance alongside the new economy before rendering, and clears the
owner on root change/unmount. Inventory and StoreGrid actions are locked during
this interval. The existing renderer hides all source aliases and draws the
single held icon; no item catalog, protocol, save, or native animation changed.

The baseline production build `ed0a2d598` failed the Mac Chrome old-slot pixel
regression: 1,302 channels differed by more than eight levels, maximum 221;
reviewed crops show an empty cell while dragging and the ring returning after
release. The fixed production build completed **45 browser receipts** across
College, Boneyard and all four services, with **zero** old-slot channel changes
on every delayed-feedback release, correct authoritative outcomes, and empty
page-error, console-error and failed-response arrays. The test waits for the
new owner's first two presentation frames before checking native reveal; a
retained canvas's previous settled flag is not readiness of its next owner.
The eight-level raster tolerance covers only minor reveal/rounding variation;
it does not mask the 221-level original item flash.

A sibling Fomentius purchase while drop snapshots are withheld also passes: the
host broadcasts immediately after each `client-hub-action`, ordered feedback
completes the drop before the later purchase, and no held item or input lock
remains after both snapshots arrive. This falsifies the suspected feedback
replacement problem without adding a speculative protocol or input queue.

Mac focused checks passed **92/92** inventory presentation, renderer contract,
and economy tests, plus frontend lint and the production build (Node 22.17.0).
The maintained browser journey is
`frontend/tools/smoke-inventory-drop-handoff.mjs`; it uses private ephemeral
host/static-server ports, a fresh Chrome context and save database, controlled
WebSocket delivery, native pointer gestures and visible pixels. The final
publication receipt records the rebased commit and the full canonical gate
plus this repeated journey on that exact tree. No native GUI session or Mod
Loader file was changed. Disposable captures are removed after publication;
the user's original report/video remain preserved.

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

## 2026-08-28 — InventoryFlyby, parent-holder, and release-feedback correction

### Reported smell and parity question

- Reported web behavior: inventory placement is authoritative but snaps to its
  result. Stock visibly flies displaced items, leaves fading item copies, and
  paints a prior-Sack holder in the upper-left cell. The web cell-zero parent
  route is pointer-only and invisible to keyboard focus.
- Stock behavior to recover: the complete `InventoryFlyby` lifetime, its
  independently fading children, every release branch that does or does not
  create one, the kind-7 parent holder painter/input contract, and exact
  branch-owned feedback sounds.
- Reproduction: ordinary blank placement, occupied swap, matching Potion
  merge, invalid release, Sack insertion, and child-to-parent release in the
  standalone College, active Boneyard, and every companion InventoryScreen.
- Falsifiers: every successful move flying; blank placement making sound;
  afterimages being part of the dragger; the parent holder being the
  bottom-centre Game backpack control; or equipment/StoreGrid targets sharing
  the ordinary-grid Flyby constructor.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | direct 2026-08-28 stock/web comparison and supplied stock save | Stock release motion/fading copies and the upper-left prior-bag member are visible; current web snaps and omits the cell control | authoritative symptom |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed image as this entry's prior addressed-grid evidence | high |
| Instructions | `InventoryFlyby` ctor/update/render `0x00550A70/0x0056F5A0/0x00557C30`; `Anim_FadeItem` base/update/render `0x00452E20/0x00454000/0x00457020`; release router `0x0056DE50`, constructor xrefs `0x0056E2A7/0x0056E5BE/0x0056E863` | Flyby advances `delta/20` for 20 100-Hz ticks, spawns a FadeItem on alternating ticks, commits/restores at tick 20, then independently registered fades finish | high |
| Instructions/data | page builder `0x00560D30`, grid painter `0x0055A070`, holder commit `0x00575850`; floats `0x007DE920=20`, `0x007845E8=.1`, `0x007DE978=.25` | A nested root inserts a kind-7 holder at cell zero and paints the active Sack icon at quarter alpha; dropping there returns the item one root | high |
| Audio registry/instructions | release calls in `0x0056DE50`; registry offsets `0x18` click, `0xF4` backpack-open, `0x120` bad-action; pitches `0x00785590=1.75`, `0x00784D58=1.25` | Occupied ordinary target/merge starts click at 1.75; Sack/parent insertion starts backpack-open at 1.25; invalid restore starts bad-action; blank placement has no release cue | high |
| Current web | Website `0c510ce3`; `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, `hub-inventory-render-contract.ts` | Host mutations are correct, but pointer-up clears the dragger and dispatches immediately; no Flyby/FadeItem model exists. Cell zero is reserved but neither painted nor represented by a semantic action. All ordinary moves inherit a generic click at pitch one. | high |

### System boundary and membership inventory

Native system: ordinary InventoryGrid release presentation and feedback, from
pointer release through holder routing, optional Flyby/FadeItem ownership,
mutation, final pixels/audio, interruption, and teardown.

| Member | Native source | Disposition required | Proof |
| --- | --- | --- | --- |
| blank ordinary holder | kind 0, `0x00575850` | `verified-already-at-parity`; remove false release click | addressed placement remains immediate and silent |
| occupied non-Sack ordinary holder | `0x0056DE50`, xrefs `0x0056E2A7/0x0056E5BE` | `exact-ported` | two items fly between source/destination and swap only at tick 20 |
| matching Potion/native-mod stack | merge branch after click | `exact-ported` feedback; mutation already exact | 1.75-pitch click, immediate merge, no Flyby |
| invalid/off-target release | fallback xref `0x0056E863` | `exact-ported` | item flies from release point back to source; bad-action once |
| main Flyby item | ctor/update/render | `exact-ported` | unclipped item follows 20 discrete linear steps |
| ten alternating FadeItem children per lane | `0x0056F5A0`, `Anim_FadeItem` | `exact-ported` | births at ticks 1,3..19; alpha loses .1/tick and final child survives parent completion |
| Item_Sack destination | container branch | `verified-already-at-parity`; feedback corrected | immediate insert, backpack-open 1.25, no Flyby |
| kind-7 parent holder art/drop | `0x00560D30/0x0055A070/0x00575850` | `exact-ported` | cell-zero active-Sack icon alpha .25; pointer and semantic keyboard activation share return action |
| standalone College and active Boneyard | shared InventoryScreen | `exact-ported` | same renderer/state machine in both hosts |
| Fomentius, Hagatha, Luthacus, Shlorio companions | shared player grid plus separate service owner | `exact-ported` for player grid | service overlay cannot replace Flyby/parent holder |
| equipment sinks and Luthacus StoreGrid | separate target callbacks/actions | `out-of-system` for ordinary-grid Flyby; retained existing exact action/audio contracts | no invented Flyby membership |
| page transition, close, death/world/session teardown | InventoryScreen/Flyby destructors | `exact-ported` | pending uncommitted Flyby cancels; registered fades may finish only while screen owner remains |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- InventoryScreen owns the dragger, one active Flyby, current/parent roots,
  grid pages, and interaction lock. Flyby owns the pending ordinary mutation;
  FadeItems are independent screen children.
- At each 10-ms tick the main item adds `(destination-source)/20`. After the
  decrement, odd remaining counts create one FadeItem at the current position.
  Each child begins at alpha one and loses `.1` per tick. The main owner calls
  the release router at tick 20, clears the active Flyby reference, and dies.
- Blank, stack, Sack, and parent branches remain immediate. Only occupied
  ordinary swaps and invalid restoration use this Flyby family.
- Authoritative item state remains host-owned. The browser may delay sending
  the private inventory mutation until the recovered presentation completion;
  it must never commit a visual-only slot result or replicate presentation
  children.
- Screen/root replacement and teardown cancel an uncommitted mutation and
  delete its task-local children. No protocol/save version changes.

### Web implementation consequence and validation contract

- Add one local InventoryFlyby presentation owner with exact 100-Hz frame
  math, dual occupied-swap lanes, invalid return, independently fading child
  copies, and an action dispatch edge at tick 20.
- Paint the path's active Sack in reserved cell zero at alpha `.25`; overlay a
  semantic parent-drop target so keyboard activation performs the same action
  as pointer release when an item is selected.
- Remove generic move feedback and route exact release cues from the branch
  plan. Do not add Flyby state to protocol/save or external target families.
- Focused tests: all branch dispositions, ticks `0/1/19/20/29`, two-lane
  swap, fade birth/alpha, current-Sack identity, quarter-alpha painter, and
  keyboard/pointer action equality.
- Mac browser: Hub, nested Sack, companion, and active-Boneyard journeys must
  inspect intermediate motion/afterimage frames, exact cue/rate counts,
  authoritative result only after tick 20, cancellation on close, and empty
  page/console/response/host errors.

### Implementation validation receipt

- InventoryScreen now owns one active 20-tick local Flyby plus independent
  fading tails. Occupied swaps use two source-to-destination lanes and dispatch
  the authoritative move only at tick 20; invalid release uses one return lane.
  Ten children are born at ticks `1,3..19`, lose `.1` alpha per tick, and the
  final child retires at tick 29. A later move may begin while earlier children
  finish, while root/screen teardown cancels its task-local presentation.
- Blank placement remains immediate and silent; matching stacks remain
  immediate after click pitch `1.75`; Sack/parent insertion remains immediate
  after backpack-open pitch `1.25`; invalid return plays bad-action once.
  Generic pitch-one move feedback was removed. The active Sack is painted in
  visible cell zero at alpha `.25`, and its semantic control accepts keyboard
  activation through the same parent-return action as pointer release. The
  already recovered record-75 animated Unforge target remains unchanged and
  continues its native pulse and transaction behavior.
- The production Chrome journey proved a two-lane swap with both authoritative
  items still in their original cells mid-flight, visible main items and
  afterimages, commit at tick 20, a one-lane invalid restore, click `1.75`,
  bad-action pitch one, parent icon alpha `.25`, keyboard return, and
  backpack-open `1.25`. It then completed nested Sack, all four companion,
  storage, dye, and active-Boneyard paths. The corrected branch membership
  raises the exact journey census from 18 to 26 backpack-open starts while
  leaving 12 closes unchanged. Page, console, and failed-response arrays were
  empty.
- Browser log SHA-256 is
  `ce97294f2da01742ab6e552abbef2a43d705134a1b1bcc4a15716a19e6faaecb`.
  Swap, invalid-return, and parent-holder capture hashes are respectively
  `44053b9824f6c01a47ac0e641685c94d52731c10cf88024bb84c7167be028825`,
  `4844bf1379b8b68274c3693a2af5a37ab7352636a296291744312e4d0b145dda`,
  and
  `4863066df84518475903ac2a21996a78bd8c5d4ff693cf196c9c718933616f93`.
- The publication pass reruns the complete canonical gate after this receipt
  and the browser-harness regressions are recorded.
