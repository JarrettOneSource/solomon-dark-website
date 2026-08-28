# 2026-08-20 — Hall of Fame, Website-global leaderboards, and reopened Memoratorium

> **2026-08-22 row-presentation reopening.** This pass dispositioned "three
> Highest Skills", "3-by-3 Perks Used", and the collapsed row as
> `exact-ported` while the Website rendered `S12 · 3` text, raw perk numbers,
> DOM headings, and a `1.6x` portrait with no native basis. The skipped rule was
> "extract the truth whenever extractable": `HallOfFameBox::Render`
> (`0x005A2C80`) was never decompiled or captured for its draw contract. The
> reopening below recovers the full row draw contract and re-ports the whole
> row system; see
> [2026-08-22 — Hall of Fame row presentation reopening](164-2026-08-22-hall-of-fame-row-presentation-reopening.md).

> **2026-08-21 authority reopening.** The first Website-global pass closed
> score calculation at the authoritative host, but then let the browser rebuild
> the completed row and submit every statistic directly. JWT identity, bounds,
> and account/run idempotency did not prove that the admitted account completed
> that run on our server. The earlier membership sweep stopped downstream of
> the snapshot and skipped admission identity, score provenance, cheat-mode
> transitions, resumed-save provenance, and API verification. This reopening replaces that incomplete
> trust boundary across the whole global-submission path; local Hall history is
> intentionally unaffected.

> **2026-08-24 client-held save provenance verification.** A security review
> asked whether an editable anonymous/local save could reach the Website-global
> boards and whether cloud saving requires an account. The prior authority pass
> already made every client-held save ineligible by testing the presence of the
> save document at the authoritative host, independently of its editable
> `integrity` member, and the cloud slot already requires JWT authentication.
> Its proof matrix did not separately exercise a profile supplied with
> `saveIntent: 'new-game'`, a forged `global-clean` local document admitted to
> the real global-Hub branch, or unauthenticated cloud read/delete. This pass
> closes those missing proof members without weakening the conservative rule:
> neither anonymous local saves nor account cloud saves can restore global
> eligibility once any client-held document has been loaded.

## Reported smell and parity question

- Reported web behavior: the stock-styled `HALL of FAME` main-menu control has
  no action, no local record surface, and no Website-global ranking source.
  The Memoratorium room was also reported as incorrect after its earlier
  private-room parity pass.
- Stock behavior to recover: the complete Hall controller/collection/row
  lifecycle and the complete ordinary Memoratorium compositor, including all
  lateral persisted-record, portrait, marker, and post-run branches.
- Reproduction inputs/scenes: pristine Hall, retail-distribution populated
  `halloffame.dat`, collapsed/expanded survival row, Main Menu close, normal
  new-game Mortuary, and the browser's 1600-by-900 root/Hall/Mortuary route.
- Falsifiable questions: whether retail's dormant `Social/Leaderboard` types
  actually feed the Hall; whether Hall rank is wave, time, kills, or the
  rendered Awesomeness field; and whether the prior room pass drained every
  normally selected Memoratorium record.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | retail executable SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, direct unmodded PID `18232`, preferred base `0x00400000` | populated row renders rank, wizard, name, level/discipline, Awesomeness, and all expanded survival details; sample is 17 kills / 91 Awesomeness | high |
