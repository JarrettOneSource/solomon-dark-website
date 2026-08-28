# 2026-08-23 — Category-2 cooldown/HUD and Golem mana correction, third reopen

## Reported smell and parity question

- Reported web behavior: invoking right-click abilities does not put their HUD
  icons under a cooldown overlay and does not visibly prevent immediate reuse.
  Raise Golem's mana cost also needs verification.
- Stock behavior to recover: the actor-private skill row and common progression
  timer jointly reject recasts and drive `BeltButton::Present`'s dark-red square
  fan. Raise Golem uses the stock composite mana resolver.
- Reproduction: cast every learned category-2 row from all eight belt slots in
  a live Boneyard, release and press again during/after the boundary, and
  observe the authoritative snapshot plus icon fan. Measure Golem from accepted
  cast through row zero against wall time.
- Falsifiers: positive non-CFG row capacities refute the existing
  `v.mCooldown ?? 0` implementation; a web host cadence other than 100 updates
  per elapsed second refutes direct tick-to-second parity; a rank-zero Iron
  Golem property read refutes the web's unlearned-row-to-zero shortcut.

This is a process-failure reopen. The 2026-08-20 pass followed only the two CFG
`mCooldown` members, Phasing and Teleport. It did not sweep the 21 hard-coded
category-2 capacity writes in the shared `Skills_Wizard` constructor, even
though the full raw progression-book fixtures were already extractable. The
CFG absence was then propagated into simulation and HUD as capacity zero.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact canonical binary used for every instruction/static-data result below. | high |
| Instructions/static data | `Skills_Wizard 0x00674EE0`; direct floats `0x00786C18`, `0x0078CC68`, `0x00785CF0`, `0x007A0CCC`, `0x00784CF8`, `0x007A0CC8`, `0x007A0CC4`, `0x007A0CC0`, `0x007A0CBC`, `0x00786C08` | Constructor writes positive fixed capacities for all 21 non-ranked category-2 rows: 2500/625/2000/1875/50/1250/277/3750/833/10000 ticks. | high |
| Instructions | refresh `0x00661530` | Phasing/Teleport replace their constructor defaults with `mCooldown[effectiveRank]*100`; new capacity clamps current with `min(oldCurrent,newCapacity)`. | high |
| Instructions | belt `0x005D5600`; dispatcher `0x0054CC50`; arming `0x00661F40 -> 0x0065EDE0`; recurrence `0x00656E70` | True dispatcher return arms selected capacity and common 150, clearing currents below 150. Firewalker-off, Mindstar, and Regenerate return false. Recharge subtracts Focus/category factor once per fixed update. | high |
| Instructions | `BeltButton::Present 0x005D3E10` | Positive selected capacity admits drawing; max(row current, common current) selects numerator and the matching row/common capacity selects denominator. | high |
| Raw runtime state | Mod Loader `tests/fixtures/webgame/class-loadout-goldens.json`, 15 byte-authenticated 83 x 0x70 books | Every fixed capacity matches the constructor; Raise Golem row 45 is `0x451C4000 = 2500.0` even in unlearned books. Supporting loader capture, not clean-stock visual evidence. | high |
| Instructions/config | dispatcher case 45 around `0x0054E4E0..0x0054E4F7`; cache resolver `0x006741B0`; property path `0x005290F0 -> 0x0065D540`; cost resolver `0x006600F0`; Raise/Iron CFG arrays | Stock sums raw Raise Golem and Iron Golem costs before one skill-45 modifier pass. Rank zero is indexed normally; Iron Golem row zero is 50. | high |
| Web clock | `PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS=0.01`; `GAME_FIXED_TICK_SECONDS`; host deadline accumulator | Host schedules the authoritative simulation at 100 Hz independently of 20-Hz snapshots/browser frames; lag drops time and can lengthen, not shorten, a cooldown. | high |

