# 2026-08-27 — Goodie Item_Sack materialization and InventoryScreen root navigation

> **2026-09-24 report 22 correction:** the reopening below supersedes this
> entry's horizontal/full-screen/160-tick Sack transition claims. The native
> countdown uses the InventoryGrid's **height**, and its moving field is the
> grid's **Y offset**. Goodie construction and authoritative inventory ownership
> are unaffected.

## 2026-09-30 — Shared parent-cell implementation and local acceptance

The approved candidate reuses `HubInventoryUi`'s return callback through both
ordinary and service inventory actions. With no selected transfer item, primary
pointer down returns one root; release is consumed so a held press cannot pop a
second root after motion finishes. Native button Enter/Space and accessibility
clicks share the action. Selected-item click-to-parent and captured drag routes
remain intact. The ordinary grid now paints the extracted gold pad/UI-1/normal
Sack composite, and the caption uses the existing root item name with its whole
backplate hidden until the same discrete page model settles. No navigation
duration, protocol, economy or save rule changed.

The native-composite regression failed exactly 1/35 on the previous constant
contract and passed 35/35 after the shared cutover. The focused Hub UI suite
passed 128/128 with test type checking. Current production frontend/host build,
bundle budget and frontend lint passed on the M5 SSD. An initial broad-smoke
phase sample missed a short pre-existing Flyby tail; the harness now records
the actual attribute transition rather than depending on catching that frame
after a screenshot. Retained-canvas reveal ownership is awaited through the
existing two-frame scene handoff. Responsive deselection uses transformed
stage coordinates. These are harness repairs; no Flyby or scene architecture
change was made.

Real built desktop 1600x900 and touch 844x390 journeys each passed 14 first-cell
returns and 56 total traversals: empty/filled/nested roots, Fomentius, Hagatha,
Luthacus/storage, Shlorio pre-roll and result, and paused Boneyard. Every probe
checks unchanged host backpack, one close cue, no error cue, correct settled
root name, hidden moving caption, transition lock, and returning/reopening
through public input. Desktop includes Enter, Space and held-pointer release;
touch uses actual touchscreen taps. Current observed motion was
368.8–377.3 ms desktop / 368.5–378.1 ms touch, with 2,450 moving-frame samples
and empty page/console/failed-response arrays. The native arrow region has 212
opaque gold pixels; reviewed current frames show the full Sack/pad/arrow and
correct root headings.

The existing real-server delivery-hold journey passed 45 transfer/equipment/
storage/parent-drop/cancel/teardown cases, with zero changed pixel channels at
the former source before acknowledgement. A new focused journey held nine
real server messages while the parent return completed locally with an
unchanged host backpack. Neither navigation nor presentation waits for an item
acknowledgement. StoreGrid/storage transactions themselves are a separate
owner; imported/stored Sacks in the shared player grid use this correction.

All rows of the earlier navigation inventory now have a local disposition:
affected first-cell input, supported input equivalents, parent composite and
root caption are `exact-ported`; existing UI-47, authored height/Y/clock/clip,
lock and teardown are `verified-already-at-parity`; item IDs/economy/protocol,
stats swipes, Forge fire and separate belt/drop mutation owners remain
`out-of-system` with their prior contracts retained. No browser approximation
or caption unknown remains. These are local candidate results; the exact final
unchanged canonical gate, publication and production rollout must be recorded
in the external implementation receipt before closure.

## 2026-09-30 — Approved parent-cell implementation: caption recovery

The user approved the proved correction and actual maintained production
deployment. Straightforward verified fixes no longer require another approval.
The prior investigation/decision hold below remains dated evidence.

Fresh M5 PE string/xref recovery found the sole `Backpack` literal at
`0x007948F8`, referenced at `0x00556B13`. Full instruction recovery of
`InventoryScreen` overlay/header owner `0x00556940` establishes the missing
caption contract at `0x00556B01..0x00556D72`:

- `InventoryScreen+0x168` is tested first; any active Sack traversal skips the
  entire variable caption/backplate block. It does not preserve the previous
  label or slide an incoming label.
- With no traversal, the caption starts as `Backpack`. Current root `+0x158`
  is read; a nonzero root UID at root `+0x04` selects its owner at root `+0x08`
  and the ordinary item name getter at vtable `+0x1C`. This supplies the Sack's
  own name, not a hard-coded `Sack of Goodies` label.
- The existing native menu-font measure/draw path sizes UI record 4 around the
  chosen caption. There is no depth, content-count, trader or world-kind name
  substitution in this branch. UI row 4 is already the shared web header frame.
