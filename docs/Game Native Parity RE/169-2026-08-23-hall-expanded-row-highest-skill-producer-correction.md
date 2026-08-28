# 2026-08-23 — Hall expanded-row highest-skill producer correction

## Reported smell and parity question

- Reported production behavior: opening `HALL of FAME` and expanding a row
  throws `RangeError: unknown native skill root null` from
  `skill-picker-render-contract`, replacing `/game` with React Router's
  application error page. The supplied production stack names
  `skill-picker-render-contract-B77jS0Bz.js` and `Game-DR-fDRj2.js`.
- Trigger: any stored Hall row whose `highestSkills` contains an element or
  discipline root (`0..7`). The expanded row calls
  `skillPickerRootTint(nativeSkillRoot(skillId))`; the dependency-rule lookup
  intentionally returns `null` for a root row, and the tint contract throws.
- Stock question: whether `HallOfFameBox` includes root rows in its three
  highest skills, and, independently, how the stock renderer colours any root
  row it is given.
- Falsifiers: a native selection filter that admits roots; a non-strict rank
  comparison that reorders ties; a root colour path that does not resolve to
  the row itself; or a clean level-one Hall row that shows root icons instead
  of the two starting public skills.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production report | user-supplied `solomondarker.com` stack and exact Hall-row expansion trigger, 2026-08-23 | the failure is synchronous render-time input `root = null`, not an async board-load or asset failure | high-live |
| Current web causal trace | Website `origin/main` `31bd858d` (Hall files unchanged from `70b935e0`); `completedHallOfFameEntry`, `HallOfFameScene`, `nativeSkillRoot`, `skillPickerRootTint` | the recorder sorts every positive `progression.learnedSkills` row, including roots; the Hall renderer assumes the result is a descendant row | high |
| Native instructions | retail `SolomonDark.exe` Beta 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `HallOfFameBox` constructor `0x005A13A0`, selection `0x005A2210..0x005A22F3` | three slots `+0x88/+0x8C/+0x90` scan only `Skills_Wizard +0x850/+0x854`, skip prior winners, and replace on strict greater permanent rank from row `+0x22`; ties retain list order | high-instruction |
| Native colour path | `Skills_Wizard::vftable +0x90 -> 0x00660CE0`; constructor `0x00674EE0`; row root field `+0x1C` | root rows `0..7` point to themselves, descendants point to their owner, Plane Orb `80` points to Ether; all map through the eight native root colours | high-instruction |
| Clean stock | unmodified retail PID 1856, `C:\Users\User\AppData\Local\Temp\solomon-hall-20260822\04-hall-expanded.png`, 2026-08-22 | level-one Ether/Mind row shows Magic Missile `8`, Call Leviathan `11`, and one empty frame; it does not show element/discipline roots | high-live |
| Existing durable evidence | Mod Loader `docs/reverse-engineering/native-skill-screen-and-quickbar.md` and corrected `native-hall-of-fame-and-memoratorium.md` | `+0x850/+0x854` is the ordered learned/visible public-skill list used by the Skill Screen; the Hall now documents both its selection producer and colour consumer | high |

## System boundary and membership inventory

Native system: `HallOfFameBox`'s three-slot highest-skill projection and the
per-row root-colour lookup used by the expanded Hall renderer. Layout, score,
portrait, perks, kills, board ranking, and scroll remain adjacent consumers
but are not changed.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| destination slots 0, 1, 2 | entry `+0x88/+0x8C/+0x90` | exact-ported | focused projection test covers three winners and fewer-than-three empty tail |
| ordered scan and duplicate suppression | `0x005A2210..0x005A22F3` | exact-ported | public learned order is scanned once per slot; selected ids are skipped |
| strict higher-rank replacement | `CMP/JLE` at `0x005A2295..0x005A2299` | exact-ported | equal-rank regression preserves acquisition order |
| element roots `0..4` | rank table only; root row `+0x1C = self` | exact-ported | excluded from new Hall projection; historical web rows render with their native self tint |
| discipline roots `5..7` | same | exact-ported | same |
| public learned rows `8..79` | ordered `+0x850/+0x854` membership | exact-ported | projection consumes protocol `learnedSkillOrder`; every id already has an extracted root rule |
| Plane Orb `80` | runtime-only row, root `0` | exact-ported | excluded from new projection; retained renderer coverage uses Ether tint for a historical/runtime row |
| Reserved `81` and row-82 storage pad | no public learned-list membership | out-of-system — neither can enter a valid native Hall selection | existing 82-row ledger plus protocol learned-order range `8..79` |
| empty destination | native id `-1`, Inventory frame only | verified-already-at-parity | existing `HallSkillCell(null)` and row-render smoke |
| local completed-run producer | serialized player skill system | exact-ported | `completedHallOfFameEntry` reads the host snapshot's ordered public membership and permanent ranks |
| signed global receipt producer | same host-owned completed entry | exact-ported | receipt seals the corrected projection; no browser-selected replacement list |
| pre-correction local/global rows containing roots | Website-only durable data emitted by the faulty producer | out-of-system legacy input, rendered through the exact native row-colour path rather than discarded | browser smoke seeds roots, expands the row, and requires zero page/console errors |
| Local and Global expanded-row scenes | shared `HallOfFameScene` | exact-ported | both scopes use the same cell renderer; browser journey covers local legacy input and the shared render contract |
| perk grid, kills box, portrait, score, board order, row geometry, scroll | other members of `HallOfFameBox` | verified-already-at-parity | 2026-08-20/22 Hall closures; unchanged by this projection fix |

No member is blocked by the browser platform.

## Native ownership thread

