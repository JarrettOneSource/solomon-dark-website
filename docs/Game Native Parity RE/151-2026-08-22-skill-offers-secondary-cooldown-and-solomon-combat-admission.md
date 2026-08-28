# 2026-08-22 — Skill offers, secondary cooldown, and Solomon combat admission

## Reported smell and parity question

- Reported questions: whether the logic selecting level-up cards matches
  retail, whether ability cooldowns behave exactly like retail, and whether
  player combat remains unavailable until Solomon Dig begins the cycling
  run-away animation.
- Current web observations: the offer builder already implements the recovered
  nine-stage roll; ordinary secondary casts own row timers, StaffCast2, and a
  150-tick common gate; player staff, primary, and category-2 admission
  currently run on every Boneyard tick, including the Dig prelude.
- Reopened earlier cooldown closure: the 2026-08-20 pass recovered concentrated
  Focus but did not make its complete arming-helper bypass a regression member.
  The web branch cleared the selected row yet still armed the common timer.
- Reproduction scenes: deterministic level-up books and seeds; Phasing and
  Teleport with neutral/Focus/concentrated-Focus/class-recharge states; default
  generated Boneyard phases from digging through `SOLOMON RUNS`; a custom Arena
  with no retail Solomon encounter.
- Falsifiers: any eligible row, weighting duplicate, pool phase, or RNG draw
  differs; any ordinary cast lacks its shared action/common timer; a successful
  Focus `75..99` roll arms either cooldown current; a cast is admitted before
  the first run event; primary selection or player movement is sealed; or a
  custom Arena inherits the retail-only gate.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Stock identity | retail Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-22; preferred base `0x00400000` | Same sealed retail oracle used by the progression and Dig reports. | high |
| Existing instructions/catalog | `Mod Loader/docs/reverse-engineering/native-progression-and-skills.md`; offer builder `0x0067CB70`, eligibility helpers, rows `8..81`, private seed `+0x834` | Exact seed ownership, complete eligibility matrix, pool construction, deliberate weighting/duplicates, retry limits, and full-range shuffles are already drained. | high |
| Fresh instructions | `0x00661F40`, `0x0065EDE0`, `0x00656E70`, `0x005D3E10` through a read-only Ghidra replica | Focus values `75..99` return before the complete arming helper; ordinary arming writes row/common currents, recurrence drains them independently, and the presenter chooses the larger visible timer only for rows with authored capacity. | high |
| Fresh instructions | Solomon state bodies `0x0047D450`, `0x0047D570`; trigger dispatcher `0x0068B6D0` | State 2 restores paired control and writes Arena `+0x902A`; only state 3's first positive-motion edge writes state 4 and calls trigger mode 15. | high |
| Preserved clean/live evidence | native skill-offer seed `79225` goldens; `Mod Loader/docs/combat-casting-enable-investigation.md` no-wave cast probe | The native books reproduce their recorded offers. A click is inert before the combat-prelude sequence and latches a cast after it, without requiring enemy spawn. | high-live |
| Current web implementation | `player-progression.ts`, `native-secondary-abilities.ts`, `skill-quickbar.ts`, `game-simulation.ts`, `player-staff-combat-system.ts` and their tests | Offer selection is already structurally complete. The Focus instant branch and Boneyard pre-combat admission are the two observed violations. | high |

## System boundary and membership inventory

Native systems:

1. `Skills_Wizard` actor-private level-up offer construction, from seed and
   complete authored row matrix through displayed order and choice actions.
2. Category-2 input/action/cooldown ownership, including all 23 dispatcher
   members, progression recurrence, concentration/equipment modifiers, HUD,
   reset, and replication.
3. Retail Solomon-to-player-combat admission, from Dig phase through the one
   `SOLOMON RUNS` edge, covering every player combat producer but not movement,
   selection, existing-effect clocks, or custom Arenas.

