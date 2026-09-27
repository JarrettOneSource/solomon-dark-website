# 2026-08-24 — DowsingShop fixed-tick UI, native hit targets, and dual flash

## Reported smell and parity question

- Reported web behavior: Shlorio's Dowsing NPC UI is buggy, does not perfectly
  match stock, and its end-to-end operation is uncertain.
- This reopens the Dowsing rows in the 2026-08-15 inventory/trader entry. That
  pass recovered settled art and the economic transaction, but stopped the
  flash trace at the roll writer, used natural sprite bounds as action bounds,
  and introduced a cubic browser animation not present in the owner.
- Reproduction: Shlorio Chat intro/questions/price return; service pre-roll;
  DOWSE press, accepted roll and flash; result hover/select/buy; accepted
  purchase and reset; escalating fee rejection MsgBox; Done/discard/reopen;
  two-participant isolation.
- Falsifiers: purchase has no flash write; `UI.101` owns its full natural width
  as the HotRect; Dowsing has a distinct eased slide; pressed state does not
  select `UI.102`; or the transaction mutates shared world economy.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same canonical retail program as the existing trader closure. | high |
| Fresh instructions | canonical read-only Ghidra replica; Dowsing vtable `0x00790524`; `0x0055F9F0`, `0x005512F0`, `0x00558160`, `0x0055FAF0`, `0x00554E20`, `0x00551350`, `0x0056D110`; shared `0x00550D80`, `0x00427710`, `0x005C60F0`, `0x005AB5C0` | Complete rebuild/update/render/action/purchase thread, shared Shop motion, Button/MsgBox bounds, pressed state, and both flash writers. | high |
| Raw instructions/data | `0x0055FA51..0x0055FA6F`, `0x0055FD99`, `0x0056D190..0x0056D194`; floats `250`/`69` at `0x007853A0/0x0079250C`, `196` at `0x00799D54`; doubles `-20`, `100`, `0.05`, `0.025` | DOWSE and OKAY use smaller HotRects than their visual art; both accepted actions start the same 20-tick flash; slide/reveal are fixed-step linear. | high |
| Stock pixels | committed Shlorio pre-roll/results/insufficient-gold and three Chat captures under Mod Loader `tests/fixtures/webgame/menu-reference-captures/`; manifest SHA-256 entries `267ef483...`, `d14e3fb7...`, `8916f9d0...`, `c222f857...`, `54604b0e...`, `ccc881ca...` | Settled visual membership and exact 1600x900 reference geometry. | high |
| Current Mac browser | Website `21c56bcd`; macOS 26.6.2, Chrome 151, Apple M2 Metal; task-owned Vite/GameHost two-client `smoke-hub-traders.mjs` | After repairing the smoke's obsolete Tutorial-prompt entry, the full transaction passed with zero browser errors: roll, purchase, in-place inspect/drag/equip, fee rejection, discard/reopen, and guest isolation. | high |
| Baseline raster comparison | current `baseline-shlorio-preroll.png` SHA-256 `feea6795...` against stock pre-roll through `compare-native-ui-captures.mjs` | Central panel best offset `(0,-1)`; DOWSE region mean absolute channel delta `8.6416`, with `23.9786%` of pixels over threshold 16. The inert reference-well region was `2.1465` and `4.1395%`, localizing the larger mismatch to the interactive control lane. | high |
| Current web source | `HubInventoryUi.tsx`, `hub-inventory-render-contract.ts`, `hub-inventory-renderer.ts`, trader smoke at `21c56bcd` | Full-width `353 x 69` semantic buttons, no pressed control state, cubic service slide, fractional render-frame clocks, and offer-count-only roll flash. | high |

The first baseline attempt never reached the Hub because the stock Tutorial
prompt intercepted the smoke's Play click. The task-owned harness now declines
that prompt in the same two entry positions as the current Hub-NPC smoke. That
is an acceptance-harness correction, not Dowsing evidence or a product bypass.

## System boundary and membership inventory