- Update `0x00551D3A..0x00551D9D` clears the same motion flag at update 37 for
  the 365-high stage. Restore the caption at that renderer tick, independently
  of a later React timeout notification.

Fresh data also drains the parent composite's item origin adjustment: doubles
`0x007DE840=0` and `0x007856B8=18`. After drawing UI-1 at `[0,-12]`, scale
`.65`, the ordinary Sack painter runs at the holder centre plus `[0,18]`,
inside relative clip `[-35,-35,70,67]`. The quarter-alpha gold pad remains
`[-30,-30,60,60]`, RGB `[.85,.73,.44]`; the Sack and arrow retain alpha one.

Implementation boundary: reuse the current local return callback, the existing
item name/root lookup, native atlas sprites, clipped item painter, discrete
Sack offset clock and header renderer. Add first-press navigation with release
deduplication; retain the selected-item click-to-transfer and captured drag
routes. No change to page duration, economy, protocol or forge fire is needed.
Candidate tests and complete member/browser/publication/deployment receipts
will follow; this recovery does not claim an implementation already passed.

## 2026-09-30 — Renewed Report 22: parent-cell action and navigation timing

**Investigation / user-decision hold. No product remedy has been applied.**
The September 24 vertical-motion correction remains valid. The renewed report
identifies a different bag control: the kind-7 parent holder in cell zero,
rather than the Game-owned UI-47 backpack at the bottom of the screen.

### Evidence and causal model

- The sealed retail image was rehashed on the M5 SSD: 0.72.5,
  SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  preferred base `0x00400000`. Fresh bounded LLVM disassembly used the existing
  Command Line Tools, without a new Ghidra project or Windows/WSL execution.
- `InventoryScreen` vtable `0x00794F54` routes pointer press at slot `+0x64`
  to `0x0056F760`. At `0x0056FA6A..0x0056FA85`, kind 7 calls activation
  `0x0056D920` immediately on the first press. The ordinary same-item
  double-activation comparison is later at `0x0056FAA5..0x0056FACD`; it does
  not gate this parent branch. Activation rejects motion while `+0x168` is
  set, then pops the root stack at `+0x174/+0x184` for a parent return.
- Return/open `0x0056DA3E..0x0056DA88` /
  `0x0056DC26..0x0056DC6E` still use grid height and opposite directions.
  Update `0x00551CDE..0x00551D9D` subtracts direction times ten from both Y
  lanes, subtracts ten from the countdown, snaps the incoming page to zero,
  changes the active page, retires the old page and clears the lock. The
  prior 100-Hz clock and complete 220/295/365 height table remain applicable.
  No easing, speed multiplier, queued return or reversal is authored here.
- The complete reporter-labeled original clip, attachment
  `1554349666370326598`, was decoded and all 120 frames reviewed on the M5 SSD.
  Served bytes remain 692,779; SHA-256
  `d76176255f7aab8d771fd18bfafd2421e088e8c1220f0549e102f5daeff0bae8`.
  It shows empty-Sack entry and a return using the first-cell bag. Last
  unchanged to first settled recorded-frame intervals are approximately
  368 ms for each direction, consistent with the 37-update nominal 370-ms
  contract. These are sampled video intervals, with about 33.45 ms between
  ordinary frames; neither the input timestamp nor the engine clock was
  recorded. The clip's native executable/version is not independently sealed.
- Current Website source `24d0b9bcee7a05ba24e570bc80681775a2abff84`, tree
  `c2b72f1a2bc50948d7f76fd35cd53e170ee7a676`, makes cell zero exclusively a
  selected-item transfer action in `HubInventoryActions.tsx`. With no selected
  item it plays `bad-action` and returns. It never invokes the existing local
  parent-navigation callback. This is a missing input branch, independent of
  item ownership or host acknowledgement.
- The exact production frontend/host build passed on the M5 SSD. Real mouse
  clicks and focused Enter failed to return in all 13 tested desktop parent
  cells; three real touchscreen taps failed in empty/filled/nested cells.
  All gestures were trusted userspace input, no item was selected, no new page
  transition started and the host backpacks remained unchanged. Each click
  or Enter emitted the error cue. The existing UI-47/KeyI return completed
  26 desktop transitions at 369.0–376.6 ms and six touch transitions at
  369.5–372.1 ms, with 682 moving-frame samples and empty page/console/failed
  response arrays. The desktop journey also exercised the existing trader,
  storage, item-transfer, teardown and Boneyard paths.