| Clean stock | committed pristine `hall-of-fame.png` and layout fixture | empty is a valid Hall state; frame/title/Main Menu geometry is exact at 1600-by-900 | high |
| Instructions | Hall vtables `0x00799334` / `0x00799264`; `0x00598120`, `0x005A07A0`, `0x00589CD0`, `0x00589DB0`, `0x005A13A0`, `0x00589DD0`, `0x005981A0`, `0x005A2C80` | outer lifetime, descending Awesomeness insertion with later-loaded equal scores first, 100-row cap, row toggle, render branches, and one-second close are owned by Hall/HallBox | high |
| Instructions | archive `0x005BC400`; shared post-contact callback `0x0063E7D0`; counters `0x005C9430`, `0x005C94E0`; maximum/name writer `0x005C9F40`; potion reset `0x005CB810` | kills and Awesomeness are independent authoritative Game counters; accepted lethal contact writes maximum bonus, then XP, then kill/base score before the later death presenter | high |
| Instructions | Region pulse `0x0063EEB0` / `0x0063EFC0`; all ten direct callsites in the eight ordinary death presenters | the score gate and Arena world pulse share one accumulator; all web enemy families have a recovered request sequence | high |
| Instructions | Game clock increment `0x0063F223..0x0063F228`; Player death tick-300 call `0x00533DCF..0x00533DE0`; archive pose `0x005BC437..0x005BC4B8` | Time includes Hub and the three-second death tail; the row serializes a temporary `115..245` degree heading and `0.85..1.0` scale from three native RNG words | high |
| Instructions | Social block `0x00B40600..0x00B40654`; `0x004452B0`, `0x00445480` | shipped generic Leaderboard/HighScore loader reads `social\\` files but has no Hall xref and no shipped data | high |
| Instructions | `Mortuary::Present 0x0050EAC0`, instructions `0x0050F45C..0x0050F5E5` | Memoratorium record 5 at singleton `+0x40C` is submitted three times at `(512,507)` after actors/effects | high |
| Asset/data | `Memoratorium.bundle` records `0..75`; registered record 5 | record 5 is an exact `71 x 54` white memorial-glow sprite; the web extractor and manifest omitted it | high |
| Existing runtime | prior normal Mortuary captures and private-room tests | record 0, ten filled paintings/six urns, record-27 marker, 16 headings, 50 flames, collision, camera, and transition are already at parity | high |
| Current web causal trace | Website `17d69dd`; `HallOfFameRunRecorder`, `MainMenuScene`, `Game.tsx`, `api.ts`, and `GameLeaderboardEndpoints.cs` | the host snapshot is authoritative, but the browser chooses every submitted field and the API accepts it after JWT/range checks; no host or supervisor proof reaches the API | high |

The Ghidra work followed the `ghidra-binary-analysis` read-only workflow. The
populated Hall observation used the retail executable directly; injected menu
fixtures are supporting layout evidence, not the clean-stock behavior source.

## System boundary and membership inventory

Native system: `HallOfFame` / `HallOfFameBox` owns local memorial records and
their front-end presentation; Website leaderboard storage/query is an explicit
global extension using the same record vocabulary. `Mortuary::Present` is a
second consumer boundary reopened only for the complete ordinary Memoratorium
composition and its reachable branch dispositions.