Reusable native detail is recorded in Mod Loader
`docs/reverse-engineering/native-secondary-cooldown-and-golem-mana-2026-08-23.md`
and the corrected secondary catalog.

## System boundary and membership inventory

Native system: actor-private category-2 row capacity/current, progression-wide
current/capacity, dispatcher success edge, fixed-update recharge/reset, belt
recast gate, square-fan presenter, and the three composite secondary mana
branches. World-actor lifetimes after an accepted cast remain in the existing
right-click presentation entry.

| Member | Native capacity and accepted branch | Disposition | Proof |
| --- | --- | --- | --- |
| 11 Call Leviathan | 833 ticks / 8.33 s | exact-ported | full-table + arm/recast/HUD tests |
| 12 Planewalker | 2500 / 25 s on both toggle edges | exact-ported | toggle-on/off row test |
| 15 Phasing | rank 1 row 100 clears under common 150 / 1.5 s | exact-ported | ranked clamp/common-fan test |
| 21 Ring of Fire | 2500 / 25 s | exact-ported | full-table + arm/recast/HUD tests |
| 23 Firewalker | cap 50; on shows common 150 / 1.5 s; off returns false | exact-ported | separate on/off branch test |
| 27 Magic Storm | 1250 / 12.5 s; raw 27+28 cost gets one 27 resolver | exact-ported | table, gate, aggregate-cost test |
| 30 Prismatic Shock | 1250 / 12.5 s | exact-ported | full-table + arm/recast/HUD tests |
| 35 Ring of Ice | 2500 / 25 s | exact-ported | full-table + arm/recast/HUD tests |
| 41 Earthquake | 2500 / 25 s | exact-ported | full-table + arm/recast/HUD tests |
| 45 Raise Golem | 2500 / 25 s; rank-one raw cost 10+50=60; non-offensive row | exact-ported | table, wall-clock and composite-cost tests |
| 46 Stoneskin | 10000 / 100 s | exact-ported | full-table + arm/recast/HUD tests |
| 48 Teleport | ranked 6000/3000/1500/1000/500/400/300/100; final rank uses common 150 | exact-ported | every-rank capacity/clamp test |
| 49 Magic Circle | 2500 / 25 s | exact-ported | full-table + arm/recast/HUD tests |
| 50 Magic Trap | 625 / 6.25 s | exact-ported | full-table + arm/recast/HUD tests |
| 51 Dampen | 2000 / 20 s plus independent CastSpin | exact-ported | full-table + action/recast test |
| 54 Magic Shield | 2500 / 25 s; raw 54+55 cost gets one 54 resolver | exact-ported | table, gate, aggregate-cost test |
| 72 Acid Rain | 2500 / 25 s | exact-ported | full-table + arm/recast/HUD tests |
| 73 Fire Wall | 277 / 2.77 s | exact-ported | full-table + arm/recast/HUD tests |
| 74 Ether Drain | 3750 / 37.5 s | exact-ported | full-table + arm/recast/HUD tests |
| 76 Call Comet | 1250 / 12.5 s | exact-ported | full-table + arm/recast/HUD tests |
| 77 Turn Undead | 1875 / 18.75 s | exact-ported | full-table + arm/recast/HUD tests |
| 78 Mindstar | cap 50 exists; dispatcher returns false, no arm/action/fan | verified-already-at-parity | actionless toggle test plus synchronized cap |
| 79 Regenerate | cap 50 exists; dispatcher returns false, no arm/action/fan | verified-already-at-parity | actionless toggle test plus synchronized cap |
| Common gate | 150 ticks / 1.5 s at `0x0078489C` | exact-ported | fixed-clock/gate test |
| Concentrated Focus | values 75..99 skip the entire arming helper | verified-already-at-parity | deterministic RNG test retained |
| Focus/category recharge | per-update max factor; global uses Focus factor | verified-already-at-parity | multi-row decrement test retained |
| Full rejuvenation | clears global and all category-2 currents, not capacities | verified-already-at-parity | economy reset test retained |
| Rank refresh | only Phasing/Teleport capacity changes; current clamps down | exact-ported | dynamic-capacity refresh test |
| Death/disconnect/world teardown | removes owner-private current/cap/toggles | verified-already-at-parity | owner teardown tests retained |
| 100-Hz authoritative clock | 0.01 s per cooldown update; 20-Hz snapshot is presentation only | verified-already-at-parity | host constants plus measured Mac journey |