- Read-only production metadata reported revision `b48fd4ed`; its actual served
  `use-coarse-pointer-JVxHU7we.js` contains the same no-selected-item error
  branch. Affected inventory source is unchanged between that revision and
  tested `24d0b9bc`. Publication, this passive source inspection and a live
  authenticated browser outcome are distinct; no live-account journey or
  deployment action was performed.

### Parent-control presentation recovery

The old parent-drop closure in entry 293 omitted the first-press navigation
branch and assigned the native `.25` alpha to the whole Sack icon. Fresh
`InventoryGrid` painter `0x0055A2F1..0x0055A485` falsifies that assignment:
kind 7 draws a 60-square gold pad at relative `[-30,-30]`, with RGB
`[.85,.73,.44]` and alpha `.25`, restores white/alpha one, draws UI record 1
at `[0,-12]` with scale `.65`, then draws the current root's Sack using its
ordinary item painter inside the recovered 70 by 67 clip. UI-1 is 41 by 57;
the served/current web instead paints only the Sack inside a container whose
whole alpha is `.25`, and omits the arrow/pad. There is one shared parent-cell
composite; no Sack-depth or trader-specific glyph is needed.

The clip also changes the settled grid caption from `Backpack` to
`Sack of Goodies`; current `chrome.ts` always consumes the fixed `Backpack`
caption. This adjacent navigation-presentation discrepancy is recorded, not
silently accepted. The settled-name behavior is directly observed; the exact
native caption writer and its phase during page motion still need a focused
trace before a caption implementation. That is extractable static evidence,
not a reason to request Windows access or to invent a caption transition.

### Boundary and provisional membership

Native system: InventoryScreen/InventoryGrid child-root navigation, including
the first-cell parent affordance, existing Game-owned return, page admission,
motion, clip, root presentation, shared hosts and teardown. A decision hold is
not final system acceptance; the pending rows below require approved work.

| Member | Investigation disposition | Evidence / next acceptance |
| --- | --- | --- |
| Empty, filled and nested first-cell parent press | recovered-pending-port | Native first-press branch; 13 desktop and 3 touch failures |
| Parent keyboard/touch equivalents in Website | recovered-pending-port | Existing semantic button errors; restore its admitted navigation meaning |
| Kind-7 pad, UI-1 arrow and ordinary Sack art | recovered-pending-port | Fresh painter/constants, native clip and current rendered pixels |
| Root/Sack caption | recovered-pending-port | Settled appearance proved; exact caption producer/transition phase trace remains |
| UI-47 bottom backpack, KeyI, one-level back and root close | verified-already-at-parity for tested paths | 32 successful transitions, geometry/control receipts and transition-lock checks |
| Grid-height/Y motion, discrete cadence, clip and retirement | verified-already-at-parity for fixed stage | Fresh raw arithmetic, retained authored table, 682 current moving frames |
| Native two-/three-/four-row layout table | verified-already-at-parity in retained contract | All native rows remain recovered; Website's fixed 900 stage selects 365 |
| Motion interruption/reactivation | verified-already-at-parity for tested paths | Repeated KeyI during each observed traversal is rejected; no queued back |
| Standalone Hub and paused Boneyard | recovered-pending-port for first cell; existing motion verified | Shared callback/renderer cause, real built journeys |
| Fomentius, Hagatha and Luthacus companion player grids | recovered-pending-port for first cell; existing paths verified | Existing full desktop journey and common owner; candidate must repeat each |
| Shlorio pre-roll and result companions | recovered-pending-port | Both share the owner; independently assert both phases in approved acceptance |
| Parent item drop and existing click-to-transfer shortcut | verified-already-at-parity for existing transfer contract | Fresh kind-7 setter thread, retained entry 293 and full current transfer journey; preserve transfer gestures |
| Close/reopen, stale path and renderer teardown | verified-already-at-parity for tested paths | Existing full journey; candidate must repeat after new callback wiring |
| Page-open/back/close audio | verified-already-at-parity for existing navigation | Existing stock cue routing; remove empty-parent error when navigation is restored |
| Item IDs/tree, economy, saves, protocol and network authority | out-of-system for remedy | Navigation is local; no ownership or schema change proposed |
| Stats swipes, forge fire, belt activation and drag/equipment mutations | out-of-system | Separate owners/reports; forge is Report 67 |

### Proposed approved implementation and gate