### Hall, record, and Website-global membership

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| outer Hall construction/layout | `0x00598120`, `0x005A07A0`, vtable `0x00799334` | exact-ported | Hall scene/frame journey |
| pristine empty collection | clean fixture | exact-ported | empty-state component/browser assertion |
| descending Awesomeness order and newest-first equal scores | `0x005A13A0`, instructions `0x005A25F0..0x005A266D` | exact-ported | domain and API ordering tests |
| 100-entry local cap | `0x005A13A0` | exact-ported | local-store cap test |
| collapsed rank/wizard/name/level/discipline/Awesomeness row | `0x005A2C80` | exact-ported | component contract and browser pixels |
| all 15 element/discipline class titles | lookup `0x00658B40` | exact-ported | complete table assertion |
| row expand/collapse and scroll extent | `0x005981A0`, `0x00589DD0` | exact-ported | interaction journey |
| survival Time/Wave details | `0x005A2C80` | exact-ported | expanded-row test |
| three Highest Skills | `0x005A2C80`, offsets `+0x88..+0x90` | exact-ported | expanded-row test |
| Monsters Killed / Awesomest Kill | `0x005A2C80` | exact-ported | recorder and expanded-row test |
| independent kill and Awesomeness counters | `0x005C9430`, `0x005C94E0`, `0x0063E7D0` | exact-ported | authoritative simulation/snapshot tests |
| binary Region-pulse score gate | `0x005C9515..0x005C9537`; doubles `0.5` and `0.1` | exact-ported | threshold and decay/impulse tests |
| negative-health triple and below-10-percent double | `0x005C9560..0x005C95A5` | exact-ported | score-kernel boundary tests |
| level-scaled streak multiplier, capped 1..5 | `0x005C95A5..0x005C95DE` | exact-ported | per-boundary score tests |
| potion resets streak before applying its effect | `0x0056D1B0 -> 0x005CB810` | exact-ported | accepted consume test and score-kernel reset test |
| new-maximum-health bonus `71 + Integer(5)*level` | `0x005C9F40` | exact-ported | deterministic Game-RNG tests |
| exact web-roster awesomest-kill variants, including Coffin poison-payload split | `0x005C9F40`, actor fields populated by `0x00462790` | exact-ported | every family/variant name test |
| all ordinary family pulse requests, including split Imp and double Wraith | ten xrefs to `0x0063EEB0` | exact-ported shared with renderer | per-output pulse membership test; current death affects later scores only |
| Game-wide Time and death-tick-300 archive | `0x0063F223..0x0063F228`, `0x00533DCF..0x00533DE0` | exact-ported | Hub-clock, archive-edge, and immutable elapsed snapshot tests |
| archive portrait heading `180+Float(65,signed)` and scale `0.85+Float(0.15)` | `0x005BC437..0x005BC4B8` | exact-ported | exact native RNG/pose and protocol/API range tests |
| story-boast final score multiplier `trunc(score*1.1)` | `0x005BC57E..0x005BC5C5` | out-of-system — ordinary Website survival has no Annalist boast producer | explicit story branch disposition |
| 3-by-3 Perks Used | `0x005A2C80` | exact-ported | expanded-row test |
| story boast failed/succeeded/not-accomplished branch | `0x005A2C80` | out-of-system — Website exposes the rebuilt survival Boneyard loop, not stock story campaigns/boasts | no browser producer exists |
| serialized wizard visual | Hall row wizard object/render call | exact-ported | entry stores element/heading and uses extracted player layers |
| Main Menu close gate and one-second linear close | `0x00589DB0`, `0x00589CD0` | exact-ported | lifecycle timer/browser journey |
| native `halloffame.dat` and raw portrait import | `0x005A13A0`, `0x005BC400`, `0x005BED10` | out-of-system — native import/export remains the separately declared save-compatibility product boundary | web records are normalized, not native-file claims |
| guest local history | native process-local profile analogue | exact-ported | local store test/browser journey |
| authenticated global submission | Website extension | exact-ported | admitted account id is sealed into a host-signed receipt and checked against the submitting JWT |
| server-authoritative global provenance | Website host/supervisor extension | exact-ported | only the authoritative host can sign the immutable completed row; arbitrary and tampered browser bodies fail closed |
| cheats-off eligibility for the complete run | Website host/protocol extension | exact-ported | initial and live cheat-mode state taints the active party run permanently; accepted direct Lua execution also taints it; tainted runs receive no receipt |
| client-held save resume without server attestation | Website save boundary | out-of-system — the current save document proves shape, not server provenance, so resumed lineages remain local-only instead of receiving a global receipt | forged-save regression and host withholding test |
| client-held profile hydration for New Game | Website save boundary | out-of-system — profile-only state is still editable client material, regardless of claimed `global-clean` integrity | global-Hub `saveIntent: 'new-game'` withholding test |
| anonymous local slot | Website IndexedDB adapter | exact-ported web policy | guest play persists locally, but anonymous admission has no leaderboard account id and every later save-bearing admission remains ineligible |
| authenticated cloud slot | Website API/account adapter | exact-ported web policy | JWT is required for read, write, and delete; the page never falls back to IndexedDB for an authenticated account |
| global Awesomeness board | Website extension over native field | exact-ported | API/client ordering test |
| global Wave board | Website extension over native field | exact-ported | API/client ordering test |
| global Kills board | Website extension over native field | exact-ported | API/client ordering test |
| global Time board | Website extension over native field | exact-ported | API/client ordering test |
| duplicate run submission | Website idempotency boundary | exact-ported | unique account/run integration test |
| shipped `Social/Leaderboard/HighScore` file loader | `0x004452B0`, `0x00445480` | out-of-system — dormant local file registry with no Hall caller, no network behavior, and no shipped rows | exhaustive Social-block direct-reference scan |