Native system: participant-local Shlorio Chat plus `DowsingShop`, attached
InventoryScreen, Dowsing StoreGrid, generic one-button MsgBox, and their
fixed-tick controls from entry through accepted/rejected action and teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Shlorio intro, questions, Dowsing Prices answer, return, service replacement | `DOWSER_INTRO/DOWSER_Q`, Chat `0x004F9380/0x004FFB00` | verified-already-at-parity; retain fixed-tick correction | graph tests, stock/current Chat captures, Mac journey |
| Shop, PerkShop, InventoryShop, Dowsing pre-roll/result root motion | common `0x00550D80`; Dowsing `0x005512F0`; InventoryScreen reveal `0x00551A10` | exact-ported by shared linear fixed-step owner | quarter-step render contract plus all four service journeys |
| DOWSE visual body/endcaps/copy and exact HotRect | `DowsingShop+0x290`; `0x00427710`; `0x00558160`; `0x005C60F0` | exact-ported | visual `353 x 69`; action `(675,265.5,250,69)` |
| DOWSE pressed/cancel/leave/release | Button byte `+0x78`; `UI.101/102`; `state * 6` copy shift | exact-ported | held-pointer and keyboard contract/browser frames |
| fee gate, accepted debit, 3..4 unique offers, 47 recipes, exact prices | `0x0055FAF0`, catalog/RNG thread | verified-already-at-parity | kernel golden and full smoke |
| accepted roll flash | `0x0055FD99 -> DowsingShop+0x360` | exact-ported | fixed-step samples and browser event |
| result field/grid/tint/selection/HoverBox | `0x00554E20`, StoreGrid family | verified-already-at-parity; integer-tick tint retained | 3x3/47-row tests and browser hover/select |
| accepted result purchase, clear, next fee, audio, InventoryScreen rebuild | `0x0056D110` | verified-already-at-parity except flash sibling below | transaction/isolation tests and browser receipt |
| accepted purchase flash | `0x0056D194 -> DowsingShop+0x360` | exact-ported | dedicated post-purchase flash assertion/capture |
| rejected roll MsgBox content/chrome/curtain | `0x0055FAF0`, MsgBox `0x005C4530` | verified-already-at-parity | stock/current insufficient-gold pixels |
| one-button MsgBox idle/pressed copy and exact HotRect | `0x005AB5C0`, `0x005C60F0`; `UI.101/102` | exact-ported for Dowsing and Hat/Robe sibling consumers | action `(702,397.5,196,69)`, outside-art rejection, pressed frame |
| Done, active-offer discard, reopen, range/Region/fade teardown | `0x0055EF40`, `0x00558890`, `0x00505010` | verified-already-at-parity | existing kernel/full browser branches |
| participant economy and two-player isolation | profile inventory owner; web player entity | verified-already-at-parity | host `350`, guest `500`, zero browser errors in current baseline |
| targeted Dowsing | inventory drop slot `+0xC8 -> 0x00568080`, target `+0x344` | recovered-pending-port; prior unreachable claim superseded | September 27 raw instruction and virtual-dispatch trace below |

No member is blocked by the browser platform.

## Native ownership thread

- `DowsingShop` derives from the Shop family and attaches a separate
  InventoryScreen beneath it. `0x005512F0` reads that InventoryScreen's reveal
  alpha and owns Dowsing's root motion and flash decrement.
- In pre-roll, `0x0055F9F0` rebuilds the embedded Button at `+0x290` and the
  renderer `0x00558160` consumes its rectangle/state. Accepted roll replaces
  the pre-roll branch with the StoreGrid result owner.
- `0x0055FAF0` gates funds, debits, writes the roll flash, creates offers, binds
  prices, and leaves the service in result state. The UI never owns gold or
  RNG speculatively.
- StoreGrid selection invokes `0x0056D110`. Only after the ordinary purchase
  succeeds does it clear the list, roll/persist the next fee, request
  distortion audio, and write the purchase flash.
- Done or interruption clears active results without refund and destroys the
  service/hover/selection owners. Neither close nor reconstruction writes the
  flash field.

## Recovered behavioral contract

- InventoryScreen reveal advances by `0.025` on integer 100-Hz ticks. Every
  Shop-family overlay uses `offsetY = -(1 - reveal) * 100`; cubic easing is not
  part of stock.
- DOWSE body art is `UI.101` idle and `UI.102` held. Endcaps remain fixed;
  DOWSE and fee copy move `(6,6)` while held. Its visible body is
  `(623.5,265.5,353,69)`, but only `(675,265.5,250,69)` is actionable.
- Generic one-button MsgBox uses the same idle/pressed records and copy shift.
  Its visible body is `(623.5,397.5,353,69)`, but only
  `(702,397.5,196,69)` is actionable.
