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
| targeted Dowsing | null target at `+0x344`; no retail hub producer | out-of-system (unreachable retail branch) | existing constructor/xref sweep |

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