### Memoratorium membership

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| architecture record 0 and 11 authored contour segments | `0x0050EAC0`, static table | verified-already-at-parity | layout/collision tests and prior browser receipt |
| ten normal Painting rows `3 + (14..23) + 7` | `0x00515290`, `0x00518620` | verified-already-at-parity | per-row layout/presentation tests |
| six normal urn markers, record 8 | `DAT_0081A3C0[0..9]` | verified-already-at-parity | marker-bit fixture |
| normal portrait ids `0..9` | `DAT_0081A3FC[0..9]` | verified-already-at-parity | per-row painting strip test |
| normal Memorator headings `28+i` plus `44+2i` | `0x0051E270` | verified-already-at-parity | 16-bank asset and direction tests |
| ordinary question marker 27 at `(627,742)` | `0x0051E270` | verified-already-at-parity | asset/position assertion |
| 50 record-1 candle flames | `0x0050EAC0` | verified-already-at-parity | anchor digest and transform-envelope test |
| three late additive record-5 memorial glows at `(512,507)` | `0x0050F45C..0x0050F5E5` | exact-ported | asset/count/position/blend/depth tests and room capture |
| player/remote filtering, spells, abilities, level-up VFX | shared private-room renderer | verified-already-at-parity | existing private-room contracts |
| Mortuary-specific south return and contact-X target | `0x00509330` | verified-already-at-parity | transition journey |
| blank-easel id `-1`, external portrait ids `>=100`, eulogy records 2/6/7 | `0x00513090`, `0x00518620` | out-of-system — produced by stock post-run portrait/eulogy archival, while the accepted Website post-run product route returns to retained loadout | existing explicit post-run deviation |
| alternate `Annalist2` records 11..13 | story-only population | out-of-system — no Website story campaign | no browser producer exists |
| exclamation/question marker siblings 24..26 | story/eulogy interaction states | out-of-system — same unreachable stock eulogy producer | no browser producer exists |
| dormant bundle record 10 | exhaustive record scan | out-of-system — no compiled stock selection | native asset census |

No member inside the declared implementation boundary is browser-blocked; the
ring/oval overlay is excluded by user scope rather than by platform limits.

## Native ownership thread

- Owner and construction path: application front end constructs Hall and its
  HallBox; the death/archive writer creates durable records. Mortuary owns its
  fixed layout and normal memorial compositor independently.
- Upstream state producers/callers: game-over archival produces Hall metrics;
  wizard/progression/inventory state supplies level, skills, perks, kills, and
  Awesomeness. The backend binds an authenticated account id to the one-use
  supervisor admission; the authoritative host, not the browser, serializes
  the completed global row and signs that account/run payload.
- State representation and transitions: Hall is empty or a ranked list with
  later-loaded equal scores first;
  each row is collapsed/expanded; outer close is idle -> rate 1 -> progress
  greater than 1 -> Main Menu. A Website entry is local immediately. Global
  eligibility begins only for a fresh account-bound authoritative connection
  and is irreversibly revoked for that connection when cheats are enabled or
  an authoritative console execution is accepted. A client-held save has no
  server attestation in save schema 3, so resume starts ineligible and cannot
  convert a forged lineage into a signed score. Any ineligible participant
  taints the active party run. Only an eligible completed run yields one signed
  receipt, submitted at most once per account/run id.