| Member / branch | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| offer RNG construction and replay | `0x006594E0`, `0x0067CB70`, progression `+0x834` | superseded by 2026-08-27 acquisition-writer closure | builder rebuilds from the stored seed; construction, every acquisition, and reroll replace it |
| ordinary authored rows `8..51`, `53..79` | complete rule matrix and helpers `0x0065E830/0x0065EBA0/0x0065ED00` | `verified-already-at-parity` | catalog eligibility/dependency/unlock tests and paired-RNG offer goldens |
| Spell Welding row `52` and ten synthetic builds | dedicated injection branch in `0x0067CB70` | `verified-already-at-parity` | cadence, learned-pair, prior-build, icon, and apply tests |
| runtime-only Plane Orb `80` and Reserved `81` | scanned then rejected by native material visibility | `out-of-system` (no ordinary selectable material) | neither enters any web pool or consumes an offer draw |
| desired three / Creativity four | screen desired count plus learned row `63` | `verified-already-at-parity` | three/four-card tests |
| category-1/category-2 focus draws | `0x0067CB70` actor-private RNG | `verified-already-at-parity` | exact draw order and threshold fixtures |
| root-priority and weighted general pools | `0x0067CB70` phases 2/3 | `verified-already-at-parity` | root, discipline bias, mana oddity, and full-range shuffle tests |
| forced prefix and learned-skill pruning | `+0x860/+0x864`, `0x0066F840` | `verified-already-at-parity` | forced-three and started/dependent fixtures |
| category-4 uniqueness, category-1 50-collision escape, and exact-ID container uniqueness | fill loop plus selected `Array<int>` in `0x0067CB70` | superseded and exact-ported on 2026-08-25 | 256-seed family sweep plus paired 100-roll duplicate-free fixture |
| attempt-100 append, attempt-200 stop, final full-range shuffle | terminal phases in `0x0067CB70` | `verified-already-at-parity` | source-order contract and deterministic golden offers |
| Sorceror's Charm reroll/save and concentrated Creativity Insight | screen `0x0066F920/0x00671470` | `verified-already-at-parity` | authoritative reroll/save/Insight tests and browser journey |
| all category-2 rows `11,12,15,21,23,27,30,35,41,45,46,48,49,50,51,54,72,73,74,76,77,78,79` | dispatcher `0x0054CC50` | `verified-already-at-parity` except shared Focus bypass below | every member enters its recovered runtime family and semantic edge |
| Phasing row capacity 100 / displayed common 150 | row 15 plus arming/presenter | `verified-already-at-parity` | row clears, common gates, square fan uses 150/150 |
| Teleport row capacity 6,000 / common 150 | row 48 plus arming/presenter | `verified-already-at-parity` | private row survives the common gate and owns the 6,000 fan |
| 21 zero-authored-cooldown rows | category-2 catalog | `verified-already-at-parity` | no invented row timer or fan; common/action gates remain silent |
| ordinary StaffCast2 and Faster Caster | `0x0044B7E0/0x0044B770` | `verified-already-at-parity` | exact float32 51/46-update fixtures and pose ownership |
| Firewalker/Planewalker off, Mindstar, Regenerate, Dampen | dispatcher state/special-action branches | `verified-already-at-parity` | actionless toggle-off/state paths and 73-tick CastSpin tests |
| Focus ordinary recharge and `FX_RECHARGECLASS` | `0x00656E70` | `verified-already-at-parity` | all row currents use the maximum applicable factor; common uses Focus |
| concentrated-Focus values `75..99` | early return in `0x00661F40` | `exact-ported` | accepted action remains; row and global currents both stay zero |
| cooldown replication, rejuvenation, teardown, and HUD | protocol state, Unforge bonus, belt presenter | `verified-already-at-parity` | strict 83-row protocol, category-2 reset, and common/row fan tests |
| Dig phases `digging`, `turning`, `speaking`, `retreat-hold`, `retreat-accelerating` | states 0..3 before positive motion | `exact-ported` | movement and primary selection remain; staff/primary/all secondaries admit no new combat action |
| first state-4 / `SOLOMON RUNS` tick | `0x0047D570 -> 0x0068B6D0(...,15)` | `exact-ported` | the same authoritative tick opens all three player-combat lanes |
| `escaping` and `gone` phases | state 4 and retained run event | `exact-ported` | combat stays enabled after the one monotonic event |
| staff auto-action admission | native player action owner | `exact-ported` | an in-range prelude target cannot create melee/spin; the run edge can |
| primary spell admission | native held/cast action owner | `exact-ported` | prelude input creates no action/emission or mana debit; run-edge input does |
| all 23 category-2 admissions | belt/dispatcher shared gate | `exact-ported` | prelude input creates no cast/fizzle/cooldown/mana edge; run-edge input does |
| movement and category-1 quickbar selection | separate actor movement/selection owners | `verified-already-at-parity` | combat seal preserves both lanes |
| existing action/effect/cooldown clocks | ActorWorld/progression owners | `verified-already-at-parity` | only new admission is sealed; fixed-tick update and teardown continue |
| custom/mod Arena with no retail Solomon encounter | authored mod scene boundary | `out-of-system` (no retail Dig gate) | combat remains immediately available |

