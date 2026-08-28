# 2026-08-27 — Mutual Boneyard renderer readiness before resume grace

## Reported smell and parity question

- Reported web behavior: the server simulation can begin or resume while one
  or more player browsers are still constructing the Boneyard renderer. A
  player who finishes first sees neither a loading surface nor an explanation,
  and the three-second grace can elapse before the remaining players are
  actually loaded.
- Required behavior: hold the exact run until every expected human player has
  produced a run- and sequence-qualified renderer-ready receipt. A player who
  has loaded early sees `Waiting on players ...`; only the all-ready edge may
  start the existing authoritative three-second grace.
- Reproduction boundaries: initial standalone/private/shared Boneyard and
  Tutorial entry; one-player active-save restart; coordinated whole-party
  process recovery; same-host active-party rejoin, staged catch-up, and
  same-tab takeover; simultaneous returners; pause and level-picker
  composition; disconnect and run teardown.
- Falsifiers: inferring readiness from a hidden loading component; accepting a
  receipt before the renderer's first paintable frame; starting a deadline
  after only the first recovered party member returns; shrinking a frozen
  replacement-process roster merely because a browser has not connected yet;
  accepting a stale sequence; burning countdown time behind a loader or
  picker; or replaying held wall time as fixed ticks.

This reopens the 2026-08-26 authoritative-resume-grace entry. That pass
correctly made the host authoritative, but it skipped the recovered native
initial-loading roster and treated `loading === null` as equivalent to a
renderer-ready event. It also addressed only returners in the pending set, so
the first browser restoring a coordinated party could start the countdown
before its signed roster returned. The former `Initial new match/Tutorial
entry` out-of-system row is superseded here.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native/session report | retail Beta 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `native-session-flow.md`, especially `loading.boneyard` and G13 ordering | Authority fixes selection, seed, nonce, and expected participants before Arena entry. Input/transients seal before attach; release follows authenticated expected-set readiness, not surface visibility. | high |
| Native pause report | same executable; `0x005CBD40`, region `+0x68`, dispatcher `0x00427800`; Mod Loader `native-gameplay-pause.md` | A held region retains one exact simulation state while application, transport, rendering, and modal clocks remain live. Final release has no catch-up. | high |
| Existing Website recovery contract | protocol 85; schema-15 revision-bound `sdrpr2` recovery; `partyRecoveryClaim.partyRoster`; active-party rejoin ledger entries dated 2026-08-24/25 | A coordinated replacement restores the complete signed ordered roster even when a nonleader connects first; same-host rejoin separately retains a live authority and late-materializes one former actor. | high |
| Current Website causal trace | exact base `f7e0b244a584e6064ee393cac6052cc9781a83a0`; `game-host.ts`, `game-client-session.ts`, `MainMenuScene.tsx`, `BoneyardScene.tsx`, `GameplayResumeCountdown.tsx` | Initial `enterBoneyardWorld` publishes a live run with no renderer barrier. Rejoin grace adds only the caller to `waitingPlayerIds`. `MainMenuScene` acknowledges when `loading` is null, while `BoneyardScene.onReady` only clears that presentation state. Pending grace renders nothing. | high |

No new native address, authored table, or loader behavior is asserted. The
canonical Mod Loader reports already close the reusable native facts, so they
remain unchanged.

## System boundary and membership inventory

System boundary: one run-scoped host readiness barrier begins before an
eligible Boneyard can tick, freezes the expected human cohort, consumes only
authenticated renderer-ready receipts for its current run/sequence, then
atomically becomes the existing 3,000-ms resume grace. Transport, loading,
rendering, picker presentation, and diagnostics stay live; simulation and
gameplay input do not.