- Accepted roll and accepted purchase each start alpha 1. Every fixed tick
  subtracts 0.05 and clamps at zero; the full-screen red painter therefore
  emits exactly 20 presentation ticks. Rejections and restore/close do not
  flash.
- Dowsing tint, service/Chat/MsgBox reveal, and Chat scroll consume integer
  native ticks. Browser frames may sample those states but must not interpolate
  extra fractional states.
- Economy remains host-authoritative and participant-owned. Visual press/flash
  state is local presentation driven only by accepted authoritative feedback.

## Nearby-system findings

- The common MsgBox primitive means the corrected narrow action rectangle and
  pressed body also apply to the InventoryScreen Hat/Robe one-button warnings;
  leaving those siblings full-art clickable would preserve the refuted model.
- The common Shop update means removing cubic easing only for Shlorio would
  leave Fomentius, Hagatha, and Luthacus on the disproven path.
- `smoke-hub-traders.mjs` was stale against the current stock Tutorial prompt;
  without declining it, the Dowsing journey could no longer provide a browser
  receipt despite the product path working.
- `../Mod Loader/docs/reverse-engineering/native-hub-and-economy.md` and
  `native-hub-trader-catalog.json` now own the corrected reusable native facts.

## Confidence and open questions

- Confirmed: both flash writers and order, 20-step decrement/painter, linear
  shared slide, fixed reveal step, both HotRects, idle/pressed records, copy
  offset, grid/action/teardown membership, and current end-to-end transaction.
- No extractable native fact in this boundary remains unknown. The previously
  open initial-fee producer remains an upstream persistence question; the
  observed/persisted 650 value is unchanged and does not affect this UI fix.

## Web implementation consequence

- Drive Dowsing flash from a new accepted feedback sequence for either
  `dowse` or `buy-dowsing`, never from offer-count shape.
- Step reveal, slide, flash, tint, notice, and Chat clocks on integer 10-ms
  ticks; use the shared linear Shop-family motion and remove the cubic helper.
- Separate visual bounds from semantic action bounds for DOWSE and MsgBox.
  Add one shared native labeled-control presentation state for `UI.101/102`
  and the `(6,6)` copy shift, then use it for Dowsing and every generic
  one-button MsgBox sibling in this renderer.
- Keep authoritative economy, offer generation, result selection/purchase,
  close/discard, and participant isolation unchanged.

## Validation contract

- Focused tests: all 40 reveal samples and linear offsets; integer Chat/MsgBox
  steps; idle/pressed body records and copy offsets; separate visual/action
  rectangles; all 21 flash samples for both accepted triggers; non-trigger
  feedback; integer result-tint sampling; and removal of cubic/offer-count
  ownership.
- Mac Chrome: reject pointer clicks in the visible left/right art outside both
  HotRects; hold DOWSE and OKAY to capture `UI.102` plus `(6,6)` copy; observe
  roll and purchase flash transitions independently; finish purchase,
  in-place inventory use, insufficient fee, Done/discard/reopen, and guest
  isolation with empty page/console/failed-response arrays.
- Compare matching 1600x900 stock/current pre-roll and MsgBox regions and run
  `/opt/homebrew/bin/bash ./scripts/validate.sh` against the exact byte-identical
  candidate.

## Implementation validation receipt

- Pre-fix browser result: the authoritative economic transaction works on
  current main, including in-place inspect/drag/equip, escalating fee rejection,
  discard/reopen, and two-participant isolation. Its `browserErrors` array was
  empty, but the original smoke first needed its stale Tutorial-prompt entry
  corrected before it could reach the Hub.
- The renderer now starts the red field from a new accepted feedback sequence
  for either `dowse` or `buy-dowsing`; restores never replay it. Flash alpha,
  service/Chat/MsgBox reveal, Chat travel, and result tint sample integer
  100-Hz ticks. All four services share the recovered linear slide; the cubic
  helper and offer-count flash owner are gone.
- DOWSE now separates its `(623.5,265.5,353,69)` art from the native
  `(675,265.5,250,69)` action rectangle. Generic one-button MsgBoxes similarly
  separate `(623.5,397.5,353,69)` art from
  `(702,397.5,196,69)` input. Holding either control renders `UI.102` and moves
  its copy `(6,6)` while the endcaps stay fixed; visible art outside each
  HotRect is inert.