Ask the user to approve restoring the complete parent-bag affordance across
the shared inventory hosts: a plain click/tap/Enter returns one root when no
item-transfer operation is in progress, with the native pad/arrow/Sack
presentation and recovered root caption. Preserve the existing item-transfer
gestures and nominal 370-ms page motion. Trace the caption producer before
using it in code. No speed-up beyond stock is supported by this investigation.

Reuse `HubInventoryUi`'s existing local parent-return callback through
`NativeHubSurface` / `InventoryActions`; complete the shared presentation in
`renderer/hub-inventory/pages.ts`, `chrome.ts` and its render contract. No new
navigation owner, protocol, retry, multiplier or network wait is needed.
After approval, add meaningful regressions at the existing interfaces and
repeat each pending member, then the unchanged full canonical gate and real
built desktop/touch journeys on the exact final M5 SSD tree before publication.

No product code, product test, protocol, configuration, publication or reaction
changed in this investigation. A diagnostic build/browser comparison is not
implementation acceptance. The user's explicit discrepancy-before-remedy
decision boundary controls this hold; it is not a skill-invented approval.
Original/mixed message `1554349667230416936` remains unmarked because both
Report 22 and separate Report 67 must be resolved.

## 2026-09-24 — Report 22: native vertical Sack-page transition

### Cause and evidence

The reporter describes slow navigation between Sacks. The preceding pass
recovered the ten-pixel step but did not resolve the rectangle layout or the
offset's downstream renderer. It substituted the 1,600-pixel stage width for
`InventoryGrid+0x20` and X for `InventoryGrid+0xBC`; its tests repeated that
assumption. This is a shared page-motion defect, not a network round trip,
activation delay, or reason to alter item-use semantics.