| Member / branch | Disposition | Required proof |
| --- | --- | --- |
| Initial shared-party Boneyard | `exact-ported` native roster ownership plus Website 3-second extension | every connected materialized human in the launched run is frozen into one pending set before the first tick |
| Initial standalone/private Boneyard | `exact-ported` same owner | the one or more hosted humans must render before countdown; no server tick leaks behind the loader |
| Stock Tutorial entry | `exact-ported` same Arena-entry owner | its sole human renderer must be ready before countdown and the authored Tutorial clock starts |
| Coordinated replacement-process recovery | `exact-ported` Website recovery extension | the signed full party roster remains required when the first former member restores the run; countdown cannot start until all roster actors return and render |
| Same-host active-party rejoin | `exact-ported` Website late-materialization extension | already loaded peers re-ack the current run; the returner can acknowledge only after its cold renderer is ready |
| Rejoin with detached catch-up choices | `exact-ported` composition | renderer readiness may latch while detached, but countdown also waits for final materialization and every picker/barrier owner |
| Same-tab active-run takeover | `exact-ported` | superseded socket/stale sequence cannot satisfy the new connection's readiness |
| Two or more simultaneous returners | `exact-ported` | each new return rebuilds a sequence-qualified union; all current waiters re-ack and one countdown begins after the final ready edge |
| Existing peer already rendering when another reconnects | `exact-ported` | stored run-specific renderer readiness permits a fresh acknowledgement; no loading-state guess or renderer rebuild is required |
| Early-loaded player presentation | `exact-ported` Website extension | own loading screen closes, pending grace remains visible as `Waiting on players ...`, then changes to `3,2,1` only on host deadline publication |
| Slow/erroring player | `exact-ported` fail-closed behavior | no ready receipt before `BoneyardScene` produces a paintable renderer; a loading error or still-open client cannot advance grace |
| Ordinary pending-barrier disconnect | `verified-already-at-parity` roster change | a non-recovery expected client that leaves is removed so remaining active humans are not stranded |
| Signed coordinated-recovery member not yet connected | `exact-ported` durable expected roster | absence does not silently shrink the replacement-process proof |
| Gameplay pause and level-up barrier | `verified-already-at-parity` with stricter composition | all-ready may latch, but deadline remains null until the older owner releases; countdown time never burns underneath it |
| Inventory/SkillScreen/selector/Pause release after an already loaded run | `verified-already-at-parity` | existing multiplayer grace starts immediately because this is not a world-loading edge |
| Late observer, bot, and detached nonmaterialized actor | `out-of-system` | observer is read-only; bots own no browser renderer; a detached actor enters only when its authenticated browser returns |
| Hub, title, Create, Game Over, loadout, Hall, unrelated party run | `out-of-system` | no Boneyard renderer-readiness owner or cross-run freeze |
| Stale/duplicate/wrong-sequence receipt | `exact-ported` strict transport member | inert; cannot shorten or release the current barrier |
| Game Over, run replacement, empty-run retirement, host close | `exact-ported` teardown | pending sets/deadlines disappear with the owning run and no late receipt can recreate them |

No browser member is blocked. A browser can explicitly report the completion
of its own renderer construction; authority does not infer GPU readiness from
DOM visibility or elapsed time.

## Ownership thread and recovered behavioral contract

- The run/party host owns the expected set, ready set, monotonic sequence,
  older-hold composition, deadline, input clearing, tick admission, logging,
  and teardown. Clients never vote to resume and cannot supply a deadline.
- Initial launch freezes the materialized human run cohort before publishing
  the Boneyard snapshot. Replacement-process recovery additionally unions the
  signed recovery roster so the first returning member cannot erase absent
  former members. Ordinary same-host rejoin unions currently materialized
  connected humans with each staged/returning actor; it does not strand the
  run on unrelated detached members.
- `BoneyardScene` owns the only positive readiness edge: the renderer promise,
  native/environment/Game Over assets, first authoritative render, canvas
  attach, and resize must all complete before `onReady`. `MainMenuScene`
  records that exact run ID and sends the current pending sequence. A retained
  already-ready renderer can answer a later rejoin barrier for the same run.
- A new run/session clears the recorded renderer ID. React loading state,
  Suspense visibility, a received map, a snapshot, time since welcome, and
  progress value are not readiness evidence.
- Pending readiness and countdown are one authority record. `remainingMs =
  null` means the simulation is held and at least one readiness, materialized
  identity, pause, or level barrier condition remains. The first valid
  all-ready/unblocked edge sets exactly one 3,000-ms host deadline. Expiry
  clears inputs again, resets the scheduler deadline, and resumes with no
  catch-up.
- Protocol 87 adds the strict `game-started` reason; the existing
  sequence-qualified ready intent and nullable remaining duration retain their
  shape. Readiness is ephemeral and changes no save schema.

## Validation contract

- Protocol/client/presentation: `game-started` strict round trip; pending
  waiting copy and accessibility; explicit renderer-ready ownership; stored
  same-run readiness; stale and repeated intent behavior; exact transition
  `Waiting on players ... -> 3 -> 2 -> 1 -> absent`.
- Host: solo/shared/Tutorial initial entry, all-ready ordering, one slow peer,
  disconnect, no pre-ready tick, exactly one deadline, no catch-up, menu-grace
  nonregression, simultaneous same-host returners, catch-up picker, takeover,
  and teardown.
- Supervisor recovery: perform a real two-member coordinated drain; restore
  the nonleader first; prove its ready receipt cannot start countdown or ticks;
  restore the original leader; require both renderer receipts before one grace
  begins; retain original party/run/leader identity.
- Mac Chrome: two real clients with one deliberately delayed renderer for
  initial entry and active-run reconnect/recovery. The early client must show
  the waiting copy on a retained frame, authority tick/enemies must stay exact,
  then both must show the same countdown and resume normally. Require empty
  page/console/failed-response/host-error arrays.