- The test-first Mac run failed on untouched implementation because the new
  fixed-tick/labeled-control surface did not exist. The completed focused Hub
  group then passed all `55/55` tests, including linear quarter steps, every
  flash sample/trigger, both control geometries, pressed records/copy offsets,
  and removal of the disproven owners.
- The matching Mod Loader report/catalog and its expanded Dowsing contract
  passed all `499/499` CI-safe static RE tests on the Mac.
- The exact six-file Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build/contracts and
  formatting; frontend lint/import boundaries; every frontend and desktop
  test group; production frontend/GameHost builds; media policy; and the game
  entry below its `131072`-byte gzip budget.
- Built-production Chrome `151.0.7922.170` on macOS 26.6.2 completed the focused
  two-client Shlorio journey from the generated `backend/wwwroot` and built
  GameHost. It rejected both outside-art clicks, captured held DOWSE and OKAY,
  observed separate roll and purchase flashes, bought and equipped a generated
  item, reached insufficient gold, discarded/reopened results, and retained
  independent owner/guest balances. `browserErrors` and `failedResponses` were
  both empty.
- The built DOWSE-pressed, purchase-flash, and insufficient-gold-OKAY-pressed
  frames were visually inspected after the final current-main rebase. No
  browser-platform member or native unknown remains. Publication and deployment
  are separate and were not performed.

## September 27, 2026 — Report39 reference drop and ItemInfo reopening

The preceding closure missed the inventory drop virtual callback and relied
on decompiler-eliminated branches when describing targeted offers. Its claim
that reference Dowsing is unreachable, and its deterministic-union claim in
ledger087, are wrong. The missing membership was the upstream inventory-drop
producer and the helpers' local candidate-list allocation/selection. This
reopening must close both the reference behavior and the reported tooltip
occlusion before report39 can be marked resolved.

### Reproduction and fresh evidence

The unmodified Website at `2dff09a3` reproduces both submitted symptoms in WSL
Chrome 150.0.7871.124. A private generated profile places Cloudcover Hood in
backpack slot24 with 20,000 gold. Selecting it in Shlorio's pre-roll service
shows its name/upper details behind the service panel, matching the submitted
image. A real pointer drag into stage `(800,175.5)` reaches the existing drag
owner but leaves the well empty, the item in the backpack, gold at 20,000 and
action feedback unchanged. Page, console and failed-response arrays are empty.
This is a browser reproduction, not a native runtime capture.

Fresh read-only Ghidra queries use canonical `SolomonDark/SolomonDark.exe` via
replica slot01 and the existing Windows Mod Loader wrapper. The retail file
again hashes to `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py` is
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
All addresses below use preferred image base `0x00400000`. Mod Loader remains
a read-only instrument; these Website ledgers supersede its older conclusions.

- `InventoryDragger::PointerRelease 0x0056EC30` reaches ordinary drop dispatch
  `0x0056DE50`. At `0x0056E73C` that dispatcher calls the active service's
  virtual slot `+0xC8` with the source item and service-local pointer position.
- Dowsing vtable `0x00790524 + 0xC8` resolves to `0x00568080`. It checks pre-roll
  byte `+0x28C == 0`, checks the authored reference well, refreshes inventory,
  emits its two native sound calls and writes the source item pointer at
  `0x0056815E` to `DowsingShop+0x344`. `XOR AL,AL` leaves the ordinary source
  return path active: this is a borrowed reference, not an inventory transfer.
- The same slot resolves to ordinary Shop `0x005088E0` and InventoryShop
  `0x00566360`; those sibling drop policies must remain separate.
- At `0x0055FE35..0x0055FE49`, a targeted roll calls same-set selection
  `0x00554AF0` twice and same-type selection `0x00554CE0` three or four times.
  Their raw tails `0x00554C59..0x00554CA0` and `0x00554D9B..0x00554DDE` draw
  `Integer(candidateCount)` and append one instantiated recipe. The decompiler
  had marked these live branches unreachable after an indirect list append.
- Both target helpers exclude earlier selected offers via `0x00554A10` and
  the native ownership predicate `0x005CB050`; the latter's rarity byte is
  recipe `+0x89`, not a level gate. Raw `0x00552430` confirms nested inventory
  and all seven equipped-item checks; the inventory and storage callers are
  recorded below. Ordinary selection `0x00554A70` uses its
  bounded retry path; price RNG occurs afterward in `0x0055FE80..0x0055FEBB`.