There are no `blocked-by-platform` members and no browser approximation.

## Native ownership thread and recovered behavioral contract

- The offer builder owns one deterministic, actor-private reconstruction. UI
  order is its final full-range shuffle; React does not filter or reroll it.
  The 2026-08-27 supersession adds the previously missed upstream rule that
  every accepted skill acquisition replaces the stored seed before a later
  reconstruction.
- Ordinary successful secondaries call the complete arming helper: selected
  row capacity to current, every current strictly below 150 to zero, common
  current to 150. Focus and class recharge drain separate lanes. The
  concentrated-Focus success returns before that helper, so no cooldown current
  changes; StaffCast2 remains a separate action lock.
- The generated Boneyard owns one nullable Solomon encounter. A present
  encounter with `runEventId == 0` seals new player combat. The first positive
  state-3 motion writes state 4 and increments that event; the post-encounter
  combat stage consumes the newly opened gate on the same 100 Hz tick.
- Combat sealing preserves player movement and category-1 selection. It
  suppresses primary held input, category-2 slot input, and staff auto-action
  admission without fizzle, mana, cooldown, RNG, audio, or presentation edges.
- `encounter == null` is an explicit non-member, not an implicit permanent
  lock. Run reset constructs a fresh event-zero encounter; `escaping`/`gone`
  retains the positive event through teardown.

## Nearby-system findings

- `0x0047D450` restoring the dialogue target's controls is not the full combat
  admission edge. Arena `+0x902A` and raw obvious flag writes were insufficient
  in the preserved no-wave probe; the later mode-15 transition remains causal.
- Cooldown capacity is authored skill state, while current cooldown is cast
  state. The browser stores capacities in the replicated secondary player
  projection and may populate the selected capacity on an instant Focus cast,
  but must not invent a current timer.
- Durable native reports updated:
  `native-progression-and-skills.md` and `native-web-combat-lifecycle.md`.

## Confidence and open questions

- Confirmed: complete offer membership/control flow; ordinary and
  concentrated-Focus cooldown instructions; state-3 positive-motion call and
  run-event ordering; current web producer/consumer paths.
- Inferred: the networked authority expresses the native Arena/input handoff as
  one derived `runEventId` gate. This is the existing semantic event already
  proven to own waves and state-4 presentation, not a new timer.
- Unknown: none material to these three questions. Browser timing can represent
  every fixed-tick branch exactly.

## Web implementation consequence

- Leave the level-up offer builder's eligibility/pool phases unchanged; add no
  filter, dedupe, or new RNG stream. The 2026-08-27 supersession corrects the
  separate acquisition-owned seed writer feeding that builder.
- Make concentrated Focus skip the complete cooldown-current arming path while
  retaining the accepted action and authored capacity.
- Derive Boneyard combat admission from the nullable encounter/run event after
  the encounter advances. Use one shared combat-input seal for Hub and the
  retail Dig prelude, plus an explicit staff new-action gate.
- Expose the derived combat state only as a non-authoritative browser diagnostic
  for the real journey; do not add protocol state or a second timer.

## Validation contract

- Automated offer coverage: deterministic goldens, complete rule matrix,
  three/four-card count, focus/pool/forced/welding/pruning/collision/fallback/
  shuffle branches, reroll/save, and Insight.
- Automated cooldown coverage: all 23 rows, 100/6,000/private/common timers,
  zero-row behavior, StaffCast2/Faster Caster, Focus/class recharge, instant
  Focus with both currents zero, HUD, protocol, reset, and teardown.