- Downstream consumers/callees: Hall row presentation, four Website sort views,
  local browser history, public API readers, and the ordinary Mortuary renderer.
- Sibling systems sharing ownership or data: player progression, Boneyard run
  lifecycle, account authentication, native profile persistence, and Mortuary
  paintings/eulogy state.
- Entry, interruption, reset, and teardown: Hall fetch cancellation does not
  mutate records; reopening refreshes global data; closing waits its own fade;
  session teardown cannot duplicate a completed run.

## Recovered behavioral contract

- Timing/ticks/thresholds: game simulation is 100 Hz; survival time is stored
  from the Game-wide clock, includes Hub preparation, freezes on local death
  tick 300, and is formatted `H:MM:SS`. Hall close is linear one second after
  accepted input. A lethal contact performs maximum bonus -> XP -> kill/base
  score; its family pulse is later presentation state and only gates subsequent
  lethal contacts.
- Geometry/transforms/coordinate spaces: the stock Hall frame and Main Menu
  button use the exact 1600-by-900 layout fixture. Memoratorium record 5 is a
  world sprite rooted at `(512,507)`, not a screen/CSS glow.
- Render/hit/collision/traversal order: collapsed/expanded rows stay inside the
  native scroll panel. The record-5 triple is after actors/effects and uses
  additive blending. Existing painting props retain painter Y and collision.
- Assets/audio/randomness: Hall uses stock frame/player layers; record 5 is
  extracted from the 76-record Memoratorium bundle. A new maximum-health kill
  consumes exactly one `Integer(5)` draw before the ordinary base-one award;
  no draw occurs for a non-maximum kill. Archive consumes signed `Float(65)`
  then unsigned `Float(0.15)` and persists the resulting heading/scale. Hall
  has no new audio owner beyond the existing click cue.
- Input/network authority/replication: local history accepts guests and
  cheat-tainted runs. Global submission requires a score receipt HMAC-signed
  inside the authoritative server process, bound to the backend account id
  carried by its consumed admission, and matched to the caller's JWT. The
  protocol carries initial and live cheat-mode state; eligibility cannot be
  restored by disabling cheats or by resuming a client-held save. Public reads
  never expose email, bearer, admission, or signing data.
- Boundary and failure behavior: global fetch failure leaves local history
  usable and exposes a bounded retry state. Invalid entry enums/limits fail
  closed. Empty is distinct from loading/error.

## Nearby-system findings

- Durable finding: retail's generic Social leaderboard loader is local-file
  content infrastructure, not an online service and not a Hall dependency.
- Evidence: `0x00445480` paths plus the `0x00B40600..0x00B40654` reference scan.
- Why it matters: Website global boards must have explicit backend ownership;
  wiring Hall to the dormant class name would create false native provenance.
- Native report/catalog also updated:
  `native-hall-of-fame-and-memoratorium.md`,
  `native-menus-and-boot.md`, and
  `native-regions-npcs-and-world-props.md`, plus the shared clock/feedback
  ownership notes in `native-camera-control.md` and
  `native-enemy-hit-and-death-effects.md`.

## Confidence and open questions

- Confirmed: all addresses, Hall sort/cap/row fields, empty state, sample values,
  Social non-ownership, the complete run-stat writer, and the omitted record-5
  identity/count/order/position. Awesomeness is not experience delta.
- Unknown: none material to the Website survival/Hall/ordinary-Mortuary surface.
  Native story boasts and post-run eulogies have named out-of-system producers,
  not unextracted placeholders.

## Web implementation consequence

- Correct owner/module: one native score kernel, host-owned run counters, one
  snapshot-to-local-entry recorder, one local store, one Hall scene, and one
  backend leaderboard endpoint/table. The supervisor owns account-bound
  admission material; the host owns cheat taint and signed global receipts;
  the backend verifies receipts and persists their sealed values. Memoratorium
  record 5 remains in the private-room renderer.