- `HallOfFameBox` load constructs a `Skills_Wizard`, deserializes the archived
  wizard, initializes the three destination fields to `-1`, and derives the
  display projection. The archive does not persist a browser-authored list.
- The ordered source is `Skills_Wizard +0x850/+0x854`, the same public learned
  membership used to construct Skill Screen pages. Roots have ranks but are
  absent from this list; public skills are present in acquisition order.
- For each of three slots, the constructor starts `bestRank = 0`, scans the
  full ordered source, ignores ids already chosen, and accepts only a strict
  rank increase. The result is descending permanent rank with learned-list
  order as the tie breaker; fewer than three positive public rows leave `-1`.
- Render `0x005A2C80` resolves the selected row's colour through virtual slot
  `+0x90`, then draws tinted Skills `164`, icon `27 + id`, badge/rank, and the
  Inventory frame. Row colour ownership is independent of selection
  membership, so roots have a defined self colour even though selection
  excludes them.
- The projection is rebuilt when Hall entries are materialized. Expanded-row
  toggling changes only presentation state; closing the Hall tears down the
  materialized views and owns no gameplay mutation.

## Nearby-system findings

- The protocol already carries the exact native source needed by the Hall:
  `learnedSkillOrder` is bounded to unique learned public ids `8..79`, while
  `learnedSkills` is an id-sorted rank table that also contains roots. The
  previous producer chose the wrong sibling representation.
- The 2026-08-22 Hall pass extracted the renderer but not its three-field
  producer. Calling those fields `exact-ported` was therefore premature; the
  skipped rule was the upstream ownership/producer trace. The corrected native
  report now records `0x005A2210..0x005A22F3` and `0x00660CE0`.

## Web implementation consequence

- `completedHallOfFameEntry` projects only `learnedSkillOrder`, joins permanent
  ranks from `learnedSkills`, and performs the native stable top-three
  selection. Root ranks no longer enter newly stored local rows or signed
  global receipts.
- `nativeSkillColorRoot` represents the separate native colour contract:
  roots return themselves, descendants use the existing authored root map,
  and Plane Orb keeps Ether root `0`. `HallSkillCell` uses this colour owner,
  so already-persisted root rows remain viewable instead of crashing.
- No catch, guessed tint, default colour, schema shim, or row-specific Hall
  exception is added. The dependency root and render-colour root remain
  distinct concepts.

## Validation contract

- Focused Mac test: a production-shaped level-one snapshot containing root
  ranks plus starting public rows must record `[8, 11]`, not `[0, 6, 8]`;
  unequal ranks and equal-rank acquisition order must both match the native
  three-pass algorithm.
- Complete colour membership test: root rows `0..7`, descendants `8..79`, and
  Plane Orb `80` resolve to one of the eight extracted tints; Reserved `81`
  and row `82` remain outside the Hall renderer contract.
- Mac Playwright journey: seed a pre-correction local row containing roots,
  open Hall, expand that exact row, verify all three skill cells and native
  root tints, continue scrolling/scope switching, and require empty
  `pageErrors`, `consoleErrors`, and unexpected failed responses.
- Exact candidate on the Mac mini: focused `test:hall`, the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, and the Hall browser journey.
  Stock comparison retains the level-one `8`, `11`, empty membership and the
  already-settled expanded-row geometry.

## Implementation validation receipt

- Deterministic red, Mac base `70b935e0`, worktree
  `/Users/jarrett/codex-acceptance/hall-skill-root-20260823.yG1quh/website`:
  focused Hall tests failed exactly `2/34` — the general projection selected
  root `0` over public skill `8`, and the level-one fixture produced
  `[0,6,8]` instead of `[8,11]`. The browser journey reached the first
  expanded row, then expanding the root-bearing row emitted the reported
  `RangeError: unknown native skill root null` from `HallSkillCell`, recorded
  six React/Router console errors, and failed its expansion wait.
- Candidate: Website `31bd858d` plus the seven-file Hall patch in
  `/Users/jarrett/codex-acceptance/hall-skill-candidate-20260823.KZiKYY/website`.
  Local/Mac SHA-256 manifests were byte-identical before validation.
- Focused Mac `npm run -s test:hall`: `36/36`, including level-one root
  exclusion, strict top-three/tie order, all colour rows `0..80`, empty slots,
  scoring, storage, and signed receipt coverage.
- Mac Chrome journey, `1600x900`, system Chrome, source server on task-owned
  port `5199`: ten screenshots; legacy row ids `[0,6,8]`; computed tints
  `#FFE5FF/#CBD8FF/#FFE5FF`; row scroll, Local/Global switching, expected dev
  errors, and Main Menu return all completed. `pageErrors=0`,
  `consoleErrors=0`, unexpected failed responses `0`, failure `null`.
  Reviewed scrolled-frame SHA-256:
  `b14e921c53afdfc8cf806ac64aa793f9765cb88f2910da5585120f5fa4750725`.
- Full Mac `/opt/homebrew/bin/bash ./scripts/validate.sh`: exit `0`; backend
  build/integration and formatting, frontend lint/architecture (zero errors,
  eight pre-existing Fast Refresh warnings), every test group, production
  TypeScript/Vite/game-host build, bundle budget
  `122590 <= 131072` gzip bytes, and media policy passed. The exact-tree rerun
  after this receipt was added also passed.
- Corrected Mod Loader report was transferred byte-identically to
  `/Users/jarrett/codex-acceptance/hall-skill-native-re-20260823.z4DZyv/mod-loader`;
  `python3 tests/re/run_static_re_tests.py --ci` passed `494/494` on the Mac.
- Task-owned dev servers and browser processes exited through their exact
  launch owners. The three task acceptance worktrees and their red/green
  evidence remain because push/publication was not authorized. Commit, push,
  and deploy: none.