- Current Website `buildService` paints companion InventoryScreen ItemInfo
  before appending `native-service-overlay`. That shared painter order
  explains the reproduced occlusion. Stock ItemInfo derives from HoverBox;
  constructor `0x005C38F0` registers the active box at `DAT_00819EDC`.
  Inventory pointer owners `0x0056F760/0x0056FC90` construct it after the
  existing service and append it through their child slot `+0xA8` at
  `0x0056FC0B/0x005705D5`. Rebuilding a service must preserve that foreground
  order instead of burying newly selected details under its panel.

### Boundary and pending membership

The work owns Dowsing reference selection, target-dependent offer generation,
their participant/authority boundary and lifecycle, plus companion ItemInfo
ordering shared by all four services. Existing item definitions, other
merchant economics, unrelated combat effects and world simulation stay with
their established owners.

| Member | Evidence / owner | Current disposition and required proof |
| --- | --- | --- |
| Pre-roll reference hit, replacement, source return and rejection after roll | `0x00568080`, shared drop `0x0056DE50` | recovered-pending-port; pointer journey and source identity |
| Root/nested backpack and existing equipment drag sources | InventoryDragger/InventoryScreen | recovered-pending-port; preserve current source and mandatory-clothing rules |
| All 47 recipes, seven sets, six equipment classes; setless and non-equipment references | existing complete catalog, `0x00554AF0/0x00554CE0` | recovered-pending-port; per-family pools, no invented fallback |
| Targeted two-set plus three/four-type draws; untargeted retries; pricing | raw helper/caller tails | recovered-pending-port; exact RNG sequence, duplicate/ownership exclusions and exhaustion |
| Empty result, insufficient funds, purchase, Done/reopen and interruption | phase byte `+0x28C`, existing transaction/close owners | recovery in progress; explicit lifecycle and atomicity checks |
| Local reference display and authoritative owned-item validation | native borrowed pointer, Website player economy | design pending recovered lifecycle; no client-owned gold/RNG |
| Companion ItemInfo for Hagatha, Fomentius, Luthacus, Dowsing pre/results | common `buildService`, HoverBox owner | recovered-pending-port; visible full tooltip through real pixel checks |
| Ordinary InventoryScreen, StoreGrid HoverBox, owned-perk help, dragger/flyby, dye and notices | existing shared renderer/input owners | preserve and verify affected ordering/lifetime siblings |

The table records the pre-implementation investigation; the completed native
trace and implementation evidence below supersede its open questions. Final
acceptance runs on Windows/WSL per the user's current instruction and includes
the canonical Website gate, built desktop/touch interaction, both report
conditions and task cleanup after verified publication.

### Recovered transaction details and implementation boundary

The raw candidate-list tails establish random selection without replacement,
not a union of every match. For Cloudcover Hood already owned, the first pool
is authored rows `[17,18,19]`; after two choices the hat pool starts as
`[5,6,11,20,40]`. With native RNG seeded to one before the pitch draw, the
instruction-derived call sequence yields rows `[17,19,6,20,5,11]`, then prices
`[5550,5300,5100,5400,5550,5150]`, consuming 14 RNG words. This oracle uses the
separately verified shared native RNG and explicit authored pools; it is not
a live stock roll receipt.

`0x005CB050` reads recipe rarity at `+0x89`. Common recipes bypass owned-item
exclusion; all 47 authored Dowsing recipes are Rare/Epic. It searches the
live profile inventory (`Game+0x13B8`) and stored inventory (`DAT_0081A3BC`)
through recursive `0x00552430`. It does not consult wizard level. Dowsing
passes a null world argument, so the optional ground-item scan is excluded.
The ordinary retry helper increments its attempt counter before drawing and
only accepts when the counter is below 100; a successful 100th attempt is
also discarded. Both ordinary and targeted rolls finish selection before
the price loop. The web port's level gate and interleaved price draws must
be removed from this shared owner.