- Shared model change: the host snapshots the completed run counters; the page
  supplies global load/submit callbacks; the session-independent Hall model
  remains free of backend imports. Protocol 46 carries cheat-mode state and
  the opaque signed global receipt in addition to the run snapshot and
  authoritative feedback seed; save schema 3 retains its Game clock/RNG/state
  alongside the current mod identity/state fields. The world-pulse kernel is
  shared by score authority and presentation.
- Stock behavior preserved: Awesomeness-first local Hall, 100 cap, full
  survival details, exact empty/frame/Main Menu behavior, and complete ordinary
  Memoratorium composition.
- Browser-specific approximation: none. Website per-participant records are an
  explicit multiplayer/global extension over retail's one local archive row.
- Symptom patch or obsolete path to remove: the inert Hall button, record-5
  omission, and client-side experience/event score inference.

## Validation contract

- Focused automated test: newest-first tie ordering, 100 cap, time formatting,
  every score/pulse/name branch, authoritative snapshot entry completion,
  potion streak reset, local persistence, account-bound host receipt issuance,
  no receipt for anonymous, resumed, profile-hydrated New Game, forged
  `global-clean`, or cheat-tainted runs; authenticated-only cloud read/write/delete,
  signature/body/account tamper rejection, strict API
  validation/auth/idempotency/four sorts, Hall source contract, and record-5
  asset/count/position/blend/depth.
- Playwright/runtime journey: root -> Hall, local/global/sort/expand/scroll ->
  Main Menu; then real Hub -> Mortuary -> settled capture -> Courtyard.
- Stock-versus-web comparison: matching 1600-by-900 frame/control geometry and
  populated collapsed/expanded fields; normal Mortuary pixels include the
  recovered late triple glow without changing the ten paintings or Memorator.
- Measurable acceptance criteria: no inert Hall control; public global top 100;
  one authenticated row per account/run; exact record-5 `71 x 54`, count 3,
  root `(512,507)`, additive blend, late depth; zero page/console errors.

## Implementation validation receipt

- Files/modules changed: Hall model, recorder, local store, scene/style,
  main-menu route, API client; backend entity/schema/endpoint; Memoratorium
  extraction/manifest/renderer; tests and the five native reports above.
- Authority reopening implementation: the backend now carries authenticated
  account identity only inside supervisor admissions; the host permanently
  revokes global eligibility for initial/live cheat mode, accepted Lua, or an
  unattested save resume; protocol 46 returns only an opaque HMAC receipt; and
  the API verifies signature plus JWT account before persisting sealed fields.
  Local Hall history remains available for every excluded branch.
- Rebased focused receipt: TypeScript test compilation passed after replaying
  the authority work over current protocol 45 and preserving party denial plus
  the mixed-skill quickbar as protocol 46. Protocol `24/24`, host
  authority/resume `4/4`, supervisor `8/8`, and Hall `17/17` passed. Loader
  static CI passed `491/491` on its rebased documentation commit.
- Mac mini exact-tree receipt: macOS `26.4.1` arm64 ran the canonical Website
  gate on commit `2ffe438a`, then the final line-ending commit `4b8b6658` ran
  its two focused contracts and canonical lint. The full matrix passed backend
  `13/13`, Library `2/2`, loot `41/41`, prerequisite `216/216`, broad game
  `1233/1233`, parties `16/16`, level-up `5/5`, diagnostics `7/7`, Hall
  `17/17`, Hub UI `14/14`, desktop `5/5`, build, budget, and media policy. Its
  game entry was `Game-YB6kcXmn.js`, `345646` raw / `97655` gzip bytes. The Mac
  Loader matrix independently passed `491/491`.