Fresh static recovery ran on the M2 through the existing read-only/noanalysis
`sdr-ghidra-headless` replica wrapper and the canonical `SolomonDark` project.
Retail 0.72.5 `SolomonDark.exe` SHA-256 is
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`. Wrapper SHA-256 is
`26015c74981f7bc23556808b42eed2801e09c554357b8da57c8480c2aa2f9da3`.
The Mod Loader checkout was an unchanged read-only instrument. Evidence below
is instruction/data-derived; no fresh clean-stock runtime recording is claimed.

| Source | Recovered contract | Confidence |
| --- | --- | --- |
| Rectangle dispatcher `0x00427770` | widget `+0x14/+0x18/+0x1C/+0x20` are X/Y/width/height. The first InventoryGrid starts at screen `+0x188`, making screen `+0x1A8` its height. | high, explicit stores |
| Activation `0x0056D920`, `0x0056DA3E..0x0056DA88`, `0x0056DC26..0x0056DC6E` | Both return and entry load the active grid's height, convert it to integer and store countdown `+0x16C`. Direction `+0x170` is -1 for return and +1 for entry. The incoming grid starts at minus/plus that height. `+0x168` rejects repeated activation. | high, raw instructions |
| Update `0x00551A10`, `0x00551CDE..0x00551D9D` | Both grid `+0xBC` fields subtract `direction*10` each 100 Hz UI update. Countdown subtracts ten; at <=0, active page flips, incoming offset snaps to zero, old page retires and the lock clears. | high, raw instructions |
| SwipeArea drawing `0x00431860`, auxiliary `0x00431BF0` | `+0xB8` adds to Graphics X `+0x238`; `+0xBC` adds to Graphics Y `+0x23C` before the virtual painter. The transition is vertical. | high, downstream consumer |
| Root constructor `0x00427370`, InventoryScreen constructor `0x00560380` | Screen size is the backbuffer size. A separate 1024x600 temporary rectangle is centered by `0x00404000`; it positions panels but does not replace the screen's height. | high, constructor and raw operands |
| Page builder `0x00560D30` | The complete height table below determines page travel, independently of screen width, inventory contents and Sack depth. | high, all branches and constants |
| Grid painter `0x0055A070`, shared clip in `0x00431860` | Clip the fixed grid rectangle, then inset the drawing clip by 30 at top/bottom. Apply page Y offset to contents, not to the clip. | high, constant data and calls |

### Complete authored layout table

| Native screen height H | Rows | Grid height | Updates to settle |
| --- | ---: | ---: | ---: |
| 320 < H <= 600 | 2 | 220 | 22 |
| H <= 320 or 600 < H <= 800 | 3 | 241 + 54 = 295 | 30 |
| H > 800 | 4 | 311 + 54 = 365 | 37 |

Sources: float constants `0x0079501C=220`, `0x00792318=241`,
`0x00795018=311`, `0x0078C568=600`, `0x0078ADF4=320`;
double constants `0x00795010=54`, `0x00785D10=800`.
The Website's existing uniformly scaled 1600x900 logical stage uses the last
row even on a smaller physical viewport; this fix does not introduce a new
responsive inventory layout.

At 1600x900, the centered temporary rectangle has Y=150 and bottom=750.
Constructor `+0x3AC=750-261=489`, then grid Y=`489-27=462`.
Its fixed clip is Y=`462+30=492`, height=`365-60=305`, width=1600.
Constants `0x00794F40=261`, `0x00786C30=27`, `0x00784D50=30`,
`0x007849A0=60` are doubles. The current first/last slot edges, 496 and
793, remain inside that clip. Equipment, backdrop, chains, gold and the
Game-owned return/tome controls stay outside the moving page containers.

For entry, outgoing Y is `-10*t`, incoming Y is `365-10*t`; return reverses
the signs. At t=36 the incoming page is five pixels from zero. At t=37 the
native countdown crosses zero and incoming Y snaps to zero. The outgoing
page may reach +/-370 before retirement; do not incorrectly clamp both pages
to 365 or extend the lock to another tick. Nominal duration is **370 ms**, not
1,600 ms. Browser scheduling may delay the first painted or observed frame;
it does not change this fixed-step state contract.

### Boundary and membership inventory

Native system: InventoryScreen's child-root page transition, from accepted
Sack/back activation through fixed-step motion, clip, lock and page retirement.

| Member | Disposition after focused/browser acceptance | Required proof |
| --- | --- | --- |
| Entry and one-parent return | exact-ported | opposite Y signs, ten-pixel steps, exact37-update boundary |
| Empty, filled and nested Sacks | exact-ported | same timing/model at every depth; no special content gate |
| Native two-/three-/four-row height branches | exact-ported | extracted table and branch-boundary tests; fixed900 stage uses365 |
| Stationary grid clip and vertical translation | exact-ported | fixed `[0,492,1600,305]` mask, no horizontal motion or panel/HUD spill |
| Transition input lock and reactivation | exact-ported | repeated back/activation cannot skip roots; next edge works after370ms |
| Standalone College and paused Boneyard inventory | exact-ported | real built-client navigation and unchanged pause/authority |
| Fomentius, Hagatha, Luthacus and Shlorio companion backpack pages | exact-ported | same shared renderer and page timer; no trader transaction on navigation |
| Close/reopen, stale-path reconciliation and renderer teardown | exact-ported | no retained path/timer/page mask after owner retirement |
| Backpack open/back/outer-close cues, existing same-item activation | verified-already-at-parity | unchanged producers and input guard; browser audio checks |
| Item tree, IDs, mutations, save and protocol | verified-already-at-parity | local navigation sends no host inventory action; unchanged schema/data |
| Goodie reward construction, heterogeneous belt actions and stats-page swiping | out-of-system | distinct producers; this pass changes only Sack-root transitions |

Handler caller census: `0x0056E950` calls activation at `0x0056EAD2`;
pointer `0x0056F760` calls it at `0x0056FA85/0x0056FAE3`.
Update has one vtable reference at `0x00794F5C`. InventoryGrid vtable
`0x00794C64` routes shared rectangle/draw handling to the recovered consumers.
No member requires a browser approximation.

### Implementation and acceptance plan

Replace the single shared page contract with grid-height/Y motion. Keep the
React lock timer derived from that same contract. Render the outgoing and
incoming grids inside a stationary clipped owner; do not move other UI.
Add red/green tick/branch/clip tests and browser measurements from transition
attribute changes and actual renderer samples. Compare unmodified baseline
with the corrected build, exercise all page hosts and nested/empty branches,
and rerun the complete canonical M2 gate. Final dispositions and measured
browser results will be recorded after those gates pass.

### Pre-publication implementation receipt

The shared renderer now uses grid-height Y offsets, and both page containers
sit inside the fixed native grid clip. The existing React page lock derives
its deadline from the corrected shared 37-tick contract; root mutation,
activation thresholds, audio, inventory IDs and save/protocol schemas are
unchanged. No atlas/art bytes changed.

The old build's six empty/filled/nested transitions measured 1599.2–1607.0 ms.
The initial corrected equivalent journey measured 369.3–372.9 ms. A complete
built-client Sack/Dye journey passed all existing item movement, dye,
companion-service, storage, belt and Boneyard checks; its 26 recorded page
transitions took 369.5–380.2 ms. Every sampled moving frame retained X=0,
correct ten-pixel Y steps, and actual mask bounds `[0,492,1600,305]`.
Repeated `KeyI` during every recorded transition was ignored without skipping
roots; subsequent navigation succeeded. Existing audio counts remained
12 close / 26 open at the harness's original accounting boundary.

The 844x390 coarse-pointer journey additionally used real Playwright
`touchscreen.tap` twice to activate each Sack, not synthetic double-clicks;
six transitions took 368.4–373.1 ms. Moving and settled images were visually
inspected: both pages are vertically clipped inside the backpack; equipment,
return/tome controls and gold remain stationary. All page/console/failed-response
arrays were empty. No production account or save was modified.

`npm run test:hub-ui --prefix frontend` passed 108/108 tests, including the
new red/green transition boundary, all native height branches, 822 sampled
open/back millisecond offsets and shared clip/timer source contracts.
Production TypeScript/Vite/game-host build and lint passed. Final canonical
validation and post-gate browser checks remain the publication gate.

Pre-gate log hashes (raw files are disposable task scratch):
- `browser-baseline.txt`: `9148acb2001e8a7e353e7dbd3f4a2dfdd8081aaa4d04bb684ffad7633097a8ca`.
- `browser-candidate.txt`: `7d6c695543ae7e8c5fd58e501f79a9c5f7cefe4c1f4e0a563d04c86307e998af`.
- `browser-full.txt`: `f43ae81038d515a66d0a1d6220be7e22cef81ec629acdcba093225a3d0e542b7`.
- `browser-touch.txt`: `2d128afa3d46507d7337da435f8dab4cec4dd6ba76630c4efaeb99c5eb20ebdc`.


### Final current-main M2 acceptance and session recovery

The interrupted `d3csbyqe` session had finished canonical and desktop/touch
acceptance on `60ff56395d5f2e77af3ab416d5232c1cf12379e7` but had not published.
Session `dkvcfavl` reused its clean worktree and verified all 7,178 old source
hashes and six stored acceptance-log hashes. No duplicate fix was introduced.
After the separately published report 23 change, the existing commit was
rebased cleanly onto `2905f0606339212bd167b92eee4c9a08b30fe46c`.

Code candidate `14168d69026ddf07a7407bfddbd75bda99b1e330` then passed the complete
`/opt/homebrew/bin/bash ./scripts/validate.sh` gate on M2, followed by fresh
production-build desktop and touch browser journeys. All three recorded exit
codes are zero. The gate included 24 backend/Website contracts, 3,792
frontend/desktop tests, formatting/lint/type/build/media checks, and the full
configured renderer-quality/mutation checks. Its 108 Hub UI tests include the
Sack transition regressions. All 7,179 source hashes matched before and after
acceptance, and the candidate remained clean.

The final 1600x900 journey recorded 26 transitions at 369.7–376.0 ms and 575
moving-frame samples. The 844x390 touch journey recorded six transitions at
368.6–372.6 ms and 132 moving-frame samples. The pre-fix baseline's six
transitions took 1,599.2–1,607.0 ms. The modeled native duration remains 370 ms;
these browser measurements include scheduling and observation boundaries.
Every recorded transition rejected repeated game-back input while moving.
All final page-error, console-error and failed-response arrays were empty.
The full journey retained its expected 12 close / 26 open audio counts.

Both final moving screenshots were visually inspected: page contents travel
vertically within the stationary backpack clip; equipment, gold and outer
controls do not move with the pages. The touch journey used real touchscreen
taps. Empty/nested roots, parent return, companion inventories, item movement,
dyes, belt operations and paused Boneyard inventory passed through the existing
full journey. No production account/save, original artwork, protocol or save
schema was changed. Native evidence is the instruction/data recovery above;
no new clean-stock runtime recording or production deployment is claimed.

Final acceptance completed 2026-09-24T13:39:05Z. Raw execution logs and captures
are disposable task scratch; the following hashes identify the checked result:
- `full-gate-final.txt`: `7ff7bc5878fbae7faf53e9dd21e006534eb098941ac1478b1e95cbaceb41ecd1`.
- `browser-final-full.txt`: `ad1b6404f9fb00eab461deaea9a666a0851f94a783fafc319335ba8f08ed74e8`.
- `browser-final-touch.txt`: `494ed689a810cb55bb9b07121965710eeda0897487e4b79d7b5740c3befe2a80`.
- `candidate-manifest.json`: `bcc97f034f583fae8a3a7176b6c1003992f88564148f0346112dfce1ddcaad0c`.


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