No member is blocked by the browser platform. SVG represents the exact native
53 x 53 square fan and the authoritative timer is host-owned.

## Native ownership and recovered behavioral contract

- Construction: `0x00674EE0` writes every fixed row cap before registering
  positive-cap rows for recurrence. `0x00661530` owns the two rank overrides.
- Input/gate: `0x005D5600` checks pause, player no-interrupt, global current,
  and selected row current. Only row-current rejection requests the unavailable
  sound; action/global rejection is silent.
- Arming: a true dispatcher result calls `0x00661F40`; absent the Focus skip,
  `0x0065EDE0` copies selected cap to current, clears every current strictly
  below 150, and copies common cap 150 to common current.
- Update: at 100 Hz, each row current loses
  `max(globalFocusRecharge, categoryEquipmentRecharge)` and common loses the
  Focus factor. Both clamp at zero. Browser rendering and 20-Hz snapshots do
  not advance either clock.
- Presentation: a positive row capacity gates the fan. Row current wins ties
  against common; otherwise common supplies both numerator and denominator.
  The already-recovered dark-red square geometry is retained.
- Reset: Unforge full rejuvenation clears global plus category-2 currents;
  Focus may skip arming; dynamic rank refresh clamps; owner removal destroys
  state. None of those paths erase the constructor table itself.
- Golem mana: effective Raise Golem rank indexes `[8,10,20,...,100]`; Iron
  Golem rank zero indexes 50. Invokable ranks 1..9 cost raw 60..140 and ranks
  10..12 cost 150 before one skill-45 modifier pass. The row is not
  Battle-Mage/offensive flagged. Learning Iron Golem adds reflection but not a
  new cost component.
- Sibling aggregate correction: Magic Storm + Magic Tornado and Magic Shield +
  Explosive Shield also sum raw operands before one base-skill resolver. A
  flat reduction or class-specific equipment modifier proves separate
  resolution is observably wrong.

## Web implementation consequence

- Synchronize all 23 authoritative capacity rows from the native constructor
  table and the two rank overrides, clamping dynamic current on refresh.
- Arm from synchronized selected capacity, including Planewalker-off and
  Firewalker-on. Retain dispatcher-false Firewalker-off/Mindstar/Regenerate.
- Preserve the existing common clearing, Focus roll, recharge, reset,
  protocol, square-sector geometry, and snapshot ownership.
- Sum raw aggregate mana operands first and call the cost resolver once. Golem
  must read Iron Golem's rank-zero authored value rather than turning an
  unlearned row into zero.
- No browser approximation or fallback is required.

## Validation contract

- Focused contracts enumerate exact maximum/current/global results for all 23
  rows, every Teleport rank, Phasing, all toggle success/false edges, rank
  clamp, reset, Focus/category recharge, repeated rejection, and square-fan
  common/row selection.
- Composite-cost contracts cover Golem 60 MP at rank one, the 58 raw rank-zero
  resolver input, ranks 10..12 clamp, learned/unlearned Iron equality, and one
  modifier application for all three aggregate siblings.
- Mac timing proof measures snapshot tick and monotonic wall time across a live
  neutral Golem cooldown: 2500 authoritative ticks must span about 25 seconds,
  a recast before zero must be rejected, and a post-zero recast accepted.