- Windows-native exact-tree receipt: a detached native clone at `4b8b6658`
  passed the same complete matrix with pinned Node `22.17.0`, npm `10.9.2`,
  .NET `10.0.302`, and Python `3.13`; lint retained eight existing warnings and
  zero errors. Its game entry was `Game-CFL5sUEd.js`, `345646` raw / `97657`
  gzip bytes. A clean Windows checkout first exposed two upstream CRLF-sensitive
  contracts; the byte-locked hat-anchor JSON now has an LF attribute and the
  source reader normalizes CRLF. Both focused regressions then passed on Windows
  and Mac before the full Windows matrix passed.
- Windows Chrome authority receipt: an isolated backend and Vite client
  rejected browser-authored score JSON with `400`, rejected a signature-tampered
  receipt with `400`, accepted the server-format account-bound receipt with
  `201`, and rendered that one row through Awesomeness, Wave, Kills, and Time.
  Row expansion and Main Menu return passed with empty page/console error lists.
  Capture:
  `.codex-windows-validation/hall-fame-memoratorium-20260820-root/sdr-authoritative-hall-global-4b8b665.png`.
- Windows automated receipt: pinned .NET SDK `10.0.302` restored and built the
  backend in Release with zero warnings/errors, `dotnet format
  --verify-no-changes` and Website/backend integration `12/12` passed. The
  Windows frontend gate passed loot `40/40`, Boneyard prerequisite `158/158`,
  Boneyard/game `1048/1048`, parties `13/13`, level-up `5/5`, diagnostics
  `7/7`, Hall `15/15`, Hub UI `14/14`, desktop `5/5`, lint/architecture,
  production build, bundle budget, and production-media policy. The Windows
  game entry is `Game-CPabnKgG.js`, raw `276116` bytes and gzip `82793` bytes.
- Canonical WSL receipt: `./scripts/validate.sh` exited zero on 2026-08-21 with
  backend build/format/integration `12/12`, frontend loot `40/40`, Boneyard
  prerequisite `158/158`, Boneyard/game `1048/1048`, parties `13/13`, level-up
  `5/5`, diagnostics `7/7`, Hall `15/15`, Hub UI `14/14`, desktop `5/5`,
  production build, bundle budget, and media policy all green. The final game
  entry is `Game-LegL-fr4.js`, raw `276116` bytes and gzip `82792` bytes.
- Gate-diagnosis receipt: an intermediate canonical run exposed the existing
  supervisor expiry test while every Hall/Memoratorium member passed. A
  six-second WSL probe measured `Date.now()` moving backward `8707.78` ms while
  `performance.now()` advanced normally. Unclaimed elapsed-time ownership,
  including shared-Hub admission tickets, and the polling deadline now use the
  monotonic clock; a frozen-wall-clock regression passes on WSL and Windows.
- Browser/native evidence: clean populated stock captures are preserved under
  `C:\\codex-validation\\sdr-hall-filled-20260820`. Current Windows browser
  captures are under
  `C:\\Users\\User\\Documents\\GitHub\\SB Modding\\Solomon Dark\\.codex-windows-validation\\hall-fame-memoratorium-20260820-root`.
  The Hall journey covered local, expanded, global Awesomeness, global Wave,
  global Kills, global Time, and Main Menu return with zero console/page
  errors. A final strict-boundary browser probe rejected an unmapped field with
  `400`, resolved two simultaneous identical submissions as `201` plus `200`,
  and rendered the one stored global row. The real authoritative Hub journey
  used six collision-safe waypoints, observed both fade phases, settled in
  Mortuary at `(512,904)`, captured the recovered triple glow, returned to
  Courtyard, and reported zero console/page errors. The post-rebase captures
  use the `sdr-postrebase-hall-*` and `sdr-postrebase-memoratorium-*` names.
- Remaining implementation explicitly out of scope: stock story campaigns,
  boast objectives, native save import/export, and the accepted post-run
  eulogy route deviation enumerated above.