Both pitch additions are stored with `FSTP float`: roll uses `0.8 + Float(0.1)`
and purchase uses `1.0 + Float(0.1)`. Their returned receipts must therefore
use float32 rounding. The purchase ceiling is `Math.fround(1.1)`, which is
slightly greater than JavaScript's double `1.1`; the existing wire check's
unrounded bound would reject that legitimate endpoint. A boundary regression
must preserve the native endpoint while continuing to reject larger values.

Pre-roll byte `+0x28C` is set on an accepted roll independently of offer count.
An empty candidate pool therefore leaves a rolled, empty service rather than
silently permitting another fee payment. Raw `0x0056D110` clears only the
embedded StoreGrid (`LEA ECX,[ESI+0x9C]` at `0x0056D121`), changes the next fee,
and writes the purchase flash; it does not reset `+0x28C`. Update `0x005512F0`
only advances presentation/flash. Done destroys the current service; reopening
constructs an unrolled service with a null reference. The Website needs a
separate rolled flag rather than inferring phase from a nonempty offer array.

The menu owns the borrowed reference choice. Its authoritative `dowse` request
will carry an optional owned-item ID, which the host resolves against that
participant's current inventory/equipment before using recipe/set/type data.
Invalid or removed references reject without debit or RNG changes. The item
is never consumed or transferred by reference selection. The rolled flag
belongs with replicated/saved economy state; legacy saves infer it from their
existing offer array to preserve the previously representable state. Closing
the menu releases the local reference and the active roll. The shared service
renderer will retain InventoryScreen's details above the service panel while
preserving drag/flyby and notice ordering. Focused failing regressions precede
these changes; no new product policy or host-wide preference is introduced.

### Implementation and focused proof

The local service retains an owned-item ID for its borrowed reference. Existing
inventory pointer capture handles desktop and touch; root/nested backpack and
equipment drops preserve the source and select the well only before a roll.
The native callback's registry offsets `+0xF4/+0xC8` are `backpack_open` and
`backpack_close`, both played at native gain/pitch. The well uses the existing
clipped natural item renderer. Its reference is replaced by another drop,
cleared when the item is no longer carried, and released with the service.

The host resolves the optional `referenceItemId`, owns pool selection, prices,
gold and RNG, and rejects unowned IDs atomically. The economy now carries the
explicit `dowsingRolled` phase through empty results and purchase until Done.
Protocol137 admits up to six offers and the reference action; save schema43
preserves the phase and migrates older saves from their existing offer array.
No reference pointer or client-chosen recipe is serialized as authority.
The service painter places companion ItemInfo after the panel and before
later contextual details, drags/flybys, dye and notices.

Five new economy regressions failed on the original implementation and passed
after the repair. Their coverage includes the exact Cloudcover trace, all 47
recipe references, ownership rejection, empty result and purchase lifecycle.
Additional checks cover nested sacks/storage/equipment exclusions, insufficient
funds, retry exhaustion including a valid hundredth draw, two-player authority
isolation, six-offer wire validation and schema42 migration. The initial
focused economy/protocol/save group passed 102 tests; application/test type
checking and frontend lint also passed. The native float32 pitch endpoint
separately reproduced a protocol rejection before its bound correction.

A real WSL browser replay now shows the complete Cloudcover tooltip, paints
the Hood in the well, preserves the backpack and charges 650 for two Tempest
Kit and four hat offers. Its error arrays are empty. The maintained
`smoke:game:dowsing` journey extends this to all four services' tooltip pixels,
equipped/root/nested references, replacement, post-roll rejection, setless
rolls, purchase/reopen, empty results and insufficient funds. Desktop preflight
passes with all 416 sampled tooltip-padding pixels black for each service and
empty page/console/HTTP error arrays. A test-only funds fixture initially
omitted its economy revision; updating that revision makes the intended
zero-gold snapshot observable. The complete touch preflight also passes:
all 276 sampled tooltip-padding pixels are black for each of the four services,
the same reference/transaction checks pass, and all error arrays are empty.
Its nested-sack setup now queues a single ordered double-tap gesture before
awaiting acknowledgements. Separate Playwright tap calls arrived 2.7 seconds
apart; the compound gesture's pointer handlers arrive 12.8 ms apart and open
the sack within the existing 500 ms rule. Product input timing is unchanged.
The final 14 targeted economy/authority/protocol/save checks pass, including
the native float32 pitch ceiling and retry exhaustion. Final canonical and
post-gate production-browser acceptance remain pending; provisional membership
rows are not final acceptance claims.
