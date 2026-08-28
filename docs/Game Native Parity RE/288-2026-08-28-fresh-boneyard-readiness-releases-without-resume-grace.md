# 2026-08-28 — Fresh Boneyard readiness releases without resume grace

## Reported smell and parity question

- Reported web behavior: a newly launched match enters the same two-second
  `RESUMING...` progress flow used after returning to an existing match or
  releasing an in-game pause.
- Required behavior: retain the authoritative renderer-readiness barrier for a
  fresh ordinary, custom, shared-party, or Tutorial Boneyard, but release it
  directly when the expected renderer cohort is ready. Resume grace remains
  only for rejoin/restart and source-qualified in-game unpause paths.
- Reproduction inputs/scenes: fresh standalone/private ordinary match, fresh
  shared-party match with one delayed renderer, fresh stock Tutorial, active
  saved-run restart, same-host active-party rejoin, and multiplayer Pause Menu
  release.
- Falsifiers: any positive-duration `game-started` projection; a fresh match
  mounting a progress bar or `RESUMING...`; simulation advancing before every
  expected fresh renderer is ready; removing the early player's useful
  `Waiting on players ...` state; changing rejoin/restart/pause grace; accepting
  a stale ready sequence; or replaying held loading time as fixed ticks.

This reopens the 2026-08-27 mutual-renderer-readiness entry only at its final
transition. That pass correctly recovered the expected-set readiness owner but
incorrectly chained the fresh `arena_materialized` edge into the Website's
separate resume-grace extension.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | user correction, 2026-08-28 | The resume flow belongs only to rejoining an existing match or unpausing gameplay, not initial match entry. | authoritative |
| Native session lifecycle | retail `SolomonDark.exe` 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-session-flow.md`; G13 `loading.boneyard -> arena_materialized -> gameplay.arena` | Expected participant and loading readiness precede Arena admission; readiness release enters Arena directly. There is no post-entry countdown state. | high |
| Native pause lifecycle | same retail image; `native-gameplay-pause.md`; suspension helper `0x005CBD40`; dispatcher `0x00427800` | A final in-game modal release resumes on the next ordinary fixed tick with no catch-up. The Website's two-second post-pause grace is a separate explicit multiplayer policy. | high |
| Current Website causal trace | exact base `f974f26801de7630d60a57cf0bea2baeff253575`; protocol 101; `game-host.ts`, `MainMenuScene.tsx`, `GameplayResumeProgress.tsx` | All three fresh launch producers create pending reason `game-started`; the all-ready edge unconditionally assigns the shared two-second deadline, which mounts `RESUMING...`. | high |

No new native address, authored table, asset, or reusable loader fact is
introduced. The current `native-session-flow.md` and
`native-gameplay-pause.md` already own the applicable native contract, so no
Mod Loader document changes in this pass.

## System boundary and membership inventory

Native system: **Boneyard entry/readiness release policy** begins when an
authority publishes an active Arena run, freezes its exact expected human
renderer cohort, consumes run- and sequence-qualified ready receipts, and
either releases immediately for a fresh run or begins resume grace for a
return to an existing run.

| Member / branch | Native or Website source | Disposition | Proof |
| --- | --- | --- | --- |
| Fresh standalone/private ordinary or custom Boneyard | G13 `start_run -> loading.boneyard -> arena_materialized` | `exact-ported` | pending `game-started` freezes tick; final ready clears the hold with no positive remainder or progress |
| Fresh shared-party ordinary or custom Boneyard | same G13 expected-set owner plus Website party extension | `exact-ported` | every materialized human is required; an early browser sees waiting copy; final ready releases directly |
| Fresh stock Tutorial Boneyard | G13 `startup_boneyard`/Arena entry; Website Tutorial launch | `exact-ported` | renderer readiness precedes the authored Tutorial clock; no resume bar follows |
| Slow/erroring fresh renderer | browser Boneyard renderer owner | `verified-already-at-parity` | no receipt means the exact run remains frozen and early peers see `Waiting on players ...` |
| Fresh-barrier ordinary disconnect | Website expected-set shrink | `exact-ported` | remaining all-ready cohort releases directly; departed client cannot strand or start a timer |
| Stale, duplicate, wrong-run, or wrong-sequence fresh receipt | strict ready intent | `verified-already-at-parity` | inert; cannot shorten the barrier or recreate a released hold |
| Active saved-run restart, including solo | Website `game-restarted` extension | `verified-already-at-parity` | renderer ready edge still starts one two-second grace |
| Same-host active-party rejoin, staged catch-up, simultaneous returners, or same-tab takeover | Website `game-rejoined` extension | `verified-already-at-parity` | exact returning cohort and older barriers still precede one two-second grace |
| Coordinated replacement-process recovery | signed recovery roster plus `game-restarted` | `verified-already-at-parity` | absent signed members remain required; all-ready starts existing-match grace |
| `party-rejoin-wait` and required-member return | Website liveness extension | `verified-already-at-parity` | indefinite wait remains; valid return transitions to rejoin grace, not fresh release |
| Multiplayer Pause Menu/Settings, Inventory, Skill Book, compact selector, and mandatory SkillPicker release | source-qualified pause/barrier owners | `verified-already-at-parity` | current two-second unpause policy remains unchanged |
| Solo modal release and pause-owner disconnect | existing direct-release policy | `verified-already-at-parity` | no grace remains unchanged |
| Initial bot, observer, or detached nonmaterialized actor | no browser renderer owner | `out-of-system` | never enters the expected human renderer cohort |
| Hub, title, Create, loading art, Game Over, loadout, Hall, or unrelated party run | separate scene/session owners | `out-of-system` | no cross-scene resume progress or hold |
| Run replacement, Game Over, empty retirement, or host close before readiness | run-owner teardown | `verified-already-at-parity` | pending fresh hold retires once; no late receipt recreates it |
| Strict `game-started` wire state | protocol 102 reason family | `exact-ported` pending-only invariant | `remainingMs` must be null; a positive value fails closed under the incremented protocol |

No member is `blocked-by-platform`. The host already distinguishes
`game-started`, `game-rejoined`, and `game-restarted`, so the requested release
policy needs no browser approximation.

## Native ownership thread

- Owner and construction path: the run/party host freezes the materialized
  human cohort before publishing a fresh Boneyard. The Boneyard renderer owns
  the only positive browser-ready edge after assets, canvas, resize, and first
  paintable frame exist.
- Upstream state producers: standalone match start, standalone Tutorial start,
  and shared-party match start produce `game-started`; active connection
  admission produces `game-rejoined` or `game-restarted`; modal/barrier release
  produces source-qualified unpause reasons.
- State representation and transitions: pending readiness retains a monotonic
  sequence plus waiting/ready sets. Fresh all-ready clears that record;
  existing-match and unpause records retain their two-second host deadline.
- Downstream consumers: authoritative tick admission, queued-input clearing,
  shared-party isolation, strict protocol projection, local prediction/input
  gates, and the waiting/progress presentation consume the record.
- Sibling systems: ordinary/custom/Tutorial launch share the fresh policy;
  saved restart and all rejoin variants share the existing-match policy; every
  modal source shares the independent unpause policy.
- Entry, interruption, reset, and teardown: a slow renderer remains fail
  closed; disconnect may shrink only the ordinary pending cohort; stale
  receipts are inert; run retirement clears the record; release resets the
  standalone scheduler deadline and never catches up held wall time.

## Recovered behavioral contract

- Timing: fresh all-ready adds zero grace milliseconds and admits the next
  ordinary fixed tick. Rejoin/restart and eligible unpause paths retain exactly
  2,000 monotonic milliseconds.
- Presentation: fresh pending readiness may show `Waiting on players ...` to an
  already loaded peer. Fresh entry never renders `RESUMING...` or a progressbar.
- Input/network authority: only authenticated, current-sequence renderer-ready
  receipts satisfy the host cohort. Clients cannot choose the release policy.
- Boundary behavior: a positive-duration `game-started` state is invalid. The
  direct fresh release clears held input again, resets standalone scheduling,
  broadcasts the absent hold, and performs no catch-up.
- Geometry, assets, audio, collision, randomness, and Boneyard selection are
  unchanged.

## Nearby-system findings

- Durable finding: renderer readiness and resume grace are adjacent phases but
  not synonymous. The same host record may coordinate both, but its final
  policy must remain reason-qualified.
- Evidence: native G13 has an explicit loading barrier followed directly by
  Arena, while the Website separately authored reorientation grace for returns
  and in-game unpause.
- Why it matters: future cold world-entry barriers must not inherit a
  post-interruption timer merely because they reuse the ready-intent transport.
- Native report/catalog also updated: none; the existing G13 and pause reports
  already state this ownership boundary.

## Confidence and open questions

- Confirmed: every fresh producer, every returning-run producer, the
  source-qualified pause family, ready receipt, pending/deadline transition,
  tick/input consumers, wire projection, presentation, disconnect, and
  teardown path.
- Inferred: none used for authority.
- Unknown: none material.

## Web implementation consequence

- Keep the pending `game-started` record as the deepest existing readiness
  owner; do not hide progress only in React or remove the readiness barrier.
- Make the all-ready transition reason-qualified: `game-started` clears and
  broadcasts the record immediately, while every return/unpause reason retains
  its existing deadline path.
- Enforce `game-started` as pending-only in the strict decoder and advance the
  exact-match protocol. Remove positive fresh-start progress expectations from
  host and browser contracts while retaining waiting-state coverage.

## Validation contract

- Focused automated tests: standalone, Tutorial, shared-party, human-plus-bot,
  delayed-peer, disconnect, stale receipt, no pre-ready tick, direct final
  release, no catch-up, positive wire rejection, and unchanged restart/rejoin/
  Pause positive controls.
- Mac Chrome: launch one two-human fresh Boneyard with a delayed raw peer;
  capture the early browser's waiting state, acknowledge the final renderer,
  require immediate overlay teardown and ordinary tick advance with no
  progressbar/`RESUMING...`; then close Pause and require the two-second bar as
  a positive control. Repeat the fresh Tutorial or loading journey where the
  registered smoke already owns it.
- Stock-versus-web comparison: native `loading.boneyard -> gameplay.arena`
  supplies the direct-release baseline; Website rejoin/unpause delay remains an
  explicit product extension.
- Exact candidate: byte-identical Mac worktree, canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, and empty page/console/
  failed-response/host-error arrays.

## Implementation validation receipt

- Protocol 102 retains every protocol-101 gameplay field and makes
  `game-started` pending-only: a positive remainder now fails strict decoding.
  The host keeps the exact expected-renderer cohort and input/tick hold, but
  its all-ready branch clears a fresh record, clears held input again, resets
  standalone scheduling, and broadcasts the absent hold instead of assigning
  a two-second deadline. Rejoin, restart, `party-rejoin-wait`, and every current
  source-qualified unpause branch retain their existing deadline path.
- The byte-identical pre-rebase test-only Mac candidate on base
  `ce8fad29c34b0361acacd8e3d8d32ad98a0b323f` produced the intended red receipt:
  backend/contracts and lint passed, then 313/314 prerequisite tests passed and
  the first new exact-match assertion failed only because protocol 100 was not
  yet 101. Red log SHA-256 is
  `d7e988449900941a9c49e2ff4ebce33af5a8ffea9d1d6e4a0500d7cff667085f`.
- The pre-rebase 13-file implementation candidate was byte-identical between the isolated
  local and Mac worktrees under manifest SHA-256
  `ac806991437d605e86f9c6d68474b8b8cdad55e47240af54d060ee0215cf9237`.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed on the Mac mini:
  backend build zero warnings/errors; 28 backend/Website contracts; lint and
  generated/boundary checks; 314/314 prerequisite tests; 1,730/1,730 Boneyard
  and host tests; all 77 ML-bot tests; every weather, party, level-up, Tutorial,
  diagnostics, Hall, Hub UI, and desktop suite; production builds; media
  policy; and bundle budget. `Game-xtATnlyh.js` measured 258,253 raw / 78,118
  gzip bytes. Green gate-log SHA-256 is
  `b30a836fafb6cd9ee96a5cc4437b8f1dfb843dc287c69f2071a9306855a7b065`.
- Pre-rebase Mac Chrome `151.0.7922.174` completed the real multi-client Boneyard journey.
  The early browser held on `Waiting on players ...`; the final two renderer
  receipts detached that state within one second, mounted zero fresh progress
  surfaces/progressbars, advanced on the next ordinary tick, and passed the
  no-catch-up bound. Pause Resume remained held at owner tick 1,826 and peer
  tick 1,835 through monotonic 10/50/90-percent progress; saved active-run
  restart remained held at tick 1,841 through the same positive control and
  finished at tick 1,850. Page/console and failed-response arrays were empty.
  Browser-log SHA-256 is
  `c5589ee637dc5f6666a9d614f927f3f565a1c3717682ec9fcbda5480fb24547b`.
- Visual inspection confirms a progress-free gold `Waiting on players ...`
  panel for the fresh pending cohort and a distinct `RESUMING...` progressbar
  after Pause and saved restart. Evidence SHA-256 values are fresh waiting
  `142856e9c80181c30efa714f91461dd9552f94c4449c1ec05d20b82ee036c3ec`,
  Pause Resume
  `db1860903c14942af17e291ec4e96581df2b2d998abaf6c235cc4253d2b07f1a`,
  and saved restart
  `a5070f173a0caf7a26b816eb6c40e5a8ad74157c9d6fa12f1ac7767ff53676b1`.
- No browser-platform member, native unknown, fallback, compatibility decoder,
  or UI-only suppression remains. Existing Mod Loader reports already owned
  the reusable native facts and were not changed. These receipts establish the
  pre-rebase behavior; exact-tree evidence after the concurrent chat/layout
  landing follows below. Publication and deployment were not requested.
- First current-main rebase: the exact candidate was one focused commit over
  `2fefff009c8580f84d7b09638701e7c3fbe15587`, retaining the concurrent
  chat/inventory layout correction and its additions to the shared Pause smoke.
  The 13 changed paths were byte-identical between local and Mac pre-receipt
  trees under manifest SHA-256
  `cdc759a5dde1c3aa57d05f1839ce3be29a1625823082791bade446179759d7a6`.
- That rebased `/opt/homebrew/bin/bash ./scripts/validate.sh` gate exited
  zero: 28 backend/Website contracts; 314/314 prerequisites; 1,730/1,730
  Boneyard/host tests; all 77 ML-bot tests; the upstream-expanded 80/80 party
  suite; every other registered frontend/desktop group; lint, generated and
  boundary checks; production builds; media policy; and bundle budget.
  `Game-DadLNQU1.js` measured 258,535 raw / 78,227 gzip bytes. Final gate-log
  SHA-256 is
  `bd1ef88abf5445161517d7d358eb15391ae7c17dc283b1c40b506e70f2c38c4c`.
- That rebased Chrome `151.0.7922.174` repeated the complete journey. Fresh
  renderer readiness mounted no progress phase or accessible progressbar and
  resumed directly without catch-up; Pause Resume held owner tick 1,793 and
  peer tick 1,803 through the positive progress control; saved restart held
  tick 1,808 and completed at tick 1,820. Page/console and failed-response
  arrays were empty. Final browser-log SHA-256 is
  `0e6a8359a97c068dd80d30c4a67a6c64bfb92e9dbe58f5ff567e6f87bcdfcdd4`.
  Final screenshot SHA-256 values are fresh waiting
  `447ad7d9fd401abc2fa76f9ec610026d4dd49d19798e86a797d179040bf93ca2`,
  Pause Resume
  `4833533cb02c2aefc763ab9c42fbfae7b0626c3ce445ee92e5655f3602556fc9`,
  and saved restart
  `3c74c037a84e9efeff0cac47fa970ebc2dac1456823923cb73975ab8473ab9a3`.
  This receipt preceded the subsequent Title-control landing; runtime, tests,
  browser harness, and build inputs were unchanged. Exact evidence on the new
  current base follows below.
- Current-base finalization: the focused commit was rebased over
  `57e2c3602485745f92997b19aa5b69ac0725a708`, preserving the independently
  validated Title Quit removal and external-control layout. The 13 local/Mac
  pre-receipt file hashes matched under manifest SHA-256
  `cbe2a591e7aa2573b46e25e2cb39a1aa541bc9c5e9e53dca46e2a5514ca9f97c`.
- The repeated current-base canonical gate exited zero with the same complete
  suite counts: 28 backend/Website contracts, 314/314 prerequisites,
  1,730/1,730 Boneyard/host, 77/77 ML-bot, 80/80 party, every remaining
  frontend/desktop group, lint, generated/boundary checks, builds, media
  policy, and bundle budget. `Game-CYCzoOxm.js` measured 257,825 raw / 78,017
  gzip bytes. Gate-log SHA-256 is
  `72c50e8b8f5725f920c25121eac73b46649a93959d9f69d756071b5a49fb8fa2`.
- Current-base Chrome `151.0.7922.174` again observed no fresh progress phase
  or progressbar and direct no-catch-up release. Pause Resume held owner tick
  1,801 and peer tick 1,812; saved restart held tick 1,818 and completed at
  tick 1,829. Page/console and failed-response arrays were empty. Browser-log
  SHA-256 is
  `c1429aeacdee9cc698bfee091bba2ba038d91489453d95dfb004225dc9b4040d`.
  Screenshot SHA-256 values are fresh waiting
  `9add1a374af8c67b4f6ea881e87dd505ff1ee39f8b4de6e626a0cecd581d9abf`,
  Pause Resume
  `679ee3721983aa1f5dff1046eded4f1cab66e14e42e27f7b08f72d02d2c69d8e`,
  and saved restart
  `937cb896fb7b86fca806c95f2e7800b3bc7896aed09518443c166aaa2471c7c3`.
  This receipt was the only tracked change after that gate and browser run;
  it preceded the Web Lua 1.0 showcase landing. Exact combined evidence follows
  below.
- Web Lua integration rebase: the focused change now sits over
  `a24bb5d02d37775612886e0aa912a5264a1732d6`. Upstream protocol 101's
  run-qualified modded-Boneyard renderer receipt and this correction's pending-
  only `game-started` contract combine as protocol 102. The modded initial-run
  test now requires both renderer owners and proves that their final edge also
  clears directly with no positive fresh grace. The 13 local/Mac pre-receipt
  file hashes matched under manifest SHA-256
  `f3991ea2ff3c0f899137abec3c44fbd41a21ee8caa272eda321f3cf83af85a00`.
- The protocol-102 canonical gate exited zero: 28 backend/Website contracts,
  314/314 prerequisites, 1,733/1,733 Boneyard/host tests, 77/77 ML-bot, 80/80
  party, every expanded Web Lua and remaining registered group, lint,
  generated/boundary checks, production builds, media policy, and bundle
  budget. `Game-Dg6qFomm.js` measured 259,805 raw / 78,532 gzip bytes.
  Gate-log SHA-256 is
  `0fb270431737b74bf25280ab20fc18a63ca414f578ed8b207b391defbf78bc2f`.
- Protocol-102 Chrome `151.0.7922.174` again showed no fresh progress phase or
  progressbar and direct no-catch-up release. Pause Resume held owner tick
  1,886 and peer tick 1,896; saved restart held tick 1,902 and completed at
  tick 1,911. Page/console and failed-response arrays were empty. Browser-log
  SHA-256 is
  `e65d83e41e37e61446b50e61f1ee478e133bb492514e9a9d69701ffee20cfd31`.
  Screenshot SHA-256 values are fresh waiting
  `83efb428baa066f025f37709d8a516699540d4879a38bfbae6244b2b4e105061`,
  Pause Resume
  `8215a2069e9d6b73ca90916f5418b04e8595db34451a776069ca688d2a8910e2`,
  and saved restart
  `39c24b4be8bf3ca7953a5be388cfd37b5b61dd6c7a7a05721861c9a70c1f3a37`.
  This receipt is the only tracked change after the combined current-base gate
  and browser run.
- Publication-base rebase: the focused commit was rebased over render/VFX main
  `f974f26801de7630d60a57cf0bea2baeff253575`. Only the append-only parity
  ledger overlapped; the complete renderer entry and this lifecycle entry were
  both preserved. The 13 local/Mac pre-receipt file hashes matched under
  manifest SHA-256
  `05613cc34c46eb0e85d10716ee33932d5dd221580da0743041c1a7097ff8ca42`.
- The publication-base canonical gate exited zero: 28 backend/Website
  contracts, 314/314 prerequisites, 1,738/1,738 Boneyard/host tests, 77/77
  ML-bot, 80/80 party, every render/VFX, Web Lua, and remaining registered
  group, lint, generated/boundary checks, production builds, media policy, and
  bundle budget. `Game-C28GTtb-.js` measured 259,898 raw / 78,549 gzip bytes.
  Gate-log SHA-256 is
  `aff8bf7133c0ac018367025c493911c4b436c350f8ada144ca9c924830fba6ef`.
- Publication-base Chrome `151.0.7922.174` again observed no fresh progress
  phase or progressbar and direct no-catch-up release. Pause Resume held owner
  tick 1,906 and peer tick 1,915; saved restart held tick 1,922 and completed
  at tick 1,931. Page/console and failed-response arrays were empty. Browser-
  log SHA-256 is
  `0f43593e5eb1068ecb19c3d54acfcf95c0f1c27f148555dca63f7c0732783628`.
  Screenshot SHA-256 values are fresh waiting
  `c546822c8cb8993d95cfaeaf3b6f4da4060b99c6b918ccaf3ea686929903c518`,
  Pause Resume
  `90bcecac9ff1059f74b7fac7dff7029203d328bfb6abf3b62df0b72d379d131b`,
  and saved restart
  `6ad228377c6cc70bc1d0849a311f00a14818046140b852b68aa62a8d05327b86`.
  This receipt is the sole tracked post-browser change; the exact post-receipt
  canonical gate and remote fast-forward are the remaining publication steps.