- Exact candidate: byte-identical Mac worktree and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` before publication.

## Implementation validation receipt

- Protocol 87 adds `game-started` without changing the ready-intent or save
  shapes. `HostGameplayResumeGrace` now owns frozen waiting/ready sets plus the
  signed coordinated-recovery subset. Initial Boneyard/Tutorial entry installs
  that hold synchronously before any scheduler turn; active saved restart,
  same-tab takeover, ordinary late materialization, staged party rejoin, and
  replacement-process recovery all union their exact human cohort. Bots,
  observers, and still-detached actors remain excluded. Pending owners retire
  with terminal/empty/replaced runs without publishing an intermediate frame.
- `MainMenuScene` records the exact run ID only from `BoneyardScene.onReady`,
  after renderer/assets/canvas/resize completion. It no longer infers readiness
  from `loading === null`. A retained same-run renderer re-acks a later rejoin
  sequence; a new session/run clears the record. Pending grace now renders
  `Waiting on players ...` and changes to the existing authoritative `3,2,1`
  only after host deadline publication.
- Contract coverage includes the strict protocol family, pending/countdown
  presentation, renderer owner, initial one-by-one acknowledgements, pause and
  SkillPicker nonregression, saved restart, same-tab replacement, detached
  catch-up, coordinated nonleader-first replacement recovery, terminal
  retirement, Lua, and human-plus-bot exclusion. All older fixtures now pass
  through the same production 3,000-ms deadline rather than shortening time in
  test configuration.
- Mac Chrome 151 at 1600 x 900 completed a three-human initial journey. The
  browser reached a paintable retained Boneyard and visibly held on `Waiting
  on players ...`; one raw peer receipt was insufficient, both remaining
  receipts released the cohort, every page then saw `3,2,1`, and ordinary
  pause/restart grace continued through tick `1932`. Page and console errors
  were empty. Reviewed waiting-frame SHA-256 is
  `bb193150afa54c47de499279aceb442ccfebbb906c40e2c5229660d56073577e`.
- The real global-Hub active-party journey disconnected the browser, stacked
  personal offer sequences `[4,6,8,10,12,14,16,18]`, retained authority tick
  `1008`, displayed the same pending waiting surface after the returning
  renderer/picker settled, then accepted the sole still-connected peer's exact
  sequence and resumed at tick `1047`. Save revision advanced `2 -> 23`; page,
  console, failed-response, failed-request, and host-error arrays were empty.
  Final catch-up frame SHA-256 is
  `83bc513ce9e53840796a2370bc5a136913cf5bf45e44c9fe471556785675c0bc`.
- The exact source/acceptance worktrees are byte-identical across every changed
  file at `/home/user/.codex-worktrees/solomon-website-player-ready-spectator-20260827-root`
  and `/Users/jarrett/codex-acceptance/player-ready-spectator-20260827/website`.
  The final exact-manifest Mac gate passed: zero-warning/error backend Release
  build and `24/24` Website/backend contracts; lint/import/generated checks;
  `1,627/1,627` broad Boneyard/game tests; `77/77` ML tests; every remaining
  frontend/desktop group; production frontend/game-host builds; media policy;
  and bundle budget (`470,995` raw / `131,681` gzip against `524,288` /
  `134,144`). This receipt is the sole post-validation documentation write; no
  runtime, test, build, or browser source byte changed after the gate.
- Publication rebase receipt: the candidate was rebased over deployment owner
  `cf3ffcb0238fe2c5bd9a9176b504b6772d7b121c`; local and clean Mac trees matched
  exactly at tree `cf2729166835a5236d0407e30a2217df9679e9c2`. The rebased Mac
  worktree `/Users/jarrett/codex-acceptance/player-ready-spectator-20260827-rebased/website`
  repeated the complete gate with the same counts and budget. Its real
  three-human readiness/pause journey resumed at tick `1921`; active-party
  rejoin held tick `992`, resumed at `1033`, resolved offer sequences
  `[4,6,8,10,12,14,16,18]`, and advanced save revision `2 -> 22`. All page,
  console, failed-response, failed-request, and host-error arrays were empty.
  Rebased waiting/catch-up frame SHA-256 values are
  `558fb172267861bdcff86f65bb23616392ca92c745eca3e9a945b57b020c3f6e`
  and `488b153097d4041a9e494978ee251976216913fb6f415d8477f9ed12af25d70b`.
- Final integration receipt: native-save portability advanced `main` through
  `3917405bb2c4e4e61d3bb1fbd058c18d19158291`, so the readiness wire moved to
  protocol 87 while preserving the landed protocol-86 save semantics. Local
  and clean Mac source trees matched at
  `e3f4a704eb25bf4e8c51d3a3b506e64e1f464360`; the Mac worktree
  `/Users/jarrett/codex-acceptance/player-ready-spectator-20260827-final/website`
  passed the complete canonical gate, including the combined save/readiness
  protocol, all backend/frontend/desktop groups, production builds, media
  policy, and bundle budget (`Game-BBcaEQii.js`, `476,425` raw / `133,251`
  gzip). Final readiness/pause resumed at tick `1897`; active-party rejoin held
  `1003`, resumed `1042`, resolved `[4,6,8,10,12,14,16,18]`, and advanced save
  revision `2 -> 22`. All relevant error arrays were empty. Final waiting and
  catch-up frame hashes are
  `f7cec241ed989109419855d1660f53cba5e0da1ec95a8c1f91f8e97651348962`
  and `f275fcf404ff63cf2be4f655ab80a6c09e915e51fdf33f3061e5e991cf14bdb2`.