- Automated combat coverage: every pre-run phase is false; same-tick run edge
  is true; staff, primary, and secondary create no prelude edge; primary and
  secondary admit on the run tick; movement/selection and custom Arenas remain.
- Browser: attempt primary and secondary input while digging and speaking,
  observe unchanged mana/cast/effect state and `data-combat-enabled=false`,
  then observe the first run event flip it true and complete ordinary combat
  with no page, console, protocol, asset, or WebGL errors.
- Canonical gate: `./scripts/validate.sh` on the exact Website tree.

## Implementation validation receipt

- The rebased Website source is current `origin/main` `ba950926` plus this
  focused implementation. A checksum dry run found no differing source files
  between the task-owned Mac Git snapshot and this worktree. The Loader
  evidence tree is current `origin/main` `44b776e8` plus the two report updates.
- The exact Mac Website tree passed `15/15` backend contracts, `4/4` library,
  `43/43` loot, `231/231` prerequisites, `1306/1306` broad runtime,
  `9/9` world-weather, `30/30` party, `11/11` level-up, `7/7` diagnostics,
  `17/17` Hall, `21/21` Hub UI, and `5/5` desktop tests, plus backend build and
  formatting, lint/import boundaries, production frontend/game-host builds,
  media policy, and bundle budget (`397381` raw / `111568` gzip bytes).
  The Loader static suite passed `491/491` on both this machine and the Mac
  history-backed evidence tree.
- Mac acceptance used `Jarretts-Mac-mini.local`, arm64 macOS `26.6.2`, Node
  `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Chrome
  `151.0.7922.170`. The task supplied the production-equivalent generated
  `deployment.json` while running Vite so the concurrently added deployment
  monitor exercised a valid manifest instead of its documented dev-only 404.
  The artifact was removed after the journeys.
- The real generated-Boneyard Chrome journey physically crossed the Gate and
  reached Solomon. Digging ticks `630 -> 740` and speaking ticks
  `6882 -> 6992` each retained mana `100`, primary/secondary cast sequences
  `0`, zero primary/secondary actors, and zero secondary events while
  `data-combat-enabled=false`. The first `runEventId=1` sample reported
  `combatEnabled=true`; the next Fire cast advanced primary sequence `0 -> 1`,
  mana `100 -> 88.8`, and primary actor count `0 -> 9`. The opening held ten
  live enemies plus five pending, and page, console, protocol, asset, and WebGL
  error arrays were empty.
- The Mac SkillPicker journey rendered authoritative IDs `16,21,56` at logical
  centers `600,800,1000`, selected skill `49`, and retained a frozen Hub actor
  X of `950.7400000014901` across 30 distinct WebGL frames at authoritative
  tick `1225`. The complete offer/reroll/save/Insight path and browser errors
  remained green.
- The focused Mac secondary journey cast Phasing `15` and Teleport `48` in
  WebGL2. Phasing emitted one traversal actor and the common-gate square fan;
  Teleport emitted two bursts and its longer row-timer fan. Both exact audio/
  flash families appeared, with empty page and console errors. Automated
  coverage separately proves the concentrated-Focus `75..99` branch leaves
  row and global currents at zero while retaining 51-tick StaffCast2.
- Mac captures: combat
  `/tmp/solomon-skill-offer-cooldown-dig-gate-rebased-clean-mac-combat.png`
  SHA-256 `e010b6b6bd2feae43153b57412cb023a308b52d2b598b2f28035bae1866a48ae`;
  speaking `78eaadc215320d4280c00aec4e1f34c9260c7a37d3de45899a789e49544159c8`;
  picker `678a1f7a2e7174e12f37b32ff2e85dec43a90e8c531cc3867611300fd2133f0f`;
  Phasing `b39d5d9cc55a16b1a4f47504201e6cd1807f3020a515dfe3c912175c541e2eb7`;
  Teleport `71a84ee8b8ea871460fefc8beecbfc8390bd4463940e18db60e40a702c88c8b3`.
- There are no `blocked-by-platform` members or material unknowns. The local
  WSL WebGL diagnostic timed out before renderer readiness, while the Mac
  exact-tree journeys were decisive. No push, deployment, production restart,
  or remote project-branch mutation was performed.