- Mac browser proof captures the Golem icon at full, partial, and zero fan,
  checks the live accessible remaining time, verifies MP debit, and records
  empty page/console/failed-response arrays.

## Implementation validation receipt

- Implementation: `native-secondary-abilities.ts` now owns the complete
  constructor-capacity table and the Phasing/Teleport rank refresh. Every
  authoritative player synchronizes all 23 maxima, clamps ranked currents,
  decrements them on the 100-Hz host clock, arms accepted dispatcher branches,
  and publishes the existing protocol fields consumed by `SkillQuickbar`.
  Aggregate Storm/Golem/Shield mana operands stay raw until one base-skill
  resolver call; Golem reads Iron Golem rank zero as 50.
- Regressions: the native-secondary suite enumerates every constructor and
  effective capacity, every accepted/dispatcher-false arming result, all eight
  Teleport ranks, rank-current clamping, common/row rejection, Planewalker and
  Firewalker toggle asymmetry, Focus/rejuvenation behavior, exact Golem costs,
  and 2,500 neutral Golem updates. The HUD contract covers long-row and
  short-row/common fan selection. Host-clock coverage pins `GAME_TICK_RATE=100`
  and `2500/100=25` seconds.
- Native Mac gate: `python3 tests/re/run_static_re_tests.py --ci`, final
  candidate, `493/493` pass. The new catalog contract pins all 23 capacities,
  the shared clock/gate/reset owners, and the three raw aggregate-cost rows.
- Website Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh`, final
  candidate, exit zero. Backend build has zero warnings/errors; Python
  contracts `17/17`; frontend groups pass `4`, `44`, `239`, `1,386`, `60`,
  `9`, `43`, `11`, `7`, `33`, `21`, and `5` tests with zero failures; desktop,
  lint/boundaries, TypeScript, production build, game-host build, and media
  policy pass. Production `Game-DIJyE92N.js` is `435,117` raw / `122,515`
  gzip under `524,288` / `131,072` budgets.
- Built Chrome/WebGL2 Golem receipt:
  `/Users/jarrett/codex-acceptance/right-click-cooldown-20260823/evidence/golem-timing-receipt.json`.
  The first accepted cast records cap `2500`, row `2497`, common `147`, and a
  square-fan path; the half-time recast is rejected and the first post-zero
  recast accepted. Cooldown zero is exactly tick `4556` after cast event tick
  `2056`: `2500` ticks over `25,048.728583 ms`. Browser MP moves `100 -> 40.4`
  after intervening recovery updates, a `59.6` net drop consistent with the
  exact 60-MP kernel debit. Full/half/zero screenshots are retained beside the
  receipt. Page, console, and failed-response arrays are empty.
- Built Chrome/WebGL2 membership receipt:
  `/Users/jarrett/codex-acceptance/right-click-cooldown-20260823/evidence/all-cooldowns-receipt.json`.
  It contains all 23 normal pointer casts in an authentic active Boneyard with
  stabilized initial stock enemies. IDs 11..77 each publish their exact
  capacity/current/common values and a square-fan path; Phasing and Firewalker
  use the common fan; Mindstar/Regenerate publish cap 50 but row/common zero and
  no path. All 23 preserve native VFX-kind, audio, flash, and teardown checks.
  Page, console, and failed-response arrays are empty.
- Failed acceptance attempts were harness evidence, not shipped fallbacks:
  Fete of Clay could not measure neutral Golem cost; the later snapshot was not
  the cast-tick clock owner; the full combat sweep reached an unrelated
  BadGuys-401..405 wave renderer; and removing the wave owner retired the
  session. The final receipts instead use a single/no-set Golem, authoritative
  event-tick anchoring, and a live wave with initial enemies stabilized at high
  HP. Product mechanics were not weakened to make the proof pass.
- No `blocked-by-platform` member and no remaining cooldown/mana unknown.
  Changes remain uncommitted in the isolated task worktrees; nothing is pushed
  or deployed.
